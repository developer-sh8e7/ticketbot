import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { env, isProduction } from './env';
import { supabaseAdmin } from './supabase';
import { encryptField, decryptField } from './encryption';
import type { DiscordTokenResponse } from './discord';

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
  const payload = raw ? decode(raw) : null;
  if (!payload) return null;
  // Enforce server-side revocation: a signed cookie alone is not enough — logout
  // (and admin revoke) mark the row revoked, and that must invalidate the token
  // even though it's still cryptographically valid until its 14-day expiry.
  // Fail-open on a DB/network blip so a transient Supabase error can't log
  // everyone out; fail-closed only on an explicit revocation/expiry.
  try {
    const { data, error } = await supabaseAdmin()
      .from('customer_sessions')
      .select('revoked_at,expires_at')
      .eq('id', payload.sid)
      .maybeSingle();
    if (error) return payload;
    if (!data) return null;
    if (data.revoked_at) return null;
    if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) return null;
  } catch {
    return payload;
  }
  return payload;
}

/** Build the encrypted Discord-token blob stored in customer_sessions.metadata. */
function tokenMetadata(token?: DiscordTokenResponse | null) {
  if (!token?.access_token) return {};
  return {
    discord: {
      at_enc: encryptField(token.access_token),
      rt_enc: token.refresh_token ? encryptField(token.refresh_token) : null,
      scope: token.scope ?? null,
      token_expires_at: new Date(Date.now() + (token.expires_in ?? 0) * 1000).toISOString(),
    },
  };
}

export async function createSession(input: {
  discordUserId: string;
  username?: string;
  avatar?: string | null;
  userAgent?: string | null;
  ip?: string | null;
  discordToken?: DiscordTokenResponse | null;
}) {
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
      metadata: tokenMetadata(input.discordToken),
    });
  if (error) throw error;

  return encode(payload);
}

export type SessionDiscordToken = { accessToken: string; refreshToken: string | null; scope: string | null; expiresAt: string | null };

/** Read + decrypt the Discord token stored for a session id. */
export async function getSessionDiscordToken(sid: string): Promise<SessionDiscordToken | null> {
  const { data, error } = await supabaseAdmin()
    .from('customer_sessions')
    .select('metadata,revoked_at')
    .eq('id', sid)
    .maybeSingle();
  if (error || !data || data.revoked_at) return null;
  const blob = (data.metadata as { discord?: { at_enc?: string; rt_enc?: string | null; scope?: string | null; token_expires_at?: string | null } })?.discord;
  if (!blob?.at_enc) return null;
  try {
    return {
      accessToken: decryptField(blob.at_enc),
      refreshToken: blob.rt_enc ? decryptField(blob.rt_enc) : null,
      scope: blob.scope ?? null,
      expiresAt: blob.token_expires_at ?? null,
    };
  } catch {
    return null;
  }
}

/** Persist a refreshed Discord token back onto the session row. */
export async function updateSessionDiscordToken(sid: string, token: DiscordTokenResponse): Promise<void> {
  await supabaseAdmin().from('customer_sessions').update({ metadata: tokenMetadata(token) }).eq('id', sid);
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
