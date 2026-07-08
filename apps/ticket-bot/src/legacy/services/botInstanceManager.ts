import {
  Client,
  Events,
  GatewayIntentBits,
  Partials,
  type ChatInputCommandInteraction,
  type Guild,
} from 'discord.js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Env } from '../env.js';
import type { AppConfig } from '../types/config.js';
import type { ConfigStore } from './configStore.js';
import { BotInstanceRepository, type BotInstanceRecord, type TicketSettingsData } from '../database/botInstanceRepository.js';
import { TicketRepository } from '../database/ticketRepository.js';
import { MediatorRepository } from '../database/mediatorRepository.js';
import { decryptToken } from '../utils/crypto.js';
import { registerProductCommands } from '../commands/productCommandRegistry.js';
import { InfrastructureService } from './infrastructureService.js';
import { PanelService } from './panelService.js';
import { TicketService } from './ticketService.js';
import { TranscriptService } from './transcriptService.js';
import { InfrastructureRepository } from '../database/infrastructureRepository.js';
import { buildErrorEmbed, buildSuccessEmbed } from '../builders/ticketBuilder.js';
import { safeDeferReply, safeEditReply } from '../utils/interaction.js';
import { logger } from '../utils/logger.js';
import { activityTypeFromName } from '../utils/discord.js';

interface RunningClient {
  instance: BotInstanceRecord;
  client: Client;
  config: AppConfig;
  startedAt: Date;
}

const SYNC_INTERVAL_MS = 60_000;

/** Initial backoff after a login failure (ms) before retrying */
const FAILURE_BACKOFF_MS = 5 * 60_000;

/**
 * Minimal ConfigStore-compatible object for InfrastructureService.
 * patchGuild/patchPanel are no-ops — client bots use the default config.
 */
function makeConfigStoreMock(config: AppConfig): ConfigStore {
  return {
    current: config,
    get: () => config,
    getOrNull: () => config,
    reload: () => config,
    patchGuild: (_guildId: string, partial: Partial<AppConfig['guild']>) => {
      config.guild = { ...config.guild, ...partial };
    },
    patchPanel: (_guildId: string, partial: Partial<AppConfig['panel']>) => {
      config.panel = { ...config.panel, ...partial };
    },
    patchEmojis: (_guildId: string, categoryEmojis: Record<string, string>, buttonEmojis: Record<string, string>) => {
      config.emojis = {
        ...config.emojis,
        categories: { ...config.emojis.categories, ...categoryEmojis },
        ...buttonEmojis,
      };
    },
  } as unknown as ConfigStore;
}

