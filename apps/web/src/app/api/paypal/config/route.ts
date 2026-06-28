export const runtime = 'nodejs';

import { fail, ok } from '@/lib/api-response';
import { paypalPublicConfig } from '@/lib/paypal';

export async function GET() {
  const config = paypalPublicConfig();
  if (!config.clientId) return fail('internal_error', 'PayPal Checkout is not configured.', 503);

  return ok({ clientId: config.clientId, env: config.env });
}
