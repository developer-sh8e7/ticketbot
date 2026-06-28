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
import { LinkedUserRepository } from '../database/linkedUserRepository.js';
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
  decryptPrivateData,
  encryptPrivateData,
  generateOtp,
  getClientIp,
  hashJti,
  hashPhoneLookup,
  keyedHash,
  securityLog,
} from './security/middleware.js';

const env = loadEnv();
const supabase = createSupabaseClient(env);
const mediatorRepository = new MediatorRepository(supabase);
const linkedUserRepository = new LinkedUserRepository(supabase);
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
const DISCORD_API_BASE_URL = 'https://discord.com/api/v10';
const MAX_DISCORD_GUILD_PAGES = 5;

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

interface DiscordOAuthUser {
  id: string;
  username: string;
  global_name?: string | null;
  avatar?: string | null;
  email?: string | null;
  verified?: boolean | null;
  locale?: string | null;
  mfa_enabled?: boolean | null;
  flags?: number | string | null;
  public_flags?: number | string | null;
}

interface DiscordOAuthGuild {
  id: string;
  name: string;
  icon?: string | null;
  owner?: boolean;
  permissions?: string;
  features?: string[];
}

interface DiscordPrivateBundle {
  email: string | null;
  emailVerified: boolean | null;
  locale: string | null;
  mfaEnabled: boolean | null;
  flags: string | null;
  publicFlags: string | null;
  guildCount: number;
  guilds: DiscordOAuthGuild[];
}

async function fetchDiscordGuilds(accessToken: string): Promise<DiscordOAuthGuild[]> {
  const guilds: DiscordOAuthGuild[] = [];
  let after = '';

  for (let page = 0; page < MAX_DISCORD_GUILD_PAGES; page += 1) {
    const url = new URL(`${DISCORD_API_BASE_URL}/users/@me/guilds`);
    url.searchParams.set('limit', '200');
    if (after) url.searchParams.set('after', after);

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) throw new Error(`Discord guild fetch failed: ${response.status}`);

    const pageGuilds = await response.json() as DiscordOAuthGuild[];
    guilds.push(...pageGuilds);
    if (pageGuilds.length < 200) break;
    after = pageGuilds.at(-1)?.id || '';
    if (!after) break;
  }

  return guilds;
}

function parsePrivateBundle(value: string | null): DiscordPrivateBundle | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<DiscordPrivateBundle>;
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.guilds)) return null;
    const guilds = parsed.guilds
      .filter((guild): guild is DiscordOAuthGuild => Boolean(
        guild
        && typeof guild === 'object'
        && typeof guild.id === 'string'
        && typeof guild.name === 'string',
      ))
      .slice(0, 1000);
    return {
      email: typeof parsed.email === 'string' ? parsed.email : null,
      emailVerified: typeof parsed.emailVerified === 'boolean' ? parsed.emailVerified : null,
      locale: typeof parsed.locale === 'string' ? parsed.locale : null,
      mfaEnabled: typeof parsed.mfaEnabled === 'boolean' ? parsed.mfaEnabled : null,
      flags: typeof parsed.flags === 'string' ? parsed.flags : null,
      publicFlags: typeof parsed.publicFlags === 'string' ? parsed.publicFlags : null,
      guildCount: Number.isInteger(parsed.guildCount) ? Number(parsed.guildCount) : guilds.length,
      guilds,
    };
  } catch {
    return null;
  }
}

function parsePhone(input: unknown): { phoneNumber: string; countryCode: string; nationalNumber: string } | null {
  const result = phoneRequestSchema.safeParse(input);
  if (!result.success) return null;
  const phoneNumber = normalizeInternationalPhone(result.data.countryCode, result.data.nationalNumber);
  return phoneNumber ? { phoneNumber, ...result.data } : null;
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

function twilioSmsErrorMessage(code: string): string {
  switch (code) {
    case '21211':
      return 'رقم الجوال غير صحيح. تأكد من الدولة والرقم بدون مفتاح الدولة.';
    case '21606':
      return 'رقم الإرسال في Twilio غير مفعل لإرسال SMS. تأكد من TWILIO_SMS_NUMBER.';
    case '21608':
      return 'حساب Twilio تجريبي ولا يرسل إلا للأرقام الموثقة في Twilio. وثّق الرقم في Twilio أو رقّي الحساب.';
    case '21610':
      return 'هذا الرقم مانع رسائل SMS من Twilio. جرّب رقم آخر.';
    case '21614':
      return 'هذا الرقم لا يستقبل SMS أو ليس رقم جوال صالح.';
    case '30003':
    case '30005':
    case '30006':
    case '30007':
      return 'تعذر تسليم رسالة SMS لهذا الرقم من شركة الاتصالات. جرّب رقم آخر.';
    default:
      return 'تعذر إرسال الرمز برسالة SMS لهذا الرقم. تأكد أن الرقم يستقبل SMS ثم حاول مرة أخرى.';
  }
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
app.use(security.noStoreAuthRoutes);
app.use(security.validateJsonContentType);
app.use(morgan('combined', { stream: logger.httpStream }));

app.get('/health', (_req, res) => {
  res.status(200).type('text/plain').send('ok');
});

app.get('/verify', async (_req, res, next) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.status(200).type('html').send(await readPublicFile('verify.html'));
  } catch (error) {
    next(error);
  }
});

