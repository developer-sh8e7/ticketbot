import { createServer } from 'node:http';
import {
  Client,
  Events,
  GatewayIntentBits,
  MessageFlags,
  Partials,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { registerCommands } from './commands/registerCommands.js';
import { ADD_MEMBER_MODAL_ID, REMOVE_MEMBER_MODAL_ID, TICKET_BUTTON_IDS, isOpenTicketModal } from './constants/customIds.js';
import { createSupabaseClient } from './database/supabase.js';
import { InfrastructureRepository } from './database/infrastructureRepository.js';
import { TicketRepository } from './database/ticketRepository.js';
import { loadEnv } from './env.js';
import { ConfigStore } from './services/configStore.js';
import { InfrastructureService } from './services/infrastructureService.js';
import { PanelService } from './services/panelService.js';
import { canManagePanels } from './services/permissionService.js';
import { TicketService } from './services/ticketService.js';
import { TranscriptService } from './services/transcriptService.js';
import { activityTypeFromName } from './utils/discord.js';
import { consumeLifecycleErrors, isInteractionLifecycleError, safeDeferReply, safeEditReply, safeReply } from './utils/interaction.js';
import { logger } from './utils/logger.js';
import { buildErrorEmbed, buildSuccessEmbed } from './builders/ticketBuilder.js';

const env = loadEnv();
const INSTANCE_ID = Math.random().toString(36).slice(2, 8);
let consecutiveInteractionFailures = 0;
const DUPLICATE_THRESHOLD = 5;
const configStore = new ConfigStore(env.CONFIG_PATH);
const supabase = createSupabaseClient(env);
const ticketRepository = new TicketRepository(supabase);
const infrastructureRepository = new InfrastructureRepository(supabase);
const transcriptService = new TranscriptService();
const panelService = new PanelService(configStore);
const infrastructureService = new InfrastructureService({
  configStore,
  infrastructureRepository,
});
const ticketService = new TicketService({
  configStore,
  ticketRepository,
  transcriptService,
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel, Partials.Message],
});

async function syncCommands(): Promise<void> {
  const config = configStore.current;

  if (!config.commands.registerOnStartup) {
    logger.info('Command registration on startup is disabled.');
    return;
  }

  await registerCommands(env.DISCORD_TOKEN, env.DISCORD_CLIENT_ID, config);
  logger.info('Slash commands registered successfully.');
}

async function ensurePanelManager(interaction: ChatInputCommandInteraction): Promise<boolean> {
  if (!interaction.inCachedGuild() || !interaction.member) {
    await safeReply(interaction, [buildErrorEmbed(configStore.current, 'This command only works inside the configured guild.')]);
    return false;
  }

  if (!canManagePanels(interaction.member, configStore.current)) {
    await safeReply(interaction, [buildErrorEmbed(configStore.current, configStore.current.ticket.messages.noPermission)]);
    return false;
  }

  return true;
}

async function handleCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const config = configStore.current;

  if (interaction.commandName === config.commands.names.panelSend) {
    if (!(await ensurePanelManager(interaction))) {
      return;
    }

    if (!(await safeDeferReply(interaction, interaction.commandName))) {
      return;
    }
    const message = await panelService.sendPanel(interaction.guild!);
    await safeEditReply(interaction, [buildSuccessEmbed(configStore.current, 'Panel Sent', `Panel has been sent successfully.\nMessage ID: \`${message.id}\``)]);
    return;
  }

  if (interaction.commandName === config.commands.names.panelRefresh) {
    if (!(await ensurePanelManager(interaction))) {
      return;
    }

    if (!(await safeDeferReply(interaction, interaction.commandName))) {
      return;
    }
    const messageId = interaction.options.getString('message-id') ?? undefined;
    const message = await panelService.refreshPanel(interaction.guild!, messageId);
    await safeEditReply(interaction, [buildSuccessEmbed(configStore.current, 'Panel Refreshed', `Panel has been refreshed.\nMessage ID: \`${message.id}\``)]);
    return;
  }

  if (interaction.commandName === config.commands.names.configReload) {
    if (!(await ensurePanelManager(interaction))) {
      return;
    }

    if (!(await safeDeferReply(interaction))) {
      return;
    }
    configStore.reload();
    
    try {
      await infrastructureService.ensureInfrastructure(interaction.client);
    } catch (error) {
      logger.error('Failed to setup infrastructure during reload', error instanceof Error ? error.message : error);
    }

    await syncCommands();
    await safeEditReply(interaction, [buildSuccessEmbed(configStore.current, 'Config Reloaded', 'تم إعادة تحميل config.json وتحديث الأوامر.')]);
    return;
  }

  if (interaction.commandName === config.commands.names.emojiRefresh) {
    if (!(await ensurePanelManager(interaction))) {
      return;
    }

    if (!(await safeDeferReply(interaction))) {
      return;
    }

    try {
      const guild = interaction.guild!;
      const categoryKeys = configStore.current.categories.filter((c) => c.enabled).map((c) => c.key);
      const { ensureEmojis } = await import('./services/emojiService.js');
      const emojis = await ensureEmojis(guild, categoryKeys, true);
      configStore.patchEmojis(emojis.categoryEmojis, emojis.buttonEmojis);
      await safeEditReply(interaction, [buildSuccessEmbed(configStore.current, 'Emojis Refreshed', `تم تحديث جميع الإيموجيات بنجاح.\nCategories: ${Object.keys(emojis.categoryEmojis).length}\nButtons: ${Object.keys(emojis.buttonEmojis).length}`)]);
    } catch (error) {
      logger.error('Failed to refresh emojis', error instanceof Error ? error.message : error);
      await safeEditReply(interaction, [buildErrorEmbed(configStore.current, 'تعذر تحديث الإيموجيات.')]);
    }
    return;
  }

  if (interaction.commandName === config.commands.names.ticketClose) {
    if (!interaction.inCachedGuild()) {
      await safeReply(interaction, [buildErrorEmbed(configStore.current, 'هذا الأمر يعمل داخل السيرفر فقط.')]);
      return;
    }

    if (!(await safeDeferReply(interaction, interaction.commandName))) {
      return;
    }
    const reason = interaction.options.getString('reason') ?? 'Closed via command';
    await ticketService.handleSlashClose(interaction, reason);
    return;
  }

  if (interaction.commandName === config.commands.names.ticketStats) {
    if (!(await ensurePanelManager(interaction))) {
      return;
    }

    if (!(await safeDeferReply(interaction))) {
      return;
    }
    await ticketService.handleSlashStats(interaction);
    return;
  }
}

