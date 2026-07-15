export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { fail, internalError, ok } from '@/lib/api-response';
import { verifyCsrf } from '@/lib/csrf';
import { encryptField, hashField } from '@/lib/encryption';
import { logWebsiteEvent } from '@/lib/events';
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

type Body = {
  name?: unknown;
  contactMethod?: unknown;
  contact?: unknown;
  idea?: unknown;
  mainGoal?: unknown;
  features?: unknown;
  budget?: unknown;
  deadline?: unknown;
};

const FEATURE_LABELS: Record<string, string> = {
  login: 'تسجيل دخول',
  dashboard: 'لوحة تحكم',
  payments: 'دفع إلكتروني',
  mobile: 'تطبيق جوال',
  unsure: 'غير متأكد',
};

const BUDGET_LABELS: Record<string, string> = {
  needs_estimate: 'أحتاج تقدير منكم',
  flexible: 'مرنة حسب الحل المناسب',
  has_budget: 'عندي ميزانية محددة',
  discuss_later: 'نناقشها بعد مراجعة الفكرة',
};

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
    } else {
      if (session) {
        const { data, error } = await supabase.from('project_requests').select(PROJECT_REQUEST_FIELDS).eq('requester_hash', hashField(session.discordUserId)).order('last_message_at', { ascending: false }).limit(100);
        if (error) throw error;
        rows = (data ?? []) as ProjectRequestRow[];
      }
      if (accesses.length > 0) {
        const { data, error } = await supabase.from('project_requests').select(PROJECT_REQUEST_FIELDS).in('id', accesses.map((access) => access.requestId)).order('last_message_at', { ascending: false });
        if (error) throw error;
        const guestRows = ((data ?? []) as ProjectRequestRow[]).filter((row) => {
          const access = accesses.find((item) => item.requestId === row.id);
          return Boolean(access && canAccessProjectRequest(row, session?.discordUserId, access.token));
        });
        const seen = new Set(rows.map((row) => row.id));
        rows = [...rows, ...guestRows.filter((row) => !seen.has(row.id))].sort((a, b) => Date.parse(b.last_message_at) - Date.parse(a.last_message_at));
      }
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
    const contactMethod = body.contactMethod === 'email' ? 'email' : body.contactMethod === 'whatsapp' ? 'whatsapp' : '';
    const contact = typeof body.contact === 'string' ? body.contact.trim() : '';
    const idea = typeof body.idea === 'string' ? body.idea.trim() : '';
    const mainGoal = typeof body.mainGoal === 'string' ? body.mainGoal.trim() : '';
    const features = Array.isArray(body.features)
      ? [...new Set(body.features.filter((item): item is string => typeof item === 'string' && item in FEATURE_LABELS))]
      : [];
    const budget = typeof body.budget === 'string' && body.budget in BUDGET_LABELS ? body.budget : '';
    const deadline = typeof body.deadline === 'string' ? body.deadline.trim() : '';

    if (name.length < 2 || name.length > 80) return fail('bad_request', 'اكتب اسمك (من حرفين إلى 80 حرفاً).', 400);
    if (!contactMethod || contact.length < 3 || contact.length > 100) return fail('bad_request', 'اختر طريقة التواصل واكتب بيانات التواصل الصحيحة.', 400);
    if (contactMethod === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)) return fail('bad_request', 'اكتب بريداً إلكترونياً صحيحاً.', 400);
    if (idea.length < 10 || idea.length > 2500) return fail('bad_request', 'اكتب فكرة المشروع بوضوح (من 10 إلى 2500 حرف).', 400);
    if (mainGoal.length < 5 || mainGoal.length > 1500) return fail('bad_request', 'وضّح أهم مهمة يجب أن ينفذها المشروع.', 400);
    if (!budget) return fail('bad_request', 'اختر الميزانية التقريبية.', 400);
    if (deadline.length > 100) return fail('bad_request', 'الموعد المحدد طويل جداً.', 400);

    const contactLabel = contactMethod === 'whatsapp' ? 'واتساب' : 'البريد الإلكتروني';
    const projectBrief = [
      `فكرة المشروع:\n${idea}`,
      `أهم شيء يجب أن يفعله المشروع:\n${mainGoal}`,
      `الميزات المطلوبة:\n${features.length ? features.map((item) => `• ${FEATURE_LABELS[item]}`).join('\n') : 'لم يحدد ميزات إضافية'}`,
      `الميزانية التقريبية:\n${BUDGET_LABELS[budget]}`,
      `الموعد المطلوب:\n${deadline || 'لا يوجد موعد محدد'}`,
    ].join('\n\n');

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
        phone_enc: encryptField(`${contactLabel}: ${contact}`),
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
      content_enc: encryptField(projectBrief),
    });
    if (messageError) throw messageError;

    await notifyOwnerOfProjectRequest({ requestId: insertedId, requesterName: name, kind: 'created' });
    await logWebsiteEvent({ eventType: 'project_request_submitted', message: 'Project request submitted' });
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
