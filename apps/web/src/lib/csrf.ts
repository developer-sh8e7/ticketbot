import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { isProduction } from './env';

export const CSRF_COOKIE = 'opus_csrf';

export function makeCsrfToken() {
  return crypto.randomBytes(24).toString('base64url');
}

export async function getOrCreateCsrfToken() {
  const jar = await cookies();
  const existing = jar.get(CSRF_COOKIE)?.value;
  return existing || makeCsrfToken();
}

export function setCsrfCookie(res: NextResponse, token: string) {
  res.cookies.set(CSRF_COOKIE, token, {
    httpOnly: false,
    secure: isProduction(),
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 8,
  });
}

export function verifyCsrf(req: NextRequest) {
  const cookie = req.cookies.get(CSRF_COOKIE)?.value;
  const header = req.headers.get('x-csrf-token');
  return Boolean(cookie && header && cookie === header);
}
