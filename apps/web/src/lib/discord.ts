/**
 * Discord OAuth2 + REST helpers.
 *
 * Centralizes token exchange/refresh and guild listing so the callback and the
 * dashboard guild picker share one implementation. Access/refresh tokens are
 * never returned to the browser — only the resolved admin guild list is.
 */
import { env } from './env';

const DISCORD_API = 'https://discord.com/api';
const ADMINISTRATOR = 0x8n;

export type DiscordTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
  token_type?: string;
};

export type DiscordUser = { id: string; username?: string; avatar?: string | null; email?: string | null };

type RawGuild = { id: string; name: string; icon: string | null; owner?: boolean; permissions?: string };

export type AdminGuild = { id: string; name: string; iconUrl: string | null; owner: boolean };

export async function exchangeCode(code: string): Promise<DiscordTokenResponse> {
  const e = env();
  const body = new URLSearchParams({
    client_id: e.DISCORD_CLIENT_ID,
    client_secret: e.DISCORD_CLIENT_SECRET,
    grant_type: 'authorization_code',
    code,
    redirect_uri: e.DISCORD_REDIRECT_URI,
  });
  const res = await fetch(`${DISCORD_API}/oauth2/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('Discord token exchange failed');
  return (await res.json()) as DiscordTokenResponse;
}

export async function refreshAccessToken(refreshToken: string): Promise<DiscordTokenResponse> {
  const e = env();
  const body = new URLSearchParams({
    client_id: e.DISCORD_CLIENT_ID,
    client_secret: e.DISCORD_CLIENT_SECRET,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });
  const res = await fetch(`${DISCORD_API}/oauth2/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('Discord token refresh failed');
  return (await res.json()) as DiscordTokenResponse;
}

export async function fetchDiscordUser(accessToken: string): Promise<DiscordUser> {
  const res = await fetch(`${DISCORD_API}/users/@me`, {
    headers: { authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('Discord user fetch failed');
  return (await res.json()) as DiscordUser;
}

/**
 * Fetch the user's guilds. Returns null on 401 (token expired/revoked) so the
 * caller can decide whether to refresh or ask the user to re-link.
 */
export async function fetchUserGuilds(accessToken: string): Promise<RawGuild[] | null> {
  const res = await fetch(`${DISCORD_API}/users/@me/guilds`, {
    headers: { authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`Discord guilds fetch failed (${res.status})`);
  return (await res.json()) as RawGuild[];
}

export type BotApplication = { id: string; name: string; iconUrl: string | null };

/**
 * Resolve a bot token to its application (id + name) by calling Discord as the
 * bot. Lets the owner paste only the token when adding to the pool — we derive
 * the application id and a sensible label automatically. Returns null if the
 * token is invalid.
 */
export async function fetchBotApplication(botToken: string): Promise<BotApplication | null> {
  const res = await fetch(`${DISCORD_API}/oauth2/applications/@me`, {
    headers: { authorization: `Bot ${botToken}` },
    cache: 'no-store',
  });
  if (!res.ok) return null;
  const app = (await res.json()) as { id: string; name?: string; icon?: string | null };
  if (!app?.id) return null;
  return {
    id: app.id,
    name: app.name ?? 'Bot',
    iconUrl: app.icon ? `https://cdn.discordapp.com/app-icons/${app.id}/${app.icon}.png?size=64` : null,
  };
}

/** Keep only guilds where the user is owner or has the ADMINISTRATOR permission. */
export function toAdminGuilds(guilds: RawGuild[]): AdminGuild[] {
  return guilds
    .filter((g) => {
      if (g.owner) return true;
      try {
        return (BigInt(g.permissions ?? '0') & ADMINISTRATOR) === ADMINISTRATOR;
      } catch {
        return false;
      }
    })
    .map((g) => ({
      id: g.id,
      name: g.name,
      owner: Boolean(g.owner),
      iconUrl: g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=128` : null,
    }))
    .sort((a, b) => (a.owner === b.owner ? a.name.localeCompare(b.name) : a.owner ? -1 : 1));
}
