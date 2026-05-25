import { createServer } from 'node:http';
import { initWheelAPI, handleWheelRequest } from './wheel/api.js';
import {
  Client,
  Events,
  GatewayIntentBits,
  MessageFlags,
  Partials,
  AuditLogEvent,
  type ChatInputCommandInteraction,
  type Guild,
  type GuildMember,
  type Role,
  type VoiceState,
} from 'discord.js';
import { registerCommands } from './commands/registerCommands.js';
import { ADD_MEMBER_MODAL_ID, REMOVE_MEMBER_MODAL_ID, TICKET_BUTTON_IDS, isOpenTicketModal, isAuthorizedAdmin } from './constants/customIds.js';
import { createSupabaseClient } from './database/supabase.js';
import { InfrastructureRepository } from './database/infrastructureRepository.js';
import { TicketRepository } from './database/ticketRepository.js';
import { ComplaintRepository } from './database/complaintRepository.js';
import { loadEnv } from './env.js';
import { ConfigStore } from './services/configStore.js';
import { InfrastructureService } from './services/infrastructureService.js';
import { PanelService } from './services/panelService.js';
import { canManagePanels } from './services/permissionService.js';
import { TicketService } from './services/ticketService.js';
import { ComplaintService } from './services/complaintService.js';
import { EscalationService } from './services/escalationService.js';
import { AIService } from './services/aiService.js';
import { TranscriptService } from './services/transcriptService.js';
import { RoleProtectionRepository } from './database/roleProtectionRepository.js';
import { RoleProtectionService } from './services/roleProtectionService.js';
import { RoleManagementRepository } from './database/roleManagementRepository.js';
import { RoleManagementService } from './services/roleManagementService.js';
import { InstanceLockRepository } from './database/instanceLockRepository.js';
import { INSTANCE_LOCK_TTL_MS, InstanceGuardService } from './services/instanceGuardService.js';
import { ServerLogService } from './services/serverLogService.js';
import { SecurityService } from './services/securityService.js';
import { WelcomeService } from './services/welcomeService.js';
import { MediatorRepository } from './database/mediatorRepository.js';
import { MediatorService } from './services/mediatorService.js';
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
initWheelAPI(supabase);
const ticketRepository = new TicketRepository(supabase);
const infrastructureRepository = new InfrastructureRepository(supabase);
const roleProtectionRepository = new RoleProtectionRepository(supabase);
const roleManagementRepository = new RoleManagementRepository(supabase);
const instanceLockRepository = new InstanceLockRepository(supabase);
const mediatorRepository = new MediatorRepository(supabase);
const complaintRepository = new ComplaintRepository(supabase);
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
  mediatorRepository,
});
const mediatorService = new MediatorService(configStore, mediatorRepository, complaintRepository);
const complaintService = new ComplaintService(configStore, complaintRepository, ticketRepository, mediatorRepository);
const aiService = new AIService(
  {
    apiKey: env.GEMINI_API_KEY,
    provider: env.AI_PROVIDER,
    baseURL: env.AI_BASE_URL,
    model: env.AI_MODEL,
  },
  ticketRepository
);
let roleProtectionService: RoleProtectionService | null = null;
const roleManagementService = new RoleManagementService(roleManagementRepository, configStore.current);
let instanceGuardService: InstanceGuardService | null = null;
let runtimeState: 'starting' | 'standby' | 'online' | 'offline' = 'starting';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildExpressions,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildWebhooks,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel, Partials.Message],
});

const serverLogService = new ServerLogService(client, configStore.current.guild.id);
const securityService = new SecurityService(configStore.current, serverLogService);
const welcomeService = new WelcomeService();

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

  if (interaction.commandName === 'clear') {
    if (!interaction.inCachedGuild()) {
      await safeReply(interaction, [buildErrorEmbed(configStore.current, 'هذا الأمر يعمل داخل السيرفر فقط.')]);
      return;
    }

    if (!(await safeDeferReply(interaction, interaction.commandName))) {
      return;
    }

    await securityService.clearUserMessages(interaction);
    return;
  }

  if (interaction.commandName === 'logs') {
    if (!interaction.inCachedGuild()) {
      await safeReply(interaction, [buildErrorEmbed(configStore.current, 'هذا الأمر يعمل داخل السيرفر فقط.')]);
      return;
    }

    if (!(await ensurePanelManager(interaction))) {
      return;
    }

    if (!(await safeDeferReply(interaction, interaction.commandName))) {
      return;
    }

    const channels = await serverLogService.ensure(true);
    const summary = channels.map((channel) => `<#${channel.id}> - ${channel.description}`).join('\n');
    await safeEditReply(interaction, [
      buildSuccessEmbed(configStore.current, 'تم تجهيز اللوقات', summary || 'تم تجهيز رومات اللوق.'),
    ]);
    return;
  }

  if (interaction.commandName === 'ai') {
    if (!(await ensurePanelManager(interaction))) {
      return;
    }

    if (!(await safeDeferReply(interaction))) {
      return;
    }

    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'on') {
      await ticketRepository.setAIEnabled(true);
      await safeEditReply(interaction, [buildSuccessEmbed(config, 'تفعيل المساعد الآلي', 'تم تفعيل المساعد الآلي (AI) بنجاح للتذاكر المفتوحة.')]);
    } else if (subcommand === 'off') {
      await ticketRepository.setAIEnabled(false);
      await safeEditReply(interaction, [buildSuccessEmbed(config, 'إيقاف المساعد الآلي', 'تم إيقاف المساعد الآلي (AI) بنجاح.')]);
    }
    return;
  }

  if (interaction.commandName === 'panel' || interaction.commandName === 'panle') {
    if (!isAuthorizedAdmin(interaction.user.id)) {
      await safeReply(interaction, [buildErrorEmbed(configStore.current, '❌ ليس لديك الصلاحية لاستخدام هذا الأمر.')]);
      return;
    }
    await ticketService.sendControlPanel(interaction);
    return;
  }

  if (interaction.commandName === 'panel-mm') {
    if (!isAuthorizedAdmin(interaction.user.id)) {
      await safeReply(interaction, [buildErrorEmbed(configStore.current, '❌ ليس لديك الصلاحية لاستخدام هذا الأمر.')]);
      return;
    }
    await mediatorService.sendControlPanel(interaction);
    return;
  }

  if (interaction.commandName === 'panel-complaints-send') {
    if (!isAuthorizedAdmin(interaction.user.id)) {
      await safeReply(interaction, [buildErrorEmbed(configStore.current, '❌ ليس لديك الصلاحية لاستخدام هذا الأمر.')]);
      return;
    }
    await complaintService.sendComplaintsPanelCommand(interaction);
    return;
  }
}

