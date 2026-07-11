export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { fail, internalError, ok } from '@/lib/api-response';
import { verifyCsrf } from '@/lib/csrf';
import { encryptField, hashField } from '@/lib/encryption';
import { notifyOwnerOfProjectRequest } from '@/lib/project-notifications';
import { publicProjectRequest, type ProjectRequestRow } from '@/lib/project-requests';
import { rateLimit } from '@/lib/rate-limit';
import { getSession } from '@/lib/sessions';
import { isOwnerId } from '@/lib/owner';
import { supabaseAdmin } from '@/lib/supabase';

type Body = { idea?: unknown; phone?: unknown };

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return fail('unauthorized', 'يلزم تسجيل الدخول.', 401);

    let query = supabaseAdmin()
      .from('project_requests')
      .select('id,requester_hash,requester_discord_id_enc,requester_name_enc,phone_enc,status,owner_unread,customer_unread,created_at,last_message_at')
      .order('last_message_at', { ascending: false })
      .limit(100);
    if (!isOwnerId(session.discordUserId)) query = query.eq('requester_hash', hashField(session.discordUserId));

    const { data, error } = await query;
    if (error) throw error;
    return ok({ requests: ((data ?? []) as ProjectRequestRow[]).map(publicProjectRequest) });
  } catch (error) {
    console.error('[project-requests][GET]', error instanceof Error ? error.message : 'unknown');
    return internalError();
  }
}

export async function POST(req: NextRequest) {
  let insertedId: string | null = null;
  try {
    if (!verifyCsrf(req)) return fail('csrf_failed', 'رمز الحماية غير صالح. أعد تحميل الصفحة.', 403);
    const session = await getSession();
    if (!session) return fail('unauthorized', 'يلزم تسجيل الدخول عبر Discord.', 401);
    if (!rateLimit(req, 'project-request:create', 3, 60 * 60_000).allowed) {
      return fail('rate_limited', 'أرسلت طلبات كثيرة. حاول لاحقاً.', 429);
    }

    const body = (await req.json().catch(() => ({}))) as Body;
    const idea = typeof body.idea === 'string' ? body.idea.trim() : '';
    const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
    if (idea.length < 10 || idea.length > 5000) return fail('bad_request', 'اكتب فكرة المشروع بوضوح (من 10 إلى 5000 حرف).', 400);
    if (phone.length > 100) return fail('bad_request', 'رقم التواصل طويل جداً.', 400);

    const now = new Date().toISOString();
    const supabase = supabaseAdmin();
    const { data: requestRow, error: requestError } = await supabase
      .from('project_requests')
      .insert({
        requester_hash: hashField(session.discordUserId),
        requester_discord_id_enc: encryptField(session.discordUserId),
        requester_name_enc: session.username ? encryptField(session.username) : null,
        phone_enc: phone ? encryptField(phone) : null,
        status: 'new',
        owner_unread: true,
        customer_unread: false,
        last_message_at: now,
      })
      .select('id,requester_hash,requester_discord_id_enc,requester_name_enc,phone_enc,status,owner_unread,customer_unread,created_at,last_message_at')
      .single();
    if (requestError) throw requestError;
    insertedId = requestRow.id as string;

    const { error: messageError } = await supabase.from('project_request_messages').insert({
      request_id: insertedId,
      sender_type: 'customer',
      content_enc: encryptField(idea),
    });
    if (messageError) throw messageError;

    await notifyOwnerOfProjectRequest({ requestId: insertedId, requesterName: session.username, kind: 'created' });
    return ok({ request: publicProjectRequest(requestRow as ProjectRequestRow) }, { status: 201 });
  } catch (error) {
    if (insertedId) {
      try {
        await supabaseAdmin().from('project_requests').delete().eq('id', insertedId);
      } catch {
        // Best-effort rollback; no plaintext was stored in either table.
      }
    }
    console.error('[project-requests][POST]', error instanceof Error ? error.message : 'unknown');
    return internalError();
  }
}
