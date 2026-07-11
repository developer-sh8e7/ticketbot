export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { fail, internalError, ok } from '@/lib/api-response';
import { verifyCsrf } from '@/lib/csrf';
import { readProjectAccess } from '@/lib/project-access';
import { getAccessibleProjectRequest } from '@/lib/project-requests';
import { rateLimit } from '@/lib/rate-limit';
import { getSession } from '@/lib/sessions';
import { isOwnerId } from '@/lib/owner';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!verifyCsrf(req)) return fail('csrf_failed', 'رمز الحماية غير صالح.', 403);
    if (!rateLimit(req, 'project-request:typing', 40, 60_000).allowed) return ok({ typing: true });

    const session = await getSession();
    const { id } = await params;
    const guestToken = readProjectAccess(req, id)?.token ?? null;
    const requestRow = await getAccessibleProjectRequest(id, session?.discordUserId, guestToken);
    if (!requestRow) return fail('not_found', 'الطلب غير موجود.', 404);

    const typingUntil = new Date(Date.now() + 5000).toISOString();
    const owner = isOwnerId(session?.discordUserId);
    const { error } = await supabaseAdmin()
      .from('project_requests')
      .update(owner ? { owner_typing_until: typingUntil } : { customer_typing_until: typingUntil })
      .eq('id', id);
    if (error) throw error;
    return ok({ typing: true });
  } catch (error) {
    console.error('[project-typing]', error instanceof Error ? error.message : 'unknown');
    return internalError();
  }
}
