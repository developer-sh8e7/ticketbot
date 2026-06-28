/**
 * تشغيل مستقل لبوت التكتات (للتطوير فقط).
 * في الإنتاج، الأوركستريتر هو من يستدعي createTicketBot لكل نسخة زبون.
 *
 * شغّل عبر: TICKET_DEV_TOKEN=... TICKET_DEV_GUILD=... pnpm dev:ticket
 */
import { createTicketBot } from './bot.js';

async function main() {
  const token = process.env.TICKET_DEV_TOKEN;
  const guildId = process.env.TICKET_DEV_GUILD;
  if (!token || !guildId) {
    throw new Error('TICKET_DEV_TOKEN و TICKET_DEV_GUILD مطلوبان للتشغيل المستقل.');
  }

  const bot = createTicketBot({
    token,
    guildId,
    ownerId: process.env.TICKET_DEV_OWNER ?? 'dev',
    instanceId: 'dev-instance',
    config: {},
    supabaseUrl: process.env.SUPABASE_URL ?? '',
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  });

  const { botUserId } = await bot.start();
  console.log(`[ticket-bot] running as ${botUserId}`);

  process.on('SIGINT', () => bot.stop().then(() => process.exit(0)));
  process.on('SIGTERM', () => bot.stop().then(() => process.exit(0)));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
