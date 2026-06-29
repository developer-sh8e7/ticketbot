export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { clearSession } from '@/lib/sessions';
import { verifyCsrf } from '@/lib/csrf';
import { fail } from '@/lib/api-response';

/** Build an absolute redirect URL from the proxied request host (Railway-safe). */
function loginUrl(req: NextRequest) {
  const proto = req.headers.get('x-forwarded-proto') ?? 'https';
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? 'localhost';
  return new URL('/login', `${proto}://${host}`);
}

/**
 * GET logout — used by the simple navbar link. Clearing a session is not a
 * state-changing action on the user's data, so a GET is acceptable and avoids
 * the 405 the navbar link previously hit. Always clears server + cookie.
 */
export async function GET(req: NextRequest) {
  const res = NextResponse.redirect(loginUrl(req));
  await clearSession(res);
  return res;
}

/** POST logout — CSRF-protected variant for programmatic / fetch callers. */
export async function POST(req: NextRequest) {
  if (!verifyCsrf(req)) return fail('csrf_failed', 'Invalid CSRF token', 403);
  const res = NextResponse.redirect(loginUrl(req));
  await clearSession(res);
  return res;
}
