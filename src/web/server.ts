import crypto from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import express, { type ErrorRequestHandler, type Request, type Response } from 'express';
import jwt from 'jsonwebtoken';
import twilio from 'twilio';
import { createSupabaseClient } from '../database/supabase.js';
import { MediatorRepository } from '../database/mediatorRepository.js';
import { loadEnv } from '../env.js';
import { sendVerificationAlert } from '../services/verificationWebhookService.js';
import {
  type AuthenticatedRequest,
  buildJwtAuthMiddleware,
  buildSecurityMiddleware,
  createVerificationToken,
  generateOtp,
  getClientIp,
  hashPhone,
  normalizePhone,
  securityLog,
  validatePhone,
} from './security/middleware.js';

const env = loadEnv();
const supabase = createSupabaseClient(env);
const mediatorRepository = new MediatorRepository(supabase);
const app = express();
const security = buildSecurityMiddleware(env);
const jwtAuth = buildJwtAuthMiddleware(env, mediatorRepository);
const optionalJwtAuth = buildJwtAuthMiddleware(env, mediatorRepository, true);

const currentFile = fileURLToPath(import.meta.url);
const currentDir = dirname(currentFile);
const publicIndexPath = join(currentDir, 'public', 'index.html');
const sourcePublicIndexPath = join(process.cwd(), 'src', 'web', 'public', 'index.html');

function requireConfig(value: string | undefined, name: string): string {
  if (!value?.trim()) {
    throw new Error(`${name} is not configured`);
  }
  return value.trim();
}

function publicBaseUrl(req: Request): string {
  return `${req.protocol}://${req.get('host')}`;
}

function redirectUri(req: Request): string {
  return env.DISCORD_REDIRECT_URI || `${publicBaseUrl(req)}/auth/discord/callback`;
}

function genericError(res: Response, status = 500): void {
  res.status(status).json({ error: true, message: 'حدث خطأ، حاول مرة أخرى' });
}

async function readIndexHtml(): Promise<string> {
  try {
    return await readFile(publicIndexPath, 'utf8');
  } catch {
    return readFile(sourcePublicIndexPath, 'utf8');
  }
}

app.set('trust proxy', 1);
app.use(security.helmetMiddleware);
app.use(security.corsMiddleware);
app.use(security.globalRateLimiter);
app.use(security.validateJsonContentType);
app.use(express.json({ limit: '1kb' }));
app.use(security.sessionMiddleware);
app.use(security.requestIdMiddleware);
app.use(security.securityLogger);

app.get('/health', (_req, res) => {
  res.status(200).type('text/plain').send('ok');
});

app.get('/', async (_req, res, next) => {
  try {
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).type('html').send(await readIndexHtml());
  } catch (error) {
    next(error);
  }
});

app.get(['/auth/discord', '/api/auth/discord'], security.discordRateLimiter, async (req, res) => {
  if (req.session.isVerified) {
    res.redirect('/?step=done');
    return;
  }

  const clientId = requireConfig(env.DISCORD_CLIENT_ID, 'DISCORD_CLIENT_ID');
  const sessionSecret = requireConfig(env.SESSION_SECRET, 'SESSION_SECRET');
  const state = jwt.sign(
    { nonce: crypto.randomBytes(32).toString('hex') },
    sessionSecret,
    { expiresIn: '10m', algorithm: 'HS256' },
  );
  req.session.oauthState = state;

  const url = new URL('https://discord.com/oauth2/authorize');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri(req));
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'identify');
  url.searchParams.set('state', state);
  res.redirect(url.toString());
});

