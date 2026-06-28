import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  MessageFlags,
  ModalBuilder,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextInputBuilder,
  TextInputStyle,
  UserSelectMenuBuilder,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type Client,
  type Guild,
  type GuildMember,
  type ModalSubmitInteraction,
  type StringSelectMenuInteraction,
  type UserSelectMenuInteraction,
  type VoiceBasedChannel,
  type VoiceChannel,
  type VoiceState,
} from 'discord.js';
import type { AppConfig, TempRoomState } from '../types/config.js';
import type { ConfigStore } from './configStore.js';
import { logger } from '../utils/logger.js';

const DEFAULT_CATEGORY_NAME = 'الرومات المؤقتة';
const DEFAULT_JOIN_NAME = '➕・إنشاء روم';
const DEFAULT_CONTROL_NAME = 'لوحة-تحكم';
const DEFAULT_ROOM_TEMPLATE = 'روم {username}';
const PANEL_IMAGE = 'https://i.imgur.com/BiQetZY.png';
const MAX_NAME_LENGTH = 100;
const BTN_COOLDOWN_MS = 1500;
const RENAME_COOLDOWN_MS = 10_000;
const LIMIT_COOLDOWN_MS = 5_000;

const buttonIds = {
  lock: (guildId: string) => `tv:l:${guildId}`,
  unlock: (guildId: string) => `tv:u:${guildId}`,
  show: (guildId: string) => `tv:s:${guildId}`,
  hide: (guildId: string) => `tv:h:${guildId}`,
  kick: (guildId: string) => `tv:k:${guildId}`,
  ban: (guildId: string) => `tv:b:${guildId}`,
  unban: (guildId: string) => `tv:ub:${guildId}`,
  rename: (guildId: string) => `tv:r:${guildId}`,
  limit: (guildId: string) => `tv:lm:${guildId}`,
  allow: (guildId: string) => `tv:a:${guildId}`,
  unallow: (guildId: string) => `tv:ua:${guildId}`,
};

const selectIds = {
  kick: (guildId: string, ownerId: string) => `tvs:k:${guildId}:${ownerId}`,
  ban: (guildId: string, ownerId: string) => `tvs:b:${guildId}:${ownerId}`,
  unban: (guildId: string, ownerId: string) => `tvs:ub:${guildId}:${ownerId}`,
  allow: (guildId: string, ownerId: string) => `tvs:a:${guildId}:${ownerId}`,
  unallow: (guildId: string, ownerId: string) => `tvs:ua:${guildId}:${ownerId}`,
};

const modalIds = {
  rename: (guildId: string) => `tvm:r:${guildId}`,
  limit: (guildId: string) => `tvm:l:${guildId}`,
};

const imageCache = new Map<string, Buffer>();

async function fetchImage(url: string): Promise<Buffer> {
  const cached = imageCache.get(url);
  if (cached) return cached;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch temp room panel image: ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  imageCache.set(url, buffer);
  return buffer;
}