/** Build a minimal AppConfig for a client bot guild — no local config files needed */
function makeDefaultConfig(guildId: string): AppConfig {
  return {
    bot: {
      presence: { status: 'online', activityType: 'Watching', activityName: 'tickets' },
      locale: 'ar',
      timezone: 'UTC',
      embedColor: '#5865F2',
      errorColor: '#ED4245',
      successColor: '#57F287',
      footerText: 'Ticket Bot',
      footerIconUrl: '',
    },
    guild: {
      id: guildId,
      categoryId: '',
      archiveCategoryId: '',
      logChannelId: '',
      transcriptChannelId: '',
      supportRoleIds: [],
      managerRoleIds: [],
      mentionRolesOnOpen: [],
    },
    images: { panelBannerUrl: '', ticketBannerUrl: '', thumbnailUrl: '' },
    naming: {
      ticketChannelPrefix: 'ticket',
      maxChannelNameLength: 100,
      includeCategorySlug: true,
      zeroPadLength: 3,
      topicTemplate: '{user}',
    },
    limits: {
      allowOnlyOneOpenTicketPerUser: false,
      maxQuestionsPerCategory: 5,
      maxAnswerLength: 500,
      maxCategoryOptions: 25,
      pinSummaryMessageOnCreate: false,
    },
    panel: {
      channelId: '',
      messageId: '',
      title: 'Ticket Panel',
      subtitle: 'اختر تصنيفاً لفتح تذكرة',
      description: '',
      menuPlaceholder: 'اختر تصنيفاً...',
      menuCustomId: 'ticket_open',
      defaultMention: 'here',
      showNumbers: false,
      accentText: '',
    },
    ticket: {
      welcomeTitle: 'مرحباً!',
      welcomeDescription: 'سيتم مساعدتك قريباً',
      summaryTitle: 'ملخص',
      controls: {
        close: { label: 'إغلاق', style: 'Danger', emojiId: '' },
        add: { label: 'إضافة', style: 'Success', emojiId: '' },
        remove: { label: 'حذف', style: 'Danger', emojiId: '' },
        claim: { label: 'استلام', style: 'Primary', emojiId: '' },
        pin: { label: 'تثبيت', style: 'Secondary', emojiId: '' },
        stats: { label: 'إحصائيات', style: 'Secondary', emojiId: '', allowedRoleIds: [] },
      },
      messages: {
        alreadyOpen: 'لديك تذكرة مفتوحة بالفعل.',
        created: 'تم فتح التذكرة.',
        closed: 'تم إغلاق التذكرة.',
        claimed: 'تم استلام التذكرة.',
        unclaimed: 'تم إلغاء استلام التذكرة.',
        addedMember: 'تم إضافة العضو.',
        removedMember: 'تم إزالة العضو.',
        noPermission: '❌ ليس لديك الصلاحية.',
        notInTicket: 'أنت لست في هذه التذكرة.',
      },
    },
    emojis: { panelIcon: '', ticketIcon: '', infoIcon: '', epicIcon: '', categories: {} },
    categories: [{
      key: 'default',
      enabled: true,
      label: 'عام',
      description: 'للطلبات العامة',
      channelNameTemplate: 'ticket-{username}',
      supportRoleIds: [],
      questions: [],
    }],
    commands: {
      registerOnStartup: true,
      guildScoped: true,
      names: {
        panelSend: 'panel_send',
        panelRefresh: 'panel_refresh',
        configReload: 'config_reload',
        emojiRefresh: 'emoji_refresh',
        ticketClose: 'ticket_close',
        ticketStats: 'ticket_stats',
      },
    },
    features: {
      applicationsPanel: false,
      tempRoomsPanel: true,
    },
    tempRooms: {
      enabled: false,
      categoryId: '',
      joinChannelId: '',
      controlChannelId: '',
      controlMessageId: '',
      defaultRoomName: 'روم {username}',
      defaultUserLimit: 0,
      transferOwnershipOnOwnerLeave: true,
      deleteWhenEmpty: true,
      adminBypass: false,
      maxRooms: 50,
      panelImageUrl: 'https://i.imgur.com/BiQetZY.png',
      rooms: {},
    },
    voice247: {
      enabled: false,
      channelId: '',
    },
    roleProtection: {
      enabled: false,
      protectedRoleId: '',
      protectedRoleName: '',
      excludedRoleId: '',
      syncIntervalMinutes: 0,
    },
    roleManagement: {
      enabled: false,
      ownerId: '',
      allowedRoleIds: [],
      blockedRoleIds: [],
      dailyLimitedRoleId: '',
      dailyLimitedRoleLimit: 0,
    },
    mediatorWarnings: {
      enabled: false,
      mediatorRoleId: '',
      maxWarnings: 3,
      removeRoleOnLimit: true,
    },
  };
}

/**
 * Apply dashboard-saved ticket settings (bot_configs.config_data.ticketSettings)
 * onto an AppConfig. Mutates in place so live references (config store mocks,
 * wired event handlers) pick up the changes.
 */