app.get(['/auth/discord/callback', '/api/auth/discord/callback'], security.discordRateLimiter, async (req, res, next) => {
  try {
    const code = String(req.query.code || '');
    const state = String(req.query.state || '');

    const sessionSecret = requireConfig(env.SESSION_SECRET, 'SESSION_SECRET');
    let validState = Boolean(code && state && state === req.session.oauthState);
    if (!validState && state) {
      try {
        jwt.verify(state, sessionSecret, { algorithms: ['HS256'] });
        validState = true;
      } catch {
        validState = false;
      }
    }

    if (!code || !validState) {
      securityLog('INVALID_INPUT', req);
      res.status(400).send('طلب غير صالح، أعد المحاولة.');
      return;
    }

    const clientId = requireConfig(env.DISCORD_CLIENT_ID, 'DISCORD_CLIENT_ID');
    const clientSecret = requireConfig(env.DISCORD_CLIENT_SECRET, 'DISCORD_CLIENT_SECRET');
    const jwtSecret = requireConfig(env.JWT_SECRET, 'JWT_SECRET');

    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri(req),
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error(`Discord token exchange failed: ${tokenResponse.status}`);
    }

    const tokenData = await tokenResponse.json() as { access_token?: string };
    const accessToken = requireConfig(tokenData.access_token, 'Discord access token');
    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!userResponse.ok) {
      throw new Error(`Discord user fetch failed: ${userResponse.status}`);
    }

    const discordUser = await userResponse.json() as {
      id: string;
      username: string;
      global_name?: string | null;
    };

    const ipAddress = getClientIp(req);
    const userAgent = String(req.headers['user-agent'] || 'unknown').slice(0, 500);
    await mediatorRepository.upsertUser(discordUser.id, discordUser.username, discordUser.global_name ?? null, ipAddress, userAgent);

    const jwtToken = createVerificationToken({ discordId: discordUser.id, username: discordUser.username }, jwtSecret);
    await mediatorRepository.setVerificationToken(discordUser.id, jwtToken);

    req.session.discordId = discordUser.id;
    req.session.username = discordUser.username;
    req.session.displayName = discordUser.global_name ?? discordUser.username;
    req.session.jwtToken = jwtToken;
    req.session.oauthState = undefined;
    res.cookie('verify_token', jwtToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000,
      path: '/',
    });

    res.redirect('/?step=2');
  } catch (error) {
    next(error);
  }
});

app.post('/api/send-otp', security.sendOtpRateLimiter, jwtAuth, security.sanitizeInputs, async (req: AuthenticatedRequest, res, next) => {
  try {
    const phoneNumber = normalizePhone(String(req.body?.phoneNumber || ''));
    if (!validatePhone(phoneNumber)) {
      securityLog('INVALID_INPUT', req, req.auth?.discordId);
      res.status(400).json({ error: true, message: 'رقم الواتساب غير صحيح. اكتب الرقم بصيغة دولية مثل +966XXXXXXXXX' });
      return;
    }

    const jwtSecret = requireConfig(env.JWT_SECRET, 'JWT_SECRET');
    const accountSid = requireConfig(env.TWILIO_ACCOUNT_SID, 'TWILIO_ACCOUNT_SID');
    const authToken = requireConfig(env.TWILIO_AUTH_TOKEN, 'TWILIO_AUTH_TOKEN');
    const fromNumber = requireConfig(env.TWILIO_WHATSAPP_NUMBER, 'TWILIO_WHATSAPP_NUMBER');
    const discordId = req.auth!.discordId;
    const phoneHash = hashPhone(phoneNumber, jwtSecret);

    const otpCount = await mediatorRepository.getRateLimitCount(phoneHash, 'otp_phone', 60 * 60 * 1000);
    if (otpCount >= 3) {
      securityLog('RATE_LIMITED', req, discordId);
      res.status(429).json({ error: true, message: 'تم إرسال رموز كثيرة لهذا الرقم، حاول بعد ساعة.' });
      return;
    }

    if (await mediatorRepository.isPhoneHashTaken(phoneHash)) {
      securityLog('DUPLICATE_PHONE', req, discordId);
      res.status(409).json({ error: true, message: 'هذا الرقم مستخدم مسبقاً ولا يمكن استخدامه مرة أخرى.' });
      return;
    }

    const otp = generateOtp();
    const otpHash = await bcrypt.hash(otp, 12);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await mediatorRepository.saveOtp(phoneHash, otpHash, discordId, expiresAt);
    await mediatorRepository.logRateLimit(phoneHash, 'otp_phone');

    const twilioClient = twilio(accountSid, authToken);
    await twilioClient.messages.create({
      to: `whatsapp:${phoneNumber}`,
      from: `whatsapp:${fromNumber}`,
      body: `🔐 رمز التحقق: *${otp}*\n\nصالح 10 دقائق فقط.\n⚠️ لا تشاركه مع أحد.`,
    });

    req.session.pendingPhoneHash = phoneHash;
    req.session.pendingPhone = phoneNumber;
    securityLog('OTP_SENT', req, discordId);
    res.status(200).json({ success: true, expiresIn: 600 });
  } catch (error) {
    next(error);
  }
});

