import { supabaseAdmin } from './supabase';

export async function findOwnedBotIds(discordUserId: string) {
  const { data, error } = await supabaseAdmin()
    .from('activation_codes')
    .select('bot_instance_id')
    .eq('owner_discord_id', discordUserId)
    .not('bot_instance_id', 'is', null);
  if (error) throw error;
  return (data || []).map((row) => row.bot_instance_id as string).filter(Boolean);
}

export async function getOwnedBots(discordUserId: string) {
  const ids = await findOwnedBotIds(discordUserId);
  let query = supabaseAdmin().from('bot_instances').select('id,bot_user_id,bot_name,guild_id,guild_name,owner_id,product_type,plan_type,status,expires_at,support_ends_at,last_started_at,last_stopped_at,updated_at').eq('product_type', 'ticket');
  if (ids.length) query = query.or(`owner_id.eq.${discordUserId},id.in.(${ids.join(',')})`);
  else query = query.eq('owner_id', discordUserId);
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getOwnedBot(discordUserId: string, botId: string) {
  const bots = await getOwnedBots(discordUserId);
  return bots.find((bot) => bot.id === botId) || null;
}

export async function assertOwnedBot(discordUserId: string, botId: string) {
  const bot = await getOwnedBot(discordUserId, botId);
  if (!bot) return null;
  return bot;
}

export async function latestBotConfig(botInstanceId: string) {
  const { data, error } = await supabaseAdmin()
    .from('bot_configs')
    .select('id,config_data')
    .eq('bot_instance_id', botInstanceId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}
