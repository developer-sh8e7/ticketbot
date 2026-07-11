export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { fail, internalError, ok } from '@/lib/api-response';
import { verifyCsrf } from '@/lib/csrf';
import { encryptField, hashField } from '@/lib/encryption';
import { newProjectAccessToken, readProjectAccesses, setProjectAccessCookie } from '@/lib/project-access';
import { notifyOwnerOfProjectRequest } from '@/lib/project-notifications';
import {
  canAccessProjectRequest,
  PROJECT_REQUEST_FIELDS,
  publicProjectRequest,
  type ProjectRequestRow,
} from '@/lib/project-requests';
import { rateLimit } from '@/lib/rate-limit';
import { getSession } from '@/lib/sessions';
import { isOwnerId } from '@/lib/owner';
import { supabaseAdmin } from '@/lib/supabase';

type Body = { name?: unknown; idea?: unknown; phone?: unknown };

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    const accesses = readProjectAccesses(req);
    const supabase = supabaseAdmin();

    let rows: ProjectRequestRow[] = [];
    if (session && isOwnerId(session.discordUserId)) {
      const { data, error } = await supabase.from('project_requests').select(PROJECT_REQUEST_FIELDS).order('last_message_at', { ascending: false }).limit(100);
      if (error) throw error;
      rows = (data ?? []) as ProjectRequestRow[];
    } else if (session) {
      const { data, error } = await supabase.from('project_requests').select(PROJECT_REQUEST_FIELDS).eq('requester_hash', hashField(session.discordUserId)).order('last_message_at', { ascending: false }).limit(100);
      if (error) throw error;
      rows = (data ?? []) as ProjectRequestRow[];
    } else if (accesses.length > 0) {
      const { data, error } = await supabase.from('project_requests').select(PROJECT_REQUEST_FIELDS).in('id', accesses.map((access) => access.requestId)).order('last_message_at', { ascending: false });
      if (error) throw error;
      rows = ((data ?? []) as ProjectRequestRow[]).filter((row) => {
        const access = accesses.find((item) => item.requestId === row.id);
        return Boolean(access && canAccessProjectRequest(row, null, access.token));
      });
    }

    return ok({ requests: rows.map(publicProjectRequest) });
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
    if (!rateLimit(req, 'project-request:create', 3, 60 * 60_000).allowed) {
      return fail('rate_limited', 'أرسلت طلبات كثيرة. حاول لاحقاً.', 429);
    }

    const body = (await req.json().catch(() => ({}))) as Body;
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const idea = typeof body.idea === 'string' ? body.idea.trim() : '';
    const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
    if (name.length < 2 || name.length > 80) return fail('bad_request', 'اكتب اسمك (من حرفين إلى 80 حرفاً).', 400);
    if (idea.length < 10 || idea.length > 5000) return fail('bad_request', 'اكتب فكرة المشروع بوضوح (من 10 إلى 5000 حرف).', 400);
    if (phone.length > 100) return fail('bad_request', 'رقم التواصل طويل جداً.', 400);

    const accessToken = newProjectAccessToken();
    const requesterHash = session ? hashField(session.discordUserId) : hashField(accessToken);
    const now = new Date().toISOString();
    const supabase = supabaseAdmin();
    const { data: requestRow, error: requestError } = await supabase
      .from('project_requests')
      .insert({
        requester_hash: requesterHash,
        requester_discord_id_enc: encryptField(session?.discordUserId ?? '__guest__'),
        requester_name_enc: encryptField(name),
        phone_enc: phone ? encryptField(phone) : null,
        status: 'new',
        owner_unread: true,
        customer_unread: false,
        last_message_at: now,
      })
      .select(PROJECT_REQUEST_FIELDS)
      .single();
    if (requestError) throw requestError;
    insertedId = requestRow.id as string;

    const { error: messageError } = await supabase.from('project_request_messages').insert({
      request_id: insertedId,
      sender_type: 'customer',
      content_enc: encryptField(idea),
    });
    if (messageError) throw messageError;

    await notifyOwnerOfProjectRequest({ requestId: insertedId, requesterName: name, kind: 'created' });
    const response = ok({ request: publicProjectRequest(requestRow as ProjectRequestRow) }, { status: 201 });
    setProjectAccessCookie(req, response, insertedId, accessToken);
    return response;
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
