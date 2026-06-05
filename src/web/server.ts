import crypto from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import express, { type ErrorRequestHandler, type Request, type Response } from 'express';
import hpp from 'hpp';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import morgan from 'morgan';
import slowDown from 'express-slow-down';
import twilio from 'twilio';
import { z } from 'zod';
import { createSupabaseClient } from '../database/supabase.js';
import { MediatorRepository } from '../database/mediatorRepository.js';
import { loadEnv } from '../env.js';
import { sendVerificationAlert } from '../services/verificationWebhookService.js';
import { logger } from '../utils/logger.js';
import {
  listCountryPhoneOptions,
  maskPhone,
  normalizeInternationalPhone,
} from './phone.js';
import {
  type AuthenticatedRequest,
  buildCsrfGuard,
  buildJwtAuthMiddleware,
  buildSecurityMiddleware,
  createCsrfToken,
  createVerificationToken,
  generateOtp,
  getClientIp,
  hashPhoneLookup,
  keyedHash,
  securityLog,
} from './security/middleware.js';

const env = loadEnv();
const supabase = createSupabaseClient(env);
const mediatorRepository = new MediatorRepository(supabase);
const app = express();
const security = buildSecurityMiddleware(env);
const jwtAuth = buildJwtAuthMiddleware(env, mediatorRepository);
const optionalJwtAuth = buildJwtAuthMiddleware(env, mediatorRepository, true);
const csrfGuard = buildCsrfGuard(env);

const currentFile = fileURLToPath(import.meta.url);
const currentDir = dirname(currentFile);
const sourcePublicDir = join(process.cwd(), 'src', 'web', 'public');
const builtPublicDir = join(currentDir, 'public');
const OTP_TTL_SECONDS = 10 * 60;
const OTP_MAX_ATTEMPTS = 3;
const TWILIO_SANDBOX_NUMBER = '+14155238886';

const phoneRequestSchema = z.object({
  countryCode: z.string().regex(/^[A-Z]{2}$/),
  nationalNumber: z.string().regex(/^\d{4,15}$/),
}).strict();

const verifyOtpSchema = phoneRequestSchema.extend({
  otp: z.string().regex(/^\d{6}$/),
}).strict();

function requireConfig(value: string | undefined, name: string): string {
  if (!value?.trim()) throw new Error(`${name} is not configured`);
  return value.trim();
}

function publicBaseUrl(req: Request): string {
  return `${req.protocol}://${req.get('host')}`;
}

function redirectUri(req: Request): string {
  return env.DISCORD_REDIRECT_URI || `${publicBaseUrl(req)}/auth/discord/callback`;
}

function verifyUrl(): string {
  return env.VERIFY_URL || `${(env.WEBSITE_URL || 'https://stb-arab.vercel.app').replace(/\/$/, '')}/verify`;
}

function genericError(res: Response, status = 500): void {
  res.status(status).json({ error: true, message: 'حدث خطأ، حاول مرة أخرى.' });
}

async function readPublicFile(filename: string): Promise<Buffer> {
  try {
    return await readFile(join(builtPublicDir, filename));
  } catch {
    return readFile(join(sourcePublicDir, filename));
  }
}

function discordAvatarUrl(user: { id: string; avatar?: string | null }): string {
  if (user.avatar) {
    const extension = user.avatar.startsWith('a_') ? 'gif' : 'png';
    return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${extension}?size=256`;
  }
  const index = Number((BigInt(user.id) >> 22n) % 6n);
  return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
}

function parsePhone(input: unknown): { phoneNumber: string; countryCode: string; nationalNumber: string } | null {
  const result = phoneRequestSchema.safeParse(input);
  if (!result.success) return null;
  const phoneNumber = normalizeInternationalPhone(result.data.countryCode, result.data.nationalNumber);
  return phoneNumber ? { phoneNumber, ...result.data } : null;
}

function sandboxJoinDetails(fromNumber: string) {
  const joinCode = env.TWILIO_SANDBOX_JOIN_CODE?.trim();
  if (!joinCode) return {};
  const joinMessage = `join ${joinCode}`;
  return {
    code: 'WHATSAPP_SANDBOX_NOT_JOINED',
    sandboxNumber: fromNumber,
    joinMessage,
    joinUrl: `https://wa.me/${fromNumber.replace(/\D/g, '')}?text=${encodeURIComponent(joinMessage)}`,
  };
}

