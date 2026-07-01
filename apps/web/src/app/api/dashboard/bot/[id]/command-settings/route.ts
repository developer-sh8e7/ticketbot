export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { fail, internalError, ok } from '@/lib/api-response';
import { verifyCsrf } from '@/lib/csrf';
import { rateLimit } from '@/lib/rate-limit';
import { getSession } from '@/lib/sessions';
import { assertOwnedBot } from '@/lib/dashboard-data';
import { supabaseAdmin } from '@/lib/supabase';
import { decryptBotToken } from '@/lib/encryption';
import { fetchBotGuildRoles } from '@/lib/discord';
import { isOwnerId } from '@/lib/owner';
import { logWebsiteEvent } from '@/lib/events';

type Body = { commandName?: unknown; enabled?: unknown; allowedRoleIds?: unknown; allowedUserIds?: unknown };

type CommandInfo = { name: string; label: string; description: string; risk: 'low' | 'medium' | 'high' | 'danger' };
type CommandSetting = { commandName: string; enabled: boolean; allowedRoleIds: string[]; allowedUserIds: string[] };

const SYSTEM_COMMANDS: CommandInfo[] = [
  { name: 'ban', label: 'Ban — باند', description: 'حظر عضو من السيرفر.', risk: 'danger' },
  { name: 'softban', label: 'Softban — تنظيف + فك', description: 'يحظر ثم يفك الحظر لتنظيف رسائل العضو.', risk: 'danger' },
  { name: 'kick', label: 'Kick — طرد', description: 'طرد عضو من السيرفر.', risk: 'high' },
  { name: 'timeout', label: 'Timeout — إسكات مؤقت', description: 'إعطاء تايم آوت لمدة محددة.', risk: 'high' },
  { name: 'mute', label: 'Mute — ميوت', description: 'اختصار احترافي للتايم آوت.', risk: 'high' },
  { name: 'unmute', label: 'Unmute — فك الميوت', description: 'إزالة التايم آوت عن عضو.', risk: 'medium' },
  { name: 'warn', label: 'Warn — تحذير', description: 'تحذير عضو وتخزين التحذير.', risk: 'medium' },
  { name: 'warnings', label: 'Warnings — سجل التحذيرات', description: 'عرض تحذيرات عضو.', risk: 'low' },
  { name: 'clearwarns', label: 'Clear Warns — حذف التحذيرات', description: 'حذف تحذيرات عضو.', risk: 'high' },
  { name: 'clear', label: 'Clear — مسح رسائل', description: 'حذف رسائل بالجملة.', risk: 'medium' },
  { name: 'unban', label: 'Unban — فك باند', description: 'إزالة الحظر عن User ID.', risk: 'high' },
  { name: 'slowmode', label: 'Slowmode — وضع بطيء', description: 'تعديل السلومود للروم.', risk: 'medium' },
  { name: 'lock', label: 'Lock — قفل روم', description: 'منع الإرسال في روم.', risk: 'medium' },
  { name: 'unlock', label: 'Unlock — فتح روم', description: 'إرجاع الإرسال في روم.', risk: 'medium' },
  { name: 'nuke', label: 'Nuke — تفجير روم', description: 'حذف الروم وإعادة نسخه لتنظيفه بالكامل.', risk: 'danger' },
  { name: 'role', label: 'Role — إدارة رتبة', description: 'إضافة/إزالة رتبة من عضو.', risk: 'danger' },
  { name: 'nick', label: 'Nick — تعديل نك', description: 'تغيير أو تصفير اسم عضو داخل السيرفر.', risk: 'medium' },
  { name: 'hide', label: 'Hide — إخفاء روم', description: 'إخفاء روم عن everyone.', risk: 'medium' },
  { name: 'show', label: 'Show — إظهار روم', description: 'إظهار روم لـ everyone.', risk: 'medium' },
];

const COMMAND_NAMES = new Set(SYSTEM_COMMANDS.map((c) => c.name));
const SNOWFLAKE = /^\d{17,20}$/;

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.map((v) => String(v)).filter((v) => SNOWFLAKE.test(v)).slice(0, 30) : [];
}

function extractSnowflakes(value: unknown) {
  if (Array.isArray(value)) return asStringArray(value);
  if (typeof value !== 'string') return [];
  return Array.from(new Set((value.match(/\d{17,20}/g) ?? []).filter((v) => SNOWFLAKE.test(v)))).slice(0, 30);
}

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

async function ownedSystemBot(discordUserId: string, botId: string) {
  const bot = await assertOwnedBot(discordUserId, botId);
  if (!bot) return { error: fail('forbidden', 'Access denied', 403) };
  if (bot.product_type !== 'general') return { error: fail('bad_request', 'إعدادات أوامر السيستم خاصة ببوت السيستم فقط.', 400) };
  return { bot };
}