client.once(Events.ClientReady, async (readyClient) => {
  const config = configStore.current;

  readyClient.user.setPresence({
    status: config.bot.presence.status,
    activities: [
      {
        type: activityTypeFromName(config.bot.presence.activityType),
        name: config.bot.presence.activityName,
      },
    ],
  });

  logger.info(`Logged in as ${readyClient.user.tag} [instance=${INSTANCE_ID}, pid=${process.pid}]`);

  try {
    await infrastructureService.ensureInfrastructure(readyClient);
    logger.info('Infrastructure verified / created successfully.');
  } catch (error) {
    logger.error('Failed to setup infrastructure', error instanceof Error ? error.message : error);
  }

  try {
    await syncCommands();
  } catch (error) {
    logger.error('Failed to register commands', error instanceof Error ? error.message : error);
  }
});

function trackLifecycleHealth(): void {
  const errors = consumeLifecycleErrors();
  if (errors > 0) {
    consecutiveInteractionFailures += errors;
    if (consecutiveInteractionFailures >= DUPLICATE_THRESHOLD) {
      logger.error(
        `[instance=${INSTANCE_ID}] ${consecutiveInteractionFailures} consecutive interaction failures — ` +
        'another bot instance is likely running with the same token. ' +
        'This instance will destroy its gateway connection.',
      );
      client.destroy();
      process.exit(1);
    }
  } else {
    consecutiveInteractionFailures = 0;
  }
}

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      await handleCommand(interaction);
      trackLifecycleHealth();
      return;
    }

    if (interaction.isStringSelectMenu() && interaction.customId === configStore.current.panel.menuCustomId) {
      await ticketService.handleOpenSelect(interaction);
      trackLifecycleHealth();
      return;
    }

    if (interaction.isModalSubmit()) {
      if (isOpenTicketModal(interaction.customId)) {
        await ticketService.handleOpenModal(interaction);
        trackLifecycleHealth();
        return;
      }

      if (interaction.customId === ADD_MEMBER_MODAL_ID || interaction.customId === REMOVE_MEMBER_MODAL_ID) {
        await ticketService.handleMemberModal(interaction);
        trackLifecycleHealth();
        return;
      }
    }

    if (interaction.isButton()) {
      const ticketButtonIds = Object.values(TICKET_BUTTON_IDS);
      if (ticketButtonIds.includes(interaction.customId as (typeof ticketButtonIds)[number])) {
        await ticketService.handleTicketButton(interaction);
        trackLifecycleHealth();
      }
    }
  } catch (error) {
    if (isInteractionLifecycleError(error)) {
      consecutiveInteractionFailures++;
      trackLifecycleHealth();
      return;
    }

    logger.error('Unhandled interaction error', error instanceof Error ? error.stack ?? error.message : error);

    const errorEmbeds = [buildErrorEmbed(configStore.current, 'حدث خطأ غير متوقع أثناء تنفيذ العملية.')];

    if (interaction.isRepliable()) {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ embeds: errorEmbeds }).catch(() => null);
      } else {
        await interaction.reply({ flags: MessageFlags.Ephemeral, embeds: errorEmbeds }).catch(() => null);
      }
    }
  }
});

client.on(Events.Error, (error) => {
  logger.error('Discord client error', error.message);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', reason instanceof Error ? reason.stack ?? reason.message : reason);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', error.stack ?? error.message);
});

function gracefulShutdown(signal: string): void {
  logger.info(`[instance=${INSTANCE_ID}] Received ${signal}, shutting down...`);
  healthServer.close();
  client.destroy();
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

const HEALTH_PORT = Number(process.env.PORT) || 8080;
const startedAt = Date.now();

const healthServer = createServer((req, res) => {
  const uptime = Math.floor((Date.now() - startedAt) / 1000);
  const botUser = client.user;
  const status = botUser ? 'online' : 'starting';

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    status,
    instance: INSTANCE_ID,
    uptime,
    bot: botUser?.tag ?? null,
    guilds: client.guilds.cache.size,
    ping: client.ws.ping,
  }));
});

healthServer.listen(HEALTH_PORT, () => {
  logger.info(`Health check server listening on port ${HEALTH_PORT}`);
});

client.login(env.DISCORD_TOKEN).catch((error) => {
  logger.error('Failed to login', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
