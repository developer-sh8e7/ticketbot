export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { fail, internalError, ok } from '@/lib/api-response';
import { verifyCsrf } from '@/lib/csrf';
import { requireOwner } from '@/lib/owner';
import { rateLimit } from '@/lib/rate-limit';
import { supabaseAdmin } from '@/lib/supabase';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!verifyCsrf(req)) return fail('csrf_failed', 'رمز الحماية غير صالح. أعد تحميل الصفحة.', 403);
    const owner = await requireOwner(req);
    if (!owner) return fail('forbidden', 'هذا الإجراء مقصور على مالك المتجر.', 403);
    if (!rateLimit(req, 'project-request:delete', 20, 60_000).allowed) {
      return fail('rate_limited', 'محاولات كثيرة. انتظر دقيقة.', 429);
    }

    const { id } = await params;
    if (!/^[0-9a-f-]{36}$/i.test(id)) return fail('bad_request', 'معرّف المشروع غير صالح.', 400);

    const { data, error } = await supabaseAdmin()
      .from('project_requests')
      .delete()
      .eq('id', id)
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (!data) return fail('not_found', 'المشروع غير موجود.', 404);

    return ok({ deleted: true, id });
  } catch (error) {
    console.error('[project-request][DELETE]', error instanceof Error ? error.message : 'unknown');
    return internalError();
  }
}