function uniq(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function sanitizeChannelName(input: string): string {
  return input
    .replace(/@everyone/gi, 'everyone')
    .replace(/@here/gi, 'here')
    .replace(/[\n\r\t]/g, ' ')
    .replace(/[`*_~|<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_NAME_LENGTH);
}

function applyRoomTemplate(template: string, member: GuildMember): string {
  const username = sanitizeChannelName(member.displayName || member.user.username || 'user');
  return sanitizeChannelName((template || DEFAULT_ROOM_TEMPLATE).replace('{username}', username)) || `${DEFAULT_ROOM_TEMPLATE.replace('{username}', username)}`;
}

function isAdminBypass(member: GuildMember, config: AppConfig): boolean {
  if (!config.tempRooms.adminBypass) return false;
  return member.permissions.has(PermissionFlagsBits.Administrator) || member.permissions.has(PermissionFlagsBits.ManageChannels);
}

function defaultTempRooms(config: AppConfig): AppConfig['tempRooms'] {
  const existing = config.tempRooms;
  return {
    enabled: existing?.enabled ?? false,
    categoryId: existing?.categoryId ?? '',
    joinChannelId: existing?.joinChannelId ?? '',
    controlChannelId: existing?.controlChannelId ?? '',
    controlMessageId: existing?.controlMessageId ?? '',
    defaultRoomName: existing?.defaultRoomName ?? DEFAULT_ROOM_TEMPLATE,
    defaultUserLimit: existing?.defaultUserLimit ?? 0,
    transferOwnershipOnOwnerLeave: existing?.transferOwnershipOnOwnerLeave ?? true,
    deleteWhenEmpty: existing?.deleteWhenEmpty ?? true,
    adminBypass: existing?.adminBypass ?? false,
    maxRooms: existing?.maxRooms ?? 50,
    panelImageUrl: existing?.panelImageUrl ?? PANEL_IMAGE,
    rooms: existing?.rooms ?? {},
  };
}

function tempRoomState(ownerId: string, userLimit: number): TempRoomState {
  return {
    ownerId,
    createdAt: Date.now(),
    allowedUserIds: [],
    bannedUserIds: [],
    userLimit,
    locked: false,
    hidden: false,
    systemManagedOverwrites: {},
  };
}

function isDiscordNotFound(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && Number((error as { code?: unknown }).code) === 10003;
}

export class TempRoomService {
  private readonly creationLocks = new Set<string>();
  private readonly cooldowns = new Map<string, number>();

  public constructor(private readonly configStore: ConfigStore) {}

  public isTempButton(customId: string): boolean {
    return customId.startsWith('tv:');
  }

  public isTempSelect(customId: string): boolean {
    return customId.startsWith('tvs:');
  }

  public isTempModal(customId: string): boolean {
    return customId.startsWith('tvm:');
  }

  private getConfig(guildId: string): AppConfig {
    const config = this.configStore.get(guildId);
    if (!config.tempRooms) {
      return this.configStore.update(guildId, (current) => ({ ...current, tempRooms: defaultTempRooms(current) }));
    }
    return config;
  }

  private saveTempRooms(guildId: string, updater: (rooms: AppConfig['tempRooms']) => AppConfig['tempRooms']): AppConfig {
    return this.configStore.update(guildId, (config) => {
      const tempRooms = updater(defaultTempRooms(config));
      return { ...config, tempRooms };
    });
  }

  private async reply(interaction: ButtonInteraction | StringSelectMenuInteraction | UserSelectMenuInteraction | ModalSubmitInteraction | ChatInputCommandInteraction, content: string): Promise<void> {
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content }).catch(() => null);
      return;
    }
    await interaction.reply({ content, flags: MessageFlags.Ephemeral }).catch(() => null);
  }

  private async defer(interaction: ButtonInteraction | StringSelectMenuInteraction | UserSelectMenuInteraction | ModalSubmitInteraction | ChatInputCommandInteraction): Promise<boolean> {
    if (interaction.deferred || interaction.replied) return true;
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      return true;
    } catch {
      return false;
    }
  }

  private cooldown(guildId: string, userId: string, action: string, ms = BTN_COOLDOWN_MS): boolean {
    const key = `${guildId}:${userId}:${action}`;
    const now = Date.now();
    const prev = this.cooldowns.get(key) ?? 0;
    if (now - prev < ms) return false;
    this.cooldowns.set(key, now);
    if (this.cooldowns.size > 5000) {
      const oldest = this.cooldowns.keys().next().value;
      if (oldest) this.cooldowns.delete(oldest);
    }
    return true;
  }

  private findRoomByOwner(config: AppConfig, ownerId: string): [string, TempRoomState] | null {
    const entry = Object.entries(config.tempRooms.rooms).find(([, room]) => room.ownerId === ownerId);
    return entry ?? null;
  }

  private async resolveOwnedRoom(guild: Guild, member: GuildMember): Promise<{ config: AppConfig; channel: VoiceChannel; channelId: string; state: TempRoomState } | null> {
    const config = this.getConfig(guild.id);
    if (!config.tempRooms.enabled) return null;

    let entry = this.findRoomByOwner(config, member.id);
    if (!entry && isAdminBypass(member, config) && member.voice.channelId && config.tempRooms.rooms[member.voice.channelId]) {
      entry = [member.voice.channelId, config.tempRooms.rooms[member.voice.channelId]];
    }
    if (!entry) return null;

    const [channelId, state] = entry;
    const channel = await guild.channels.fetch(channelId).catch(() => null);
    if (!channel || channel.type !== ChannelType.GuildVoice) {
      this.removeRoom(guild.id, channelId);
      return null;
    }
    return { config, channel, channelId, state };
  }

  private removeRoom(guildId: string, channelId: string): void {
    this.saveTempRooms(guildId, (tempRooms) => {
      const rooms = { ...tempRooms.rooms };
      delete rooms[channelId];
      return { ...tempRooms, rooms };
    });
  }

  private setRoom(guildId: string, channelId: string, state: TempRoomState): AppConfig {
    return this.saveTempRooms(guildId, (tempRooms) => ({
      ...tempRooms,
      rooms: { ...tempRooms.rooms, [channelId]: state },
    }));
  }

  private async buildPanelPayload(config: AppConfig) {
    const image = await fetchImage(config.tempRooms.panelImageUrl || PANEL_IMAGE);
    const attachment = new AttachmentBuilder(image, { name: 'temp-rooms-panel.png' });
    const g = config.guild.id;

    // Discord renders buttons left-to-right. To make the visual order Arabic RTL,
    // components are added in reverse visual order per row.
    const rows = [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(buttonIds.hide(g)).setLabel('إخفاء').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(buttonIds.show(g)).setLabel('إظهار').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(buttonIds.unlock(g)).setLabel('فتح').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(buttonIds.lock(g)).setLabel('قفل').setStyle(ButtonStyle.Secondary),
      ),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(buttonIds.unban(g)).setLabel('إلغاء الحظر').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(buttonIds.ban(g)).setLabel('حظر').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(buttonIds.kick(g)).setLabel('طرد').setStyle(ButtonStyle.Secondary),
      ),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(buttonIds.limit(g)).setLabel('الحد').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(buttonIds.rename(g)).setLabel('الإسم').setStyle(ButtonStyle.Secondary),
      ),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(buttonIds.unallow(g)).setLabel('إلغاء السماح').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(buttonIds.allow(g)).setLabel('سماح').setStyle(ButtonStyle.Secondary),
      ),
    ];

    return {
      content: '',
      embeds: [],
      files: [attachment],
      attachments: [],
      components: rows,
    };
  }

  private missingSetupPermissions(guild: Guild): string[] {
    const me = guild.members.me;
    if (!me) return ['BotMember'];
    const required: [bigint, string][] = [
      [PermissionFlagsBits.ManageChannels, 'Manage Channels'],
      [PermissionFlagsBits.MoveMembers, 'Move Members'],
      [PermissionFlagsBits.ViewChannel, 'View Channel'],
      [PermissionFlagsBits.Connect, 'Connect'],
      [PermissionFlagsBits.SendMessages, 'Send Messages'],
      [PermissionFlagsBits.EmbedLinks, 'Embed Links'],
      [PermissionFlagsBits.ReadMessageHistory, 'Read Message History'],
    ];
    return required.filter(([perm]) => !me.permissions.has(perm)).map(([, label]) => label);
  }

  public async handleSetupCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.inCachedGuild()) {
      await this.reply(interaction, 'هذا الأمر يعمل داخل السيرفر فقط.');
      return;
    }

    const member = interaction.member as GuildMember;
    if (!member.permissions.has(PermissionFlagsBits.Administrator) && !member.permissions.has(PermissionFlagsBits.ManageChannels)) {
      await this.reply(interaction, 'ما عندك صلاحية إعداد الرومات المؤقتة.');
      return;
    }

    const currentConfig = this.getConfig(interaction.guildId);
    if (!currentConfig.features.tempRoomsPanel) {
      await this.reply(interaction, 'نظام الرومات المؤقتة غير مفعل في هذا السيرفر.');
      return;
    }

    const missing = this.missingSetupPermissions(interaction.guild);
    if (missing.length > 0) {
      await this.reply(interaction, `ما أقدر أجهز الرومات المؤقتة لأن البوت ناقصه صلاحية ${missing.join(', ')}.\nالحل:\n1. افتح إعدادات السيرفر.\n2. ارفع رتبة البوت فوق الرتب المطلوبة.\n3. فعّل Manage Channels و Move Members.\n4. أعد تشغيل أمر /setup-room.`);
      return;
    }

    if (!(await this.defer(interaction))) return;

    const guild = interaction.guild;
    const categoryName = sanitizeChannelName(interaction.options.getString('category') || DEFAULT_CATEGORY_NAME);
    const joinName = sanitizeChannelName(interaction.options.getString('trigger-name') || DEFAULT_JOIN_NAME);
    const controlName = sanitizeChannelName(interaction.options.getString('control-name') || DEFAULT_CONTROL_NAME);
    const roomTemplate = sanitizeChannelName(interaction.options.getString('room-template') || DEFAULT_ROOM_TEMPLATE) || DEFAULT_ROOM_TEMPLATE;
    const defaultUserLimit = interaction.options.getInteger('user-limit') ?? 0;
    const adminBypass = interaction.options.getBoolean('admin-bypass') ?? false;

    try {
      let config = this.getConfig(guild.id);
      let category = config.tempRooms.categoryId ? await guild.channels.fetch(config.tempRooms.categoryId).catch(() => null) : null;
      if (!category || category.type !== ChannelType.GuildCategory) {
        category = await guild.channels.create({ name: categoryName, type: ChannelType.GuildCategory, reason: 'Temporary rooms setup' });
      } else if (category.name !== categoryName) {
        await category.setName(categoryName, 'Temporary rooms setup update').catch(() => null);
      }

      let join = config.tempRooms.joinChannelId ? await guild.channels.fetch(config.tempRooms.joinChannelId).catch(() => null) : null;
      if (!join || join.type !== ChannelType.GuildVoice) {
        join = await guild.channels.create({ name: joinName, type: ChannelType.GuildVoice, parent: category.id, reason: 'Temporary rooms join-to-create channel' });
      } else {
        await join.setParent(category.id, { lockPermissions: false }).catch(() => null);
        if (join.name !== joinName) await join.setName(joinName, 'Temporary rooms setup update').catch(() => null);
      }

      let control = config.tempRooms.controlChannelId ? await guild.channels.fetch(config.tempRooms.controlChannelId).catch(() => null) : null;
      if (!control || control.type !== ChannelType.GuildText) {
        control = await guild.channels.create({ name: controlName, type: ChannelType.GuildText, parent: category.id, reason: 'Temporary rooms control panel' });
      } else {
        await control.setParent(category.id, { lockPermissions: false }).catch(() => null);
        if (control.name !== controlName) await control.setName(controlName, 'Temporary rooms setup update').catch(() => null);
      }

      config = this.saveTempRooms(guild.id, (tempRooms) => ({
        ...tempRooms,
        enabled: true,
        categoryId: category.id,
        joinChannelId: join.id,
        controlChannelId: control.id,
        defaultRoomName: roomTemplate,
        defaultUserLimit,
        adminBypass,
        panelImageUrl: tempRooms.panelImageUrl || PANEL_IMAGE,
      }));

      const payload = await this.buildPanelPayload(config);
      const textControl = control;
      let message = config.tempRooms.controlMessageId
        ? await textControl.messages.fetch(config.tempRooms.controlMessageId).catch(() => null)
        : null;
      if (message) {
        message = await message.edit(payload);
      } else {
        message = await textControl.send(payload);
      }

      this.saveTempRooms(guild.id, (tempRooms) => ({ ...tempRooms, controlMessageId: message!.id }));
      await this.reply(interaction, `تم إعداد الرومات المؤقتة بنجاح ✅\nالروم: <#${join.id}>\nلوحة التحكم: <#${control.id}>`);
    } catch (error) {
      logger.error('[tempRooms] setup failed', error instanceof Error ? error.stack ?? error.message : error);
      await this.reply(interaction, 'تعذر إعداد الرومات المؤقتة. تأكد من صلاحيات البوت وحاول مرة أخرى.');
    }
  }

  public async recoverAll(client: Client): Promise<void> {
    for (const config of this.configStore.all()) {
      if (!config.tempRooms?.enabled) continue;
      const guild = await client.guilds.fetch(config.guild.id).catch(() => null);
      if (!guild) continue;
      await this.recoverGuild(guild).catch((error) => logger.warn('[tempRooms] recovery failed', error instanceof Error ? error.message : error));
    }
  }

  private async recoverGuild(guild: Guild): Promise<void> {
    let config = this.getConfig(guild.id);
    const tempRooms = defaultTempRooms(config);
    if (!tempRooms.enabled) return;

    const category = tempRooms.categoryId ? await guild.channels.fetch(tempRooms.categoryId).catch(() => null) : null;
    const join = tempRooms.joinChannelId ? await guild.channels.fetch(tempRooms.joinChannelId).catch(() => null) : null;
    const control = tempRooms.controlChannelId ? await guild.channels.fetch(tempRooms.controlChannelId).catch(() => null) : null;
    if (!category || !join || !control || control.type !== ChannelType.GuildText) return;

    let message = tempRooms.controlMessageId ? await control.messages.fetch(tempRooms.controlMessageId).catch(() => null) : null;
    if (!message) {
      message = await control.send(await this.buildPanelPayload(config));
      config = this.saveTempRooms(guild.id, (rooms) => ({ ...rooms, controlMessageId: message!.id }));
    }

    for (const [channelId, state] of Object.entries(config.tempRooms.rooms)) {
      const channel = await guild.channels.fetch(channelId).catch(() => null);
      if (!channel || channel.type !== ChannelType.GuildVoice) {
        this.removeRoom(guild.id, channelId);
        continue;
      }
      await this.cleanupOrTransfer(guild, channel, state);
    }
  }

  public async handleVoiceStateUpdate(oldState: VoiceState, newState: VoiceState): Promise<void> {
    const guild = newState.guild ?? oldState.guild;
    const config = this.configStore.getOrNull(guild.id) ?? this.getConfig(guild.id);
    if (!config.tempRooms?.enabled) return;

    const member = newState.member ?? oldState.member;
    if (member?.user.bot) return;

    if (newState.channelId === config.tempRooms.joinChannelId && member) {
      await this.handleJoinToCreate(newState, member);
      return;
    }

    if (newState.channelId && config.tempRooms.rooms[newState.channelId] && member) {
      const state = config.tempRooms.rooms[newState.channelId];
      if (state.bannedUserIds.includes(member.id)) {
        await member.voice.disconnect('Banned from temporary room').catch(() => null);
      }
    }

    if (oldState.channelId && oldState.channelId !== newState.channelId && config.tempRooms.rooms[oldState.channelId]) {
      const channel = await guild.channels.fetch(oldState.channelId).catch(() => null);
      if (channel?.type === ChannelType.GuildVoice) {
        await this.cleanupOrTransfer(guild, channel, config.tempRooms.rooms[oldState.channelId]);
      } else {
        this.removeRoom(guild.id, oldState.channelId);
      }
    }
  }

  private async handleJoinToCreate(state: VoiceState, member: GuildMember): Promise<void> {
    const guild = state.guild;
    const lockKey = `${guild.id}:${member.id}`;
    if (this.creationLocks.has(lockKey)) return;
    this.creationLocks.add(lockKey);

    try {
      let config = this.getConfig(guild.id);
      const existing = this.findRoomByOwner(config, member.id);
      if (existing) {
        const channel = await guild.channels.fetch(existing[0]).catch(() => null);
        if (channel?.type === ChannelType.GuildVoice) {
          await member.voice.setChannel(channel, 'Move to existing temporary room').catch(() => null);
          return;
        }
        this.removeRoom(guild.id, existing[0]);
        config = this.getConfig(guild.id);
      }

      if (Object.keys(config.tempRooms.rooms).length >= config.tempRooms.maxRooms) {
        await member.voice.disconnect('Temporary rooms limit reached').catch(() => null);
        return;
      }

      const parent = config.tempRooms.categoryId || undefined;
      const name = applyRoomTemplate(config.tempRooms.defaultRoomName, member);
      const created = await guild.channels.create({
        name,
        type: ChannelType.GuildVoice,
        parent,
        userLimit: config.tempRooms.defaultUserLimit,
        permissionOverwrites: [
          { id: member.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak] },
        ],
        reason: `Temporary room for ${member.user.tag}`,
      });

      const roomState = tempRoomState(member.id, config.tempRooms.defaultUserLimit);
      roomState.systemManagedOverwrites[member.id] = ['ViewChannel', 'Connect', 'Speak'];
      this.setRoom(guild.id, created.id, roomState);

      if (member.voice.channelId === config.tempRooms.joinChannelId) {
        await member.voice.setChannel(created, 'Move to newly-created temporary room').catch(async () => {
          if (created.members.size === 0) {
            await created.delete('Temporary room owner disconnected during creation').catch(() => null);
            this.removeRoom(guild.id, created.id);
          }
        });
      } else if (created.members.size === 0) {
        await created.delete('Temporary room owner disconnected during creation').catch(() => null);
        this.removeRoom(guild.id, created.id);
      }
    } catch (error) {
      logger.warn('[tempRooms] create room failed', error instanceof Error ? error.message : error);
    } finally {
      this.creationLocks.delete(lockKey);
    }
  }

  private async cleanupOrTransfer(guild: Guild, channel: VoiceBasedChannel, state: TempRoomState): Promise<void> {
    const config = this.getConfig(guild.id);
    if (!config.tempRooms.rooms[channel.id]) return;
    if (config.tempRooms.categoryId && channel.parentId !== config.tempRooms.categoryId) return;

    const humans = channel.members.filter((m) => !m.user.bot);
    if (humans.size === 0) {
      if (config.tempRooms.deleteWhenEmpty) {
        await channel.delete('Temporary room empty').catch((error) => {
          if (!isDiscordNotFound(error)) logger.warn('[tempRooms] failed to delete empty room', error instanceof Error ? error.message : error);
        });
      }
      this.removeRoom(guild.id, channel.id);
      return;
    }

    if (!humans.has(state.ownerId) && config.tempRooms.transferOwnershipOnOwnerLeave) {
      const nextOwner = humans.first();
      if (!nextOwner) return;
      const updated = { ...state, ownerId: nextOwner.id };
      updated.systemManagedOverwrites[nextOwner.id] = uniq([...(updated.systemManagedOverwrites[nextOwner.id] ?? []), 'ViewChannel', 'Connect', 'Speak']);
      await channel.permissionOverwrites.edit(nextOwner.id, {
        ViewChannel: true,
        Connect: true,
        Speak: true,
      }).catch(() => null);
      this.setRoom(guild.id, channel.id, updated);
    }
  }

  public async handleButton(interaction: ButtonInteraction): Promise<void> {
    if (!interaction.inCachedGuild()) return;
    const guildId = interaction.guildId;
    const action = interaction.customId.split(':')[1];
    const targetGuildId = interaction.customId.split(':')[2];
    if (targetGuildId !== guildId) {
      await this.reply(interaction, 'هذا الزر لا يخص هذا السيرفر.');
      return;
    }
    if (!this.cooldown(guildId, interaction.user.id, action)) {
      await this.reply(interaction, 'انتظر قليلًا قبل استخدام الأزرار مرة ثانية.');
      return;
    }

    const member = interaction.member as GuildMember;
    const ctx = await this.resolveOwnedRoom(interaction.guild, member);
    if (!ctx) {
      await this.reply(interaction, 'ما عندك روم مؤقت حاليًا. ادخل روم الإنشاء أولًا.');
      return;
    }

    switch (action) {
      case 'l':
        await ctx.channel.permissionOverwrites.edit(interaction.guild.roles.everyone.id, { Connect: false });
        ctx.state.locked = true;
        this.setRoom(guildId, ctx.channelId, ctx.state);
        await this.reply(interaction, 'تم قفل رومك.');
        return;
      case 'u':
        await ctx.channel.permissionOverwrites.edit(interaction.guild.roles.everyone.id, { Connect: null });
        ctx.state.locked = false;
        this.setRoom(guildId, ctx.channelId, ctx.state);
        await this.reply(interaction, 'تم فتح رومك.');
        return;
      case 's':
        await ctx.channel.permissionOverwrites.edit(interaction.guild.roles.everyone.id, { ViewChannel: null, Connect: ctx.state.locked ? false : null });
        ctx.state.hidden = false;
        this.setRoom(guildId, ctx.channelId, ctx.state);
        await this.reply(interaction, 'تم إظهار رومك.');
        return;
      case 'h':
        await ctx.channel.permissionOverwrites.edit(interaction.guild.roles.everyone.id, { ViewChannel: false, Connect: false });
        ctx.state.hidden = true;
        this.setRoom(guildId, ctx.channelId, ctx.state);
        await this.reply(interaction, 'تم إخفاء رومك.');
        return;
      case 'k':
        await this.openKickSelect(interaction, ctx.channel);
        return;
      case 'b':
        await this.openUserSelect(interaction, selectIds.ban(guildId, ctx.state.ownerId), 'اختر العضو المراد حظره من رومك');
        return;
      case 'ub':
        await this.openListSelect(interaction, selectIds.unban(guildId, ctx.state.ownerId), ctx.state.bannedUserIds, 'لا يوجد أعضاء محظورين.', 'اختر العضو لإلغاء حظره');
        return;
      case 'r':
        if (!this.cooldown(guildId, interaction.user.id, 'rename-heavy', RENAME_COOLDOWN_MS)) {
          await this.reply(interaction, 'تقدر تغيّر الاسم مرة كل 10 ثواني فقط.');
          return;
        }
        await this.openRenameModal(interaction);
        return;
      case 'lm':
        if (!this.cooldown(guildId, interaction.user.id, 'limit-heavy', LIMIT_COOLDOWN_MS)) {
          await this.reply(interaction, 'انتظر قليلًا قبل تغيير الحد مرة ثانية.');
          return;
        }
        await this.openLimitModal(interaction);
        return;
      case 'a':
        await this.openUserSelect(interaction, selectIds.allow(guildId, ctx.state.ownerId), 'اختر العضو المسموح له بالدخول');
        return;
      case 'ua':
        await this.openListSelect(interaction, selectIds.unallow(guildId, ctx.state.ownerId), ctx.state.allowedUserIds, 'لا يوجد أعضاء مسموح لهم.', 'اختر العضو لإلغاء السماح');
        return;
      default:
        await this.reply(interaction, 'زر غير معروف.');
    }
  }

  private async openKickSelect(interaction: ButtonInteraction, channel: VoiceChannel): Promise<void> {
    const options = channel.members
      .filter((member) => !member.user.bot && member.id !== interaction.user.id)
      .first(25)
      .map((member) => new StringSelectMenuOptionBuilder().setLabel(member.displayName.slice(0, 100)).setValue(member.id));

    if (options.length === 0) {
      await this.reply(interaction, 'لا يوجد أعضاء يمكن طردهم داخل رومك.');
      return;
    }

    const menu = new StringSelectMenuBuilder()
      .setCustomId(selectIds.kick(interaction.guildId!, interaction.user.id))
      .setPlaceholder('اختر عضو لطرده من رومك')
      .addOptions(options);
    await interaction.reply({ content: 'اختر العضو:', components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)], flags: MessageFlags.Ephemeral });
  }

  private async openUserSelect(interaction: ButtonInteraction, customId: string, placeholder: string): Promise<void> {
    const menu = new UserSelectMenuBuilder().setCustomId(customId).setPlaceholder(placeholder).setMinValues(1).setMaxValues(1);
    await interaction.reply({ content: 'اختر العضو:', components: [new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(menu)], flags: MessageFlags.Ephemeral });
  }

  private async openListSelect(interaction: ButtonInteraction, customId: string, userIds: string[], emptyMessage: string, placeholder: string): Promise<void> {
    const ids = uniq(userIds).slice(0, 25);
    if (ids.length === 0) {
      await this.reply(interaction, emptyMessage);
      return;
    }
    const options = ids.map((id) => new StringSelectMenuOptionBuilder().setLabel(id).setDescription(`User ID: ${id}`).setValue(id));
    const menu = new StringSelectMenuBuilder().setCustomId(customId).setPlaceholder(placeholder).addOptions(options);
    await interaction.reply({ content: 'اختر العضو:', components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)], flags: MessageFlags.Ephemeral });
  }

  private async openRenameModal(interaction: ButtonInteraction): Promise<void> {
    const modal = new ModalBuilder().setCustomId(modalIds.rename(interaction.guildId!)).setTitle('تغيير اسم الروم');
    const input = new TextInputBuilder()
      .setCustomId('name')
      .setLabel('اسم الروم الجديد')
      .setStyle(TextInputStyle.Short)
      .setMinLength(1)
      .setMaxLength(100)
      .setRequired(true);
    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
    await interaction.showModal(modal);
  }

  private async openLimitModal(interaction: ButtonInteraction): Promise<void> {
    const modal = new ModalBuilder().setCustomId(modalIds.limit(interaction.guildId!)).setTitle('تغيير حد الروم');
    const input = new TextInputBuilder()
      .setCustomId('limit')
      .setLabel('0 = بدون حد، أو رقم من 1 إلى 99')
      .setStyle(TextInputStyle.Short)
      .setMinLength(1)
      .setMaxLength(2)
      .setRequired(true);
    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
    await interaction.showModal(modal);
  }

  public async handleSelect(interaction: StringSelectMenuInteraction | UserSelectMenuInteraction): Promise<void> {
    if (!interaction.inCachedGuild()) return;
    const [prefix, action, guildId, ownerId] = interaction.customId.split(':');
    if (prefix !== 'tvs' || guildId !== interaction.guildId || ownerId !== interaction.user.id) {
      await this.reply(interaction, 'هذه القائمة لا تخصك.');
      return;
    }
    if (!(await this.defer(interaction))) return;

    const member = interaction.member as GuildMember;
    const ctx = await this.resolveOwnedRoom(interaction.guild, member);
    if (!ctx) {
      await this.reply(interaction, 'ما عندك روم مؤقت حاليًا. ادخل روم الإنشاء أولًا.');
      return;
    }

    const selectedId = interaction.values[0];
    if (!selectedId) {
      await this.reply(interaction, 'لم يتم اختيار عضو.');
      return;
    }

    switch (action) {
      case 'k':
        await this.kickMember(interaction, ctx.channel, selectedId);
        return;
      case 'b':
        await this.banMember(interaction, ctx.channel, ctx.state, selectedId);
        return;
      case 'ub':
        await this.unbanMember(interaction, ctx.channel, ctx.state, selectedId);
        return;
      case 'a':
        await this.allowMember(interaction, ctx.channel, ctx.state, selectedId);
        return;
      case 'ua':
        await this.unallowMember(interaction, ctx.channel, ctx.state, selectedId);
        return;
      default:
        await this.reply(interaction, 'قائمة غير معروفة.');
    }
  }

  private async kickMember(interaction: StringSelectMenuInteraction | UserSelectMenuInteraction, channel: VoiceChannel, userId: string): Promise<void> {
    if (userId === interaction.user.id) {
      await this.reply(interaction, 'ما تقدر تطرد نفسك من رومك.');
      return;
    }
    const target = channel.members.get(userId);
    if (!target) {
      await this.reply(interaction, 'العضو المحدد غير موجود داخل رومك.');
      return;
    }
    await target.voice.disconnect('Kicked from temporary room').catch(async () => {
      await this.reply(interaction, 'ما قدرت أطرد العضو بسبب الصلاحيات أو ترتيب الرتب.');
    });
    await this.reply(interaction, 'تم طرد العضو من رومك.');
  }

  private async banMember(interaction: StringSelectMenuInteraction | UserSelectMenuInteraction, channel: VoiceChannel, state: TempRoomState, userId: string): Promise<void> {
    if (userId === state.ownerId) {
      await this.reply(interaction, 'ما تقدر تحظر مالك الروم.');
      return;
    }
    state.bannedUserIds = uniq([...state.bannedUserIds, userId]);
    state.allowedUserIds = state.allowedUserIds.filter((id) => id !== userId);
    state.systemManagedOverwrites[userId] = uniq([...(state.systemManagedOverwrites[userId] ?? []), 'ViewChannel', 'Connect']);
    await channel.permissionOverwrites.edit(userId, { ViewChannel: false, Connect: false, Speak: null });
    const target = channel.members.get(userId);
    if (target) await target.voice.disconnect('Banned from temporary room').catch(() => null);
    this.setRoom(interaction.guildId!, channel.id, state);
    await this.reply(interaction, 'تم حظر العضو من رومك.');
  }

  private async unbanMember(interaction: StringSelectMenuInteraction | UserSelectMenuInteraction, channel: VoiceChannel, state: TempRoomState, userId: string): Promise<void> {
    state.bannedUserIds = state.bannedUserIds.filter((id) => id !== userId);
    if (state.allowedUserIds.includes(userId)) {
      await channel.permissionOverwrites.edit(userId, { ViewChannel: true, Connect: true, Speak: true });
    } else {
      await channel.permissionOverwrites.edit(userId, { ViewChannel: null, Connect: null });
    }
    state.systemManagedOverwrites[userId] = (state.systemManagedOverwrites[userId] ?? []).filter((p) => !['ViewChannel', 'Connect'].includes(p));
    if (state.systemManagedOverwrites[userId]?.length === 0) delete state.systemManagedOverwrites[userId];
    this.setRoom(interaction.guildId!, channel.id, state);
    await this.reply(interaction, 'تم إلغاء الحظر عن العضو.');
  }

  private async allowMember(interaction: StringSelectMenuInteraction | UserSelectMenuInteraction, channel: VoiceChannel, state: TempRoomState, userId: string): Promise<void> {
    if (state.bannedUserIds.includes(userId)) {
      await this.reply(interaction, 'العضو محظور من الروم. فك الحظر عنه أولًا ثم اسمح له.');
      return;
    }
    state.allowedUserIds = uniq([...state.allowedUserIds, userId]);
    state.systemManagedOverwrites[userId] = uniq([...(state.systemManagedOverwrites[userId] ?? []), 'ViewChannel', 'Connect', 'Speak']);
    await channel.permissionOverwrites.edit(userId, { ViewChannel: true, Connect: true, Speak: true });
    this.setRoom(interaction.guildId!, channel.id, state);
    await this.reply(interaction, 'تم السماح للعضو بالدخول.');
  }

  private async unallowMember(interaction: StringSelectMenuInteraction | UserSelectMenuInteraction, channel: VoiceChannel, state: TempRoomState, userId: string): Promise<void> {
    state.allowedUserIds = state.allowedUserIds.filter((id) => id !== userId);
    if (!state.bannedUserIds.includes(userId)) {
      await channel.permissionOverwrites.edit(userId, { ViewChannel: null, Connect: null, Speak: null });
    }
    state.systemManagedOverwrites[userId] = (state.systemManagedOverwrites[userId] ?? []).filter((p) => !['ViewChannel', 'Connect', 'Speak'].includes(p));
    if (state.systemManagedOverwrites[userId]?.length === 0) delete state.systemManagedOverwrites[userId];
    this.setRoom(interaction.guildId!, channel.id, state);
    await this.reply(interaction, 'تم إلغاء السماح.');
  }

  public async handleModal(interaction: ModalSubmitInteraction): Promise<void> {
    if (!interaction.inCachedGuild()) return;
    const [prefix, action, guildId] = interaction.customId.split(':');
    if (prefix !== 'tvm' || guildId !== interaction.guildId) {
      await this.reply(interaction, 'هذا النموذج لا يخص هذا السيرفر.');
      return;
    }
    if (!(await this.defer(interaction))) return;

    const member = interaction.member as GuildMember;
    const ctx = await this.resolveOwnedRoom(interaction.guild, member);
    if (!ctx) {
      await this.reply(interaction, 'ما عندك روم مؤقت حاليًا. ادخل روم الإنشاء أولًا.');
      return;
    }

    if (action === 'r') {
      const name = sanitizeChannelName(interaction.fields.getTextInputValue('name'));
      if (!name) {
        await this.reply(interaction, 'اسم الروم غير صالح.');
        return;
      }
      await ctx.channel.setName(name, 'Temporary room rename');
      await this.reply(interaction, 'تم تغيير اسم الروم.');
      return;
    }

    if (action === 'l') {
      const raw = interaction.fields.getTextInputValue('limit').trim();
      if (!/^\d{1,2}$/.test(raw)) {
        await this.reply(interaction, 'حد الروم لازم يكون رقم صحيح من 0 إلى 99.');
        return;
      }
      const limit = Number(raw);
      if (!Number.isInteger(limit) || limit < 0 || limit > 99) {
        await this.reply(interaction, 'حد الروم لازم يكون من 0 إلى 99.');
        return;
      }
      await ctx.channel.setUserLimit(limit, 'Temporary room limit change');
      ctx.state.userLimit = limit;
      this.setRoom(interaction.guildId, ctx.channelId, ctx.state);
      await this.reply(interaction, 'تم تغيير حد الروم.');
    }
  }
}
