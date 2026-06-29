export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { fail, internalError, ok } from '@/lib/api-response';
import { verifyCsrf } from '@/lib/csrf';
import { rateLimit } from '@/lib/rate-limit';
import { requireOwner } from '@/lib/owner';
import { getBotInstanceById } from '@/lib/admin-data';
import { supabaseAdmin } from '@/lib/supabase';
import { logWebsiteEvent } from '@/lib/events';

type Action = 'extend' | 'suspend' | 'activate';
type Body = { botId?: unknown; action?: unknown; days?: unknown };

const VALID_ACTIONS: Action[] = ['extend', 'suspend', 'activate'];

export async function POST(req: NextRequest) {
  try {
    if (!verifyCsrf(req)) return fail('csrf_failed', 'رمز الحماية غير صالح. أعد تحميل الصفحة.', 403);
    const owner = await requireOwner(req);
    if (!owner) return fail('forbidden', 'هذا الإجراء مقصور على مالك المتجر.', 403);
    if (!rateLimit(req, 'owner:bots', 30, 60_000).allowed) return fail('rate_limited', 'محاولات كثيرة. انتظر دقيقة.', 429);

    const body = (await req.json().catch(() => ({}))) as Body;
    const botId = typeof body.botId === 'string' ? body.botId.trim() : '';
    const action = typeof body.action === 'string' ? (body.action as Action) : null;
    if (!botId || !action || !VALID_ACTIONS.includes(action)) {
      return fail('bad_request', 'بيانات الإجراء غير مكتملة أو غير صحيحة.', 400);
    }

    const bot = await getBotInstanceById(botId);
    if (!bot) return fail('not_found', 'لم يتم العثور على البوت المطلوب.', 404);

    const supabase = supabaseAdmin();
    const nowIso = new Date().toISOString();
    let update: Record<string, unknown> = { updated_at: nowIso };

    if (action === 'extend') {
      const days = Math.floor(Number(body.days));
      if (!Number.isFinite(days) || days < 1 || days > 3650) {
        return fail('bad_request', 'عدد الأيام يجب أن يكون بين 1 و 3650.', 400);
      }
      const base = bot.expires_at && new Date(bot.expires_at) > new Date() ? new Date(bot.expires_at) : new Date();
      base.setDate(base.getDate() + days);
      update = { ...update, status: 'active', expires_at: base.toISOString() };
    } else if (action === 'suspend') {
      update = { ...update, status: 'paused' };
    } else if (action === 'activate') {
      update = { ...update, status: 'active' };
    }

    const { error } = await supabase.from('bot_instances').update(update).eq('id', botId);
    if (error) throw error;

    // Keep the subscription row in sync where one exists.
    if (action === 'extend' && update.expires_at) {
      await supabase.from('subscriptions').update({ status: 'active', expires_at: update.expires_at as string, updated_at: nowIso }).eq('instance_id', botId);
    } else if (action === 'suspend') {
      await supabase.from('subscriptions').update({ status: 'paused', updated_at: nowIso }).eq('instance_id', botId);
    } else if (action === 'activate') {
      await supabase.from('subscriptions').update({ status: 'active', updated_at: nowIso }).eq('instance_id', botId);
    }

    await logWebsiteEvent({
      eventType: 'owner_bot_action',
      message: `Owner performed ${action} on bot instance`,
      userId: owner.discordUserId,
      botInstanceId: botId,
      metadata: { action, days: body.days ?? null },
    }).catch(() => {});

    return ok({ botId, action, expires_at: update.expires_at ?? bot.expires_at });
  } catch (error) {
    console.error('[owner/bots]', error);
    return internalError();
  }
}
