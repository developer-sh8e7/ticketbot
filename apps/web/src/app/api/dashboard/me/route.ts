export const runtime = 'nodejs';

import { fail, ok } from '@/lib/api-response';
import { getSession } from '@/lib/sessions';

export async function GET() {
  const session = await getSession();
  if (!session) return fail('unauthorized', 'Login required', 401);
  return ok({ discord_user_id: session.discordUserId, username: session.username ?? null, avatar: session.avatar ?? null });
}
