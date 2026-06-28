export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { env, isProduction } from '@/lib/env';

export async function GET(_req: NextRequest) {
  const state = crypto.randomUUID();
  const url = new URL('https://discord.com/oauth2/authorize');
  url.searchParams.set('client_id', env().DISCORD_CLIENT_ID);
  url.searchParams.set('redirect_uri', env().DISCORD_REDIRECT_URI);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'identify');
  url.searchParams.set('state', state);
  const res = NextResponse.redirect(url);
  res.cookies.set('opus_oauth_state', state, { httpOnly: true, secure: isProduction(), sameSite: 'lax', path: '/', maxAge: 60 * 10 });
  return res;
}