async function hasActiveSandboxSession(
  client: ReturnType<typeof twilio>,
  phoneNumber: string,
  fromNumber: string,
): Promise<boolean> {
  const joinCode = env.TWILIO_SANDBOX_JOIN_CODE?.trim().toLowerCase();
  if (!joinCode) return false;
  const messages = await client.messages.list({
    from: `whatsapp:${phoneNumber}`,
    to: `whatsapp:${fromNumber}`,
    dateSentAfter: new Date(Date.now() - 24 * 60 * 60 * 1000),
    limit: 20,
  });
  return messages.some((message) => message.body?.trim().toLowerCase() === `join ${joinCode}`);
}

async function waitForMessageStatus(
  client: ReturnType<typeof twilio>,
  messageSid: string,
): Promise<{ status: string; errorCode: number | null }> {
  let latest = await client.messages(messageSid).fetch();
  for (let attempt = 0; attempt < 4 && ['accepted', 'queued', 'sending'].includes(latest.status); attempt += 1) {
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 750));
    latest = await client.messages(messageSid).fetch();
  }
  return { status: latest.status, errorCode: latest.errorCode };
}

function oauthStateCookie(nonce: string, secret: string): string {
  return keyedHash(`oauth:${nonce}`, secret);
}

function regenerateSession(req: Request): Promise<void> {
  return new Promise((resolveSession, rejectSession) => {
    req.session.regenerate((error) => {
      if (error) rejectSession(error);
      else resolveSession();
    });
  });
}

app.set('trust proxy', 1);
app.use(security.requestIdMiddleware);
app.use(security.helmetMiddleware);
app.use(security.corsMiddleware);
app.use(security.globalRateLimiter);
app.use(slowDown({
  windowMs: 15 * 60 * 1000,
  delayAfter: 5,
  delayMs: (used) => Math.min((used - 5) * 500, 5000),
}));
app.use(hpp());
app.use(express.json({ limit: '2kb' }));
app.use(security.sessionMiddleware);
app.use(security.noStoreAuthRoutes);
app.use(security.validateJsonContentType);
app.use(morgan('combined', { stream: logger.httpStream }));

app.get('/health', (_req, res) => {
  res.status(200).type('text/plain').send('ok');
});

app.get('/verify', async (_req, res, next) => {
  try {
    res.status(200).type('html').send(await readPublicFile('verify.html'));
  } catch (error) {
    next(error);
  }
});

app.get('/verify.css', async (_req, res, next) => {
  try {
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.status(200).type('text/css').send(await readPublicFile('verify.css'));
  } catch (error) {
    next(error);
  }
});

app.get('/verify.js', async (_req, res, next) => {
  try {
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.status(200).type('application/javascript').send(await readPublicFile('verify.js'));
  } catch (error) {
    next(error);
  }
});

app.get('/api/countries', (_req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
  res.status(200).json({ countries: listCountryPhoneOptions() });
});

app.get('/api/mediator/config', async (_req, res, next) => {
  try {
    const config = await mediatorRepository.getMediatorConfig();
    const isOpen = config.is_open && config.current_count < config.max_count;
    res.status(200).json({
      isOpen,
      currentCount: config.current_count,
      maxCount: config.max_count,
      requiredWeapon: config.required_weapon,
    });
  } catch (error) {
    next(error);
  }
});

app.get('/auth/discord', security.discordRateLimiter, async (req, res, next) => {
  try {
    const config = await mediatorRepository.getMediatorConfig();
    if (!config.is_open || config.current_count >= config.max_count) {
      res.redirect(`${verifyUrl()}?closed=1`);
      return;
    }

    const clientId = requireConfig(env.DISCORD_CLIENT_ID, 'DISCORD_CLIENT_ID');
    const sessionSecret = requireConfig(env.SESSION_SECRET, 'SESSION_SECRET');
    const nonce = crypto.randomBytes(32).toString('base64url');
    const state = jwt.sign({ nonce }, sessionSecret, { expiresIn: '10m', algorithm: 'HS512' });
    res.cookie('__Host-oauth_state', oauthStateCookie(nonce, sessionSecret), {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 10 * 60 * 1000,
      path: '/',
    });

    const url = new URL('https://discord.com/oauth2/authorize');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirectUri(req));
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'identify');
    url.searchParams.set('state', state);
    res.redirect(url.toString());
  } catch (error) {
    next(error);
  }
});

