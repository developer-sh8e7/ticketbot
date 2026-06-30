export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { fail, internalError, ok } from '@/lib/api-response';
import { verifyCsrf } from '@/lib/csrf';
import { rateLimit } from '@/lib/rate-limit';
import { getSession } from '@/lib/sessions';
import { assertOwnedBot } from '@/lib/dashboard-data';
import { supabaseAdmin } from '@/lib/supabase';
import { decryptBotToken } from '@/lib/encryption';
import { getBotProfile, updateBotProfile, type BotProfile } from '@/lib/discord';
import { logWebsiteEvent } from '@/lib/events';

type Body = { name?: unknown; avatar?: unknown; banner?: unknown };

const MAX_IMAGE_CHARS = 8_000_000; // ~6MB binary as base64 data URI

/** Resolve the decrypted bot token for an owned instance, or null. */
async function tokenForInstance(botId: string): Promise<string | null> {
  const supabase = supabaseAdmin();
  const { data: inst } = await supabase.from('bot_instances').select('token_id').eq('id', botId).maybeSingle();
  if (!inst?.token_id) return null;
  const { data: tok } = await supabase.from('token_pool').select('bot_token_encrypted').eq('id', inst.token_id).maybeSingle();
  if (!tok?.bot_token_encrypted) return null;
  try {
    return decryptBotToken(tok.bot_token_encrypted);
  } catch {
    return null;
  }
}

/** Cache the resolved profile URLs onto the instance so the dashboard renders them. */
async function cacheProfile(botId: string, profile: BotProfile) {
  await supabaseAdmin()
    .from('bot_instances')
    .update({ bot_name: profile.username, bot_avatar_url: profile.avatarUrl, bot_banner_url: profile.bannerUrl, updated_at: new Date().toISOString() })
    .eq('id', botId);
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getSession();
    if (!session) return fail('unauthorized', 'Login required', 401);
    const bot = await assertOwnedBot(session.discordUserId, id);
    if (!bot) return fail('forbidden', 'Access denied', 403);

    const token = await tokenForInstance(id);
    if (!token) return fail('conflict', 'البوت غير مرتبط بتوكن بعد. انتظر تفعيله ثم أعد المحاولة.', 409);

    const profile = await getBotProfile(token);
    if (!profile) return fail('internal_error', 'تعذّر جلب بروفايل البوت من Discord.', 502);
    await cacheProfile(id, profile).catch(() => {});
    return ok({ profile });
  } catch (error) {
    console.error('[dashboard/bot/profile][GET]', error);
    return internalError();
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!verifyCsrf(req)) return fail('csrf_failed', 'رمز الحماية غير صالح. أعد تحميل الصفحة.', 403);
    const session = await getSession();
    if (!session) return fail('unauthorized', 'Login required', 401);
    const bot = await assertOwnedBot(session.discordUserId, id);
    if (!bot) return fail('forbidden', 'Access denied', 403);
    if (bot.status === 'expired' || bot.status === 'cancelled') {
      return fail('forbidden', 'الاشتراك منتهي. جدّد لتعديل بروفايل البوت.', 403);
    }
    if (!rateLimit(req, 'bot:profile', 6, 60_000).allowed) return fail('rate_limited', 'محاولات كثيرة. انتظر دقيقة.', 429);

    const body = (await req.json().catch(() => ({}))) as Body;
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const avatar = typeof body.avatar === 'string' ? body.avatar.trim() : '';
    const banner = typeof body.banner === 'string' ? body.banner.trim() : '';

    const update: { username?: string; avatar?: string; banner?: string } = {};
    if (name) {
      if (name.length < 2 || name.length > 32) return fail('bad_request', 'اسم البوت يجب أن يكون بين 2 و 32 حرفاً.', 400);
      update.username = name;
    }
    for (const [key, value] of [['avatar', avatar], ['banner', banner]] as const) {
      if (!value) continue;
      if (!value.startsWith('data:image/')) return fail('bad_request', 'الصورة يجب أن تكون ملف صورة صالح.', 400);
      if (value.length > MAX_IMAGE_CHARS) return fail('bad_request', 'حجم الصورة كبير. استخدم صورة أصغر (أقل من 6MB).', 400);
      update[key] = value;
    }
    if (Object.keys(update).length === 0) return fail('bad_request', 'لا يوجد تغيير. اكتب اسماً أو اختر صورة.', 400);

    const token = await tokenForInstance(id);
    if (!token) return fail('conflict', 'البوت غير مرتبط بتوكن بعد.', 409);

    const result = await updateBotProfile(token, update);
    if (!result.ok) {
      if (result.status === 429) return fail('rate_limited', 'Discord يحدّ تغيير الاسم (مرتين بالساعة). جرّب لاحقاً.', 429);
      return fail('internal_error', 'تعذّر تحديث البروفايل. تأكد من صحة الصورة وحاول مجدداً.', 502);
    }
    await cacheProfile(id, result.profile).catch(() => {});

    await logWebsiteEvent({
      eventType: 'bot_profile_update',
      message: 'Customer updated bot profile',
      userId: session.discordUserId,
      botInstanceId: id,
      metadata: { changed: Object.keys(update) },
    }).catch(() => {});

    return ok({ profile: result.profile });
  } catch (error) {
    console.error('[dashboard/bot/profile][POST]', error);
    return internalError();
  }
}
