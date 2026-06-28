import { NextResponse, type NextRequest } from 'next/server';
import { isProduction } from '@/lib/env';

const CSRF_COOKIE = 'opus_csrf';

function makeToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function proxy(req: NextRequest) {
  const res = NextResponse.next();

  // CSRF cookie
  if (!req.cookies.get(CSRF_COOKIE)) {
    res.cookies.set(CSRF_COOKIE, makeToken(), {
      httpOnly: false,
      secure: isProduction(),
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 8,
    });
  }

  // Log visits to Supabase only (fire-and-forget, no webhook)
  const pathname = req.nextUrl.pathname;
  if (
    req.method === 'GET' &&
    !pathname.startsWith('/_next/') &&
    !pathname.startsWith('/api/') &&
    !pathname.startsWith('/.well-known/') &&
    pathname !== '/favicon.ico'
  ) {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || '';
    const userAgent = req.headers.get('user-agent') || '';
    const referer = req.headers.get('referer') || '';
    const host = req.headers.get('host') || '';

    const origin = host ? `https://${host}` : 'http://localhost:3000';
    fetch(`${origin}/api/visit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: pathname, ip, userAgent, referer }),
    }).catch(() => {});
  }

  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.well-known).*)'],
};
