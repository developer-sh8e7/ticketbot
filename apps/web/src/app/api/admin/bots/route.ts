export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { fail, internalError, ok } from '@/lib/api-response';
import { isAdminRequest, isAdminDiscordUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  try {
    if (!isAdminRequest(req)) {
      try { if (!(await isAdminDiscordUser())) return fail('unauthorized', 'Admin access required', 401); }
      catch { return fail('unauthorized', 'Admin access required (env not configured)', 401); }
    }
    const { data, error } = await supabaseAdmin().from('bot_instances').select('id,bot_user_id,bot_name,guild_id,guild_name,owner_id,product_type,plan_type,status,expires_at,last_started_at,last_stopped_at,updated_at').order('created_at', { ascending: false }).limit(200);
    if (error) throw error;
    return ok({ bots: data || [] });
  } catch (error) {
    console.error('[admin/bots]', error);
    return internalError();
  }
}
