export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { clearSession } from '@/lib/sessions';
import { verifyCsrf } from '@/lib/csrf';
import { fail } from '@/lib/api-response';
import { env } from '@/lib/env';

export async function POST(req: NextRequest) {
  if (!verifyCsrf(req)) return fail('csrf_failed', 'Invalid CSRF token', 403);
  const res = NextResponse.redirect(new URL('/login', env().APP_URL));
  await clearSession(res);
  return res;
}
