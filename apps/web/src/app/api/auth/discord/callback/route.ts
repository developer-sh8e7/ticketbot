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
import { exchangeCode, fetchDiscordUser } from '@/lib/discord';

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

    const token = await exchangeCode(code);
    const user = await fetchDiscordUser(token.access_token);

    await supabaseAdmin().from('accounts').upsert({
      discord_user_id: user.id,
      discord_username: user.username ?? null,
      avatar_url: user.avatar ?? null,
      email: user.email ?? null,
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
      discordToken: token,
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
