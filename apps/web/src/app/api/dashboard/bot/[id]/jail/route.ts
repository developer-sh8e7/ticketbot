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

type Body = { enabled?: unknown; allowedRoleIds?: unknown; allowedUserIds?: unknown };
type JailConfig = { enabled: boolean; allowedRoleIds: string[]; allowedUserIds: string[]; controlChannelId: string; jailRoleId: string; updatedAt: string | null };

const SNOWFLAKE = /^\d{17,20}$/;

function asStringArray(value: unknown) {
  return Array.isArray(value) ? Array.from(new Set(value.map((v) => String(v)).filter((v) => SNOWFLAKE.test(v)))).slice(0, 30) : [];
}

function extractSnowflakes(value: unknown) {
  if (Array.isArray(value)) return asStringArray(value);
  if (typeof value !== 'string') return [];
  return Array.from(new Set((value.match(/\d{17,20}/g) ?? []).filter((v) => SNOWFLAKE.test(v)))).slice(0, 30);
}

function jailFromConfig(configData: unknown): JailConfig {
  const jail = configData && typeof configData === 'object' ? (configData as Record<string, unknown>).jail : null;
  if (!jail || typeof jail !== 'object') return { enabled: false, allowedRoleIds: [], allowedUserIds: [], controlChannelId: '', jailRoleId: '', updatedAt: null };
  const raw = jail as Record<string, unknown>;
  return {
    enabled: raw.enabled === true,
    allowedRoleIds: asStringArray(raw.allowedRoleIds),
    allowedUserIds: asStringArray(raw.allowedUserIds),
    controlChannelId: typeof raw.controlChannelId === 'string' ? raw.controlChannelId : '',
    jailRoleId: typeof raw.jailRoleId === 'string' ? raw.jailRoleId : '',
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : null,
  };
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
  if (bot.product_type !== 'general') return { error: fail('bad_request', 'نظام السجن خاص ببوت السيستم فقط.', 400) };
  return { bot };
}

async function getConfigData(guildId: string) {
  const { data, error } = await supabaseAdmin().from('server_configs').select('config_data').eq('guild_id', guildId).eq('product_type', 'general').maybeSingle();
  if (error) throw error;
  return data?.config_data && typeof data.config_data === 'object' ? (data.config_data as Record<string, unknown>) : {};
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getSession();
    if (!session) return fail('unauthorized', 'سجّل دخولك أولاً.', 401);
    if (!rateLimit(req, 'bot:jail:get', 30, 60_000).allowed) return fail('rate_limited', 'محاولات كثيرة. انتظر دقيقة.', 429);

    const r = await ownedSystemBot(session.discordUserId, id);
    if ('error' in r) return r.error;

    const token = await tokenForInstance(id);
    if (!token) return fail('conflict', 'البوت غير مرتبط بتوكن بعد. انتظر تفعيله ثم أعد المحاولة.', 409);

    const [roles, configData, prisonersRes, delegatesRes, auditRes] = await Promise.all([
      fetchBotGuildRoles(token, r.bot.guild_id),
      getConfigData(r.bot.guild_id),
      supabaseAdmin().from('guild_jail_prisoners').select('id,user_id,jailed_by_id,reason,started_at,expires_at').eq('guild_id', r.bot.guild_id).is('released_at', null).order('expires_at', { ascending: true }).limit(25),
      supabaseAdmin().from('guild_jail_delegates').select('user_id,granted_by_id,created_at').eq('guild_id', r.bot.guild_id).is('revoked_at', null).order('created_at', { ascending: false }).limit(50),
      supabaseAdmin().from('guild_jail_audit').select('id,actor_id,target_user_id,action,reason,metadata,created_at').eq('guild_id', r.bot.guild_id).order('created_at', { ascending: false }).limit(50),
    ]);

    if (!roles) return fail('conflict', 'ما قدرنا نقرأ رتب السيرفر. تأكد أن البوت داخل السيرفر.', 409);
    if (prisonersRes.error) throw prisonersRes.error;
    if (delegatesRes.error) throw delegatesRes.error;
    if (auditRes.error) throw auditRes.error;

    return ok({ config: jailFromConfig(configData), roles, activeJails: prisonersRes.data ?? [], delegates: delegatesRes.data ?? [], audit: auditRes.data ?? [] });
  } catch (error) {
    console.error('[dashboard/bot/jail][GET]', error);
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
    if (!rateLimit(req, 'bot:jail:post', 15, 60_000).allowed) return fail('rate_limited', 'محاولات كثيرة. انتظر دقيقة.', 429);

    const body = (await req.json().catch(() => ({}))) as Body;
    const enabled = Boolean(body.enabled);
    const rawRoleIds = extractSnowflakes(body.allowedRoleIds);
    const allowedUserIds = extractSnowflakes(body.allowedUserIds);
    if (enabled && rawRoleIds.length + allowedUserIds.length === 0) return fail('bad_request', 'حدد رتبة أو شخص واحد على الأقل لاستخدام نظام السجن.', 400);

    const token = await tokenForInstance(id);
    if (!token) return fail('conflict', 'البوت غير مرتبط بتوكن بعد. انتظر تفعيله ثم أعد المحاولة.', 409);
    const roles = await fetchBotGuildRoles(token, r.bot.guild_id);
    if (!roles) return fail('conflict', 'ما قدرنا نتحقق من رتب السيرفر. تأكد أن البوت داخل السيرفر.', 409);
    const validRoleIds = new Set(roles.map((role) => role.id));
    const allowedRoleIds = rawRoleIds.filter((roleId) => roleId !== r.bot.guild_id && validRoleIds.has(roleId));
    if (allowedRoleIds.length !== rawRoleIds.length) return fail('bad_request', 'فيه رتبة غير صالحة أو @everyone. اختر الرتب من القائمة فقط.', 400);

    const configData = await getConfigData(r.bot.guild_id);
    const existing = jailFromConfig(configData);
    const jail: JailConfig = {
      ...existing,
      enabled,
      allowedRoleIds,
      allowedUserIds,
      updatedAt: new Date().toISOString(),
    };

    const { error } = await supabaseAdmin().from('server_configs').upsert(
      {
        guild_id: r.bot.guild_id,
        product_type: 'general',
        config_data: { ...configData, jail },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'guild_id,product_type' },
    );
    if (error) throw error;

    await logWebsiteEvent({
      eventType: 'system_jail_config_update',
      message: 'Customer updated SystemBot jail config',
      userId: session.discordUserId,
      guildId: r.bot.guild_id,
      botInstanceId: id,
      metadata: { enabled, allowedRoleCount: allowedRoleIds.length, allowedUserCount: allowedUserIds.length },
    }).catch(() => {});

    return ok({ saved: true, config: jail });
  } catch (error) {
    console.error('[dashboard/bot/jail][POST]', error);
    return internalError();
  }
}
