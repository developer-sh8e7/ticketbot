import { Client, Events, GatewayIntentBits, Partials } from 'discord.js';
import {
  createLogger,
  createSupabaseClient,
  type BotFactory,
  type BotRuntimeOptions,
  type RunningBot,
} from '@opus/core';

const log = createLogger('ticket-bot');

/**
 * مصنع بوت التكتات.
 * الأوركستريتر يستدعيه لكل نسخة زبون بتوكن مسحوب من البركة + إعدادات السيرفر المحفوظة.
 *
 * ── الخدمات التي تُرحّل إلى هذه الحزمة (انظر MIGRATION_MAP.md) ──
 *   services:  ticketService, panelService, transcriptService, escalationService,
 *              complaintService, mediatorService, vouchesService, vouchesImageService,
 *              welcomeService, aiService, securityService, serverLogService,
 *              roleManagementService, roleProtectionService, permissionService,
 *              emojiService, infrastructureService
 *   builders:  ticketBuilder, panelBuilder, modalBuilder
 *   handlers:  mediatorApplicationHandler
 *   database:  ticketRepository, mediatorRepository, complaintRepository,
 *              roleManagementRepository, roleProtectionRepository, infrastructureRepository
 *   data:      moderationWordLists
 */
export const createTicketBot: BotFactory = (options: BotRuntimeOptions): RunningBot => {
  const supabase = createSupabaseClient({
    SUPABASE_URL: options.supabaseUrl,
    SUPABASE_SERVICE_ROLE_KEY: options.supabaseServiceRoleKey,
  });

  // التكتات تحتاج محتوى الرسائل والأعضاء (تأكد من تفعيل الـ Privileged Intents في البوابة).
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Channel, Partials.Message],
  });

  client.once(Events.ClientReady, async (ready) => {
    log.info(`🎫 Ticket bot ready: ${ready.user.tag} → guild ${options.guildId}`);
    // TODO(migration): registerProductCommands + InfrastructureService.ensureInfrastructure
    //                  ثم استعادة لوحة التكتات من options.config المحفوظ.
    void supabase; // يُستخدم داخل الخدمات المُرحّلة
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (interaction.guildId !== options.guildId) return; // عزل صارم: لا يخدم إلا سيرفره
    // TODO(migration): توجيه التفاعلات إلى TicketService / PanelService.
  });

  client.on(Events.Error, (err) => log.error(`Ticket client error: ${err.message}`));

  return {
    productType: 'ticket',
    instanceId: options.instanceId,
    async start() {
      await client.login(options.token);
      const botUserId = client.user?.id ?? '';
      return { botUserId };
    },
    async stop() {
      await client.destroy();
    },
  };
};

export default createTicketBot;