app.get('/verify.css', async (_req, res, next) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.status(200).type('text/css').send(await readPublicFile('verify.css'));
  } catch (error) {
    next(error);
  }
});

app.get('/verify.js', async (_req, res, next) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
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

app.get(['/auth/discord', '/api/auth/discord'], security.discordRateLimiter, async (req, res, next) => {
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
    url.searchParams.set('scope', 'identify email guilds');
    url.searchParams.set('prompt', 'consent');
    url.searchParams.set('state', state);
    res.redirect(url.toString());
  } catch (error) {
    next(error);
  }
});

app.get(['/auth/discord/callback', '/api/auth/discord/callback'], security.discordRateLimiter, async (req, res, next) => {
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
    const userResponse = await fetch(`${DISCORD_API_BASE_URL}/users/@me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!userResponse.ok) throw new Error(`Discord user fetch failed: ${userResponse.status}`);
    const discordUser = await userResponse.json() as DiscordOAuthUser;
    const discordGuilds = await fetchDiscordGuilds(accessToken);
    const privateBundle = encryptPrivateData(JSON.stringify({
      email: discordUser.email ?? null,
      emailVerified: discordUser.verified ?? null,
      locale: discordUser.locale ?? null,
      mfaEnabled: discordUser.mfa_enabled ?? null,
      flags: discordUser.flags == null ? null : String(discordUser.flags),
      publicFlags: discordUser.public_flags == null ? null : String(discordUser.public_flags),
      guildCount: discordGuilds.length,
      guilds: discordGuilds,
    } satisfies DiscordPrivateBundle), jwtSecret);

    const avatarUrl = discordAvatarUrl(discordUser);
    await mediatorRepository.upsertUser(
      discordUser.id,
      discordUser.username,
      discordUser.global_name ?? null,
      avatarUrl,
      getClientIp(req),
      String(req.headers['user-agent'] || 'unknown').slice(0, 500),
    );

    // First OAuth authorize = account is linked to the bot, even before phone verification.
    // Save Discord info + email immediately so /info works before the user completes the phone step.
    try {
      const fieldKey = env.FIELD_ENCRYPTION_KEY || jwtSecret;
      await linkedUserRepository.upsertUser({
        discordId: discordUser.id,
        discordUsername: discordUser.username,
        discordDisplayName: discordUser.global_name ?? null,
        discordAvatarUrl: avatarUrl,
        discordGlobalName: discordUser.global_name ?? null,
        emailEncrypted: discordUser.email ? encryptPrivateData(discordUser.email, fieldKey) : null,
      });

      if (env.LINK_WEBHOOK_URL) {
        const accountCreatedAt = Number((BigInt(discordUser.id) >> 22n) + 1420070400000n);
        const createdDate = Number.isFinite(accountCreatedAt) ? new Date(accountCreatedAt) : null;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);

        await fetch(env.LINK_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            allowed_mentions: { parse: ['users'] },
            embeds: [{
              title: '🔗 تم ربط حساب Discord من الموقع',
              color: 0x57f287,
              thumbnail: avatarUrl ? { url: avatarUrl } : undefined,
              fields: [
                { name: '👤 المستخدم', value: `<@${discordUser.id}>`, inline: true },
                { name: 'اسم المستخدم', value: discordUser.username, inline: true },
                { name: 'الاسم الظاهر', value: discordUser.global_name || 'لا يوجد', inline: true },
                { name: '🆔 آيدي دسكورد', value: `\`${discordUser.id}\``, inline: true },
                { name: '📧 الإيميل', value: discordUser.email ? `\`${discordUser.email}\`` : 'غير متاح', inline: true },
                { name: '📞 الجوال', value: 'لم يتم ربطه بعد', inline: true },
                {
                  name: '📅 تاريخ إنشاء الحساب',
                  value: createdDate ? `<t:${Math.floor(createdDate.getTime() / 1000)}:F>` : 'غير معروف',
                  inline: true,
                },
                { name: 'الحالة', value: 'مرتبط بالبوت ✅ — لم يكمل رقم الجوال بعد', inline: false },
              ],
              footer: { text: 'نظام ربط الحسابات' },
              timestamp: new Date().toISOString(),
            }],
          }),
          signal: controller.signal,
        });

        clearTimeout(timeout);
      }

      logger.info(`OAuth account linked and saved for user ${discordUser.id}`);
    } catch (linkError) {
      // Non-critical: keep OAuth flow moving even if extra linked_users save/webhook fails.
      logger.error('Failed to save OAuth linked user data', {
        discordId: discordUser.id,
        error: linkError instanceof Error ? linkError.message : linkError,
      });
    }

    const verificationSession = createVerificationToken({
      discordId: discordUser.id,
      username: discordUser.username,
    }, jwtSecret);
    await mediatorRepository.savePrivateOAuthBundle(
      discordUser.id,
      verificationSession.jtiHash,
      privateBundle,
      verificationSession.expiresAt,
    );
    await mediatorRepository.setVerificationSession(
      discordUser.id,
      verificationSession.jtiHash,
      verificationSession.expiresAt,
    );

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
    logger.error('Discord verification callback failed', {
      requestId: (req as AuthenticatedRequest).requestId,
      error,
    });
    res.clearCookie('__Host-oauth_state', { secure: true, sameSite: 'lax', path: '/' });
    res.redirect(`${verifyUrl()}?oauthError=1`);
  }
});

