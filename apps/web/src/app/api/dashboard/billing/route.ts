export const runtime = 'nodejs';

import { fail, internalError, ok } from '@/lib/api-response';
import { getSession } from '@/lib/sessions';
import { supabaseAdmin } from '@/lib/supabase';
import { publicConfig } from '@/lib/env';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return fail('unauthorized', 'Login required', 401);
    const { data, error } = await supabaseAdmin().from('activation_codes').select('order_id,product_name,plan_type,status,created_at,expires_at,bot_instance_id').eq('owner_discord_id', session.discordUserId).order('created_at', { ascending: false });
    if (error) throw error;
    return ok({ renew_url: publicConfig().paypalTicketProductUrl, items: data || [] });
  } catch (error) {
    console.error('[dashboard/billing]', error);
    return internalError();
  }
}
