export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { env, isProduction } from '@/lib/env';
import { supabaseAdmin } from '@/lib/supabase';
import { createSession, setSessionCookie } from '@/lib/sessions';
import { clientIp } from '@/lib/security';
import { logWebsiteEvent } from '@/lib/events';
import { notifyManagerSync } from '@/lib/manager-sync';
import { hashField } from '@/lib/encryption';
import { updateOwnerPii, lookupActivationCodeByHash } from '@/lib/activation-codes';

type DiscordUser = { id: string; username?: string; avatar?: string | null };

async function exchangeCode(code: string) {
  const e = env();
  const body = new URLSearchParams({
    client_id: e.DISCORD_CLIENT_ID,
    client_secret: e.DISCORD_CLIENT_SECRET,
    grant_type: 'authorization_code',
    code,
    redirect_uri: e.DISCORD_REDIRECT_URI,
  });
  const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
    cache: 'no-store',
  });
  if (!tokenRes.ok) throw new Error('Discord token exchange failed');
  const token = (await tokenRes.json()) as { access_token: string };
  const userRes = await fetch('https://discord.com/api/users/@me', {
    headers: { authorization: `Bearer ${token.access_token}` },
    cache: 'no-store',
  });
  if (!userRes.ok) throw new Error('Discord user fetch failed');
  return (await userRes.json()) as DiscordUser;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const expectedState = req.cookies.get('opus_oauth_state')?.value;
  const plainActivationCode = req.cookies.get('opus_activation_code')?.value;
  const appUrl = env().APP_URL;

  try {
    if (!code || !state || state !== expectedState) {
      return NextResponse.redirect(new URL('/login?error=oauth_state', appUrl));
    }

    const user = await exchangeCode(code);

    await supabaseAdmin().from('accounts').upsert({
      discord_user_id: user.id,
      discord_username: user.username ?? null,
      avatar_url: user.avatar ?? null,
      last_login_at: new Date().toISOString(),
    }, { onConflict: 'discord_user_id' });

    // Legacy activation codes remain supported as a secondary migration path, but purchase no longer depends on them.
    if (plainActivationCode) {
      const codeHash = hashField(plainActivationCode);
      const activation = await lookupActivationCodeByHash(codeHash);
      if (activation && !['revoked', 'expired', 'cancelled'].includes(activation.status)) {
        if (!activation.owner_discord_id) {
          await updateOwnerPii(activation.id, {
            discordUserId: user.id,
            discordUsername: user.username,
            discordAvatar: user.avatar,
          });
          await notifyManagerSync('activation_code_claimed', { activation_code_id: activation.id });
        }
      }
    }

    const sessionValue = await createSession({
      discordUserId: user.id,
      username: user.username,
      avatar: user.avatar,
      userAgent: req.headers.get('user-agent'),
      ip: clientIp(req),
    });

    const res = NextResponse.redirect(new URL('/dashboard', appUrl));
    setSessionCookie(res, sessionValue);
    // Clear temp cookies
    res.cookies.set('opus_activation_code', '', { httpOnly: true, secure: isProduction(), sameSite: 'lax', path: '/', maxAge: 0 });
    res.cookies.set('opus_oauth_state', '', { httpOnly: true, secure: isProduction(), sameSite: 'lax', path: '/', maxAge: 0 });
    return res;
  } catch (error) {
    console.error('[discord/callback]', error);
    return NextResponse.redirect(new URL('/login?error=oauth_failed', appUrl));
  }
}