app.post('/api/verify-otp', security.verifyOtpRateLimiter, jwtAuth, security.sanitizeInputs, async (req: AuthenticatedRequest, res, next) => {
  try {
    const phoneNumber = normalizePhone(String(req.body?.phoneNumber || ''));
    const otp = String(req.body?.otp || '').trim();
    const discordId = req.auth!.discordId;

    if (!validatePhone(phoneNumber) || !/^\d{6}$/.test(otp)) {
      securityLog('INVALID_INPUT', req, discordId);
      res.status(400).json({ error: true, message: 'الرقم أو رمز التحقق غير صحيح.' });
      return;
    }

    const jwtSecret = requireConfig(env.JWT_SECRET, 'JWT_SECRET');
    const phoneHash = hashPhone(phoneNumber, jwtSecret);
    const record = await mediatorRepository.getValidOtp(phoneHash);
    if (!record) {
      securityLog('OTP_FAILED', req, discordId);
      res.status(400).json({ error: true, message: 'رمز التحقق غير موجود أو انتهت صلاحيته.' });
      return;
    }

    const matched = await bcrypt.compare(otp, record.otp_hash);
    if (!matched) {
      await mediatorRepository.incrementAttempts(record.id);
      const remaining = Math.max(0, 3 - (record.attempts + 1));
      if (remaining <= 0) {
        await mediatorRepository.markOtpUsed(record.id);
      }
      securityLog('OTP_FAILED', req, discordId);
      res.status(400).json({ error: true, message: `رمز خاطئ. المحاولات المتبقية: ${remaining}` });
      return;
    }

    await mediatorRepository.markOtpUsed(record.id);
    await mediatorRepository.updatePhoneVerified(discordId, phoneHash);
    const userInfo = await mediatorRepository.getUserInfo(discordId);
    const verifiedAt = new Date();
    req.session.isVerified = true;
    securityLog('OTP_VERIFIED', req, discordId);

    void sendVerificationAlert({
      discordId,
      discordUsername: userInfo?.discord_username || req.auth!.username,
      discordDisplayName: userInfo?.discord_display_name || req.session.displayName || req.auth!.username,
      phoneNumber,
      ipAddress: getClientIp(req),
      userAgent: String(req.headers['user-agent'] || 'unknown'),
      verifiedAt,
    });

    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
});

app.get('/api/status', optionalJwtAuth, async (req: AuthenticatedRequest, res) => {
  const discordId = req.auth?.discordId || req.session.discordId;
  if (!discordId) {
    res.status(200).json({
      step: 'discord',
      username: null,
      displayName: null,
      jwtToken: null,
    });
    return;
  }

  const user = await mediatorRepository.getUserInfo(discordId);
  const isVerified = Boolean(user?.is_fully_verified || req.session.isVerified);
  res.status(200).json({
    step: isVerified ? 'done' : 'phone',
    username: user?.discord_username || req.session.username || null,
    displayName: user?.discord_display_name || req.session.displayName || null,
    jwtToken: req.session.jwtToken || req.auth?.token || null,
  });
});

const errorHandler: ErrorRequestHandler = (error, req: AuthenticatedRequest, res, _next) => {
  console.error('[WEB_ERROR]', req.requestId || 'no-request-id', error instanceof Error ? error.stack ?? error.message : error);
  genericError(res);
};

app.use(errorHandler);

const directRun = process.argv[1] ? resolve(process.argv[1]) === currentFile : false;
if (directRun) {
  const port = Number(env.WEB_PORT || process.env.PORT || 3000);
  app.listen(port, () => {
    console.info(`[WEB] Mediator verification server listening on port ${port}`);
  });
}

export default app;
