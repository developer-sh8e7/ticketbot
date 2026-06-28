export const runtime = 'nodejs';

import { fail, internalError, ok } from '@/lib/api-response';
import { createPayPalOrder, findCheckoutProduct, PayPalApiError, PayPalConfigError } from '@/lib/paypal';
import { sendBuyWebhook } from '@/lib/webhook';
import { requireCustomer } from '@/lib/auth';

type CreateOrderBody = {
  productId?: unknown;
  productSlug?: unknown;
  planId?: unknown;
  duration?: unknown;
};

export async function POST(req: Request) {
  try {
    const session = await requireCustomer();
    if (!session) return fail('unauthorized', 'Link your Discord account before purchasing.', 401);

    const body = (await req.json()) as CreateOrderBody;
    const checkoutProduct = findCheckoutProduct(body);
    if (!checkoutProduct) return fail('bad_request', 'Invalid or unavailable product, plan, or duration.', 400);

    const order = await createPayPalOrder(checkoutProduct);

    // DISCORD_BUY_WEB — payment attempt
    sendBuyWebhook('order_created', {
      title: '🔄 محاولة شراء',
      description: `${checkoutProduct.product.name} — ${checkoutProduct.plan.label}`,
      color: 0xf59e0b,
      fields: [
        { name: '📦 المنتج', value: checkoutProduct.product.name, inline: true },
        { name: '📄 المدة', value: checkoutProduct.plan.label, inline: true },
        { name: '💵 المبلغ', value: `${checkoutProduct.plan.amount} ${checkoutProduct.plan.currency}`, inline: true },
        { name: '🔖 رقم الطلب', value: `\`${order.orderID.slice(0, 20)}\``, inline: true },
      ],
      footer: 'Opus • شراء',
    }).catch(() => {});

    return ok(order);
  } catch (error) {
    if (error instanceof SyntaxError) return fail('bad_request', 'Invalid JSON body.', 400);
    if (error instanceof PayPalConfigError) return fail('internal_error', 'PayPal Checkout is not configured.', 503);
    if (error instanceof PayPalApiError) {
      const msg = error.message;
      console.error('[paypal/create-order]', msg);

      // DISCORD_BUY_WEB — payment error
      sendBuyWebhook('order_create_error', {
        title: '❌ فشل إنشاء الطلب',
        description: `\`${msg}\``,
        color: 0xef4444,
        footer: 'Opus • شراء',
      }).catch(() => {});

      return fail('internal_error', 'Unable to create PayPal order.', 502);
    }

    console.error('[paypal/create-order]', error instanceof Error ? error.message : 'Unknown error');
    return internalError();
  }
}