client.once(Events.ClientReady, async (readyClient) => {
  const config = configStore.current;
  runtimeState = 'online';

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
    instanceGuardService = new InstanceGuardService(readyClient, instanceLockRepository, config.guild.id, INSTANCE_ID);
    const guardStarted = await instanceGuardService.start();
    if (!guardStarted) {
      runtimeState = 'standby';
      return;
    }
  } catch (error) {
    logger.warn('Could not start instance guard. Duplicate protection depends on Supabase schema.', error instanceof Error ? error.message : error);
  }

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

  try {
    const escalationService = new EscalationService(readyClient, ticketRepository, config);
    escalationService.start();
  } catch (error) {
    logger.error('Failed to start EscalationService', error instanceof Error ? error.message : error);
  }

  try {
    roleProtectionService = new RoleProtectionService(readyClient, roleProtectionRepository, config);
    roleProtectionService.start();
  } catch (error) {
    logger.error('Failed to start RoleProtectionService', error instanceof Error ? error.message : error);
  }

  try {
    await serverLogService.ensure();
    logger.info('Server logs verified / created successfully.');
  } catch (error) {
    logger.error('Failed to setup server logs', error instanceof Error ? error.message : error);
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
      runtimeState = 'offline';
      client.destroy();
    }
  } else {
    consecutiveInteractionFailures = 0;
  }
}

const processedInteractions = new Set<string>();