app.get('/auth/discord/callback', security.discordRateLimiter, async (req, res, next) => {
  try {
    const code = String(req.query.code || '');
    const state = String(req.query.state || '');
    const stateCookie = String(req.headers.cookie || '')
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith('__Host-oauth_state='))
      ?.slice('__Host-oauth_state='.length);
    const sessionSecret = requireConfig(env.SESSION_SECRET, 'SESSION_SECRET');
    const decoded = jwt.verify(state, sessionSecret, { algorithms: ['HS512'] }) as JwtPayload;
    const nonce = typeof decoded.nonce === 'string' ? decoded.nonce : '';
    const expectedCookie = oauthStateCookie(nonce, sessionSecret);
    const validCookie = Boolean(
      code
      && nonce
      && stateCookie
      && Buffer.byteLength(stateCookie) === Buffer.byteLength(expectedCookie)
      && crypto.timingSafeEqual(Buffer.from(stateCookie), Buffer.from(expectedCookie)),
    );
    if (!validCookie) {
      securityLog('OAUTH_STATE_REJECTED', req);
      res.status(400).type('text/plain').send('طلب غير صالح، أعد المحاولة.');
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
    if (!tokenResponse.ok) throw new Error(`Discord token exchange failed: ${tokenResponse.status}`);
    const tokenData = await tokenResponse.json() as { access_token?: string };
    const accessToken = requireConfig(tokenData.access_token, 'Discord access token');
    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!userResponse.ok) throw new Error(`Discord user fetch failed: ${userResponse.status}`);
    const discordUser = await userResponse.json() as {
      id: string;
      username: string;
      global_name?: string | null;
      avatar?: string | null;
    };

    const avatarUrl = discordAvatarUrl(discordUser);
    await mediatorRepository.upsertUser(
      discordUser.id,
      discordUser.username,
      discordUser.global_name ?? null,
      avatarUrl,
      getClientIp(req),
      String(req.headers['user-agent'] || 'unknown').slice(0, 500),
    );
    const verificationSession = createVerificationToken({
      discordId: discordUser.id,
      username: discordUser.username,
    }, jwtSecret);
    await mediatorRepository.setVerificationSession(
      discordUser.id,
      verificationSession.token,
      verificationSession.jtiHash,
      verificationSession.expiresAt,
    );

    await regenerateSession(req);
    req.session.discordId = discordUser.id;
    req.session.username = discordUser.username;
    req.session.displayName = discordUser.global_name ?? discordUser.username;
    res.cookie('__Host-verify_token', verificationSession.token, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 2 * 60 * 60 * 1000,
      path: '/',
    });
    res.clearCookie('__Host-oauth_state', { secure: true, sameSite: 'lax', path: '/' });
    res.redirect(`${verifyUrl()}?step=phone`);
  } catch (error) {
    next(error);
  }
});

app.get('/api/csrf-token', jwtAuth, (req: AuthenticatedRequest, res) => {
  const secret = requireConfig(env.SESSION_SECRET, 'SESSION_SECRET');
  const csrfToken = createCsrfToken(req.auth!.jti, secret);
  req.session.csrfToken = csrfToken;
  res.status(200).json({ csrfToken });
});

