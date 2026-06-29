import { createClient } from '@supabase/supabase-js';
import { createTicketBot } from './bot.js';

async function main() {
  const token = process.env.DISCORD_TOKEN ?? process.env.TICKET_DEV_TOKEN;
  const guildId = process.env.GUILD_ID ?? process.env.TICKET_DEV_GUILD;
  const supabaseUrl = process.env.SUPABASE_URL ?? '';
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

  if (!token || !guildId) {
    throw new Error('DISCORD_TOKEN and GUILD_ID are required (or TICKET_DEV_TOKEN / TICKET_DEV_GUILD for local dev).');
  }
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
  const { data, error } = await supabase
    .from('server_configs')
    .select('config_data')
    .eq('guild_id', guildId)
    .eq('product_type', 'ticket')
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load config from server_configs: ${error.message}`);
  }
  if (!data?.config_data) {
    throw new Error(`No config found in server_configs for guild ${guildId} / product ticket. Run the seed SQL first.`);
  }

  const config = data.config_data as Record<string, unknown>;

  const bot = createTicketBot({
    token,
    guildId,
    ownerId: process.env.OWNER_ID ?? 'standalone',
    instanceId: `standalone-${guildId}`,
    config,
    supabaseUrl,
    supabaseServiceRoleKey,
  });

  const { botUserId } = await bot.start();
  console.log(`[ticket-bot] standalone — guild=${guildId} bot=${botUserId}`);

  process.on('SIGINT', () => bot.stop().then(() => process.exit(0)));
  process.on('SIGTERM', () => bot.stop().then(() => process.exit(0)));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
