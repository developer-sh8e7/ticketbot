export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { fail, internalError, ok } from '@/lib/api-response';
import { verifyCsrf } from '@/lib/csrf';
import { getSession } from '@/lib/sessions';
import { assertOwnedBot, latestBotConfig } from '@/lib/dashboard-data';
import { botIdentitySchema } from '@/lib/validation';
import { supabaseAdmin } from '@/lib/supabase';
import { logWebsiteEvent } from '@/lib/events';
import { notifyManagerSync } from '@/lib/manager-sync';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!verifyCsrf(req)) return fail('csrf_failed', 'Invalid CSRF token', 403);
    const session = await getSession();
    if (!session) return fail('unauthorized', 'Login required', 401);
    const bot = await assertOwnedBot(session.discordUserId, id);
    if (!bot) return fail('forbidden', 'Access denied', 403);
    if (bot.status === 'expired') return fail('forbidden', 'Expired subscriptions are read-only. Please renew.', 403);

    const raw = await req.json().catch(() => ({}));
    if ('status' in raw) {
      await logWebsiteEvent({ eventType: 'suspicious_input_rejected', message: 'Manual status update rejected', userId: session.discordUserId, botInstanceId: id });
      return fail('bad_request', 'Bot status cannot be changed', 400);
    }
    const parsed = botIdentitySchema.safeParse(raw);
    if (!parsed.success) return fail('bad_request', 'Invalid bot identity payload', 400);

    if (parsed.data.bot_name) {
      const { error } = await supabaseAdmin().from('bot_instances').update({ bot_name: parsed.data.bot_name, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
    }
    const config = await latestBotConfig(id);
    const nextConfig = { ...((config?.config_data as Record<string, unknown>) || {}), identity: { bot_avatar: parsed.data.bot_avatar ?? null, bot_description: parsed.data.bot_description ?? null, status: 'Playing Opus Solutions' } };
    if (config?.id) {
      const { error } = await supabaseAdmin().from('bot_configs').update({ config_data: nextConfig, updated_at: new Date().toISOString() }).eq('id', config.id);
      if (error) throw error;
    } else {
      const { error } = await supabaseAdmin().from('bot_configs').insert({ bot_instance_id: id, guild_id: bot.guild_id, config_data: nextConfig });
      if (error) throw error;
    }

    await logWebsiteEvent({ eventType: 'config_update', message: 'Bot identity updated', userId: session.discordUserId, botInstanceId: id });
    const sync = await notifyManagerSync('bot_identity_updated', { bot_instance_id: id });
    return ok({ updated: true, sync });
  } catch (error) {
    console.error('[dashboard/bot/update]', error);
    return internalError();
  }
}
