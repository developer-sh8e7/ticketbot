export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { fail, internalError, ok } from '@/lib/api-response';
import { verifyCsrf } from '@/lib/csrf';
import { rateLimit } from '@/lib/rate-limit';
import { getSession } from '@/lib/sessions';
import { assertOwnedBot } from '@/lib/dashboard-data';
import { supabaseAdmin } from '@/lib/supabase';
import { logWebsiteEvent } from '@/lib/events';

type Body = { enabled?: unknown; channelId?: unknown; message?: unknown; pingUser?: unknown };
const SNOWFLAKE = /^\d{17,20}$/;

/** Welcome config lives per guild; only the system (general) bot uses it. */
async function ownedSystemBot(discordUserId: string, botId: string) {
  const bot = await assertOwnedBot(discordUserId, botId);
  if (!bot) return { error: fail('forbidden', 'Access denied', 403) };
  if (bot.product_type !== 'general') return { error: fail('bad_request', 'ميزة الترحيب خاصة ببوت السيستم فقط.', 400) };
  return { bot };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getSession();
    if (!session) return fail('unauthorized', 'Login required', 401);
    const r = await ownedSystemBot(session.discordUserId, id);
    if (r.error) return r.error;

    const { data } = await supabaseAdmin().from('guild_welcome').select('enabled,channel_id,message,ping_user').eq('guild_id', r.bot.guild_id).maybeSingle();
    return ok({
      welcome: {
        enabled: data?.enabled ?? false,
        channelId: data?.channel_id ?? '',
        message: data?.message ?? '',
        pingUser: data?.ping_user ?? true,
      },
    });
  } catch (error) {
    console.error('[dashboard/bot/welcome][GET]', error);
    return internalError();
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!verifyCsrf(req)) return fail('csrf_failed', 'رمز الحماية غير صالح. أعد تحميل الصفحة.', 403);
    const session = await getSession();
    if (!session) return fail('unauthorized', 'Login required', 401);
    const r = await ownedSystemBot(session.discordUserId, id);
    if (r.error) return r.error;
    if (r.bot.status === 'expired' || r.bot.status === 'cancelled') return fail('forbidden', 'الاشتراك منتهي. جدّد للتعديل.', 403);
    if (!rateLimit(req, 'bot:welcome', 20, 60_000).allowed) return fail('rate_limited', 'محاولات كثيرة. انتظر دقيقة.', 429);

    const body = (await req.json().catch(() => ({}))) as Body;
    const enabled = Boolean(body.enabled);
    const channelId = typeof body.channelId === 'string' ? body.channelId.trim() : '';
    const message = typeof body.message === 'string' ? body.message.trim().slice(0, 2000) : '';
    const pingUser = body.pingUser === undefined ? true : Boolean(body.pingUser);

    if (channelId && !SNOWFLAKE.test(channelId)) return fail('bad_request', 'معرّف روم الترحيب غير صحيح.', 400);
    if (enabled && !channelId) return fail('bad_request', 'اختر روم الترحيب لتفعيل الميزة.', 400);
    if (enabled && !message) return fail('bad_request', 'اكتب رسالة الترحيب أولاً.', 400);

    const { error } = await supabaseAdmin().from('guild_welcome').upsert({
      guild_id: r.bot.guild_id,
      enabled,
      channel_id: channelId || null,
      message: message || null,
      ping_user: pingUser,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'guild_id' });
    if (error) throw error;

    await logWebsiteEvent({
      eventType: 'welcome_config_update',
      message: 'Customer updated welcome config',
      userId: session.discordUserId,
      guildId: r.bot.guild_id,
      botInstanceId: id,
      metadata: { enabled, pingUser },
    }).catch(() => {});

    return ok({ saved: true });
  } catch (error) {
    console.error('[dashboard/bot/welcome][POST]', error);
    return internalError();
  }
}
