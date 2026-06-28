export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { fail, ok } from '@/lib/api-response';
import { isAdminRequest, isAdminDiscordUser } from '@/lib/auth';
import { verifyCsrf } from '@/lib/csrf';
import { notifyManagerSync } from '@/lib/manager-sync';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!verifyCsrf(req)) return fail('csrf_failed', 'Invalid CSRF token', 403);
  if (!isAdminRequest(req)) {
    try { if (!(await isAdminDiscordUser())) return fail('unauthorized', 'Admin access required', 401); }
    catch { return fail('unauthorized', 'Admin access required (env not configured)', 401); }
  }
  const sync = await notifyManagerSync('admin_bot_sync', { bot_instance_id: id });
  return ok({ sync });
}
