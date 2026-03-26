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

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ');
}

const healthServer = createServer((req, res) => {
  if (req.url === '/api') {
    const uptime = Math.floor((Date.now() - startedAt) / 1000);
    const botUser = client.user;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: botUser ? 'online' : 'starting',
      instance: INSTANCE_ID,
      uptime,
      bot: botUser?.tag ?? null,
      guilds: client.guilds.cache.size,
      ping: client.ws.ping,
    }));
    return;
  }

  const uptime = Math.floor((Date.now() - startedAt) / 1000);
  const botUser = client.user;
  const isOnline = !!botUser;
  const statusText = isOnline ? 'Online' : 'Starting...';
  const statusColor = isOnline ? '#22c55e' : '#eab308';
  const statusDot = isOnline ? '#22c55e' : '#eab308';
  const ping = client.ws.ping;
  const pingColor = ping < 200 ? '#22c55e' : ping < 500 ? '#eab308' : '#ef4444';
  const guilds = client.guilds.cache.size;
  const members = client.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0);

  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bot Status</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Tahoma, sans-serif;
      background: #0a0a0f;
      color: #e2e8f0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      width: 100%;
      max-width: 480px;
    }
    .card {
      background: linear-gradient(145deg, #13131f, #1a1a2e);
      border: 1px solid #2a2a3e;
      border-radius: 16px;
      padding: 32px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.4);
    }
    .header {
      text-align: center;
      margin-bottom: 28px;
    }
    .avatar {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background: linear-gradient(135deg, #8b5cf6, #6d28d9);
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 12px;
      font-size: 28px;
      font-weight: 700;
      color: #fff;
    }
    .bot-name {
      font-size: 20px;
      font-weight: 700;
      color: #f1f5f9;
    }
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin-top: 8px;
      padding: 4px 14px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 600;
      background: ${statusColor}18;
      color: ${statusColor};
      border: 1px solid ${statusColor}40;
    }
    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: ${statusDot};
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }
    .stats {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-top: 24px;
    }
    .stat {
      background: #0f0f1a;
      border: 1px solid #1e1e32;
      border-radius: 12px;
      padding: 16px;
      text-align: center;
    }
    .stat-value {
      font-size: 22px;
      font-weight: 700;
      color: #c4b5fd;
    }
    .stat-label {
      font-size: 12px;
      color: #64748b;
      margin-top: 4px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .ping-value { color: ${pingColor}; }
    .footer {
      text-align: center;
      margin-top: 20px;
      font-size: 11px;
      color: #475569;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">
        <div class="avatar">${botUser?.username?.charAt(0)?.toUpperCase() ?? 'B'}</div>
        <div class="bot-name">${botUser?.tag ?? 'Bot'}</div>
        <div class="status-badge">
          <span class="status-dot"></span>
          ${statusText}
        </div>
      </div>
      <div class="stats">
        <div class="stat">
          <div class="stat-value">${formatUptime(uptime)}</div>
          <div class="stat-label">Uptime</div>
        </div>
        <div class="stat">
          <div class="stat-value ping-value">${ping}ms</div>
          <div class="stat-label">Ping</div>
        </div>
        <div class="stat">
          <div class="stat-value">${guilds}</div>
          <div class="stat-label">Servers</div>
        </div>
        <div class="stat">
          <div class="stat-value">${members}</div>
          <div class="stat-label">Members</div>
        </div>
      </div>
      <div class="footer">Instance ${INSTANCE_ID} &bull; PID ${process.pid}</div>
    </div>
  </div>
</body>
</html>`;

  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
});

healthServer.listen(HEALTH_PORT, () => {
  logger.info(`Health check server listening on port ${HEALTH_PORT}`);
});

client.login(env.DISCORD_TOKEN).catch((error) => {
  logger.error('Failed to login', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
