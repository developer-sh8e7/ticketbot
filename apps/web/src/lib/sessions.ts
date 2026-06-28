import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { env, isProduction } from './env';
import { supabaseAdmin } from './supabase';

export const SESSION_COOKIE = 'opus_session';

type SessionPayload = {
  sid: string;
  discordUserId: string;
  username?: string;
  avatar?: string | null;
  exp: number;
};

function sign(data: string) {
  return crypto.createHmac('sha256', env().SESSION_SECRET).update(data).digest('base64url');
}

function encode(payload: SessionPayload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${sign(body)}`;
}

function decode(value: string): SessionPayload | null {
  const [body, sig] = value.split('.');
  if (!body || !sig || sign(body) !== sig) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SessionPayload;
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function getSession() {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE)?.value;
  return raw ? decode(raw) : null;
}

export async function createSession(input: { discordUserId: string; username?: string; avatar?: string | null; userAgent?: string | null; ip?: string | null }) {
  const sid = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14);
  const payload: SessionPayload = {
    sid,
    discordUserId: input.discordUserId,
    username: input.username,
    avatar: input.avatar,
    exp: Math.floor(expiresAt.getTime() / 1000),
  };

  const { error } = await supabaseAdmin()
    .from('customer_sessions')
    .insert({
      id: sid,
      discord_user_id: input.discordUserId,
      username: input.username ?? null,
      avatar_url: input.avatar ?? null,
      user_agent: input.userAgent ?? null,
      ip_address: input.ip ?? null,
      expires_at: expiresAt.toISOString(),
      metadata: {},
    });
  if (error) throw error;

  return encode(payload);
}

export function setSessionCookie(res: NextResponse, sessionValue: string) {
  res.cookies.set(SESSION_COOKIE, sessionValue, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 14,
  });
}

export async function clearSession(res: NextResponse) {
  const session = await getSession();
  if (session) {
    await supabaseAdmin().from('customer_sessions').update({ revoked_at: new Date().toISOString() }).eq('id', session.sid);
  }
  res.cookies.set(SESSION_COOKIE, '', { httpOnly: true, secure: isProduction(), sameSite: 'lax', path: '/', maxAge: 0 });
}