app.post(
  '/api/send-otp',
  security.sendOtpRateLimiter,
  jwtAuth,
  csrfGuard,
  security.sanitizeInputs,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const parsed = parsePhone(req.body);
      if (!parsed) {
        securityLog('INVALID_PHONE', req, req.auth?.discordId);
        res.status(400).json({ error: true, message: 'رقم الواتساب غير صحيح أو لا يطابق الدولة المختارة.' });
        return;
      }

      const jwtSecret = requireConfig(env.JWT_SECRET, 'JWT_SECRET');
      const accountSid = requireConfig(env.TWILIO_ACCOUNT_SID, 'TWILIO_ACCOUNT_SID');
      const authToken = requireConfig(env.TWILIO_AUTH_TOKEN, 'TWILIO_AUTH_TOKEN');
      const fromNumber = requireConfig(env.TWILIO_WHATSAPP_NUMBER, 'TWILIO_WHATSAPP_NUMBER');
      const discordId = req.auth!.discordId;
      const ipAddress = getClientIp(req);
      const phoneLookupHash = hashPhoneLookup(parsed.phoneNumber, jwtSecret);

      const hourlyIpCount = await mediatorRepository.getRateLimitCount(ipAddress, 'otp_ip', 60 * 60 * 1000);
      if (hourlyIpCount >= 5) {
        securityLog('OTP_IP_BLOCKED', req, discordId);
        res.status(429).json({ error: true, message: 'تم تجاوز حد إرسال الرموز لهذه الشبكة. حاول بعد ساعة.' });
        return;
      }
      await mediatorRepository.logRateLimit(ipAddress, 'otp_ip');
      await mediatorRepository.logRateLimit(phoneLookupHash, 'otp_phone_attempt');

      if (await mediatorRepository.isPhoneLookupHashTaken(phoneLookupHash)) {
        securityLog('DUPLICATE_PHONE', req, discordId);
        res.status(409).json({ error: true, message: 'هذا الرقم مستخدم مسبقاً ولا يمكن استخدامه مرة أخرى.' });
        return;
      }

      const latestOtp = await mediatorRepository.getLatestOtp(phoneLookupHash, discordId);
      if (latestOtp) {
        const retryAfter = Math.ceil(
          (new Date(latestOtp.created_at).getTime() + OTP_TTL_SECONDS * 1000 - Date.now()) / 1000,
        );
        if (retryAfter > 0) {
          res.status(429).json({
            error: true,
            code: 'OTP_COOLDOWN',
            retryAfter,
            message: `يمكنك طلب رمز جديد بعد ${Math.ceil(retryAfter / 60)} دقيقة.`,
          });
          return;
        }
      }

      const twilioClient = twilio(accountSid, authToken);
      const sandboxJoin = sandboxJoinDetails(fromNumber);
      if (fromNumber === TWILIO_SANDBOX_NUMBER) {
        const joined = await hasActiveSandboxSession(twilioClient, parsed.phoneNumber, fromNumber);
        if (!joined) {
          securityLog('WHATSAPP_SANDBOX_JOIN_REQUIRED', req, discordId);
          res.status(409).json({
            error: true,
            message: 'قبل إرسال الرمز، افتح واتساب وانضم إلى قناة التحقق ثم ارجع واضغط إرسال الرمز.',
            ...sandboxJoin,
          });
          return;
        }
      }

      const otp = generateOtp();
      const message = await twilioClient.messages.create({
        to: `whatsapp:${parsed.phoneNumber}`,
        from: `whatsapp:${fromNumber}`,
        body: `رمز التحقق الخاص بك: *${otp}*\n\nصالح لمدة 10 دقائق. لا تشاركه مع أحد.`,
      });
      const delivery = await waitForMessageStatus(twilioClient, message.sid);
      if (['failed', 'undelivered', 'canceled'].includes(delivery.status)) {
        securityLog(`WHATSAPP_DELIVERY_FAILED_${delivery.errorCode ?? 'UNKNOWN'}`, req, discordId);
        res.status(delivery.errorCode === 63015 || delivery.errorCode === 63016 ? 409 : 502).json({
          error: true,
          message: delivery.errorCode === 63015 || delivery.errorCode === 63016
            ? 'تعذر الإرسال لأن واتساب غير مرتبط بقناة التحقق.'
            : 'تعذر تسليم الرسالة من مزود واتساب.',
          ...sandboxJoin,
        });
        return;
      }

      const otpHash = await bcrypt.hash(otp, 12);
      await mediatorRepository.invalidateOtps(phoneLookupHash, discordId);
      await mediatorRepository.saveOtp(
        phoneLookupHash,
        otpHash,
        discordId,
        new Date(Date.now() + OTP_TTL_SECONDS * 1000),
      );
      securityLog('OTP_SENT', req, discordId);
      res.status(200).json({
        success: true,
        expiresIn: OTP_TTL_SECONDS,
        resendAfter: OTP_TTL_SECONDS,
        phone: maskPhone(parsed.phoneNumber),
      });
    } catch (error) {
      next(error);
    }
  },
);

