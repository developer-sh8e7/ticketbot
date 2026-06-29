import { findCheckoutProductSelection, type CheckoutProductSelection } from '@/lib/checkout-products';

type PayPalEnv = 'sandbox' | 'live';

export class PayPalConfigError extends Error {}
export class PayPalApiError extends Error {
  public constructor(message: string, public readonly status?: number) {
    super(message);
  }
}

function normalizePayPalEnv(value: string | undefined): PayPalEnv {
  return value === 'live' ? 'live' : 'sandbox';
}

let diagnosticsLogged = false;
function logPayPalDiagnostics() {
  if (diagnosticsLogged) return;
  diagnosticsLogged = true;
  const envValue = process.env.PAYPAL_ENV;
  console.info('[paypal] config', {
    paypalEnvLoaded: envValue ? 'yes' : 'no',
    clientIdPresent: process.env.PAYPAL_CLIENT_ID ? 'yes' : 'no',
    clientSecretPresent: process.env.PAYPAL_CLIENT_SECRET ? 'yes' : 'no',
    mode: normalizePayPalEnv(envValue),
  });
}

export function paypalPublicConfig() {
  logPayPalDiagnostics();
  return {
    clientId: process.env.PAYPAL_CLIENT_ID || '',
    env: normalizePayPalEnv(process.env.PAYPAL_ENV),
  };
}

export function paypalHealth() {
  return {
    paypalEnvLoaded: process.env.PAYPAL_ENV ? 'yes' : 'no',
    clientIdPresent: process.env.PAYPAL_CLIENT_ID ? 'yes' : 'no',
    clientSecretPresent: process.env.PAYPAL_CLIENT_SECRET ? 'yes' : 'no',
    mode: normalizePayPalEnv(process.env.PAYPAL_ENV),
  };
}

function paypalServerConfig() {
  const config = paypalPublicConfig();
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET || '';

  if (!config.clientId || !clientSecret) {
    throw new PayPalConfigError('PayPal Checkout is not configured.');
  }

  return {
    ...config,
    clientSecret,
    baseUrl: config.env === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com',
  };
}

function amountToCents(value: string): number {
  const amount = Number.parseFloat(value);
  if (!Number.isFinite(amount)) return Number.NaN;
  return Math.round(amount * 100);
}

export function findCheckoutProduct(input: {
  productId?: unknown;
  productSlug?: unknown;
  planId?: unknown;
  duration?: unknown;
}) {
  return findCheckoutProductSelection(input);
}

