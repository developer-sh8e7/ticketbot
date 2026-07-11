export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { env, isProduction } from '@/lib/env';
import { safeOAuthReturnTo } from '@/lib/oauth-return';

export async function GET(req: NextRequest) {
  try {
    const e = env();
    const state = crypto.randomUUID();
    const returnTo = safeOAuthReturnTo(req.nextUrl.searchParams.get('returnTo'), e.APP_URL);
    const url = new URL('https://discord.com/oauth2/authorize');
    url.searchParams.set('client_id', e.DISCORD_CLIENT_ID);
    url.searchParams.set('redirect_uri', e.DISCORD_REDIRECT_URI);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'identify email guilds');
    url.searchParams.set('state', state);
    const res = NextResponse.redirect(url);
    res.cookies.set('opus_oauth_state', state, { httpOnly: true, secure: isProduction(), sameSite: 'lax', path: '/', maxAge: 60 * 10 });
    res.cookies.set('opus_oauth_return', returnTo, { httpOnly: true, secure: isProduction(), sameSite: 'lax', path: '/', maxAge: 60 * 10 });
    return res;
  } catch (error) {
    console.error('[auth/discord]', error);
    // Behind Railway's proxy req.url is the internal localhost:8080 — use the forwarded host so the user lands on the real domain.
    const proto = req.headers.get('x-forwarded-proto') ?? 'https';
    const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? 'localhost';
    return NextResponse.redirect(new URL('/login?error=config', `${proto}://${host}`));
  }
}
