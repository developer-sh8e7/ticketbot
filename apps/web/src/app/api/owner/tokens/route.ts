export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { fail, internalError, ok } from '@/lib/api-response';
import { verifyCsrf } from '@/lib/csrf';
import { rateLimit } from '@/lib/rate-limit';
import { requireOwner } from '@/lib/owner';
import { supabaseAdmin } from '@/lib/supabase';
import { encryptBotToken } from '@/lib/encryption';
import { logWebsiteEvent } from '@/lib/events';
import { fulfillPendingProvisions } from '@/lib/provisioning-shared';
import { fetchBotApplication } from '@/lib/discord';
import { env } from '@/lib/env';

type Body = { productType?: unknown; token?: unknown; label?: unknown };

const PRODUCT_TYPES = ['ticket', 'voice_rooms', 'general'];

export async function POST(req: NextRequest) {
  try {
    if (!verifyCsrf(req)) return fail('csrf_failed', 'رمز الحماية غير صالح. أعد تحميل الصفحة.', 403);
    const owner = await requireOwner(req);
    if (!owner) return fail('forbidden', 'هذا الإجراء مقصور على مالك المتجر.', 403);
    if (!rateLimit(req, 'owner:tokens', 10, 60_000).allowed) return fail('rate_limited', 'محاولات كثيرة. انتظر دقيقة.', 429);

    if (!env().TOKEN_ENCRYPTION_KEY) {
      return fail('internal_error', 'مفتاح تشفير التوكنات غير مهيأ على الخادم (TOKEN_ENCRYPTION_KEY).', 503);
    }

    const body = (await req.json().catch(() => ({}))) as Body;
    const productType = typeof body.productType === 'string' ? body.productType.trim() : '';
    const token = typeof body.token === 'string' ? body.token.trim() : '';
    const customLabel = typeof body.label === 'string' ? body.label.trim().slice(0, 80) : '';

    if (!PRODUCT_TYPES.includes(productType)) return fail('bad_request', 'نوع المنتج غير صحيح.', 400);
    if (token.length < 50) return fail('bad_request', 'توكن البوت غير صالح. انسخه من Developer Portal → Bot → Reset Token.', 400);

    // The owner only pastes the token; we verify it with Discord and derive the
    // application id + name automatically. Invalid token → clear error.
    const app = await fetchBotApplication(token);
    if (!app) return fail('bad_request', 'التوكن غير صالح أو منتهي. تأكد من نسخه كاملاً من Discord.', 400);

    const label = customLabel || app.name;
    const encrypted = encryptBotToken(token);

    const { error } = await supabaseAdmin().from('token_pool').insert({
      product_type: productType,
      bot_application_id: app.id,
      bot_token_encrypted: encrypted,
      status: 'available',
      label,
    });
    if (error) {
      if (String(error.message).toLowerCase().includes('duplicate') || String(error.code) === '23505') {
        return fail('conflict', 'هذا التطبيق مضاف مسبقاً لبركة التوكنات.', 409);
      }
      throw error;
    }

    await logWebsiteEvent({
      eventType: 'owner_add_token',
      message: 'Owner added a bot token to the pool',
      userId: owner.discordUserId,
      metadata: { productType, applicationId: app.id, label },
    }).catch(() => {});

    // Activate any paid-but-deferred orders that were waiting on this token type.
    const fulfilled = await fulfillPendingProvisions(productType).catch(() => 0);

    return ok({ productType, applicationId: app.id, botName: app.name, fulfilledPending: fulfilled });
  } catch (error) {
    console.error('[owner/tokens]', error);
    return internalError();
  }
}
