export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { fail, internalError, ok } from '@/lib/api-response';
import { verifyCsrf } from '@/lib/csrf';
import { rateLimit } from '@/lib/rate-limit';
import { getSession } from '@/lib/sessions';
import { assertOwnedBot } from '@/lib/dashboard-data';
import { isOwnerId } from '@/lib/owner';
import { supabaseAdmin } from '@/lib/supabase';
import { logWebsiteEvent } from '@/lib/events';

type Body = { alias?: unknown; commandName?: unknown; id?: unknown };

/** يطابق ALIASABLE_COMMANDS في apps/system-bot/src/legacy/services/aliasCommands.ts */
const ALIASABLE_COMMANDS = new Set([
  'ban', 'kick', 'timeout', 'warn', 'clear', 'unban',
  'slowmode', 'lock', 'unlock', 'nuke', 'role', 'hide', 'show',
]);

const MAX_ALIASES_PER_GUILD = 30;

/** الاختصارات خاصة ببوت السيستم فقط (نفس قيد ميزة الترحيب). */
async function ownedSystemBot(discordUserId: string, botId: string) {
  const bot = await assertOwnedBot(discordUserId, botId);
  if (!bot) return { error: fail('forbidden', 'Access denied', 403) };
  if (bot.product_type !== 'general') return { error: fail('bad_request', 'الاختصارات خاصة ببوت السيستم فقط.', 400) };
  return { bot };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getSession();
    if (!session) return fail('unauthorized', 'Login required', 401);
    const r = await ownedSystemBot(session.discordUserId, id);
    if ('error' in r) return r.error;

    const { data, error } = await supabaseAdmin()
      .from('guild_command_aliases')
      .select('id,alias,command_name')
      .eq('guild_id', r.bot.guild_id)
      .order('created_at', { ascending: true });
    if (error) throw error;

    return ok({ aliases: (data ?? []).map((row) => ({ id: row.id, alias: row.alias, commandName: row.command_name })) });
  } catch (error) {
    console.error('[dashboard/bot/aliases][GET]', error);
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
    if ('error' in r) return r.error;
    if (!isOwnerId(session.discordUserId) && (r.bot.status === 'expired' || r.bot.status === 'cancelled')) return fail('forbidden', 'الاشتراك منتهي. جدّد للتعديل.', 403);
    if (!rateLimit(req, 'bot:aliases', 20, 60_000).allowed) return fail('rate_limited', 'محاولات كثيرة. انتظر دقيقة.', 429);

    const body = (await req.json().catch(() => ({}))) as Body;
    const alias = typeof body.alias === 'string' ? body.alias.trim() : '';
    const commandName = typeof body.commandName === 'string' ? body.commandName.trim() : '';

    if (!alias || /\s/.test(alias) || alias.length > 32) return fail('bad_request', 'الاختصار يجب أن يكون كلمة واحدة بدون مسافات (٣٢ حرف كحد أقصى).', 400);
    if (!ALIASABLE_COMMANDS.has(commandName)) return fail('bad_request', 'أمر غير مدعوم للاختصار.', 400);

    const { count } = await supabaseAdmin()
      .from('guild_command_aliases')
      .select('id', { count: 'exact', head: true })
      .eq('guild_id', r.bot.guild_id);
    if ((count ?? 0) >= MAX_ALIASES_PER_GUILD) return fail('bad_request', `الحد الأقصى ${MAX_ALIASES_PER_GUILD} اختصاراً لكل سيرفر.`, 400);

    const { error } = await supabaseAdmin()
      .from('guild_command_aliases')
      .upsert({ guild_id: r.bot.guild_id, alias, command_name: commandName }, { onConflict: 'guild_id,alias' });
    if (error) throw error;

    await logWebsiteEvent({
      eventType: 'alias_command_create',
      message: 'Customer added a command alias',
      userId: session.discordUserId,
      guildId: r.bot.guild_id,
      botInstanceId: id,
      metadata: { alias, commandName },
    }).catch(() => {});

    return ok({ saved: true });
  } catch (error) {
    console.error('[dashboard/bot/aliases][POST]', error);
    return internalError();
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!verifyCsrf(req)) return fail('csrf_failed', 'رمز الحماية غير صالح. أعد تحميل الصفحة.', 403);
    const session = await getSession();
    if (!session) return fail('unauthorized', 'Login required', 401);
    const r = await ownedSystemBot(session.discordUserId, id);
    if ('error' in r) return r.error;
    if (!rateLimit(req, 'bot:aliases', 20, 60_000).allowed) return fail('rate_limited', 'محاولات كثيرة. انتظر دقيقة.', 429);

    const body = (await req.json().catch(() => ({}))) as Body;
    const aliasId = typeof body.id === 'string' ? body.id.trim() : '';
    if (!aliasId) return fail('bad_request', 'معرّف غير صحيح.', 400);

    // .eq('guild_id', ...) يمنع حذف اختصار يخص سيرفر ثاني حتى لو خمّن العميل الـ id.
    const { error } = await supabaseAdmin()
      .from('guild_command_aliases')
      .delete()
      .eq('id', aliasId)
      .eq('guild_id', r.bot.guild_id);
    if (error) throw error;

    return ok({ deleted: true });
  } catch (error) {
    console.error('[dashboard/bot/aliases][DELETE]', error);
    return internalError();
  }
}