client.on(Events.InteractionCreate, async (interaction) => {
  // Global duplicate interaction ID lock to prevent double event handling
  if (processedInteractions.has(interaction.id)) {
    logger.warn(`[instance=${INSTANCE_ID}] Interaction ${interaction.id} already processed. Ignoring duplicate event.`);
    return;
  }
  processedInteractions.add(interaction.id);
  if (processedInteractions.size > 2000) {
    const firstItem = processedInteractions.values().next().value;
    if (firstItem !== undefined) processedInteractions.delete(firstItem);
  }

  const customId = interaction.isButton() || interaction.isModalSubmit() || interaction.isStringSelectMenu()
    ? interaction.customId
    : (interaction.isCommand() ? `/${interaction.commandName}` : 'N/A');

  logger.info(
    `[instance=${INSTANCE_ID}] [INTERACTION_RECEIVED] ID: ${interaction.id}, Type: ${interaction.type}, ` +
    `User: ${interaction.user.tag} (${interaction.user.id}), CustomId/Cmd: ${customId}`
  );

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

      if (interaction.customId === 'wait:modal:trade_value') {
        await ticketService.handleWaitTradeValueModal(interaction);
        trackLifecycleHealth();
        return;
      }

      if (interaction.customId === 'ctrl_panel:modal:del_custom') {
        if (!isAuthorizedAdmin(interaction.user.id)) {
          await safeReply(interaction, [buildErrorEmbed(configStore.current, '❌ ليس لديك الصلاحية لاستخدام لوحة التحكم.')]);
          return;
        }
        await ticketService.handleDelCustomModalSubmit(interaction);
        trackLifecycleHealth();
        return;
      }

      if (interaction.customId === 'ctrl_panel:modal:close_complaint') {
        if (!isAuthorizedAdmin(interaction.user.id)) {
          await safeReply(interaction, [buildErrorEmbed(configStore.current, '❌ ليس لديك الصلاحية لاستخدام لوحة التحكم.')]);
          return;
        }
        await complaintService.handleCloseComplaintModalSubmit(interaction);
        trackLifecycleHealth();
        return;
      }

      if (interaction.customId.startsWith('mm:modal:')) {
        if (!isAuthorizedAdmin(interaction.user.id)) {
          await safeReply(interaction, [buildErrorEmbed(configStore.current, '❌ ليس لديك الصلاحية لاستخدام هذه اللوحة.')]);
          return;
        }
        await mediatorService.handleModalSubmit(interaction);
        trackLifecycleHealth();
        return;
      }

      if (interaction.customId.startsWith('complaint:modal:')) {
        await complaintService.handleComplaintModalSubmit(interaction);
        trackLifecycleHealth();
        return;
      }
    }

    if (interaction.isButton()) {
      const ticketButtonIds = Object.values(TICKET_BUTTON_IDS);
      if (ticketButtonIds.includes(interaction.customId as (typeof ticketButtonIds)[number])) {
        await ticketService.handleTicketButton(interaction);
        trackLifecycleHealth();
        return;
      }

      if (interaction.customId.startsWith('wait:btn:')) {
        await ticketService.handleWaitButton(interaction);
        trackLifecycleHealth();
        return;
      }

      if (interaction.customId.startsWith('mm:btn:')) {
        if (!isAuthorizedAdmin(interaction.user.id)) {
          await safeReply(interaction, [buildErrorEmbed(configStore.current, '❌ ليس لديك الصلاحية لاستخدام هذه اللوحة.')]);
          return;
        }
        await mediatorService.handleButton(interaction);
        trackLifecycleHealth();
        return;
      }

      if (interaction.customId.startsWith('complaint:btn:confirm_submit:')) {
        const complaintId = parseInt(interaction.customId.split(':')[3], 10);
        await complaintService.handleConfirmSubmit(interaction, complaintId);
        trackLifecycleHealth();
        return;
      }

      if (interaction.customId.startsWith('complaint:btn:cancel_submit:')) {
        const complaintId = parseInt(interaction.customId.split(':')[3], 10);
        await complaintService.handleCancelSubmit(interaction, complaintId);
        trackLifecycleHealth();
        return;
      }

      if (interaction.customId.startsWith('complaint:btn:')) {
        await complaintService.handleComplaintButton(interaction);
        trackLifecycleHealth();
        return;
      }

      if (interaction.customId.startsWith('ctrl_panel:')) {
        if (!isAuthorizedAdmin(interaction.user.id)) {
          await safeReply(interaction, [buildErrorEmbed(configStore.current, '❌ ليس لديك الصلاحية لاستخدام لوحة التحكم.')]);
          return;
        }
        
        switch (interaction.customId) {
          case 'ctrl_panel:del_wait':
            await ticketService.handleDelWaitClick(interaction);
            break;
          case 'ctrl_panel:del_active':
            await ticketService.handleDelActiveClick(interaction);
            break;
          case 'ctrl_panel:del_all':
            await ticketService.handleDelAllClick(interaction);
            break;
          case 'ctrl_panel:del_all_confirm':
            await ticketService.handleDelAllConfirmClick(interaction);
            break;
          case 'ctrl_panel:cancel':
            await ticketService.sendControlPanel(interaction);
            break;
          case 'ctrl_panel:del_custom':
            await ticketService.handleDelCustomClick(interaction);
            break;
          case 'ctrl_panel:close_complaint':
            await complaintService.handleCloseComplaintClick(interaction);
            break;
        }
        
        trackLifecycleHealth();
        return;
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

function formatMemberLogValue(member: GuildMember): string {
  return `<@${member.id}>\n${member.user.tag}\nID: ${member.id}`;
}

function formatRoleLogValue(role: Role): string {
  return `<@&${role.id}>\n${role.name}\nID: ${role.id}\nPosition: ${role.position}`;
}

function formatUserLogValue(user: { id: string; tag?: string | null; username?: string | null }): string {
  return `<@${user.id}>\n${user.tag ?? user.username ?? 'غير معروف'}\nID: ${user.id}`;
}

function formatMaybeChannel(channelId: string | null | undefined): string {
  return channelId ? `<#${channelId}>\nID: ${channelId}` : 'لا يوجد';
}

function formatMaybeValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return 'لا يوجد';
  if (typeof value === 'boolean') return value ? 'نعم' : 'لا';
  return String(value);
}

function formatChannelLogValue(channel: { id: string; name?: string | null; type?: number; parentId?: string | null; position?: number | null; rawPosition?: number | null }): string {
  return `${channel.name ?? 'غير معروف'}\nID: ${channel.id}\nType: ${channel.type ?? 'unknown'}\nParent: ${channel.parentId ?? 'none'}\nPosition: ${channel.rawPosition ?? channel.position ?? 'unknown'}`;
}

function addChange(fields: { name: string; value: string; inline?: boolean }[], name: string, before: unknown, after: unknown): void {
  if (before === after) return;
  fields.push({
    name,
    value: `قبل: ${formatMaybeValue(before)}\nبعد: ${formatMaybeValue(after)}`,
    inline: true,
  });
}

function permissionOverwriteSnapshot(channel: unknown): string {
  const overwrites = (channel as { permissionOverwrites?: { cache?: Map<string, { id: string; type: number; allow: { bitfield: bigint | number | string }; deny: { bitfield: bigint | number | string } }> } }).permissionOverwrites?.cache;
  if (!overwrites) return '';

  return [...overwrites.values()]
    .map((overwrite) => `${overwrite.id}:${overwrite.type}:${overwrite.allow.bitfield.toString()}:${overwrite.deny.bitfield.toString()}`)
    .sort()
    .join('|');
}

function trimRolePermissions(role: Role): string {
  return trimLogValue(role.permissions.toArray().join(', ') || 'لا يوجد', 900);
}

function voiceStateMemberValue(state: VoiceState): string {
  const user = state.member?.user;
  return user ? formatUserLogValue(user) : `<@${state.id}>\nID: ${state.id}`;
}

async function fetchAnyExecutor(guild: Guild, types: AuditLogEvent[], targetId?: string): Promise<string> {
  for (const type of types) {
    const executor = await serverLogService.fetchExecutor(guild, type, targetId);
    if (executor !== 'غير معروف') return executor;
  }

  return 'غير معروف';
}

client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
  try {
    if (newMember.guild.id !== configStore.current.guild.id) return;

    const addedRoles = newMember.roles.cache.filter((role) => !oldMember.roles.cache.has(role.id));
    const removedRoles = oldMember.roles.cache.filter((role) => !newMember.roles.cache.has(role.id));
    const nicknameChanged = oldMember.nickname !== newMember.nickname;
    const timeoutChanged = oldMember.communicationDisabledUntilTimestamp !== newMember.communicationDisabledUntilTimestamp;
    if (addedRoles.size === 0 && removedRoles.size === 0 && !nicknameChanged && !timeoutChanged) return;

    const executor = await serverLogService.fetchExecutor(newMember.guild, AuditLogEvent.MemberRoleUpdate, newMember.id);
    for (const role of addedRoles.values()) {
      await serverLogService.send('roles', 'إعطاء رتبة', `تم إعطاء <@&${role.id}> إلى <@${newMember.id}>.`, [
        { name: 'المنفذ', value: executor, inline: true },
        { name: 'العضو', value: formatMemberLogValue(newMember), inline: true },
        { name: 'الرتبة', value: formatRoleLogValue(role), inline: true },
        { name: 'نوع العملية', value: 'إضافة رتبة', inline: true },
      ]);
    }

    for (const role of removedRoles.values()) {
      await serverLogService.send('roles', 'إزالة رتبة', `تمت إزالة <@&${role.id}> من <@${newMember.id}>.`, [
        { name: 'المنفذ', value: executor, inline: true },
        { name: 'العضو', value: formatMemberLogValue(newMember), inline: true },
        { name: 'الرتبة', value: formatRoleLogValue(role), inline: true },
        { name: 'نوع العملية', value: 'إزالة رتبة', inline: true },
      ]);
    }

    if (nicknameChanged) {
      const nickExecutor = await serverLogService.fetchExecutor(newMember.guild, AuditLogEvent.MemberUpdate, newMember.id);
      await serverLogService.send('members', 'تعديل نك عضو', `تم تعديل نك <@${newMember.id}>.`, [
        { name: 'بواسطة', value: nickExecutor, inline: true },
        { name: 'العضو', value: formatMemberLogValue(newMember), inline: true },
        { name: 'قبل', value: oldMember.nickname ?? newMember.user.username, inline: true },
        { name: 'بعد', value: newMember.nickname ?? newMember.user.username, inline: true },
      ]);
    }

    if (timeoutChanged) {
      const timeoutExecutor = await serverLogService.fetchExecutor(newMember.guild, AuditLogEvent.MemberUpdate, newMember.id);
      await serverLogService.send('moderation', newMember.communicationDisabledUntilTimestamp ? 'إعطاء تايم أوت' : 'إزالة تايم أوت', `تم تعديل حالة التايم أوت على <@${newMember.id}>.`, [
        { name: 'بواسطة', value: timeoutExecutor, inline: true },
        { name: 'العضو', value: formatMemberLogValue(newMember), inline: true },
        { name: 'قبل', value: oldMember.communicationDisabledUntilTimestamp ? `<t:${Math.floor(oldMember.communicationDisabledUntilTimestamp / 1000)}:F>` : 'لا يوجد', inline: true },
        { name: 'بعد', value: newMember.communicationDisabledUntilTimestamp ? `<t:${Math.floor(newMember.communicationDisabledUntilTimestamp / 1000)}:F>` : 'لا يوجد', inline: true },
      ]);
    }
  } catch (error) {
    logger.warn('Failed to log member role update', error instanceof Error ? error.message : error);
  }
});

