export const runtime = 'nodejs';

import { fail, internalError, ok } from '@/lib/api-response';
import { getSession } from '@/lib/sessions';
import { getOwnedBots } from '@/lib/dashboard-data';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return fail('unauthorized', 'Login required', 401);
    const bots = await getOwnedBots(session.discordUserId);
    return ok({ bots });
  } catch (error) {
    console.error('[dashboard/bots]', error);
    return internalError();
  }
}