function applyTicketSettings(config: AppConfig, s: TicketSettingsData): void {
  if (s.panel_channel_id) config.panel.channelId = s.panel_channel_id;
  if (s.log_channel_id) config.guild.logChannelId = s.log_channel_id;
  if (s.transcript_channel_id) config.guild.transcriptChannelId = s.transcript_channel_id;
  if (s.ticket_category_id) config.guild.categoryId = s.ticket_category_id;
  if (s.archive_category_id) config.guild.archiveCategoryId = s.archive_category_id;
  if (s.support_role_id) config.guild.supportRoleIds = [s.support_role_id];
  if (s.panel_message) config.panel.description = s.panel_message;
  if (s.embed_color) config.bot.embedColor = s.embed_color;
  if (s.banner_url) config.images.panelBannerUrl = s.banner_url;
  if (s.button_text) config.panel.menuPlaceholder = s.button_text;
  if (s.footer_text) config.bot.footerText = s.footer_text;

  if (s.categories?.length) {
    config.categories = s.categories.map((c) => ({
      key: c.key,
      enabled: c.enabled,
      label: c.label,
      description: c.description,
      channelNameTemplate: 'ticket-{username}',
      supportRoleIds: [],
      questions: [],
    }));
    for (const c of s.categories) {
      if (c.emoji) config.emojis.categories[c.key] = c.emoji;
    }
  }

  if (s.buttons) {
    for (const key of ['close', 'add', 'remove', 'claim', 'pin'] as const) {
      const button = s.buttons[key];
      if (button?.label) {
        config.ticket.controls[key].label = button.label;
        config.ticket.controls[key].style = button.style;
      }
    }
  }
}

export class BotInstanceManager {
  private readonly clients = new Map<string, RunningClient>();
  /** Track instances that failed login so we don't retry every 60s */
  private readonly failedInstances = new Map<string, number>();
  private readonly repository: BotInstanceRepository;
  private readonly infrastructureRepo: InfrastructureRepository;
  private readonly ticketRepository: TicketRepository;
  private readonly mediatorRepository: MediatorRepository;
  private readonly transcriptService = new TranscriptService();
  private syncTimer: ReturnType<typeof setInterval> | null = null;
  private started = false;

  public constructor(
    supabase: SupabaseClient,
    private readonly env: Env,
  ) {
    this.repository = new BotInstanceRepository(supabase);
    this.infrastructureRepo = new InfrastructureRepository(supabase);
    this.ticketRepository = new TicketRepository(supabase);
    this.mediatorRepository = new MediatorRepository(supabase);
  }

  /** Start the manager — read all active instances and launch them */
  public async init(): Promise<void> {
    if (this.started) return;
    this.started = true;

    logger.info('[BotInstanceManager] Initializing...');
    await this.sync();

    this.syncTimer = setInterval(() => {
      this.sync().catch((error) => {
        logger.error('[BotInstanceManager] Sync failed', error instanceof Error ? error.message : error);
      });
    }, SYNC_INTERVAL_MS);
    this.syncTimer.unref();

    logger.info(`[BotInstanceManager] Initialized — sync every ${SYNC_INTERVAL_MS / 1000}s`);
  }

  /** Sync: read all active ticket instances from Supabase and start/stop as needed */
  public async sync(): Promise<void> {
    try {
      const now = Date.now();
      const expired = await this.repository.expireStaleActiveTicketInstances();
      if (expired > 0) {
        logger.info(`[BotInstanceManager] Marked ${expired} stale bot instance(s) as expired.`);
      }
      const instances = await this.repository.findActiveTicketInstances();
      const currentIds = new Set(this.clients.keys());
      const foundIds = new Set<string>();

      for (const inst of instances) {
        foundIds.add(inst.id);
        if (currentIds.has(inst.id)) {
          const running = this.clients.get(inst.id);
          if (running && running.instance.updated_at !== inst.updated_at) {
            await this.reloadInstanceConfig(running, inst);
          }
          continue;
        }

        // Skip if this instance recently failed — respect backoff
        const lastFailed = this.failedInstances.get(inst.id);
        if (lastFailed && (now - lastFailed) < FAILURE_BACKOFF_MS) continue;

        await this.startInstance(inst);
      }

      for (const id of currentIds) {
        if (!foundIds.has(id)) {
          await this.stopInstance(id, 'no longer in active instances');
        }
      }

      // Clean stale failed entries that won't be retried anyway
      for (const [id, ts] of this.failedInstances) {
        if (foundIds.has(id) && (now - ts) >= FAILURE_BACKOFF_MS) {
          this.failedInstances.delete(id);
        }
        if (!foundIds.has(id)) {
          this.failedInstances.delete(id);
        }
      }
    } catch (error) {
      logger.error('[BotInstanceManager] Sync error', error instanceof Error ? error.message : error);
    }
  }