client.on(Events.GuildMemberAdd, async (member) => {
  try {
    if (member.guild.id !== configStore.current.guild.id) return;
    await welcomeService.handleMemberAdd(member);
    await serverLogService.send('members', 'دخول عضو', `دخل <@${member.id}> إلى السيرفر.`, [
      { name: 'العضو', value: formatMemberLogValue(member), inline: true },
      { name: 'تاريخ إنشاء الحساب', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:F>`, inline: true },
      { name: 'عدد الأعضاء', value: `${member.guild.memberCount}`, inline: true },
    ]);
  } catch (error) {
    logger.warn('Failed to handle welcome member add', error instanceof Error ? error.message : error);
  }
});

client.on(Events.GuildMemberRemove, async (member) => {
  try {
    if (member.guild.id !== configStore.current.guild.id) return;

    const executor = await serverLogService.fetchExecutor(member.guild, AuditLogEvent.MemberKick, member.id);
    const kicked = executor !== 'غير معروف';
    await serverLogService.send(kicked ? 'moderation' : 'members', kicked ? 'طرد عضو' : 'خروج عضو', kicked ? `تم طرد <@${member.id}> من السيرفر.` : `خرج <@${member.id}> من السيرفر.`, [
      { name: 'العضو', value: formatUserLogValue(member.user), inline: true },
      { name: kicked ? 'بواسطة' : 'الحالة', value: kicked ? executor : 'خروج عادي أو غير معروف', inline: true },
      { name: 'عدد الأعضاء', value: `${member.guild.memberCount}`, inline: true },
    ]);
  } catch (error) {
    logger.warn('Failed to log member remove', error instanceof Error ? error.message : error);
  }
});

client.on(Events.ChannelCreate, async (channel) => {
  try {
    if (!('guild' in channel) || channel.guild.id !== configStore.current.guild.id) return;
    const executor = await serverLogService.fetchExecutor(channel.guild, AuditLogEvent.ChannelCreate, channel.id);
    await serverLogService.send('channels', 'إنشاء روم', `تم إنشاء الروم <#${channel.id}>.`, [
      { name: 'بواسطة', value: executor, inline: true },
      { name: 'الروم', value: formatChannelLogValue(channel), inline: true },
      { name: 'التصنيف', value: formatMaybeChannel(channel.parentId), inline: true },
    ]);
  } catch (error) {
    logger.warn('Failed to log channel create', error instanceof Error ? error.message : error);
  }
});

client.on(Events.ChannelDelete, async (channel) => {
  try {
    if (!('guild' in channel) || channel.guild.id !== configStore.current.guild.id) return;
    const executor = await serverLogService.fetchExecutor(channel.guild, AuditLogEvent.ChannelDelete, channel.id);
    await serverLogService.send('channels', 'حذف روم', `تم حذف روم من السيرفر.`, [
      { name: 'بواسطة', value: executor, inline: true },
      { name: 'الروم', value: formatChannelLogValue(channel), inline: true },
      { name: 'التصنيف', value: formatMaybeChannel(channel.parentId), inline: true },
    ]);
  } catch (error) {
    logger.warn('Failed to log channel delete', error instanceof Error ? error.message : error);
  }
});

client.on(Events.ChannelUpdate, async (oldChannel, newChannel) => {
  try {
    if (!('guild' in newChannel) || newChannel.guild.id !== configStore.current.guild.id) return;

    const nameChanged = 'name' in oldChannel && 'name' in newChannel && oldChannel.name !== newChannel.name;
    const parentChanged = 'parentId' in oldChannel && 'parentId' in newChannel && oldChannel.parentId !== newChannel.parentId;
    const positionChanged = 'rawPosition' in oldChannel && 'rawPosition' in newChannel && oldChannel.rawPosition !== newChannel.rawPosition;
    const overwritesChanged =
      'permissionOverwrites' in oldChannel &&
      'permissionOverwrites' in newChannel &&
      permissionOverwriteSnapshot(oldChannel) !== permissionOverwriteSnapshot(newChannel);

    const fields: { name: string; value: string; inline?: boolean }[] = [
      { name: 'الروم', value: `<#${newChannel.id}>\nID: ${newChannel.id}`, inline: true },
    ];
    addChange(fields, 'الاسم', 'name' in oldChannel ? oldChannel.name : null, 'name' in newChannel ? newChannel.name : null);
    addChange(fields, 'التصنيف', 'parentId' in oldChannel ? oldChannel.parentId : null, 'parentId' in newChannel ? newChannel.parentId : null);
    addChange(fields, 'المكان', 'rawPosition' in oldChannel ? oldChannel.rawPosition : null, 'rawPosition' in newChannel ? newChannel.rawPosition : null);
    addChange(fields, 'التوبيك', 'topic' in oldChannel ? oldChannel.topic : null, 'topic' in newChannel ? newChannel.topic : null);
    addChange(fields, 'NSFW', 'nsfw' in oldChannel ? oldChannel.nsfw : null, 'nsfw' in newChannel ? newChannel.nsfw : null);
    addChange(fields, 'التهدئة', 'rateLimitPerUser' in oldChannel ? oldChannel.rateLimitPerUser : null, 'rateLimitPerUser' in newChannel ? newChannel.rateLimitPerUser : null);
    addChange(fields, 'Bitrate', 'bitrate' in oldChannel ? oldChannel.bitrate : null, 'bitrate' in newChannel ? newChannel.bitrate : null);
    addChange(fields, 'حد الأعضاء', 'userLimit' in oldChannel ? oldChannel.userLimit : null, 'userLimit' in newChannel ? newChannel.userLimit : null);
    if (overwritesChanged) {
      fields.push({ name: 'البرمشن', value: 'تم تغيير صلاحيات الروم أو صلاحيات رتبة/عضو داخله.', inline: false });
    }

    if (!nameChanged && !parentChanged && !positionChanged && !overwritesChanged && fields.length === 1) return;

    const executor = overwritesChanged
      ? await fetchAnyExecutor(newChannel.guild, [AuditLogEvent.ChannelOverwriteUpdate, AuditLogEvent.ChannelOverwriteCreate, AuditLogEvent.ChannelOverwriteDelete, AuditLogEvent.ChannelUpdate], newChannel.id)
      : await serverLogService.fetchExecutor(newChannel.guild, AuditLogEvent.ChannelUpdate, newChannel.id);
    fields.unshift({ name: 'بواسطة', value: executor, inline: true });
    await serverLogService.send(overwritesChanged ? 'permissions' : 'channels', overwritesChanged ? 'تعديل برمشن روم' : 'تعديل روم', `<#${newChannel.id}>`, fields);
  } catch (error) {
    logger.warn('Failed to log channel update', error instanceof Error ? error.message : error);
  }
});

client.on(Events.ThreadCreate, async (thread) => {
  try {
    if (thread.guild.id !== configStore.current.guild.id) return;
    const executor = await serverLogService.fetchExecutor(thread.guild, AuditLogEvent.ThreadCreate, thread.id);
    await serverLogService.send('channels', 'إنشاء ثريد', `تم إنشاء الثريد <#${thread.id}>.`, [
      { name: 'بواسطة', value: executor, inline: true },
      { name: 'الثريد', value: formatChannelLogValue(thread), inline: true },
      { name: 'الروم الأساسي', value: formatMaybeChannel(thread.parentId), inline: true },
    ]);
  } catch (error) {
    logger.warn('Failed to log thread create', error instanceof Error ? error.message : error);
  }
});

client.on(Events.ThreadUpdate, async (oldThread, newThread) => {
  try {
    if (newThread.guild.id !== configStore.current.guild.id) return;
    const fields: { name: string; value: string; inline?: boolean }[] = [
      { name: 'الثريد', value: `<#${newThread.id}>\nID: ${newThread.id}`, inline: true },
    ];
    addChange(fields, 'الاسم', oldThread.name, newThread.name);
    addChange(fields, 'مقفل', oldThread.locked, newThread.locked);
    addChange(fields, 'مؤرشف', oldThread.archived, newThread.archived);
    addChange(fields, 'مدة الأرشفة', oldThread.autoArchiveDuration, newThread.autoArchiveDuration);
    if (fields.length === 1) return;

    const executor = await serverLogService.fetchExecutor(newThread.guild, AuditLogEvent.ThreadUpdate, newThread.id);
    fields.unshift({ name: 'بواسطة', value: executor, inline: true });
    await serverLogService.send('channels', 'تعديل ثريد', `تم تعديل الثريد <#${newThread.id}>.`, fields);
  } catch (error) {
    logger.warn('Failed to log thread update', error instanceof Error ? error.message : error);
  }
});

client.on(Events.ThreadDelete, async (thread) => {
  try {
    if (thread.guild.id !== configStore.current.guild.id) return;
    const executor = await serverLogService.fetchExecutor(thread.guild, AuditLogEvent.ThreadDelete, thread.id);
    await serverLogService.send('channels', 'حذف ثريد', 'تم حذف ثريد من السيرفر.', [
      { name: 'بواسطة', value: executor, inline: true },
      { name: 'الثريد', value: `${thread.name}\nID: ${thread.id}`, inline: true },
      { name: 'الروم الأساسي', value: formatMaybeChannel(thread.parentId), inline: true },
    ]);
  } catch (error) {
    logger.warn('Failed to log thread delete', error instanceof Error ? error.message : error);
  }
});

client.on(Events.GuildRoleUpdate, async (oldRole, newRole) => {
  try {
    if (newRole.guild.id !== configStore.current.guild.id) return;
    const permissionChanged = oldRole.permissions.bitfield !== newRole.permissions.bitfield;
    const nameChanged = oldRole.name !== newRole.name;
    const colorChanged = oldRole.hexColor !== newRole.hexColor;
    const hoistChanged = oldRole.hoist !== newRole.hoist;
    const mentionableChanged = oldRole.mentionable !== newRole.mentionable;
    const positionChanged = oldRole.position !== newRole.position;
    if (!permissionChanged && !nameChanged && !colorChanged && !hoistChanged && !mentionableChanged && !positionChanged) return;

    const executor = await serverLogService.fetchExecutor(newRole.guild, AuditLogEvent.RoleUpdate, newRole.id);
    const fields = [
      { name: 'بواسطة', value: executor, inline: true },
      { name: 'الرتبة', value: formatRoleLogValue(newRole), inline: true },
    ];
    addChange(fields, 'الاسم', oldRole.name, newRole.name);
    addChange(fields, 'اللون', oldRole.hexColor, newRole.hexColor);
    addChange(fields, 'المكان', oldRole.position, newRole.position);
    addChange(fields, 'إظهار منفصل', oldRole.hoist, newRole.hoist);
    addChange(fields, 'قابلة للمنشن', oldRole.mentionable, newRole.mentionable);
    if (permissionChanged) {
      fields.push({
        name: 'البرمشن',
        value: `قبل: ${trimRolePermissions(oldRole)}\nبعد: ${trimRolePermissions(newRole)}`,
        inline: false,
      });
    }

    await serverLogService.send(permissionChanged ? 'permissions' : 'roles', permissionChanged ? 'تعديل برمشن رتبة' : 'تعديل رتبة', `<@&${newRole.id}>`, fields);
  } catch (error) {
    logger.warn('Failed to log role update', error instanceof Error ? error.message : error);
  }
});

client.on(Events.GuildRoleCreate, async (role) => {
  try {
    if (role.guild.id !== configStore.current.guild.id) return;
    const executor = await serverLogService.fetchExecutor(role.guild, AuditLogEvent.RoleCreate, role.id);
    await serverLogService.send('roles', 'إنشاء رتبة', `تم إنشاء <@&${role.id}>.`, [
      { name: 'بواسطة', value: executor, inline: true },
      { name: 'الرتبة', value: formatRoleLogValue(role), inline: true },
      { name: 'اللون', value: role.hexColor, inline: true },
      { name: 'البرمشن', value: trimRolePermissions(role), inline: false },
    ]);
  } catch (error) {
    logger.warn('Failed to log role create', error instanceof Error ? error.message : error);
  }
});

client.on(Events.GuildRoleDelete, async (role) => {
  try {
    if (role.guild.id !== configStore.current.guild.id) return;
    const executor = await serverLogService.fetchExecutor(role.guild, AuditLogEvent.RoleDelete, role.id);
    await serverLogService.send('roles', 'حذف رتبة', `تم حذف رتبة من السيرفر.`, [
      { name: 'بواسطة', value: executor, inline: true },
      { name: 'الرتبة', value: `${role.name}\nID: ${role.id}\nPosition: ${role.position}`, inline: true },
      { name: 'اللون', value: role.hexColor, inline: true },
      { name: 'البرمشن', value: trimRolePermissions(role), inline: false },
    ]);
  } catch (error) {
    logger.warn('Failed to log role delete', error instanceof Error ? error.message : error);
  }
});

client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
  try {
    const guild = newState.guild ?? oldState.guild;
    if (guild.id !== configStore.current.guild.id) return;

    const member = newState.member ?? oldState.member;
    const memberValue = member ? formatUserLogValue(member.user) : voiceStateMemberValue(newState);

    if (oldState.channelId !== newState.channelId) {
      const moved = !!oldState.channelId && !!newState.channelId;
      const joined = !oldState.channelId && !!newState.channelId;
      const left = !!oldState.channelId && !newState.channelId;
      const executor = moved
        ? await serverLogService.fetchExecutor(guild, AuditLogEvent.MemberMove, newState.id)
        : left
          ? await serverLogService.fetchExecutor(guild, AuditLogEvent.MemberDisconnect, newState.id)
          : 'العضو نفسه أو غير معروف';
      const pulled = moved && executor !== 'غير معروف';
      const title = pulled ? 'سحب عضو لفويس' : moved ? 'نقل عضو بين الفويس' : joined ? 'دخول فويس' : 'خروج فويس';
      const description = pulled
        ? `تم سحب <@${newState.id}> من <#${oldState.channelId}> إلى <#${newState.channelId}>.`
        : moved
          ? `انتقل <@${newState.id}> من <#${oldState.channelId}> إلى <#${newState.channelId}>.`
          : joined
            ? `دخل <@${newState.id}> إلى <#${newState.channelId}>.`
            : `خرج <@${newState.id}> من <#${oldState.channelId}>.`;

      await serverLogService.send('voice', title, description, [
        { name: 'العضو', value: memberValue, inline: true },
        { name: 'من', value: formatMaybeChannel(oldState.channelId), inline: true },
        { name: 'إلى', value: formatMaybeChannel(newState.channelId), inline: true },
        { name: 'بواسطة', value: executor, inline: true },
      ]);
    }

    const voiceChanges: { name: string; value: string; inline?: boolean }[] = [
      { name: 'العضو', value: memberValue, inline: true },
      { name: 'الروم', value: formatMaybeChannel(newState.channelId ?? oldState.channelId), inline: true },
    ];
    addChange(voiceChanges, 'Server Mute', oldState.serverMute, newState.serverMute);
    addChange(voiceChanges, 'Server Deaf', oldState.serverDeaf, newState.serverDeaf);
    addChange(voiceChanges, 'Self Mute', oldState.selfMute, newState.selfMute);
    addChange(voiceChanges, 'Self Deaf', oldState.selfDeaf, newState.selfDeaf);
    addChange(voiceChanges, 'كاميرا', oldState.selfVideo, newState.selfVideo);
    addChange(voiceChanges, 'ستريم', oldState.streaming, newState.streaming);

    if (voiceChanges.length > 2) {
      const executor = oldState.serverMute !== newState.serverMute || oldState.serverDeaf !== newState.serverDeaf
        ? await serverLogService.fetchExecutor(guild, AuditLogEvent.MemberUpdate, newState.id)
        : 'العضو نفسه';
      voiceChanges.unshift({ name: 'بواسطة', value: executor, inline: true });
      await serverLogService.send('voice', 'تحديث حالة فويس', `تم تغيير حالة فويس <@${newState.id}>.`, voiceChanges);
    }
  } catch (error) {
    logger.warn('Failed to log voice state update', error instanceof Error ? error.message : error);
  }
});

