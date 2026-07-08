export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { fail, internalError, ok } from '@/lib/api-response';
import { verifyCsrf } from '@/lib/csrf';
import { getSession } from '@/lib/sessions';
import { assertOwnedBot, latestBotConfig } from '@/lib/dashboard-data';
import { ticketSettingsSchema } from '@/lib/validation';
import { supabaseAdmin } from '@/lib/supabase';
import { logWebsiteEvent } from '@/lib/events';
import { notifyManagerSync } from '@/lib/manager-sync';
import { rateLimit } from '@/lib/rate-limit';
import { decryptBotToken } from '@/lib/encryption';
import { fetchBotGuildTextChannels, fetchBotGuildCategories, fetchBotGuildRoles, fetchBotGuildEmojis } from '@/lib/discord';

/** Resolve the decrypted token for this bot instance without exposing it to the browser. */
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

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getSession();
    if (!session) return fail('unauthorized', 'سجّل دخولك أولاً.', 401);
    if (!rateLimit(req, 'bot:ticket-settings', 30, 60_000).allowed) return fail('rate_limited', 'محاولات كثيرة. انتظر دقيقة.', 429);
    const bot = await assertOwnedBot(session.discordUserId, id);
    if (!bot) return fail('forbidden', 'Access denied', 403);
    if (bot.product_type !== 'ticket') return fail('bad_request', 'هذي الإعدادات خاصة ببوت التذاكر فقط.', 400);

    const config = await latestBotConfig(id);
    const settings = ((config?.config_data as Record<string, unknown>) || {}).ticketSettings ?? null;

    let channels = null;
    let categories = null;
    let roles = null;
    let emojis = null;
    const token = await tokenForInstance(id);
    if (token && bot.guild_id) {
      [channels, categories, roles, emojis] = await Promise.all([
        fetchBotGuildTextChannels(token, bot.guild_id).catch(() => null),
        fetchBotGuildCategories(token, bot.guild_id).catch(() => null),
        fetchBotGuildRoles(token, bot.guild_id).catch(() => null),
        fetchBotGuildEmojis(token, bot.guild_id).catch(() => null),
      ]);
    }

    return ok({ settings, channels, categories, roles, emojis });
  } catch (error) {
    console.error('[dashboard/ticket-settings][GET]', error);
    return internalError();
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!verifyCsrf(req)) return fail('csrf_failed', 'Invalid CSRF token', 403);
    const session = await getSession();
    if (!session) return fail('unauthorized', 'Login required', 401);
    const bot = await assertOwnedBot(session.discordUserId, id);
    if (!bot) return fail('forbidden', 'Access denied', 403);
    if (bot.status === 'expired') return fail('forbidden', 'Expired subscriptions are read-only. Please renew.', 403);

    const parsed = ticketSettingsSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return fail('bad_request', 'Invalid ticket settings payload', 400);
    const config = await latestBotConfig(id);
    const nextConfig = { ...((config?.config_data as Record<string, unknown>) || {}), ticketSettings: parsed.data };
    if (config?.id) {
      const { error } = await supabaseAdmin().from('bot_configs').update({ config_data: nextConfig, updated_at: new Date().toISOString() }).eq('id', config.id);
      if (error) throw error;
    } else {
      const { error } = await supabaseAdmin().from('bot_configs').insert({ bot_instance_id: id, guild_id: bot.guild_id, config_data: nextConfig });
      if (error) throw error;
    }
    await supabaseAdmin().from('bot_instances').update({ updated_at: new Date().toISOString() }).eq('id', id);
    await logWebsiteEvent({ eventType: 'config_update', message: 'Ticket settings updated', userId: session.discordUserId, guildId: bot.guild_id, botInstanceId: id });
    const sync = await notifyManagerSync('ticket_settings_updated', { bot_instance_id: id });
    return ok({ updated: true, sync });
  } catch (error) {
    console.error('[dashboard/ticket-settings]', error);
    return internalError();
  }
}
