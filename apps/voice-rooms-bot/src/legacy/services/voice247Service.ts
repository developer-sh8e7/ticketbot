import {
  ChannelType,
  MessageFlags,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  type Client,
  type Guild,
  type GuildMember,
  type VoiceChannel,
  type VoiceState,
} from 'discord.js';
import {
  entersState,
  getVoiceConnection,
  joinVoiceChannel,
  VoiceConnectionStatus,
  type DiscordGatewayAdapterCreator,
} from '@discordjs/voice';
import type { ConfigStore } from './configStore.js';
import { logger } from '../utils/logger.js';

const TARGET_GUILD_ID = '1395842846107631746';
const RECONNECT_DELAY_MS = 1500;

export class Voice247Service {
  private readonly reconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();

  public constructor(private readonly configStore: ConfigStore) {}

  private async reply(interaction: ChatInputCommandInteraction, content: string): Promise<void> {
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content }).catch(() => null);
      return;
    }
    await interaction.reply({ content, flags: MessageFlags.Ephemeral }).catch(() => null);
  }

  private canManage(member: GuildMember): boolean {
    return member.permissions.has(PermissionFlagsBits.Administrator) || member.permissions.has(PermissionFlagsBits.ManageChannels);
  }

  private missingBotPermissions(channel: VoiceChannel): string[] {
    const me = channel.guild.members.me;
    if (!me) return ['Bot member unavailable'];
    const permissions = channel.permissionsFor(me);
    if (!permissions) return ['Missing channel access'];
    const missing: string[] = [];
    if (!permissions.has(PermissionFlagsBits.ViewChannel)) missing.push('View Channel');
    if (!permissions.has(PermissionFlagsBits.Connect)) missing.push('Connect');
    return missing;
  }

  private connect(guild: Guild, channel: VoiceChannel): void {
    const existing = getVoiceConnection(guild.id);
    if (existing) existing.destroy();

    const connection = joinVoiceChannel({
      guildId: guild.id,
      channelId: channel.id,
      adapterCreator: guild.voiceAdapterCreator as DiscordGatewayAdapterCreator,
      selfDeaf: true,
      selfMute: false,
    });

    connection.on(VoiceConnectionStatus.Disconnected, () => {
      const config = this.configStore.get(guild.id);
      if (!config.voice247?.enabled || config.voice247.channelId !== channel.id) return;
      this.scheduleReconnect(guild, channel.id);
    });

    entersState(connection, VoiceConnectionStatus.Ready, 15_000).catch((error) => {
      logger.warn('[voice247] connection did not become ready', error instanceof Error ? error.message : error);
    });
  }

  private scheduleReconnect(guild: Guild, channelId: string): void {
    if (this.reconnectTimers.has(guild.id)) return;
    const timer = setTimeout(async () => {
      this.reconnectTimers.delete(guild.id);
      const config = this.configStore.get(guild.id);
      if (!config.voice247?.enabled || config.voice247.channelId !== channelId) return;
      const channel = await guild.channels.fetch(channelId).catch(() => null);
      if (channel?.type !== ChannelType.GuildVoice) return;
      const missing = this.missingBotPermissions(channel);
      if (missing.length > 0) {
        logger.warn(`[voice247] cannot reconnect, missing permissions: ${missing.join(', ')}`);
        return;
      }
      this.connect(guild, channel);
    }, RECONNECT_DELAY_MS);
    this.reconnectTimers.set(guild.id, timer);
  }

  public async handleStart(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.inCachedGuild()) {
      await this.reply(interaction, 'هذا الأمر يعمل داخل السيرفر فقط.');
      return;
    }

    if (interaction.guildId !== TARGET_GUILD_ID) {
      await this.reply(interaction, 'أمر 24/7 مفعل فقط لهذا السيرفر.');
      return;
    }

    const member = interaction.member as GuildMember;
    if (!this.canManage(member)) {
      await this.reply(interaction, 'ما عندك صلاحية استخدام هذا الأمر.');
      return;
    }

    const channel = interaction.options.getChannel('room', true);
    if (channel.type !== ChannelType.GuildVoice) {
      await this.reply(interaction, 'لازم تختار روم صوتي.');
      return;
    }

    const voiceChannel = channel as VoiceChannel;
    const missing = this.missingBotPermissions(voiceChannel);
    if (missing.length > 0) {
      await this.reply(interaction, `ما أقدر أدخل الروم لأن البوت ناقصه صلاحيات: ${missing.join(', ')}.\nفعّل View Channel و Connect ثم جرّب مرة ثانية.`);
      return;
    }

    this.configStore.update(interaction.guildId, (config) => ({
      ...config,
      voice247: { enabled: true, channelId: voiceChannel.id },
    }));

    this.connect(interaction.guild, voiceChannel);
    await this.reply(interaction, `تم تثبيت البوت 24/7 في الروم: <#${voiceChannel.id}> ✅`);
  }

  public async handleStop(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.inCachedGuild()) {
      await this.reply(interaction, 'هذا الأمر يعمل داخل السيرفر فقط.');
      return;
    }

    if (interaction.guildId !== TARGET_GUILD_ID) {
      await this.reply(interaction, 'أمر stop مفعل فقط لهذا السيرفر.');
      return;
    }

    const member = interaction.member as GuildMember;
    if (!this.canManage(member)) {
      await this.reply(interaction, 'ما عندك صلاحية استخدام هذا الأمر.');
      return;
    }

    const timer = this.reconnectTimers.get(interaction.guildId);
    if (timer) clearTimeout(timer);
    this.reconnectTimers.delete(interaction.guildId);

    this.configStore.update(interaction.guildId, (config) => ({
      ...config,
      voice247: { enabled: false, channelId: '' },
    }));

    getVoiceConnection(interaction.guildId)?.destroy();
    await this.reply(interaction, 'تم إيقاف 24/7 وخروج البوت من الروم ✅');
  }

  public async recoverAll(client: Client): Promise<void> {
    for (const config of this.configStore.all()) {
      if (!config.voice247?.enabled || !config.voice247.channelId) continue;
      if (config.guild.id !== TARGET_GUILD_ID) continue;
      const guild = await client.guilds.fetch(config.guild.id).catch(() => null);
      if (!guild) continue;
      const channel = await guild.channels.fetch(config.voice247.channelId).catch(() => null);
      if (channel?.type !== ChannelType.GuildVoice) continue;
      const missing = this.missingBotPermissions(channel);
      if (missing.length > 0) {
        logger.warn(`[voice247] recovery skipped, missing permissions: ${missing.join(', ')}`);
        continue;
      }
      this.connect(guild, channel);
      logger.info(`[voice247] recovered 24/7 connection for guild ${guild.id} channel ${channel.id}`);
    }
  }

  public async handleVoiceStateUpdate(oldState: VoiceState, newState: VoiceState): Promise<void> {
    const guild = newState.guild ?? oldState.guild;
    if (guild.id !== TARGET_GUILD_ID) return;
    const botId = guild.client.user?.id;
    if (!botId || oldState.id !== botId && newState.id !== botId) return;

    const config = this.configStore.get(guild.id);
    if (!config.voice247?.enabled || !config.voice247.channelId) return;

    const currentChannelId = newState.channelId;
    if (currentChannelId !== config.voice247.channelId) {
      this.scheduleReconnect(guild, config.voice247.channelId);
    }
  }
}