  /** Start a single bot instance: decrypt token → create client → login */
  private async startInstance(record: BotInstanceRecord): Promise<void> {
    if (this.clients.has(record.id)) {
      return;
    }

    if (!record.guild_id) {
      logger.warn(`[BotInstanceManager] Instance ${record.id} has no guild_id — skipping`);
      return;
    }

    if (!this.env.TOKEN_ENCRYPTION_KEY) {
      logger.error('[BotInstanceManager] TOKEN_ENCRYPTION_KEY not set — cannot decrypt tokens');
      return;
    }

    // Build config — try bot_configs first, fall back to defaults
    const config = makeDefaultConfig(record.guild_id);
    try {
      const dbConfig = await this.repository.findConfigByInstanceId(record.id);
      if (dbConfig?.commands?.names) {
        config.commands = { ...config.commands, names: { ...config.commands.names, ...dbConfig.commands.names } };
      }
      if (dbConfig?.ticketSettings) {
        applyTicketSettings(config, dbConfig.ticketSettings);
      }
    } catch {
      // ignore — fall back to defaults
    }

    // Decrypt token
    let token: string;
    try {
      token = decryptToken(record.bot_token_encrypted, this.env.TOKEN_ENCRYPTION_KEY);
    } catch (error) {
      logger.error(
        `[BotInstanceManager] Failed to decrypt token for ${record.bot_name} (${record.id}):`,
        error instanceof Error ? error.message : error,
      );
      await this.repository.logEvent({
        botInstanceId: record.id,
        guildId: record.guild_id,
        userId: record.owner_id ?? undefined,
        eventType: 'token_decrypt_failed',
        eventMessage: `Failed to decrypt token for ${record.bot_name} (${record.bot_user_id})`,
        metadata: { error: error instanceof Error ? error.message : String(error) },
      }).catch(() => null);
      return;
    }

    // Create Discord client
    const client = new Client({
      // Keep client-bot intents minimal. Privileged intents (MessageContent/GuildMembers)
      // require Developer Portal toggles and caused "Used disallowed intents" failures.
      intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
      partials: [Partials.Channel, Partials.Message],
    });

    const running: RunningClient = { instance: record, client, config, startedAt: new Date() };
    this.clients.set(record.id, running);

    this.wireClientEvents(running);

    try {
      await client.login(token);
      await this.repository.markStarted(record.id);
      this.failedInstances.delete(record.id);
      logger.info(
        `[BotInstanceManager] 🟢 Started: ${record.bot_name} (${record.bot_user_id}) in guild ${record.guild_id}`,
      );
    } catch (error) {
      logger.error(
        `[BotInstanceManager] Failed to login ${record.bot_name}:`,
        error instanceof Error ? error.message : error,
      );
      this.clients.delete(record.id);
      this.failedInstances.set(record.id, Date.now());
      client.destroy();

      const message = error instanceof Error ? error.message : String(error);
      if (/invalid token/i.test(message)) {
        await this.repository.updateStatus(record.id, 'rejected').catch(() => null);
        await this.repository.logEvent({
          botInstanceId: record.id,
          guildId: record.guild_id,
          userId: record.owner_id ?? undefined,
          eventType: 'bot_token_invalid',
          eventMessage: `Bot token rejected by Discord for ${record.bot_name} (${record.bot_user_id})`,
          metadata: { error: message },
        }).catch(() => null);
      }
    }
  }

