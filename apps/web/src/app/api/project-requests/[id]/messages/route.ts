export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { fail, internalError, ok } from '@/lib/api-response';
import { verifyCsrf } from '@/lib/csrf';
import { encryptField } from '@/lib/encryption';
import { readProjectAccess } from '@/lib/project-access';
import { notifyOwnerOfProjectRequest } from '@/lib/project-notifications';
import {
  getAccessibleProjectRequest,
  publicProjectMessage,
  publicProjectRequest,
  type ProjectMessageRow,
} from '@/lib/project-requests';
import { rateLimit } from '@/lib/rate-limit';
import { getSession } from '@/lib/sessions';
import { isOwnerId } from '@/lib/owner';
import { supabaseAdmin } from '@/lib/supabase';

type Context = { params: Promise<{ id: string }> };
type Body = { content?: unknown };

function guestTokenFor(req: NextRequest, id: string) {
  return readProjectAccess(req, id)?.token ?? null;
}

export async function GET(req: NextRequest, { params }: Context) {
  try {
    const session = await getSession();
    const { id } = await params;
    const requestRow = await getAccessibleProjectRequest(id, session?.discordUserId, guestTokenFor(req, id));
    if (!requestRow) return fail('not_found', 'الطلب غير موجود.', 404);

    const { data, error } = await supabaseAdmin()
      .from('project_request_messages')
      .select('id,sender_type,content_enc,created_at')
      .eq('request_id', id)
      .order('created_at', { ascending: true })
      .limit(300);
    if (error) throw error;

    const owner = isOwnerId(session?.discordUserId);
    const unread = owner ? requestRow.owner_unread : requestRow.customer_unread;
    if (unread) {
      await supabaseAdmin()
        .from('project_requests')
        .update(owner ? { owner_unread: false } : { customer_unread: false })
        .eq('id', id);
    }

    const now = Date.now();
    const otherTypingUntil = owner ? requestRow.customer_typing_until : requestRow.owner_typing_until;
    return ok({
      request: publicProjectRequest({
        ...requestRow,
        owner_unread: owner ? false : requestRow.owner_unread,
        customer_unread: owner ? requestRow.customer_unread : false,
      }),
      messages: ((data ?? []) as ProjectMessageRow[]).map(publicProjectMessage),
      otherTyping: Boolean(otherTypingUntil && new Date(otherTypingUntil).getTime() > now),
    });
  } catch (error) {
    console.error('[project-messages][GET]', error instanceof Error ? error.message : 'unknown');
    return internalError();
  }
}

export async function POST(req: NextRequest, { params }: Context) {
  try {
    if (!verifyCsrf(req)) return fail('csrf_failed', 'رمز الحماية غير صالح. أعد تحميل الصفحة.', 403);
    const session = await getSession();
    if (!rateLimit(req, 'project-request:message', 30, 60_000).allowed) {
      return fail('rate_limited', 'أرسلت رسائل كثيرة. انتظر دقيقة.', 429);
    }

    const { id } = await params;
    const requestRow = await getAccessibleProjectRequest(id, session?.discordUserId, guestTokenFor(req, id));
    if (!requestRow) return fail('not_found', 'الطلب غير موجود.', 404);
    if (requestRow.status === 'closed') return fail('conflict', 'هذه المحادثة مغلقة.', 409);

    const body = (await req.json().catch(() => ({}))) as Body;
    const content = typeof body.content === 'string' ? body.content.trim() : '';
    if (!content || content.length > 5000) return fail('bad_request', 'الرسالة مطلوبة وبحد أقصى 5000 حرف.', 400);

    const owner = isOwnerId(session?.discordUserId);
    const senderType = owner ? 'owner' : 'customer';
    const now = new Date().toISOString();
    const supabase = supabaseAdmin();
    const { data: message, error } = await supabase
      .from('project_request_messages')
      .insert({ request_id: id, sender_type: senderType, content_enc: encryptField(content) })
      .select('id,sender_type,content_enc,created_at')
      .single();
    if (error) throw error;

    const { error: updateError } = await supabase
      .from('project_requests')
      .update({
        status: requestRow.status === 'new' ? 'open' : requestRow.status,
        last_message_at: now,
        owner_unread: !owner,
        customer_unread: owner,
        ...(owner ? { owner_typing_until: null } : { customer_typing_until: null }),
      })
      .eq('id', id);
    if (updateError) throw updateError;

    if (!owner) {
      const requesterName = requestRow.requester_name_enc ? publicProjectRequest(requestRow).requesterName : null;
      await notifyOwnerOfProjectRequest({ requestId: id, requesterName, kind: 'message' });
    }

    return ok({ message: publicProjectMessage(message as ProjectMessageRow) }, { status: 201 });
  } catch (error) {
    console.error('[project-messages][POST]', error instanceof Error ? error.message : 'unknown');
    return internalError();
  }
}