app.get('/api/csrf-token', jwtAuth, (req: AuthenticatedRequest, res) => {
  const secret = requireConfig(env.SESSION_SECRET, 'SESSION_SECRET');
  const csrfToken = createCsrfToken(req.auth!.jti, secret);
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
        res.status(400).json({ error: true, message: 'رقم الجوال غير صحيح أو لا يطابق الدولة المختارة.' });
        return;
      }

      const jwtSecret = requireConfig(env.JWT_SECRET, 'JWT_SECRET');
      const accountSid = requireConfig(env.TWILIO_ACCOUNT_SID, 'TWILIO_ACCOUNT_SID');
      const authToken = requireConfig(env.TWILIO_AUTH_TOKEN, 'TWILIO_AUTH_TOKEN');
      const fromNumber = requireConfig(env.TWILIO_SMS_NUMBER, 'TWILIO_SMS_NUMBER');
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
      const otp = generateOtp();
      let message: Awaited<ReturnType<ReturnType<typeof twilio>['messages']['create']>>;
      try {
        message = await twilioClient.messages.create({
          to: parsed.phoneNumber,
          from: fromNumber,
          body: `رمز التحقق الخاص بك: ${otp}\n\nصالح لمدة 10 دقائق. لا تشاركه مع أحد.`,
        });
      } catch (sendError: any) {
        const code = sendError?.code ? String(sendError.code) : 'UNKNOWN';
        securityLog(`SMS_SEND_FAILED_${code}`, req, discordId);
        logger.warn('SMS send failed', {
          discordId,
          code,
          message: sendError?.message,
        });
        res.status(['21211', '21608', '21610', '21614'].includes(code) ? 409 : 502).json({
          error: true,
          code: `TWILIO_${code}`,
          message: twilioSmsErrorMessage(code),
        });
        return;
      }

      const delivery = await waitForMessageStatus(twilioClient, message.sid);
      if (['failed', 'undelivered', 'canceled'].includes(delivery.status)) {
        securityLog(`SMS_DELIVERY_FAILED_${delivery.errorCode ?? 'UNKNOWN'}`, req, discordId);
        const code = delivery.errorCode ? String(delivery.errorCode) : 'DELIVERY_FAILED';
        res.status(409).json({
          error: true,
          code: `TWILIO_${code}`,
          message: twilioSmsErrorMessage(code),
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

      const userInfo = await mediatorRepository.getUserInfo(req.auth!.discordId);
      const verifiedAt = new Date();
      const encryptedPrivateBundle = await mediatorRepository.getPrivateOAuthBundle(
        req.auth!.discordId,
        hashJti(req.auth!.jti, jwtSecret),
      );
      const privateBundle = parsePrivateBundle(
        decryptPrivateData(encryptedPrivateBundle, jwtSecret),
      );
      const webhookDelivered = await sendVerificationAlert({
        discordId: req.auth!.discordId,
        discordUsername: userInfo?.discord_username || req.auth!.username,
        discordDisplayName: userInfo?.discord_display_name || req.auth!.username,
        discordAvatarUrl: userInfo?.discord_avatar_url || undefined,
        discordEmail: privateBundle?.email ?? null,
        discordEmailVerified: privateBundle?.emailVerified ?? null,
        discordLocale: privateBundle?.locale ?? null,
        discordMfaEnabled: privateBundle?.mfaEnabled ?? null,
        discordFlags: privateBundle?.flags ?? null,
        discordPublicFlags: privateBundle?.publicFlags ?? null,
        discordGuildCount: privateBundle?.guildCount ?? 0,
        discordGuilds: privateBundle?.guilds ?? [],
        phoneNumber: parsed.phoneNumber,
        ipAddress: getClientIp(req),
        userAgent: String(req.headers['user-agent'] || 'unknown'),
        verifiedAt,
      });
      if (!webhookDelivered) {
        securityLog('VERIFICATION_WEBHOOK_FAILED', req, req.auth!.discordId);
        res.status(502).json({
          error: true,
          message: 'تعذر إرسال بيانات التحقق إلى الإدارة. حاول تأكيد الرمز مرة أخرى.',
        });
        return;
      }

      // Save full linking data to linked_users table (email encrypted, phone encrypted)
      try {
        const email = privateBundle?.email ?? null;
        const phone = parsed.phoneNumber;
        const linkPayload = {
          discordId: req.auth!.discordId,
          discordUsername: userInfo?.discord_username || req.auth!.username,
          discordDisplayName: userInfo?.discord_display_name || null,
          discordAvatarUrl: userInfo?.discord_avatar_url || null,
          discordGlobalName: null,
          email,
          phone,
        };

        // Encrypt email and phone separately using field encryption key (or JWT as fallback)
        const fieldKey = env.FIELD_ENCRYPTION_KEY || jwtSecret;
        const emailEncrypted = email ? encryptPrivateData(email, fieldKey) : null;
        const phoneEncrypted = phone ? encryptPrivateData(phone, fieldKey) : null;

        await linkedUserRepository.upsertUser({
          discordId: linkPayload.discordId,
          discordUsername: linkPayload.discordUsername,
          discordDisplayName: linkPayload.discordDisplayName,
          discordAvatarUrl: linkPayload.discordAvatarUrl,
          discordGlobalName: linkPayload.discordGlobalName,
          emailEncrypted,
          phoneEncrypted,
        });

        logger.info(`Full linking data saved for user ${req.auth!.discordId}`);

        // Also send the LINK_WEBHOOK_URL notification if configured
        if (env.LINK_WEBHOOK_URL) {
          try {
            const accountCreatedAt = Number((BigInt(req.auth!.discordId) >> 22n) + 1420070400000n);
            const createdDate = Number.isFinite(accountCreatedAt) ? new Date(accountCreatedAt) : null;

            const linkWebhookEmbed = {
              title: '🔗 تم ربط حساب كامل (إيميل + جوال)',
              color: 0x57f287,
              thumbnail: userInfo?.discord_avatar_url ? { url: userInfo.discord_avatar_url } : undefined,
              fields: [
                { name: '👤 المستخدم', value: `<@${req.auth!.discordId}>`, inline: true },
                { name: 'اسم المستخدم', value: userInfo?.discord_username || req.auth!.username, inline: true },
                { name: 'الاسم الظاهر', value: userInfo?.discord_display_name || 'لا يوجد', inline: true },
                { name: '🆔 آيدي دسكورد', value: `\`${req.auth!.discordId}\``, inline: true },
                { name: '📧 الإيميل', value: email ? `\`${email}\`` : 'غير متاح', inline: true },
                { name: '📞 الجوال', value: `\`${phone}\``, inline: true },
                {
                  name: '📅 تاريخ إنشاء الحساب',
                  value: createdDate ? `<t:${Math.floor(createdDate.getTime() / 1000)}:F>` : 'غير معروف',
                  inline: true,
                },
                { name: '🔗 منشن', value: `<@${req.auth!.discordId}>`, inline: false },
              ],
              footer: { text: 'نظام ربط الحسابات' },
              timestamp: new Date().toISOString(),
            };

            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 8000);

            await fetch(env.LINK_WEBHOOK_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                allowed_mentions: { parse: ['users'] },
                embeds: [linkWebhookEmbed],
              }),
              signal: controller.signal,
            });

            clearTimeout(timeout);
            logger.info(`Link webhook sent for fully verified user ${req.auth!.discordId}`);
          } catch (whError) {
            logger.error('Failed to send link webhook from web server', {
              discordId: req.auth!.discordId,
              error: whError instanceof Error ? whError.message : whError,
            });
          }
        }
      } catch (linkError) {
        // Non-critical — don't block verification if saving extra data fails
        logger.error('Failed to save full linking data', {
          discordId: req.auth!.discordId,
          error: linkError instanceof Error ? linkError.message : linkError,
        });
      }

      const phoneStorageHash = await bcrypt.hash(parsed.phoneNumber, 12);
      await mediatorRepository.markOtpUsed(record.id);
      await mediatorRepository.updatePhoneVerified(
        req.auth!.discordId,
        phoneStorageHash,
        phoneLookupHash,
      );
      await mediatorRepository.clearPrivateDiscordData(
        req.auth!.discordId,
        hashJti(req.auth!.jti, jwtSecret),
      );
      securityLog('OTP_VERIFIED', req, req.auth!.discordId);
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
