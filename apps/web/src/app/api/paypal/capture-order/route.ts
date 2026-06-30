export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { fail, internalError, ok } from '@/lib/api-response';
import { captureAndVerifyPayPalOrder, findCheckoutProduct, PayPalApiError, PayPalConfigError } from '@/lib/paypal';
import type { CheckoutProductSelection } from '@/lib/checkout-products';
import { sendBuyWebhook } from '@/lib/webhook';
import { requireCustomer } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { supabaseAdmin } from '@/lib/supabase';
import { isProvisionable, productArabicName } from '@/lib/provisioning-shared';
import { botInviteUrl } from '@/lib/bot-invite';

type SelectionInput = {
  productId?: unknown;
  productSlug?: unknown;
  planId?: unknown;
  duration?: unknown;
};

type CaptureOrderBody = SelectionInput & {
  orderID?: unknown;
  items?: unknown;
  guildId?: unknown;
  guildName?: unknown;
};

const STORE_GUILD_ID = '1395842846107631746';

function resolveSelections(body: CaptureOrderBody): CheckoutProductSelection[] | null {
  const raw = Array.isArray(body.items) && body.items.length > 0 ? (body.items as SelectionInput[]) : [body];
  const selections: CheckoutProductSelection[] = [];
  for (const input of raw) {
    const found = findCheckoutProduct(input);
    if (!found) return null;
    selections.push(found);
  }
  return selections.length > 0 ? selections : null;
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireCustomer();
    if (!session) return fail('unauthorized', 'Link your Discord account before purchasing.', 401);
    if (!rateLimit(req, 'paypal:capture', 20, 60_000).allowed) return fail('rate_limited', 'محاولات كثيرة. انتظر دقيقة.', 429);

    const body = (await req.json()) as CaptureOrderBody;
    const guildId = (typeof body.guildId === 'string' ? body.guildId.trim() : '') || process.env.DEFAULT_PURCHASE_GUILD_ID || '';
    const guildName = (typeof body.guildName === 'string' ? body.guildName.trim() : '') || null;
    if (!guildId) return fail('bad_request', 'Link/select a Discord server before completing purchase.', 400);
    const orderID = typeof body.orderID === 'string' ? body.orderID.trim() : '';
    if (!orderID) return fail('bad_request', 'Missing PayPal order ID.', 400);

    const selections = resolveSelections(body);
    if (!selections) return fail('bad_request', 'Invalid or unavailable product, plan, or duration.', 400);

    const result = await captureAndVerifyPayPalOrder(orderID, selections);
    const supabase = supabaseAdmin();
    const { data: account } = await supabase.from('accounts').select('id').eq('discord_user_id', session.discordUserId).maybeSingle();
    if (!account?.id) return fail('unauthorized', 'Account link was not found. Login again.', 401);

    const first = selections[0];
    const amountCents = Math.round(Number(result.amount) * 100);
    const { error: paymentError } = await supabase.from('payments').upsert({
      account_id: account.id,
      product_id: first.product.id,
      plan_id: first.plan.dbPlanId,
      paypal_order_id: result.orderID,
      paypal_capture_id: result.captureID,
      status: 'captured',
      amount_cents: amountCents,
      currency: result.currency,
      metadata: {
        items: selections.map((s) => ({ productType: s.product.productType, plan: s.plan.id, duration: s.plan.duration })),
        payerEmail: result.payerEmail,
        guildId,
        guildName,
      },
    }, { onConflict: 'paypal_order_id' });
    if (paymentError) throw paymentError;

    // Provision each purchased bot to the chosen server. The payment is already
    // captured at this point, so a provisioning hiccup must NEVER turn into a
    // 500 that loses the order — we record what succeeded and what's pending.
    const pending: string[] = [];
    const invites: { productType: string; name: string; url: string }[] = [];
    for (const selection of selections) {
      const productType = selection.product.productType;
      // Manual/custom products (e.g. HumanGuard, custom bot) aren't pooled bots,
      // and the store's own server is exempt and always running.
      if (!isProvisionable(productType) || guildId === STORE_GUILD_ID) continue;

      // Unique per item so multi-item carts don't collide on the subscription's
      // external_ref unique index.
      const externalRef = `${result.orderID}:${productType}`;
      const { data: instance, error: provisionError } = await supabase.rpc('provision_instance', {
        p_account_id: account.id,
        p_owner_id: session.discordUserId,
        p_guild_id: guildId,
        p_guild_name: guildName,
        p_product_type: productType,
        p_plan_name: selection.plan.id,
        p_duration_days: selection.plan.durationDays,
        p_external_ref: externalRef,
      });

      if (provisionError) {
        // Out of tokens (lost a stock race) — defer, don't fail the paid order.
        if (/NO_TOKEN_AVAILABLE/.test(provisionError.message)) {
          pending.push(productType);
          await supabase.from('payment_events').insert({
            provider: 'paypal',
            event_type: 'provision_pending',
            external_event_id: result.orderID,
            // Self-contained so it can be fulfilled later without re-deriving anything.
            payload: {
              productType,
              reason: 'no_token_available',
              guildId,
              guildName,
              ownerId: session.discordUserId,
              accountId: account.id,
              planId: selection.plan.id,
              durationDays: selection.plan.durationDays,
              externalRef,
            },
          });
          continue;
        }
        throw provisionError;
      }
      await supabase.from('payment_events').insert({ provider: 'paypal', event_type: 'provisioned', external_event_id: result.orderID, payload: { instance, productType } });

      // Build the one-click invite link so the buyer can add the bot immediately.
      const appId = (instance as { bot_application_id?: string | null } | null)?.bot_application_id;
      if (appId) invites.push({ productType, name: selection.product.name, url: botInviteUrl(appId, guildId) });
    }

    // Alert the owner so they can top up the pool; the buyer is told it's coming.
    if (pending.length > 0) {
      sendBuyWebhook('provision_pending', {
        title: '⚠️ دفع مكتمل بانتظار توكن',
        description: `طلب \`${result.orderID.slice(0, 20)}\` دفع لكن لا يوجد توكن متاح. أضف توكناً للبركة لتفعيله.`,
        color: 0xf59e0b,
        fields: [
          { name: '📦 بانتظار', value: pending.map(productArabicName).join('، '), inline: false },
          { name: '🏠 السيرفر', value: `\`${guildId}\``, inline: true },
        ],
        footer: 'Opus • تفعيل مؤجل',
      }).catch(() => {});
    }

    // DISCORD_BUY_WEB — purchase success
    sendBuyWebhook('purchase_success', {
      title: '🛒 عملية شراء جديدة',
      description: `تم شراء ${selections.length} منتج`,
      color: 0x00d4aa,
      fields: [
        { name: '📦 المنتجات', value: selections.map((s) => `${s.product.name} (${s.plan.label})`).join('\n'), inline: false },
        { name: '💵 المبلغ', value: `${result.amount} ${result.currency}`, inline: true },
        { name: '🔖 رقم الطلب', value: `\`${result.orderID.slice(0, 20)}\``, inline: true },
        { name: '📧 البريد', value: result.payerEmail ? `\`${result.payerEmail.slice(0, 40)}\`` : '—', inline: true },
      ],
      footer: 'Opus • شراء',
    }).catch(() => {});

    return ok({ ...result, provisioning: pending.length > 0 ? 'pending' : 'active', pendingProducts: pending, invites });
  } catch (error) {
    if (error instanceof SyntaxError) return fail('bad_request', 'Invalid JSON body.', 400);
    if (error instanceof PayPalConfigError) return fail('internal_error', 'PayPal Checkout is not configured.', 503);
    if (error instanceof PayPalApiError) {
      const msg = error.message;
      console.error('[paypal/capture-order]', msg);

      sendBuyWebhook('capture_error', {
        title: '❌ خطأ في الدفع',
        description: `\`${msg}\``,
        color: 0xef4444,
        footer: 'Opus • شراء',
      }).catch(() => {});

      return fail('internal_error', 'Unable to capture or verify PayPal order.', 502);
    }

    console.error('[paypal/capture-order]', error instanceof Error ? error.message : 'Unknown error');
    return internalError();
  }
}