client.on(Events.GuildBanAdd, async (ban) => {
  try {
    if (ban.guild.id !== configStore.current.guild.id) return;
    const executor = await serverLogService.fetchExecutor(ban.guild, AuditLogEvent.MemberBanAdd, ban.user.id);
    await serverLogService.send('moderation', 'باند عضو', `تم حظر <@${ban.user.id}> من السيرفر.`, [
      { name: 'بواسطة', value: executor, inline: true },
      { name: 'العضو', value: formatUserLogValue(ban.user), inline: true },
      { name: 'السبب', value: ban.reason ?? 'غير معروف', inline: false },
    ]);
  } catch (error) {
    logger.warn('Failed to log ban add', error instanceof Error ? error.message : error);
  }
});

client.on(Events.GuildBanRemove, async (ban) => {
  try {
    if (ban.guild.id !== configStore.current.guild.id) return;
    const executor = await serverLogService.fetchExecutor(ban.guild, AuditLogEvent.MemberBanRemove, ban.user.id);
    await serverLogService.send('moderation', 'فك باند عضو', `تم فك الحظر عن <@${ban.user.id}>.`, [
      { name: 'بواسطة', value: executor, inline: true },
      { name: 'العضو', value: formatUserLogValue(ban.user), inline: true },
    ]);
  } catch (error) {
    logger.warn('Failed to log ban remove', error instanceof Error ? error.message : error);
  }
});

