export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { fail, internalError, ok } from '@/lib/api-response';
import { rateLimit } from '@/lib/rate-limit';
import { getSession, getSessionDiscordToken, updateSessionDiscordToken } from '@/lib/sessions';
import { fetchUserGuilds, refreshAccessToken, toAdminGuilds } from '@/lib/discord';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return fail('unauthorized', 'سجّل دخولك أولاً.', 401);
    if (!rateLimit(req, 'dashboard:guilds', 20, 60_000).allowed) {
      return fail('rate_limited', 'محاولات كثيرة. انتظر قليلاً.', 429);
    }

    const stored = await getSessionDiscordToken(session.sid);
    if (!stored) {
      // Session predates guild storage, or token blob missing → re-link needed.
      return fail('forbidden', 'NEEDS_RELINK', 403);
    }

    let guilds = await fetchUserGuilds(stored.accessToken);

    // Token expired/revoked → try a refresh once, then retry.
    if (guilds === null && stored.refreshToken) {
      try {
        const refreshed = await refreshAccessToken(stored.refreshToken);
        await updateSessionDiscordToken(session.sid, refreshed);
        guilds = await fetchUserGuilds(refreshed.access_token);
      } catch {
        guilds = null;
      }
    }

    if (guilds === null) return fail('forbidden', 'NEEDS_RELINK', 403);

    return ok({ guilds: toAdminGuilds(guilds) });
  } catch (error) {
    console.error('[dashboard/guilds]', error);
    return internalError();
  }
}
