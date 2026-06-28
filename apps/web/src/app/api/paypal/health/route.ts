export const runtime = 'nodejs';

import { ok } from '@/lib/api-response';
import { paypalHealth } from '@/lib/paypal';

export async function GET() {
  return ok(paypalHealth());
}
