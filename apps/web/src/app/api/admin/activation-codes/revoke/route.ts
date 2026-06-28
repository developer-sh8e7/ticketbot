export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { fail, internalError, ok } from '@/lib/api-response';
import { isAdminRequest, isAdminDiscordUser } from '@/lib/auth';
import { verifyCsrf } from '@/lib/csrf';
import { supabaseAdmin } from '@/lib/supabase';
import { logWebsiteEvent } from '@/lib/events';

export async function POST(req: NextRequest) {
  try {
    if (!verifyCsrf(req)) return fail('csrf_failed', 'Invalid CSRF token', 403);
    if (!isAdminRequest(req)) {
      try { if (!(await isAdminDiscordUser())) return fail('unauthorized', 'Admin access required', 401); }
      catch { return fail('unauthorized', 'Admin access required (env not configured)', 401); }
    }
    const body = await req.json().catch(() => ({}));
    if (!body.id) return fail('bad_request', 'Activation code id is required', 400);
    const { error } = await supabaseAdmin().from('activation_codes').update({ status: 'revoked', updated_at: new Date().toISOString() }).eq('id', body.id);
    if (error) throw error;
    await logWebsiteEvent({ eventType: 'activation_code_revoked', message: 'Activation code revoked by admin', metadata: { activation_code_id: body.id } });
    return ok({ revoked: true });
  } catch (error) {
    console.error('[admin/revoke]', error);
    return internalError();
  }
}
