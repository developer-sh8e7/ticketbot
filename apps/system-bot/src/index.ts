/** تشغيل مستقل للبوت العام (تطوير فقط). */
import { createSystemBot } from './bot.js';

async function main() {
  const token = process.env.GENERAL_DEV_TOKEN;
  const guildId = process.env.GENERAL_DEV_GUILD;
  if (!token || !guildId) {
    throw new Error('GENERAL_DEV_TOKEN و GENERAL_DEV_GUILD مطلوبان للتشغيل المستقل.');
  }

  const bot = createSystemBot({
    token,
    guildId,
    ownerId: process.env.GENERAL_DEV_OWNER ?? 'dev',
    instanceId: 'dev-instance',
    config: {},
    supabaseUrl: process.env.SUPABASE_URL ?? '',
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  });

  const { botUserId } = await bot.start();
  console.log(`[system-bot] running as ${botUserId}`);

  process.on('SIGINT', () => bot.stop().then(() => process.exit(0)));
  process.on('SIGTERM', () => bot.stop().then(() => process.exit(0)));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