client.on(Events.GuildUpdate, async (oldGuild, newGuild) => {
  try {
    if (newGuild.id !== configStore.current.guild.id) return;

    const fields: { name: string; value: string; inline?: boolean }[] = [];
    addChange(fields, 'الاسم', oldGuild.name, newGuild.name);
    addChange(fields, 'المالك', oldGuild.ownerId, newGuild.ownerId);
    addChange(fields, 'لغة السيرفر', oldGuild.preferredLocale, newGuild.preferredLocale);
    addChange(fields, 'مستوى التحقق', oldGuild.verificationLevel, newGuild.verificationLevel);
    addChange(fields, 'فلتر المحتوى', oldGuild.explicitContentFilter, newGuild.explicitContentFilter);
    addChange(fields, 'إشعارات الرسائل', oldGuild.defaultMessageNotifications, newGuild.defaultMessageNotifications);
    addChange(fields, 'روم AFK', oldGuild.afkChannelId, newGuild.afkChannelId);
    addChange(fields, 'وقت AFK', oldGuild.afkTimeout, newGuild.afkTimeout);
    addChange(fields, 'روم النظام', oldGuild.systemChannelId, newGuild.systemChannelId);
    addChange(fields, 'روم القوانين', oldGuild.rulesChannelId, newGuild.rulesChannelId);
    addChange(fields, 'رابط الفانيتي', oldGuild.vanityURLCode, newGuild.vanityURLCode);
    if (fields.length === 0) return;

    const executor = await serverLogService.fetchExecutor(newGuild, AuditLogEvent.GuildUpdate, newGuild.id);
    fields.unshift({ name: 'بواسطة', value: executor, inline: true });
    await serverLogService.send('server', 'تعديل السيرفر', 'تم تعديل إعدادات السيرفر.', fields);
  } catch (error) {
    logger.warn('Failed to log guild update', error instanceof Error ? error.message : error);
  }
});

client.on(Events.GuildEmojiCreate, async (emoji) => {
  try {
    if (emoji.guild.id !== configStore.current.guild.id) return;
    const executor = await serverLogService.fetchExecutor(emoji.guild, AuditLogEvent.EmojiCreate, emoji.id);
    await serverLogService.send('server', 'إضافة إيموجي', `تمت إضافة إيموجي ${emoji}.`, [
      { name: 'بواسطة', value: executor, inline: true },
      { name: 'الإيموجي', value: `${emoji.name}\nID: ${emoji.id}`, inline: true },
    ]);
  } catch (error) {
    logger.warn('Failed to log emoji create', error instanceof Error ? error.message : error);
  }
});

client.on(Events.GuildEmojiUpdate, async (oldEmoji, newEmoji) => {
  try {
    if (newEmoji.guild.id !== configStore.current.guild.id) return;
    if (oldEmoji.name === newEmoji.name) return;
    const executor = await serverLogService.fetchExecutor(newEmoji.guild, AuditLogEvent.EmojiUpdate, newEmoji.id);
    await serverLogService.send('server', 'تعديل إيموجي', `تم تعديل إيموجي ${newEmoji}.`, [
      { name: 'بواسطة', value: executor, inline: true },
      { name: 'قبل', value: oldEmoji.name ?? 'غير معروف', inline: true },
      { name: 'بعد', value: newEmoji.name ?? 'غير معروف', inline: true },
      { name: 'آيدي', value: newEmoji.id, inline: true },
    ]);
  } catch (error) {
    logger.warn('Failed to log emoji update', error instanceof Error ? error.message : error);
  }
});

