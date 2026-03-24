import {
  Client,
  Events,
  GatewayIntentBits,
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
import { logger } from './utils/logger.js';
import { buildErrorEmbed, buildSuccessEmbed } from './builders/ticketBuilder.js';

const env = loadEnv();
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
    await interaction.reply({
      ephemeral: true,
      embeds: [buildErrorEmbed(configStore.current, 'This command only works inside the configured guild.')],
    });
    return false;
  }

  if (!canManagePanels(interaction.member, configStore.current)) {
    await interaction.reply({
      ephemeral: true,
      embeds: [buildErrorEmbed(configStore.current, configStore.current.ticket.messages.noPermission)],
    });
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

    await interaction.deferReply({ ephemeral: true });
    const message = await panelService.sendPanel(interaction.guild!);
    await interaction.editReply({
      embeds: [
        buildSuccessEmbed(configStore.current, 'Panel Sent', `Panel has been sent successfully.\nMessage ID: \`${message.id}\``),
      ],
    });
    return;
  }

  if (interaction.commandName === config.commands.names.panelRefresh) {
    if (!(await ensurePanelManager(interaction))) {
      return;
    }

    await interaction.deferReply({ ephemeral: true });
    const messageId = interaction.options.getString('message-id') ?? undefined;
    const message = await panelService.refreshPanel(interaction.guild!, messageId);
    await interaction.editReply({
      embeds: [
        buildSuccessEmbed(configStore.current, 'Panel Refreshed', `Panel has been refreshed.\nMessage ID: \`${message.id}\``),
      ],
    });
    return;
  }

  if (interaction.commandName === config.commands.names.configReload) {
    if (!(await ensurePanelManager(interaction))) {
      return;
    }

    await interaction.deferReply({ ephemeral: true });
    configStore.reload();
    await syncCommands();
    await interaction.editReply({
      embeds: [buildSuccessEmbed(configStore.current, 'Config Reloaded', 'تم إعادة تحميل config.json وتحديث الأوامر.')],
    });
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

  logger.info(`Logged in as ${readyClient.user.tag}`);

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

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      await handleCommand(interaction);
      return;
    }

    if (interaction.isStringSelectMenu() && interaction.customId === configStore.current.panel.menuCustomId) {
      await ticketService.handleOpenSelect(interaction);
      return;
    }

    if (interaction.isModalSubmit()) {
      if (isOpenTicketModal(interaction.customId)) {
        await ticketService.handleOpenModal(interaction);
        return;
      }

      if (interaction.customId === ADD_MEMBER_MODAL_ID || interaction.customId === REMOVE_MEMBER_MODAL_ID) {
        await ticketService.handleMemberModal(interaction);
        return;
      }
    }

    if (interaction.isButton()) {
      const ticketButtonIds = Object.values(TICKET_BUTTON_IDS);
      if (ticketButtonIds.includes(interaction.customId as (typeof ticketButtonIds)[number])) {
        await ticketService.handleTicketButton(interaction);
      }
    }
  } catch (error) {
    logger.error('Unhandled interaction error', error instanceof Error ? error.stack ?? error.message : error);

    const payload = {
      ephemeral: true,
      embeds: [buildErrorEmbed(configStore.current, 'حدث خطأ غير متوقع أثناء تنفيذ العملية.')],
    };

    if (interaction.isRepliable()) {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(payload).catch(() => null);
      } else {
        await interaction.reply(payload).catch(() => null);
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

client.login(env.DISCORD_TOKEN).catch((error) => {
  logger.error('Failed to login', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
