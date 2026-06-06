import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import type { Env } from '../../env.js';
import type { MediatorRepository } from '../../database/mediatorRepository.js';
import { logger } from '../../utils/logger.js';

export interface AuthenticatedRequest extends Request {
  auth?: {
    discordId: string;
    username: string;
    token: string;
    jti: string;
  };
  requestId?: string;
}

export interface VerificationToken {
  token: string;
  jtiHash: string;
  expiresAt: Date;
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return (raw?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown').slice(0, 80);
}

export function securityLog(event: string, req: Request, discordId?: string): void {
  logger.warn('Security event', {
    event,
    requestId: (req as AuthenticatedRequest).requestId,
    ipAddress: getClientIp(req),
    discordId,
    method: req.method,
    path: req.path,
  });
}

export function sanitize(input: string): string {
  return input
    .trim()
    .replace(/[<>&"'`;=(){}\[\]\\\/]/g, '')
    .slice(0, 120);
}

export function normalizePhone(input: string): string {
  return input.replace(/[\s.\-]/g, '');
}

export function validatePhone(input: string): boolean {
  const normalized = normalizePhone(input);
  if (!/^\+[1-9]\d{6,14}$/.test(normalized)) return false;
  const testNumbers = new Set(['+10000000000', '+11111111111', '+1234567890', '+966500000000']);
  return !testNumbers.has(normalized);
}

export function keyedHash(value: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(value).digest('hex');
}

export function encryptPrivateData(value: string, secret: string): string {
  const key = crypto.createHash('sha256').update(secret).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return ['v1', iv.toString('base64url'), authTag.toString('base64url'), encrypted.toString('base64url')].join('.');
}

export function decryptPrivateData(value: string | null | undefined, secret: string): string | null {
  if (!value) return null;
  try {
    const [version, ivEncoded, authTagEncoded, encryptedEncoded] = value.split('.');
    if (version !== 'v1' || !ivEncoded || !authTagEncoded || !encryptedEncoded) return null;
    const key = crypto.createHash('sha256').update(secret).digest();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivEncoded, 'base64url'));
    decipher.setAuthTag(Buffer.from(authTagEncoded, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedEncoded, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    return null;
  }
}

export function hashPhoneLookup(phoneNumber: string, secret: string): string {
  return keyedHash(normalizePhone(phoneNumber), secret);
}

export function hashJti(jti: string, secret: string): string {
  return keyedHash(jti, secret);
}

export function generateOtp(): string {
  return String(crypto.randomInt(100000, 1000000));
}

export function createVerificationToken(
  input: { discordId: string; username: string },
  secret: string,
): VerificationToken {
  const jti = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
  const token = jwt.sign(
    {
      sub: input.discordId,
      username: input.username,
      jti,
    },
    secret,
    { expiresIn: '2h', algorithm: 'HS512' },
  );

  return {
    token,
    jtiHash: hashJti(jti, secret),
    expiresAt,
  };
}

export function createCsrfToken(jti: string, secret: string): string {
  const nonce = crypto.randomBytes(32).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(`${jti}.${nonce}`).digest('base64url');
  return `${nonce}.${signature}`;
}

export function validateCsrfToken(token: string, jti: string, secret: string): boolean {
  const [nonce, providedSignature] = token.split('.');
  if (!nonce || !providedSignature) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${jti}.${nonce}`).digest('base64url');
  const providedBuffer = Buffer.from(providedSignature);
  const expectedBuffer = Buffer.from(expected);
  return providedBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(providedBuffer, expectedBuffer);
}

function readCookie(req: Request, name: string): string | undefined {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return undefined;
  const prefix = `${name}=`;
  const match = cookieHeader.split(';').map((part) => part.trim()).find((part) => part.startsWith(prefix));
  return match ? decodeURIComponent(match.slice(prefix.length)) : undefined;
}

export function buildSecurityMiddleware(env: Env) {
  const websiteUrl = env.WEBSITE_URL || 'https://stb-arab.vercel.app';
  const sessionSecret = env.SESSION_SECRET;
  if (!sessionSecret) throw new Error('SESSION_SECRET is required');

  const helmetMiddleware = helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", 'https://fonts.googleapis.com', 'https://cdnjs.cloudflare.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'https://cdnjs.cloudflare.com'],
        connectSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https://cdn.discordapp.com'],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    noSniff: true,
    frameguard: { action: 'deny' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    permittedCrossDomainPolicies: { permittedPolicies: 'none' },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'same-site' },
  });

  const corsMiddleware = cors({
    origin: websiteUrl.replace(/\/$/, ''),
    credentials: true,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'X-Request-ID', 'X-CSRF-Token', 'Authorization'],
  });

  const rateLimitHandler = (event: string) => (req: Request, res: Response): void => {
    securityLog(event, req, (req as AuthenticatedRequest).auth?.discordId);
    res.status(429).json({ error: true, message: 'طلبات كثيرة، حاول لاحقاً.' });
  };

  const globalRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: true,
    legacyHeaders: false,
    handler: rateLimitHandler('GLOBAL_RATE_LIMITED'),
  });

  const sendOtpRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 3,
    skipSuccessfulRequests: false,
    standardHeaders: true,
    legacyHeaders: false,
    handler: rateLimitHandler('OTP_SEND_RATE_LIMITED'),
  });

  const verifyOtpRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    handler: rateLimitHandler('OTP_VERIFY_RATE_LIMITED'),
  });

  const discordRateLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      securityLog('DISCORD_OAUTH_RATE_LIMITED', req);
      res.status(429).type('text/plain').send('طلبات كثيرة، حاول لاحقاً.');
    },
  });

  const requestIdMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const requestId = String(req.headers['x-request-id'] || crypto.randomUUID()).slice(0, 80);
    const startedAt = process.hrtime.bigint();
    req.requestId = requestId;
    res.setHeader('X-Request-ID', requestId);
    const originalWriteHead = res.writeHead.bind(res);
    res.writeHead = ((...args: Parameters<Response['writeHead']>) => {
      const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      if (!res.headersSent) res.setHeader('X-Response-Time', `${elapsedMs.toFixed(2)}ms`);
      return originalWriteHead(...args);
    }) as Response['writeHead'];
    next();
  };

  const noStoreAuthRoutes = (req: Request, res: Response, next: NextFunction): void => {
    if (req.path.startsWith('/auth/') || req.path.startsWith('/api/')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
    }
    next();
  };

  const validateJsonContentType = (req: Request, res: Response, next: NextFunction): void => {
    if (req.method === 'POST' && !req.is('application/json')) {
      securityLog('INVALID_CONTENT_TYPE', req);
      res.status(415).json({ error: true, message: 'نوع الطلب غير صحيح.' });
      return;
    }
    next();
  };

  const sanitizeInputs = (req: Request, _res: Response, next: NextFunction): void => {
    if (req.body && typeof req.body === 'object') {
      for (const [key, value] of Object.entries(req.body)) {
        if (typeof value === 'string') req.body[key] = sanitize(value);
      }
    }
    next();
  };

  return {
    helmetMiddleware,
    corsMiddleware,
    globalRateLimiter,
    sendOtpRateLimiter,
    verifyOtpRateLimiter,
    discordRateLimiter,
    requestIdMiddleware,
    noStoreAuthRoutes,
    validateJsonContentType,
    sanitizeInputs,
  };
}

export function buildJwtAuthMiddleware(env: Env, repository: MediatorRepository, optional = false) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length).trim()
      : readCookie(req, '__Host-verify_token');

    if (!token) {
      if (optional) {
        next();
        return;
      }
      securityLog('JWT_MISSING', req);
      res.status(401).json({ error: true, message: 'جلسة التحقق غير صالحة.' });
      return;
    }

    try {
      const secret = env.JWT_SECRET;
      if (!secret) throw new Error('JWT_SECRET is required');
      const decoded = jwt.verify(token, secret, { algorithms: ['HS512'] }) as JwtPayload;
      const discordId = typeof decoded.sub === 'string' ? decoded.sub : '';
      const username = typeof decoded.username === 'string' ? decoded.username : '';
      const jti = typeof decoded.jti === 'string' ? decoded.jti : '';
      if (!discordId || !username || !jti) throw new Error('Invalid JWT payload');

      const dbUser = await repository.getUserByJtiHash(hashJti(jti, secret));
      if (!dbUser || dbUser.discord_id !== discordId) throw new Error('Revoked JWT');

      req.auth = { discordId, username, token, jti };
      next();
    } catch {
      if (optional) {
        next();
        return;
      }
      securityLog('JWT_INVALID', req);
      res.status(401).json({ error: true, message: 'جلسة التحقق انتهت، اربط الديسكورد من جديد.' });
    }
  };
}

export function buildCsrfGuard(env: Env) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const token = String(req.headers['x-csrf-token'] || '');
    const jti = req.auth?.jti;
    const secret = env.SESSION_SECRET;
    if (!token || !jti || !secret || !validateCsrfToken(token, jti, secret)) {
      securityLog('CSRF_REJECTED', req, req.auth?.discordId);
      res.status(403).json({ error: true, message: 'تعذر التحقق من أمان الطلب، حدّث الصفحة وحاول مجدداً.' });
      return;
    }
    next();
  };
}