client.on(Events.GuildEmojiDelete, async (emoji) => {
  try {
    if (emoji.guild.id !== configStore.current.guild.id) return;
    const executor = await serverLogService.fetchExecutor(emoji.guild, AuditLogEvent.EmojiDelete, emoji.id);
    await serverLogService.send('server', 'حذف إيموجي', 'تم حذف إيموجي من السيرفر.', [
      { name: 'بواسطة', value: executor, inline: true },
      { name: 'الإيموجي', value: `${emoji.name}\nID: ${emoji.id}`, inline: true },
    ]);
  } catch (error) {
    logger.warn('Failed to log emoji delete', error instanceof Error ? error.message : error);
  }
});

client.on(Events.GuildStickerCreate, async (sticker) => {
  try {
    if (sticker.guild?.id !== configStore.current.guild.id) return;
    const executor = await serverLogService.fetchExecutor(sticker.guild, AuditLogEvent.StickerCreate, sticker.id);
    await serverLogService.send('server', 'إضافة ستيكر', 'تمت إضافة ستيكر.', [
      { name: 'بواسطة', value: executor, inline: true },
      { name: 'الستيكر', value: `${sticker.name}\nID: ${sticker.id}`, inline: true },
    ]);
  } catch (error) {
    logger.warn('Failed to log sticker create', error instanceof Error ? error.message : error);
  }
});

client.on(Events.GuildStickerUpdate, async (oldSticker, newSticker) => {
  try {
    if (newSticker.guild?.id !== configStore.current.guild.id) return;
    const fields: { name: string; value: string; inline?: boolean }[] = [];
    addChange(fields, 'الاسم', oldSticker.name, newSticker.name);
    addChange(fields, 'الوصف', oldSticker.description, newSticker.description);
    if (fields.length === 0) return;
    const executor = await serverLogService.fetchExecutor(newSticker.guild, AuditLogEvent.StickerUpdate, newSticker.id);
    fields.unshift({ name: 'بواسطة', value: executor, inline: true });
    fields.push({ name: 'آيدي', value: newSticker.id, inline: true });
    await serverLogService.send('server', 'تعديل ستيكر', 'تم تعديل ستيكر.', fields);
  } catch (error) {
    logger.warn('Failed to log sticker update', error instanceof Error ? error.message : error);
  }
});

client.on(Events.GuildStickerDelete, async (sticker) => {
  try {
    if (sticker.guild?.id !== configStore.current.guild.id) return;
    const executor = await serverLogService.fetchExecutor(sticker.guild, AuditLogEvent.StickerDelete, sticker.id);
    await serverLogService.send('server', 'حذف ستيكر', 'تم حذف ستيكر من السيرفر.', [
      { name: 'بواسطة', value: executor, inline: true },
      { name: 'الستيكر', value: `${sticker.name}\nID: ${sticker.id}`, inline: true },
    ]);
  } catch (error) {
    logger.warn('Failed to log sticker delete', error instanceof Error ? error.message : error);
  }
});

client.on(Events.InviteCreate, async (invite) => {
  try {
    if (invite.guild?.id !== configStore.current.guild.id) return;
    const guild = client.guilds.cache.get(invite.guild.id) ?? await client.guilds.fetch(invite.guild.id).catch(() => null);
    if (!guild) return;
    const executor = await serverLogService.fetchExecutor(guild, AuditLogEvent.InviteCreate, invite.code);
    await serverLogService.send('server', 'إنشاء دعوة', 'تم إنشاء دعوة للسيرفر.', [
      { name: 'بواسطة', value: executor, inline: true },
      { name: 'الكود', value: invite.code, inline: true },
      { name: 'الروم', value: formatMaybeChannel(invite.channelId), inline: true },
      { name: 'الاستخدامات', value: `${invite.uses ?? 0}/${invite.maxUses ?? 'غير محدود'}`, inline: true },
    ]);
  } catch (error) {
    logger.warn('Failed to log invite create', error instanceof Error ? error.message : error);
  }
});

client.on(Events.InviteDelete, async (invite) => {
  try {
    if (invite.guild?.id !== configStore.current.guild.id) return;
    const guild = client.guilds.cache.get(invite.guild.id) ?? await client.guilds.fetch(invite.guild.id).catch(() => null);
    if (!guild) return;
    const executor = await serverLogService.fetchExecutor(guild, AuditLogEvent.InviteDelete, invite.code);
    await serverLogService.send('server', 'حذف دعوة', 'تم حذف دعوة من السيرفر.', [
      { name: 'بواسطة', value: executor, inline: true },
      { name: 'الكود', value: invite.code, inline: true },
      { name: 'الروم', value: formatMaybeChannel(invite.channelId), inline: true },
    ]);
  } catch (error) {
    logger.warn('Failed to log invite delete', error instanceof Error ? error.message : error);
  }
});

client.on(Events.WebhooksUpdate, async (channel) => {
  try {
    if (!('guild' in channel) || channel.guild.id !== configStore.current.guild.id) return;
    const executor = await fetchAnyExecutor(channel.guild, [AuditLogEvent.WebhookCreate, AuditLogEvent.WebhookUpdate, AuditLogEvent.WebhookDelete], channel.id);
    await serverLogService.send('server', 'تحديث ويب هوك', `تم تحديث ويب هوك داخل <#${channel.id}>.`, [
      { name: 'بواسطة', value: executor, inline: true },
      { name: 'الروم', value: formatMaybeChannel(channel.id), inline: true },
    ]);
  } catch (error) {
    logger.warn('Failed to log webhooks update', error instanceof Error ? error.message : error);
  }
});

function trimLogValue(value: string, max = 1000): string {
  return value.length > max ? `${value.slice(0, max - 3)}...` : value;
}

