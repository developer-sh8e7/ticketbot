export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { fail, internalError, ok } from '@/lib/api-response';
import { verifyCsrf } from '@/lib/csrf';
import { rateLimit } from '@/lib/rate-limit';
import { requireOwner } from '@/lib/owner';
import { supabaseAdmin } from '@/lib/supabase';
import { logWebsiteEvent } from '@/lib/events';

type Body = { guildId?: unknown; ownerId?: unknown; productType?: unknown; days?: unknown; guildName?: unknown };

const SNOWFLAKE = /^\d{17,20}$/;
const PRODUCT_TYPES = ['ticket', 'voice_rooms', 'general'];

export async function POST(req: NextRequest) {
  try {
    if (!verifyCsrf(req)) return fail('csrf_failed', 'رمز الحماية غير صالح. أعد تحميل الصفحة.', 403);
    const owner = await requireOwner(req);
    if (!owner) return fail('forbidden', 'هذا الإجراء مقصور على مالك المتجر.', 403);
    if (!rateLimit(req, 'owner:trial', 15, 60_000).allowed) return fail('rate_limited', 'محاولات كثيرة. انتظر دقيقة.', 429);

    const body = (await req.json().catch(() => ({}))) as Body;
    const guildId = typeof body.guildId === 'string' ? body.guildId.trim() : '';
    const ownerId = typeof body.ownerId === 'string' ? body.ownerId.trim() : '';
    const productType = typeof body.productType === 'string' ? body.productType.trim() : '';
    const guildName = typeof body.guildName === 'string' ? body.guildName.trim() : null;
    const days = Math.floor(Number(body.days));

    if (!SNOWFLAKE.test(guildId)) return fail('bad_request', 'معرّف السيرفر غير صحيح.', 400);
    if (!SNOWFLAKE.test(ownerId)) return fail('bad_request', 'معرّف صاحب السيرفر غير صحيح.', 400);
    if (!PRODUCT_TYPES.includes(productType)) return fail('bad_request', 'نوع المنتج غير صحيح.', 400);
    if (!Number.isFinite(days) || days < 1 || days > 90) return fail('bad_request', 'مدة التجربة يجب أن تكون بين 1 و 90 يوماً.', 400);

    const supabase = supabaseAdmin();
    const { data: account } = await supabase.from('accounts').select('id').eq('discord_user_id', ownerId).maybeSingle();

    const { data: instance, error } = await supabase.rpc('provision_instance', {
      p_account_id: account?.id ?? null,
      p_owner_id: ownerId,
      p_guild_id: guildId,
      p_guild_name: guildName,
      p_product_type: productType,
      p_plan_name: 'trial',
      p_duration_days: days,
      p_external_ref: `trial:${guildId}:${productType}:${Date.now()}`,
    });
    if (error) {
      if (String(error.message).includes('NO_TOKEN_AVAILABLE')) {
        return fail('conflict', 'لا يوجد توكن متاح لهذا المنتج. أضف توكناً للبركة أولاً.', 409);
      }
      throw error;
    }

    const instanceId = (instance as { id?: string })?.id;
    if (instanceId) {
      await supabase.from('bot_instances').update({ plan_type: 'trial', updated_at: new Date().toISOString() }).eq('id', instanceId);
    }

    await logWebsiteEvent({
      eventType: 'owner_grant_trial',
      message: 'Owner granted a free trial',
      userId: owner.discordUserId,
      guildId,
      botInstanceId: instanceId ?? null,
      metadata: { productType, days, targetOwner: ownerId },
    }).catch(() => {});

    return ok({ instanceId: instanceId ?? null, productType, days });
  } catch (error) {
    console.error('[owner/trial]', error);
    return internalError();
  }
}
