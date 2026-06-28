export const runtime = 'nodejs';

import { fail, internalError, ok } from '@/lib/api-response';
import { getSession } from '@/lib/sessions';
import { assertOwnedBot, latestBotConfig } from '@/lib/dashboard-data';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getSession();
    if (!session) return fail('unauthorized', 'Login required', 401);
    const bot = await assertOwnedBot(session.discordUserId, id);
    if (!bot) return fail('forbidden', 'Access denied', 403);
    const config = await latestBotConfig(id);
    return ok({ bot, config });
  } catch (error) {
    console.error('[dashboard/bot/id]', error);
    return internalError();
  }
}
