import { supabaseAdmin } from './supabase';
import { isOwnerId } from './owner';

export async function findOwnedBotIds(discordUserId: string) {
  const { data, error } = await supabaseAdmin()
    .from('activation_codes')
    .select('bot_instance_id')
    .eq('owner_discord_id', discordUserId)
    .not('bot_instance_id', 'is', null);
  if (error) throw error;
  return (data || []).map((row) => row.bot_instance_id as string).filter(Boolean);
}

const BOT_FIELDS =
  'id,bot_user_id,bot_application_id,bot_name,bot_avatar_url,bot_banner_url,guild_id,guild_name,owner_id,product_type,plan_type,status,started_at,expires_at,last_started_at,last_stopped_at,created_at,updated_at';

export async function getOwnedBots(discordUserId: string) {
  const ids = await findOwnedBotIds(discordUserId);
  let query = supabaseAdmin().from('bot_instances').select(BOT_FIELDS);
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
  // مالك المتجر يقدر يدخل ويتحكم بأي بوت عميل من لوحته (دعم/تعديل مباشر).
  if (isOwnerId(discordUserId)) {
    const { data, error } = await supabaseAdmin().from('bot_instances').select(BOT_FIELDS).eq('id', botId).maybeSingle();
    if (error) throw error;
    return data ?? null;
  }

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
