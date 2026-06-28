export const runtime = 'nodejs';

import { fail, internalError, ok } from '@/lib/api-response';
import { captureAndVerifyPayPalOrder, findCheckoutProduct, PayPalApiError, PayPalConfigError } from '@/lib/paypal';
import { sendBuyWebhook } from '@/lib/webhook';
import { requireCustomer } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

type CaptureOrderBody = {
  orderID?: unknown;
  productId?: unknown;
  productSlug?: unknown;
  planId?: unknown;
  duration?: unknown;
  guildId?: unknown;
  guildName?: unknown;
};

export async function POST(req: Request) {
  try {
    const session = await requireCustomer();
    if (!session) return fail('unauthorized', 'Link your Discord account before purchasing.', 401);

    const body = (await req.json()) as CaptureOrderBody;
    const guildId = (typeof body.guildId === 'string' ? body.guildId.trim() : '') || process.env.DEFAULT_PURCHASE_GUILD_ID || '';
    const guildName = (typeof body.guildName === 'string' ? body.guildName.trim() : '') || null;
    if (!guildId) return fail('bad_request', 'Link/select a Discord server before completing purchase.', 400);
    const orderID = typeof body.orderID === 'string' ? body.orderID.trim() : '';
    if (!orderID) return fail('bad_request', 'Missing PayPal order ID.', 400);

    const checkoutProduct = findCheckoutProduct(body);
    if (!checkoutProduct) return fail('bad_request', 'Invalid or unavailable product, plan, or duration.', 400);

    const result = await captureAndVerifyPayPalOrder(orderID, checkoutProduct);
    const supabase = supabaseAdmin();
    const { data: account } = await supabase.from('accounts').select('id').eq('discord_user_id', session.discordUserId).maybeSingle();
    if (!account?.id) return fail('unauthorized', 'Account link was not found. Login again.', 401);

    const amountCents = Math.round(Number(result.amount) * 100);
    const { error: paymentError } = await supabase.from('payments').upsert({
      account_id: account.id,
      product_id: checkoutProduct.product.id,
      plan_id: checkoutProduct.plan.dbPlanId,
      paypal_order_id: result.orderID,
      paypal_capture_id: result.captureID,
      status: 'captured',
      amount_cents: amountCents,
      currency: result.currency,
      metadata: { productType: checkoutProduct.product.productType, duration: result.duration, payerEmail: result.payerEmail },
    }, { onConflict: 'paypal_order_id' });
    if (paymentError) throw paymentError;

    if (checkoutProduct.productType !== 'custom') {
      const durationDays = checkoutProduct.plan.durationDays;
      const { data: instance, error: provisionError } = await supabase.rpc('provision_instance', {
        p_account_id: account.id,
        p_owner_id: session.discordUserId,
        p_guild_id: guildId,
        p_guild_name: guildName,
        p_product_type: checkoutProduct.productType,
        p_plan_name: checkoutProduct.plan.id,
        p_duration_days: durationDays,
        p_external_ref: result.orderID,
      });
      if (provisionError) throw provisionError;
      await supabase.from('payment_events').insert({ provider: 'paypal', event_type: 'provisioned', external_event_id: result.orderID, payload: { instance } });
    }

    // DISCORD_BUY_WEB — purchase success
    sendBuyWebhook('purchase_success', {
      title: '🛒 عملية شراء جديدة',
      description: `تم شراء **${checkoutProduct.product.name}** — ${checkoutProduct.plan.label}`,
      color: 0x00d4aa,
      fields: [
        { name: '📦 المنتج', value: checkoutProduct.product.name, inline: true },
        { name: '📄 المدة', value: checkoutProduct.plan.label, inline: true },
        { name: '💵 المبلغ', value: `${result.amount} ${result.currency}`, inline: true },
        { name: '🔖 رقم الطلب', value: `\`${result.orderID.slice(0, 20)}\``, inline: true },
        { name: '📧 البريد', value: result.payerEmail ? `\`${result.payerEmail.slice(0, 40)}\`` : '—', inline: true },
        { name: '🕒 الوقت', value: new Date().toLocaleString('ar-SA'), inline: true },
      ],
      footer: 'Opus • شراء',
    }).catch(() => {});

    return ok(result);
  } catch (error) {
    if (error instanceof SyntaxError) return fail('bad_request', 'Invalid JSON body.', 400);
    if (error instanceof PayPalConfigError) return fail('internal_error', 'PayPal Checkout is not configured.', 503);
    if (error instanceof PayPalApiError) {
      const msg = error.message;
      console.error('[paypal/capture-order]', msg);

      // DISCORD_BUY_WEB — payment error
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