  /** Reload dashboard settings for a running instance (bot_instances.updated_at changed) */
  private async reloadInstanceConfig(running: RunningClient, fresh: BotInstanceRecord): Promise<void> {
    running.instance = fresh;
    try {
      const dbConfig = await this.repository.findConfigByInstanceId(fresh.id);
      if (!dbConfig?.ticketSettings) return;

      applyTicketSettings(running.config, dbConfig.ticketSettings);
      logger.info(`[BotInstanceManager] Reloaded ticket settings for ${fresh.bot_name} (${fresh.id})`);

      await this.refreshPanelMessage(running);
    } catch (error) {
      logger.error(
        `[BotInstanceManager] Failed to reload config for ${fresh.id}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  /** Re-render the existing panel message (if any) after a settings change */
  private async refreshPanelMessage(running: RunningClient): Promise<void> {
    const { client, config, instance } = running;
    const guildId = instance.guild_id;
    const channelId = config.panel.channelId;
    if (!guildId || !channelId || !client.isReady()) return;

    try {
      const guild = await client.guilds.fetch(guildId);
      const channel = await guild.channels.fetch(channelId).catch(() => null);
      if (!channel?.isTextBased()) return;

      const messages = await channel.messages.fetch({ limit: 50 });
      const botId = client.user?.id;
      const panelMessage = messages.find((m) => m.author.id === botId && m.components.length > 0);
      if (!panelMessage) return;

      const panelService = new PanelService(makeConfigStoreMock(config), this.mediatorRepository);
      await panelService.refreshPanel(guild, panelMessage.id);
      logger.info(`[BotInstanceManager] Panel refreshed for guild ${guildId} after settings update`);
    } catch (error) {
      logger.warn(
        `[BotInstanceManager] Could not auto-refresh panel for guild ${guildId}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  /** Stop a running instance */
  public async stopInstance(id: string, reason?: string): Promise<void> {
    const running = this.clients.get(id);
    if (!running) return;

    logger.info(`[BotInstanceManager] Stopping ${id}${reason ? ` (${reason})` : ''}`);
    try { running.client.destroy(); } catch { /* ignore */ }
    this.clients.delete(id);
    await this.repository.markStopped(id).catch(() => null);
  }

  /** Wire Discord event handlers for a client bot */
  private wireClientEvents(running: RunningClient): void {
    const { client, instance, config } = running;

    client.once(Events.ClientReady, async (readyClient) => {
      const guildId = instance.guild_id!;
      logger.info(`[BotInstanceManager] ${readyClient.user.tag} ready in guild ${guildId}`);

      readyClient.user.setPresence({
        status: 'online',
        activities: [{ type: activityTypeFromName('Watching'), name: 'tickets' }],
      });

      try {
        const guild = await readyClient.guilds.fetch(guildId);

        // Register product-scoped commands for this bot.
        const botUserId = readyClient.user.id;
        await registerProductCommands(readyClient.token, botUserId, config, instance.product_type);
        logger.info(`[BotInstanceManager] Registered commands for ${readyClient.user.tag} in guild ${guildId}`);

        // Ensure basic infrastructure (categories, channels)
        const infraService = new InfrastructureService({
          configStore: makeConfigStoreMock(config),
          infrastructureRepository: this.infrastructureRepo,
        });
        await infraService.ensureInfrastructure(readyClient, guild);

        // Log activation event
        await this.repository.logEvent({
          botInstanceId: instance.id,
          guildId,
          eventType: 'ticket_product_activated',
          eventMessage: `Bot ${readyClient.user.tag} activated ticket product for guild ${guildId}`,
          metadata: {
            bot_user_id: instance.bot_user_id,
            bot_name: instance.bot_name,
            owner_id: instance.owner_id,
            product_type: instance.product_type,
            plan_type: instance.plan_type,
          },
        }).catch(() => null);

        logger.info(`[BotInstanceManager] Ticket product activated for guild ${guildId}`);
      } catch (error) {
        logger.error(
          `[BotInstanceManager] Setup failed for ${readyClient.user.tag}:`,
          error instanceof Error ? error.message : error,
        );
      }
    });

    // GuildCreate: verify guild ownership
    client.on(Events.GuildCreate, async (guild) => {
      await this.handleGuildCreate(running, guild);
    });

    // InteractionCreate: each managed client bot must handle its own commands.
    client.on(Events.InteractionCreate, async (interaction) => {
      if (!interaction.isChatInputCommand()) return;
      await this.handleClientBotCommand(running, interaction);
    });

    client.on(Events.Error, (error) => {
      logger.error(`[BotInstanceManager] Client error for ${instance.bot_name}: ${error.message}`);
    });
  }

  /** Handle slash commands received by a managed client bot. */
  private async handleClientBotCommand(running: RunningClient, interaction: ChatInputCommandInteraction): Promise<void> {
    const { instance, config } = running;
    const commandName = interaction.commandName;

    logger.info(
      `[ClientBot Interaction] command=${commandName} guild=${interaction.guildId ?? 'none'} ` +
      `bot=${instance.bot_user_id ?? running.client.user?.id ?? 'unknown'} user=${interaction.user.id}`,
    );

    if (interaction.guildId !== instance.guild_id) {
      await interaction.reply({ content: '❌ هذا الأمر غير مخصص لهذا السيرفر.', flags: 64 }).catch(() => null);
      return;
    }

    const ticketCommands = new Set([
      'ticket_setup',
      config.commands.names.panelSend,
      config.commands.names.panelRefresh,
      config.commands.names.ticketClose,
      config.commands.names.ticketStats,
      'restore-panel',
    ].filter(Boolean));

    if (!ticketCommands.has(commandName)) {
      await interaction.reply({ content: '❌ هذا الأمر غير مدعوم لهذا المنتج.', flags: 64 }).catch(() => null);
      return;
    }

    if (!this.isOwnerOrManager(interaction)) {
      await interaction.reply({ content: '❌ ما عندك صلاحية استخدام هذا الأمر.', flags: 64 }).catch(() => null);
      return;
    }

    if (!(await safeDeferReply(interaction, `[ClientBot ${commandName}]`))) return;

    try {
      const configStore = makeConfigStoreMock(config);
      const panelService = new PanelService(configStore, this.mediatorRepository);
      const ticketService = new TicketService({
        configStore,
        ticketRepository: this.ticketRepository,
        transcriptService: this.transcriptService,
        mediatorRepository: this.mediatorRepository,
      });

      if (commandName === 'ticket_setup') {
        await safeEditReply(interaction, [
          buildSuccessEmbed(config, 'Ticket Ready', `البوت مفعل. استخدم /${config.commands.names.panelSend} لإرسال لوحة التذاكر.`),
        ]);
        return;
      }

      if (commandName === config.commands.names.panelSend) {
        const message = await panelService.sendPanel(interaction.guild!);
        await safeEditReply(interaction, [
          buildSuccessEmbed(config, 'Panel Sent', `تم إرسال لوحة التذاكر بنجاح.\nMessage ID: \`${message.id}\``),
        ]);
        return;
      }

      if (commandName === config.commands.names.panelRefresh) {
        const messageId = interaction.options.getString('message-id') ?? undefined;
        const message = await panelService.refreshPanel(interaction.guild!, messageId);
        await safeEditReply(interaction, [
          buildSuccessEmbed(config, 'Panel Refreshed', `تم تحديث لوحة التذاكر.\nMessage ID: \`${message.id}\``),
        ]);
        return;
      }

      if (commandName === config.commands.names.ticketClose) {
        const reason = interaction.options.getString('reason') ?? 'Closed via command';
        await ticketService.handleSlashClose(interaction, reason);
        return;
      }

      if (commandName === config.commands.names.ticketStats) {
        await ticketService.handleSlashStats(interaction);
        return;
      }

      if (commandName === 'restore-panel') {
        await ticketService.restoreTicketPanel(interaction);
        return;
      }
    } catch (error) {
      logger.error(
        `[ClientBot Interaction] command=${commandName} guild=${interaction.guildId ?? 'none'} ` +
        `bot=${instance.bot_user_id ?? running.client.user?.id ?? 'unknown'} failed:`,
        error instanceof Error ? error.stack ?? error.message : error,
      );
      await safeEditReply(interaction, [buildErrorEmbed(config, '❌ حدث خطأ أثناء تنفيذ الأمر.')]).catch(() => null);
    }
  }

  /** GuildCreate handler: verify guild_id, status, product_type — activate or leave */
  private async handleGuildCreate(running: RunningClient, guild: Guild): Promise<void> {
    const { instance } = running;

    // 1. Check guild_id matches
    if (instance.guild_id && guild.id !== instance.guild_id) {
      logger.warn(
        `[BotInstanceManager] ${instance.bot_name} joined guild ${guild.id} but registered for ${instance.guild_id} — leaving`,
      );
      await this.repository.logEvent({
        botInstanceId: instance.id,
        guildId: guild.id,
        eventType: 'guild_mismatch',
        eventMessage: `Bot joined wrong guild ${guild.name} (${guild.id}), expected ${instance.guild_id}`,
      }).catch(() => null);

      try {
        const ch = guild.systemChannel ?? guild.channels.cache.first();
        if (ch?.isTextBased()) await ch.send('❌ هذا السيرفر غير مسجل لهذا البوت. سيتم المغادرة.');
      } catch { /* ignore */ }

      await guild.leave();
      return;
    }

    // 2. Check current status from DB
    try {
      const fresh = await this.repository.findById(instance.id);
      if (!fresh || fresh.status !== 'active' || fresh.product_type !== 'ticket') {
        logger.warn(
          `[BotInstanceManager] ${instance.bot_name} joined guild ${guild.id} but status=${fresh?.status ?? 'deleted'} — leaving`,
        );
        await this.repository.logEvent({
          botInstanceId: instance.id,
          guildId: guild.id,
          eventType: 'guild_join_rejected',
          eventMessage: `Bot joined guild but service not active (status=${fresh?.status ?? 'deleted'})`,
        }).catch(() => null);

        try {
          const ch = guild.systemChannel ?? guild.channels.cache.first();
          if (ch?.isTextBased()) await ch.send('❌ الخدمة غير مفعلة. سيتم المغادرة.');
        } catch { /* ignore */ }

        await guild.leave();
        return;
      }

      // 3. All checks passed — log activation
      await this.repository.logEvent({
        botInstanceId: instance.id,
        guildId: guild.id,
        eventType: 'ticket_product_activated',
        eventMessage: `Ticket product activated for guild ${guild.name} (${guild.id})`,
        metadata: { owner_id: instance.owner_id, plan_type: instance.plan_type },
      }).catch(() => null);

      logger.info(`[BotInstanceManager] Ticket product activated for guild ${guild.id}`);
    } catch (error) {
      logger.error(
        `[BotInstanceManager] guildCreate error for ${instance.bot_name}:`,
        error instanceof Error ? error.message : error,
      );
      await guild.leave();
    }
  }

  /** Check if user is authorized for this exact bot_instance and guild */
  private isOwnerOrManager(interaction: ChatInputCommandInteraction): boolean {
    for (const [, running] of this.clients) {
      if (running.client !== interaction.client) continue;

      // Never authorize commands from another guild for this bot instance.
      if (interaction.guildId !== running.instance.guild_id) return false;

      return interaction.user.id === running.instance.owner_id ||
             interaction.user.id === this.env.TRIAL_MANAGER_ID;
    }
    return false;
  }

  /** Number of currently running client bots */
  public get runningCount(): number {
    return this.clients.size;
  }

  /** Shut down all managed bots */
  public destroy(): void {
    logger.info(`[BotInstanceManager] Shutting down ${this.clients.size} bot(s)...`);

    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }

    for (const [id, running] of this.clients) {
      try { running.client.destroy(); } catch { /* ignore */ }
      this.repository.markStopped(id).catch(() => null);
    }

    this.clients.clear();
    this.started = false;
    logger.info('[BotInstanceManager] All bots shut down');
  }
}
