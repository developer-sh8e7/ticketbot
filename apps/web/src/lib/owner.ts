/**
 * Store-owner identity & gating.
 *
 * The owner is a single Discord account that gets the admin section inside the
 * shared dashboard. Gating is always done server-side against the session's
 * Discord ID — never trust the client. Any unauthorized attempt to reach an
 * owner-only surface is logged to Supabase with IP for an audit trail.
 */
import type { NextRequest } from 'next/server';
import { getSession } from './sessions';
import { logWebsiteEvent } from './events';
import { clientIp } from './security';

/** Hardcoded store owner. Overridable via env for staging without code changes. */
export const OWNER_DISCORD_ID = (process.env.OWNER_DISCORD_ID || '1397364822152315052').trim();

/** Store's own Discord server — the only guild the /info control command runs in. */
export const STORE_GUILD_ID = (process.env.STORE_GUILD_ID || '1395842846107631746').trim();

export function isOwnerId(discordUserId: string | null | undefined): boolean {
  return Boolean(discordUserId) && discordUserId === OWNER_DISCORD_ID;
}

type SessionLike = { discordUserId: string } | null;

export function sessionIsOwner(session: SessionLike): boolean {
  return Boolean(session) && isOwnerId(session!.discordUserId);
}

/**
 * Server-side owner guard for API routes.
 * Returns the session when the caller is the owner, otherwise null AND records
 * an audit event (only when there is a session — anonymous 401s are noise).
 */
export async function requireOwner(req?: NextRequest) {
  const session = await getSession();
  if (sessionIsOwner(session)) return session;

  if (session) {
    await logWebsiteEvent({
      eventType: 'unauthorized_owner_access',
      message: 'Non-owner attempted to access an owner-only resource',
      userId: session.discordUserId,
      metadata: { ip: req ? clientIp(req) : null, path: req?.nextUrl?.pathname ?? null },
    }).catch(() => {});
  }
  return null;
}