function defaultSetting(commandName: string): CommandSetting {
  return { commandName, enabled: true, allowedRoleIds: [], allowedUserIds: [] };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getSession();
    if (!session) return fail('unauthorized', 'سجّل دخولك أولاً.', 401);
    if (!rateLimit(req, 'bot:command-settings:get', 30, 60_000).allowed) return fail('rate_limited', 'محاولات كثيرة. انتظر دقيقة.', 429);

    const r = await ownedSystemBot(session.discordUserId, id);
    if ('error' in r) return r.error;

    const token = await tokenForInstance(id);
    if (!token) return fail('conflict', 'البوت غير مرتبط بتوكن بعد. انتظر تفعيله ثم أعد المحاولة.', 409);

    const [roles, settingsRes] = await Promise.all([
      fetchBotGuildRoles(token, r.bot.guild_id),
      supabaseAdmin()
        .from('guild_command_settings')
        .select('command_name,enabled,allowed_role_ids,allowed_user_ids')
        .eq('guild_id', r.bot.guild_id),
    ]);

    if (!roles) return fail('conflict', 'ما قدرنا نقرأ رتب السيرفر. تأكد أن البوت داخل السيرفر ومعه صلاحية View Server.', 409);
    if (settingsRes.error) throw settingsRes.error;

    const settings = new Map(SYSTEM_COMMANDS.map((c) => [c.name, defaultSetting(c.name)]));
    for (const row of settingsRes.data ?? []) {
      const commandName = String(row.command_name ?? '');
      if (!COMMAND_NAMES.has(commandName)) continue;
      settings.set(commandName, {
        commandName,
        enabled: row.enabled !== false,
        allowedRoleIds: asStringArray(row.allowed_role_ids),
        allowedUserIds: asStringArray(row.allowed_user_ids),
      });
    }

    return ok({ commands: SYSTEM_COMMANDS, roles, settings: Array.from(settings.values()) });
  } catch (error) {
    console.error('[dashboard/bot/command-settings][GET]', error);
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
    if (!rateLimit(req, 'bot:command-settings:post', 20, 60_000).allowed) return fail('rate_limited', 'محاولات كثيرة. انتظر دقيقة.', 429);

    const body = (await req.json().catch(() => ({}))) as Body;
    const commandName = typeof body.commandName === 'string' ? body.commandName.trim() : '';
    if (!COMMAND_NAMES.has(commandName)) return fail('bad_request', 'الأمر غير معروف.', 400);

    const enabled = body.enabled === undefined ? true : Boolean(body.enabled);
    const rawRoleIds = extractSnowflakes(body.allowedRoleIds);
    const allowedUserIds = extractSnowflakes(body.allowedUserIds);

    const token = await tokenForInstance(id);
    if (!token) return fail('conflict', 'البوت غير مرتبط بتوكن بعد. انتظر تفعيله ثم أعد المحاولة.', 409);
    const roles = await fetchBotGuildRoles(token, r.bot.guild_id);
    if (!roles) return fail('conflict', 'ما قدرنا نتحقق من رتب السيرفر. تأكد أن البوت داخل السيرفر.', 409);
    const validRoleIds = new Set(roles.map((role) => role.id));
    const allowedRoleIds = rawRoleIds.filter((roleId) => roleId !== r.bot.guild_id && validRoleIds.has(roleId));
    if (allowedRoleIds.length !== rawRoleIds.length) return fail('bad_request', 'فيه رتبة غير صالحة أو @everyone. اختر الرتب من القائمة فقط.', 400);

    const { error } = await supabaseAdmin().from('guild_command_settings').upsert(
      {
        guild_id: r.bot.guild_id,
        command_name: commandName,
        enabled,
        allowed_role_ids: allowedRoleIds,
        allowed_user_ids: allowedUserIds,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'guild_id,command_name' },
    );
    if (error) throw error;

    await logWebsiteEvent({
      eventType: 'system_command_settings_update',
      message: 'Customer updated system command permissions',
      userId: session.discordUserId,
      guildId: r.bot.guild_id,
      botInstanceId: id,
      metadata: { commandName, enabled, allowedRoleCount: allowedRoleIds.length, allowedUserCount: allowedUserIds.length },
    }).catch(() => {});

    return ok({ saved: true, setting: { commandName, enabled, allowedRoleIds, allowedUserIds } });
  } catch (error) {
    console.error('[dashboard/bot/command-settings][POST]', error);
    return internalError();
  }
}