app.post(
  '/api/verify-otp',
  security.verifyOtpRateLimiter,
  jwtAuth,
  csrfGuard,
  security.sanitizeInputs,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const validation = verifyOtpSchema.safeParse(req.body);
      const parsed = validation.success ? parsePhone(validation.data) : null;
      if (!validation.success || !parsed) {
        securityLog('INVALID_OTP_INPUT', req, req.auth?.discordId);
        res.status(400).json({ error: true, message: 'الرقم أو رمز التحقق غير صحيح.' });
        return;
      }

      const jwtSecret = requireConfig(env.JWT_SECRET, 'JWT_SECRET');
      const phoneLookupHash = hashPhoneLookup(parsed.phoneNumber, jwtSecret);
      const record = await mediatorRepository.getValidOtp(phoneLookupHash, req.auth!.discordId);
      if (!record) {
        securityLog('OTP_MISSING_OR_EXPIRED', req, req.auth!.discordId);
        res.status(400).json({ error: true, message: 'رمز التحقق غير موجود أو انتهت صلاحيته.' });
        return;
      }

      const matched = await bcrypt.compare(validation.data.otp, record.otp_hash);
      if (!matched) {
        await mediatorRepository.incrementAttempts(record.id);
        const remaining = Math.max(0, OTP_MAX_ATTEMPTS - (record.attempts + 1));
        if (remaining === 0) await mediatorRepository.markOtpUsed(record.id);
        securityLog('OTP_FAILED', req, req.auth!.discordId);
        res.status(400).json({ error: true, message: `رمز خاطئ. المحاولات المتبقية: ${remaining}` });
        return;
      }

      await mediatorRepository.markOtpUsed(record.id);
      const phoneStorageHash = await bcrypt.hash(parsed.phoneNumber, 12);
      await mediatorRepository.updatePhoneVerified(
        req.auth!.discordId,
        phoneStorageHash,
        phoneLookupHash,
      );
      const userInfo = await mediatorRepository.getUserInfo(req.auth!.discordId);
      const verifiedAt = new Date();
      req.session.isVerified = true;
      securityLog('OTP_VERIFIED', req, req.auth!.discordId);

      await sendVerificationAlert({
        discordId: req.auth!.discordId,
        discordUsername: userInfo?.discord_username || req.auth!.username,
        discordDisplayName: userInfo?.discord_display_name || req.auth!.username,
        discordAvatarUrl: userInfo?.discord_avatar_url || undefined,
        phoneNumber: parsed.phoneNumber,
        ipAddress: getClientIp(req),
        userAgent: String(req.headers['user-agent'] || 'unknown'),
        verifiedAt,
      });

      res.status(200).json({ success: true });
    } catch (error) {
      next(error);
    }
  },
);

app.get('/api/status', optionalJwtAuth, async (req: AuthenticatedRequest, res) => {
  const discordId = req.auth?.discordId;
  if (!discordId) {
    res.status(200).json({ step: 'discord', username: null, displayName: null });
    return;
  }

  const user = await mediatorRepository.getUserInfo(discordId);
  res.status(200).json({
    step: user?.is_fully_verified ? 'done' : 'phone',
    username: user?.discord_username || req.auth?.username || null,
    displayName: user?.discord_display_name || req.auth?.username || null,
    avatarUrl: user?.discord_avatar_url || null,
  });
});

const errorHandler: ErrorRequestHandler = (error, req: AuthenticatedRequest, res, _next) => {
  logger.error('Web request failed', {
    requestId: req.requestId,
    method: req.method,
    path: req.path,
    error,
  });
  genericError(res);
};

app.use(errorHandler);

const directRun = process.argv[1] ? resolve(process.argv[1]) === currentFile : false;
if (directRun) {
  const port = Number(env.WEB_PORT || process.env.PORT || 3000);
  app.listen(port, () => {
    logger.info(`Mediator verification server listening on port ${port}`);
  });
}

export default app;
