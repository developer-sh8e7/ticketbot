import { NextRequest } from 'next/server';
import { env } from './env';
import { getSession } from './sessions';

export async function requireCustomer() {
  const session = await getSession();
  if (!session) return null;
  return session;
}

export function isAdminRequest(req: NextRequest) {
  const e = env();
  const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  const headerToken = req.headers.get('x-admin-token');
  const cookieToken = req.cookies.get('admin_token')?.value;
  const provided = bearer || headerToken || cookieToken;
  return Boolean(e.ADMIN_DASHBOARD_TOKEN && provided && provided === e.ADMIN_DASHBOARD_TOKEN);
}

export async function isAdminDiscordUser() {
  const e = env();
  const session = await getSession();
  if (!session || !e.ADMIN_DISCORD_IDS) return false;
  return e.ADMIN_DISCORD_IDS.split(',').map((id) => id.trim()).includes(session.discordUserId);
}