async function getPayPalAccessToken() {
  const config = paypalServerConfig();
  const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');
  const response = await fetch(`${config.baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new PayPalApiError('Unable to authenticate with PayPal.', response.status);
  }

  const data = (await response.json()) as { access_token?: string };
  if (!data.access_token) throw new PayPalApiError('PayPal did not return an access token.');
  return { accessToken: data.access_token, baseUrl: config.baseUrl };
}

async function paypalApi<T>(path: string, init: RequestInit): Promise<T> {
  const { accessToken, baseUrl } = await getPayPalAccessToken();
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new PayPalApiError('PayPal request failed.', response.status);
  }

  return (await response.json()) as T;
}

type PayPalCreateOrderResponse = {
  id?: string;
  status?: string;
};

function customId(selection: CheckoutProductSelection) {
  return `${selection.product.key}:${selection.plan.id}:${selection.plan.duration}`;
}

function purchaseUnitFor(selection: CheckoutProductSelection) {
  const { product, plan } = selection;
  return {
    reference_id: product.id,
    custom_id: customId(selection),
    description: `${product.name} - ${plan.label}`.slice(0, 127),
    amount: {
      currency_code: plan.currency,
      value: plan.amount,
    },
  };
}

/**
 * Create a PayPal order for one or more products (a cart).
 * Each selection becomes its own purchase_unit (PayPal supports up to 10).
 */
export async function createPayPalOrder(selections: CheckoutProductSelection | CheckoutProductSelection[]) {
  const list = Array.isArray(selections) ? selections : [selections];
  if (list.length === 0) throw new PayPalApiError('No products selected.');

  const order = await paypalApi<PayPalCreateOrderResponse>('/v2/checkout/orders', {
    method: 'POST',
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: list.map(purchaseUnitFor),
      application_context: {
        shipping_preference: 'NO_SHIPPING',
        user_action: 'PAY_NOW',
      },
    }),
  });

  if (!order.id) throw new PayPalApiError('PayPal did not return an order ID.');
  const first = list[0];
  return {
    orderID: order.id,
    productId: first.product.id,
    productSlug: first.product.key,
    productName: list.length > 1 ? `${first.product.name} +${list.length - 1}` : first.product.name,
    planId: first.plan.id,
    duration: first.plan.duration,
    amount: list.reduce((sum, s) => sum + Number.parseFloat(s.plan.amount), 0).toFixed(2),
    currency: first.plan.currency,
    itemCount: list.length,
  };
}

type PayPalCapture = {
  id?: string;
  status?: string;
  amount?: {
    currency_code?: string;
    value?: string;
  };
};

type PayPalCaptureOrderResponse = {
  id?: string;
  status?: string;
  purchase_units?: Array<{
    reference_id?: string;
    custom_id?: string;
    payments?: {
      captures?: PayPalCapture[];
    };
  }>;
  payer?: {
    email_address?: string;
  };
};

function verifyUnit(capturedOrder: PayPalCaptureOrderResponse, selection: CheckoutProductSelection) {
  const purchaseUnits = capturedOrder.purchase_units ?? [];
  const matchingUnit = purchaseUnits.find(
    (unit) => unit.reference_id === selection.product.id && unit.custom_id === customId(selection)
  );
  if (!matchingUnit) {
    throw new PayPalApiError('PayPal order does not match the selected product or plan.');
  }

  const captures = matchingUnit.payments?.captures ?? [];
  const completedCaptures = captures.filter((capture) => capture.status === 'COMPLETED');
  if (completedCaptures.length === 0) throw new PayPalApiError('PayPal capture was not completed.');

  const expectedCurrency = selection.plan.currency;
  const expectedCents = amountToCents(selection.plan.amount);
  const paidCents = completedCaptures.reduce((total, capture) => {
    if (capture.amount?.currency_code !== expectedCurrency) return Number.NaN;
    return total + amountToCents(capture.amount?.value ?? '');
  }, 0);

  if (!Number.isFinite(paidCents) || paidCents !== expectedCents) {
    throw new PayPalApiError('PayPal payment amount or currency did not match the selected product.');
  }

  return {
    captureID: completedCaptures[0]?.id || null,
    productId: selection.product.id,
    productSlug: selection.product.key,
    planId: selection.plan.id,
    duration: selection.plan.duration,
    amount: selection.plan.amount,
    currency: expectedCurrency,
  };
}

export async function captureAndVerifyPayPalOrder(
  orderID: string,
  selections: CheckoutProductSelection | CheckoutProductSelection[],
) {
  if (!orderID.trim()) throw new PayPalApiError('Missing PayPal order ID.');
  const list = Array.isArray(selections) ? selections : [selections];
  if (list.length === 0) throw new PayPalApiError('No products selected.');

  const capturedOrder = await paypalApi<PayPalCaptureOrderResponse>(
    `/v2/checkout/orders/${encodeURIComponent(orderID.trim())}/capture`,
    { method: 'POST', body: '{}' }
  );

  if (capturedOrder.status !== 'COMPLETED') {
    throw new PayPalApiError('PayPal payment was not completed.');
  }

  const verifiedItems = list.map((selection) => verifyUnit(capturedOrder, selection));

  return {
    orderID: capturedOrder.id || orderID,
    captureID: verifiedItems[0]?.captureID || null,
    items: verifiedItems,
    productId: verifiedItems[0]?.productId,
    productSlug: verifiedItems[0]?.productSlug,
    planId: verifiedItems[0]?.planId,
    duration: verifiedItems[0]?.duration,
    amount: verifiedItems.reduce((sum, i) => sum + Number.parseFloat(i.amount), 0).toFixed(2),
    currency: verifiedItems[0]?.currency,
    paymentStatus: capturedOrder.status,
    payerEmail: capturedOrder.payer?.email_address || null,
    timestamp: new Date().toISOString(),
  };
}
