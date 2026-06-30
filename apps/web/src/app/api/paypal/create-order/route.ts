export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { fail, internalError, ok } from '@/lib/api-response';
import { createPayPalOrder, findCheckoutProduct, PayPalApiError, PayPalConfigError } from '@/lib/paypal';
import type { CheckoutProductSelection } from '@/lib/checkout-products';
import { sendBuyWebhook } from '@/lib/webhook';
import { requireCustomer } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { checkTokenStock, productArabicName } from '@/lib/provisioning-shared';

type SelectionInput = {
  productId?: unknown;
  productSlug?: unknown;
  planId?: unknown;
  duration?: unknown;
};

type CreateOrderBody = SelectionInput & {
  items?: unknown;
};

/** Resolve a checkout body to one or more validated selections (cart or single). */
function resolveSelections(body: CreateOrderBody): CheckoutProductSelection[] | null {
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
    if (!rateLimit(req, 'paypal:create', 20, 60_000).allowed) return fail('rate_limited', 'محاولات كثيرة. انتظر دقيقة.', 429);

    const body = (await req.json()) as CreateOrderBody;
    const selections = resolveSelections(body);
    if (!selections) return fail('bad_request', 'Invalid or unavailable product, plan, or duration.', 400);

    // Don't take money for a bot we can't deliver: ensure pooled tokens exist.
    const shortage = await checkTokenStock(selections.map((s) => s.product.productType), session.discordUserId);
    if (shortage) {
      return fail(
        'conflict',
        `نفدت بوتات ${productArabicName(shortage.productType)} مؤقتاً. تواصل مع الدعم وسنوفّرها سريعاً.`,
        409,
      );
    }

    const order = await createPayPalOrder(selections);

    // DISCORD_BUY_WEB — payment attempt
    sendBuyWebhook('order_created', {
      title: '🔄 محاولة شراء',
      description: `${order.productName} — ${selections.length} منتج`,
      color: 0xf59e0b,
      fields: [
        { name: '📦 المنتجات', value: selections.map((s) => s.product.name).join('، '), inline: false },
        { name: '💵 المبلغ', value: `${order.amount} ${order.currency}`, inline: true },
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
