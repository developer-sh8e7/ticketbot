import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import type { SessionOptions } from 'express-session';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import session from 'express-session';
import helmet from 'helmet';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import CryptoJS from 'crypto-js';
import type { Env } from '../../env.js';
import type { MediatorRepository } from '../../database/mediatorRepository.js';

declare module 'express-session' {
  interface SessionData {
    oauthState?: string;
    discordId?: string;
    username?: string;
    displayName?: string | null;
    jwtToken?: string;
    pendingPhoneHash?: string;
    pendingPhone?: string;
    isVerified?: boolean;
  }
}

export interface AuthenticatedRequest extends Request {
  auth?: {
    discordId: string;
    username: string;
    token: string;
  };
  requestId?: string;
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return (raw?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown').slice(0, 80);
}

export function securityLog(event: string, req: Request, discordId?: string): void {
  console.warn(`[SECURITY] ${new Date().toISOString()} ${event} ${getClientIp(req)} ${discordId ?? 'unknown'}`);
}

export function sanitize(input: string): string {
  return input
    .trim()
    .replace(/[<>"';=(){}\[\]\\\/]/g, '')
    .slice(0, 100);
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

export function hashPhone(phoneNumber: string, secret: string): string {
  return CryptoJS.HmacSHA256(normalizePhone(phoneNumber), secret).toString(CryptoJS.enc.Hex);
}

export function generateOtp(): string {
  return String(crypto.randomInt(100000, 1000000));
}

export function createVerificationToken(input: { discordId: string; username: string }, secret: string): string {
  return jwt.sign(
    {
      discordId: input.discordId,
      username: input.username,
      iat: Math.floor(Date.now() / 1000),
    },
    secret,
    { expiresIn: '24h', algorithm: 'HS512' },
  );
}

function readCookie(req: Request, name: string): string | undefined {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return undefined;
  const cookies = cookieHeader.split(';').map((part) => part.trim());
  const prefix = `${name}=`;
  const match = cookies.find((part) => part.startsWith(prefix));
  return match ? decodeURIComponent(match.slice(prefix.length)) : undefined;
}

export function buildSecurityMiddleware(env: Env) {
  const websiteUrl = env.WEBSITE_URL || 'https://stb-arab.vercel.app/';
  const sessionSecret = env.SESSION_SECRET || crypto.randomBytes(64).toString('hex');

  const helmetMiddleware = helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", 'fonts.googleapis.com'],
        styleSrc: ["'self'", "'unsafe-inline'", 'fonts.googleapis.com', 'fonts.gstatic.com'],
        fontSrc: ['fonts.gstatic.com'],
        connectSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'cdn.discordapp.com'],
        frameSrc: ["'none'"],
      },
    },
    hsts: { maxAge: 31536000, includeSubDomains: true },
    noSniff: true,
    xssFilter: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  });

  const corsMiddleware = cors({
    origin: websiteUrl.replace(/\/$/, ''),
    credentials: true,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'X-Request-ID', 'Authorization'],
  });

  const globalRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      securityLog('RATE_LIMITED', req);
      res.status(429).json({ error: true, message: 'طلبات كثيرة، حاول لاحقاً.' });
    },
  });

  const sendOtpRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 3,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      securityLog('RATE_LIMITED', req, (req as AuthenticatedRequest).auth?.discordId);
      res.status(429).json({ error: true, message: 'طلبات كثيرة، حاول بعد 15 دقيقة.' });
    },
  });

  const verifyOtpRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      securityLog('RATE_LIMITED', req, (req as AuthenticatedRequest).auth?.discordId);
      res.status(429).json({ error: true, message: 'محاولات كثيرة، حاول لاحقاً.' });
    },
  });

  const discordRateLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      securityLog('RATE_LIMITED', req);
      res.status(429).send('طلبات كثيرة، حاول لاحقاً.');
    },
  });

  const sessionOptions: SessionOptions = {
    secret: sessionSecret,
    name: '__Host-sess',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000,
      path: '/',
    },
  };

  const sessionMiddleware = session(sessionOptions);

  const requestIdMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const requestId = String(req.headers['x-request-id'] || crypto.randomUUID()).slice(0, 80);
    req.requestId = requestId;
    res.setHeader('X-Request-ID', requestId);
    next();
  };

  const securityLogger = (req: Request, _res: Response, next: NextFunction): void => {
    console.info(`[WEB] ${new Date().toISOString()} ${req.method} ${req.path} ${getClientIp(req)}`);
    next();
  };

  const validateJsonContentType = (req: Request, res: Response, next: NextFunction): void => {
    if (req.method === 'POST' && !req.is('application/json')) {
      securityLog('INVALID_INPUT', req);
      res.status(415).json({ error: true, message: 'نوع الطلب غير صحيح.' });
      return;
    }
    next();
  };

  const sanitizeInputs = (req: Request, _res: Response, next: NextFunction): void => {
    if (req.body && typeof req.body === 'object') {
      for (const [key, value] of Object.entries(req.body)) {
        if (typeof value === 'string') {
          req.body[key] = sanitize(value);
        }
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
    sessionMiddleware,
    requestIdMiddleware,
    securityLogger,
    validateJsonContentType,
    sanitizeInputs,
  };
}

export function buildJwtAuthMiddleware(env: Env, repository: MediatorRepository, optional = false) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length).trim()
      : req.session.jwtToken || readCookie(req, 'verify_token');

    if (!token) {
      if (optional) {
        next();
        return;
      }
      securityLog('JWT_INVALID', req);
      res.status(401).json({ error: true, message: 'جلسة التحقق غير صالحة.' });
      return;
    }

    try {
      const decoded = jwt.verify(token, env.JWT_SECRET || '', { algorithms: ['HS512'] }) as JwtPayload;
      const discordId = typeof decoded.discordId === 'string' ? decoded.discordId : '';
      const username = typeof decoded.username === 'string' ? decoded.username : '';
      if (!discordId || !username) throw new Error('Invalid JWT payload');

      const dbUser = await repository.getUserByToken(token);
      if (!dbUser || dbUser.discord_id !== discordId) throw new Error('JWT not bound to database session');

      req.auth = { discordId, username, token };
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