function normalizeLogLine(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

client.on(Events.MessageDelete, async (message) => {
  try {
    const guild = message.guild;
    if (!guild || guild.id !== configStore.current.guild.id) return;

    const author = message.author ? `${message.author.tag} (${message.author.id})` : 'غير معروف';
    const executor = await serverLogService.fetchExecutor(guild, AuditLogEvent.MessageDelete, message.author?.id);
    const text = message.partial ? 'غير متوفر (الرسالة لم تكن محفوظة عند البوت).' : message.content?.trim() || 'بدون محتوى نصي.';
    const attachments = message.partial ? [] : message.attachments.map((attachment) => attachment.url).slice(0, 3);
    const content = trimLogValue([text, attachments.length > 0 ? `المرفقات:\n${attachments.join('\n')}` : ''].filter(Boolean).join('\n\n'));

    await serverLogService.send('messages', 'حذف رسالة', `تم حذف رسالة في <#${message.channelId}>.`, [
      { name: 'بواسطة', value: executor, inline: true },
      { name: 'صاحب الرسالة', value: author, inline: true },
      { name: 'الروم', value: `<#${message.channelId}>`, inline: true },
      { name: 'آيدي الرسالة', value: message.id, inline: true },
      { name: 'المحتوى', value: content },
    ]);
  } catch (error) {
    logger.warn('Failed to log message delete', error instanceof Error ? error.message : error);
  }
});

client.on(Events.MessageBulkDelete, async (messages, channel) => {
  try {
    if (!('guild' in channel) || !channel.guild || channel.guild.id !== configStore.current.guild.id) return;

    const executor = await serverLogService.fetchExecutor(channel.guild, AuditLogEvent.MessageBulkDelete, channel.id);
    const samples = [...messages.values()].slice(0, 8).map((deletedMessage, index) => {
      const author = deletedMessage.author ? deletedMessage.author.tag : 'غير معروف';
      const text = deletedMessage.partial ? 'غير محفوظة عند البوت' : normalizeLogLine(deletedMessage.content || 'بدون محتوى نصي.');
      return `${index + 1}. ${author}: ${trimLogValue(text, 120)}`;
    });

    await serverLogService.send('messages', 'حذف رسائل جماعي', `تم حذف ${messages.size} رسالة في <#${channel.id}>.`, [
      { name: 'بواسطة', value: executor, inline: true },
      { name: 'الروم', value: `<#${channel.id}>`, inline: true },
      { name: 'عدد الرسائل', value: `${messages.size}`, inline: true },
      { name: 'عينات محفوظة', value: trimLogValue(samples.join('\n') || 'لا توجد رسائل محفوظة عند البوت.') },
    ]);
  } catch (error) {
    logger.warn('Failed to log message bulk delete', error instanceof Error ? error.message : error);
  }
});

client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
  try {
    const guild = newMessage.guild;
    if (!guild || guild.id !== configStore.current.guild.id) return;
    if (newMessage.author?.bot) return;
    if (oldMessage.partial || newMessage.partial) return;
    if (oldMessage.content === newMessage.content) return;

    await serverLogService.send('messages', 'تعديل رسالة', `تم تعديل رسالة في <#${newMessage.channelId}>.`, [
      { name: 'صاحب الرسالة', value: newMessage.author ? formatUserLogValue(newMessage.author) : 'غير معروف', inline: true },
      { name: 'الروم', value: `<#${newMessage.channelId}>`, inline: true },
      { name: 'آيدي الرسالة', value: newMessage.id, inline: true },
      { name: 'قبل', value: trimLogValue(oldMessage.content || 'بدون محتوى نصي.') },
      { name: 'بعد', value: trimLogValue(newMessage.content || 'بدون محتوى نصي.') },
    ]);
  } catch (error) {
    logger.warn('Failed to log message update', error instanceof Error ? error.message : error);
  }
});

client.on(Events.MessageCreate, async (message) => {
  try {
    if (message.author.bot || !message.inGuild()) return;

    const securityHandled = await securityService.handleMessage(message);
    if (securityHandled) return;

    const roleCommandHandled = await roleManagementService.handleMessage(message);
    if (roleCommandHandled) return;

    const channelId = message.channelId;
    const ticket = await ticketRepository.findByChannelId(channelId);

    if (!ticket) return;

    // Check if AI is enabled globally
    const aiEnabled = await ticketRepository.getAIEnabled();
    if (!aiEnabled) {
      return;
    }

    await aiService.handleTicketMessage(message, ticket);
  } catch (error) {
    logger.error('Auto-reply error', error instanceof Error ? error.message : error);
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
  runtimeState = 'offline';
  roleProtectionService?.stop();
  void instanceGuardService?.stop();
  healthServer.close();
  client.destroy();
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

const HEALTH_PORT = Number(process.env.PORT) || 8080;
const startedAt = Date.now();
const STARTUP_LOCK_RETRY_MS = 15_000;
const STARTUP_LOCK_TAKEOVER_MS = 60_000;
const STARTUP_LOCK_LOG_INTERVAL_MS = 60_000;

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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForStartupInstanceLock(): Promise<void> {
  const guildId = configStore.current.guild.id;
  let blockedBy: string | null = null;
  let blockedSince = 0;
  let lastBlockedLogAt = 0;

  while (true) {
    try {
      const current = await instanceLockRepository.find(guildId);
      const currentUpdatedAt = current ? new Date(current.updated_at).getTime() : 0;
      const currentFresh = current ? Date.now() - currentUpdatedAt < INSTANCE_LOCK_TTL_MS : false;

      if (current && current.instance_id !== INSTANCE_ID && currentFresh) {
        runtimeState = 'standby';
        const now = Date.now();
        if (blockedBy !== current.instance_id) {
          blockedBy = current.instance_id;
          blockedSince = now;
          lastBlockedLogAt = 0;
        }

        const waitedMs = now - blockedSince;
        if (waitedMs < STARTUP_LOCK_TAKEOVER_MS) {
          if (now - lastBlockedLogAt >= STARTUP_LOCK_LOG_INTERVAL_MS) {
            lastBlockedLogAt = now;
            logger.warn(
              `Another active bot instance owns the lock: ${current.instance_id}. ` +
              `${INSTANCE_ID} is waiting ${Math.ceil((STARTUP_LOCK_TAKEOVER_MS - waitedMs) / 1000)}s before takeover.`,
            );
          }
          await sleep(STARTUP_LOCK_RETRY_MS);
          continue;
        }

        logger.warn(
          `Taking over stale deployment lock from ${current.instance_id} after ${Math.round(waitedMs / 1000)}s. ` +
          `The old instance will disconnect on its next heartbeat.`,
        );
      }

      runtimeState = 'starting';
      await instanceLockRepository.upsert(guildId, INSTANCE_ID);
      logger.info(`Startup instance lock reserved for guild ${guildId} by ${INSTANCE_ID}.`);
      return;
    } catch (error) {
      runtimeState = 'standby';
      logger.warn('Startup instance lock check failed; retrying.', error instanceof Error ? error.message : error);
      await sleep(STARTUP_LOCK_RETRY_MS);
    }
  }
}

const healthServer = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);

  if (url.pathname.startsWith('/wheel') || url.pathname.startsWith('/api/wheel')) {
    try {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = Buffer.concat(chunks).toString('utf-8') || undefined;
      const result = await handleWheelRequest(url, req.method || 'GET', body, req.headers as Record<string, string | string[] | undefined>);
      res.writeHead(result.status, result.headers);
      res.end(result.body);
    } catch (err: any) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  if (req.url === '/api') {
    const uptime = Math.floor((Date.now() - startedAt) / 1000);
    const botUser = client.user;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: botUser ? 'online' : 'starting',
      runtimeState,
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
  const statusText = isOnline ? 'Online' : (runtimeState === 'standby' ? 'Standby' : 'Starting...');
  const statusColor = isOnline ? '#22c55e' : (runtimeState === 'standby' ? '#38bdf8' : '#eab308');
  const statusDot = isOnline ? '#22c55e' : (runtimeState === 'standby' ? '#38bdf8' : '#eab308');
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

async function startDiscordClient(): Promise<void> {
  await waitForStartupInstanceLock();
  await client.login(env.DISCORD_TOKEN);
}

startDiscordClient().catch((error) => {
  runtimeState = 'offline';
  logger.error('Failed to start Discord client', error instanceof Error ? error.message : error);
});
