import {
  AuditLogEvent,
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  type Client,
  type Guild,
  type TextChannel,
} from 'discord.js';
import { logger } from '../utils/logger.js';

type LogChannelKey = 'security' | 'roles' | 'channels' | 'permissions';

const LOG_CATEGORY_NAME = 'bot-logs';
const LOG_CHANNEL_NAMES: Record<LogChannelKey, string> = {
  security: 'security-logs',
  roles: 'role-logs',
  channels: 'channel-logs',
  permissions: 'permission-logs',
};

export class ServerLogService {
  private channelIds = new Map<LogChannelKey, string>();

  public constructor(private readonly client: Client, private readonly guildId: string) {}

  public async ensure(): Promise<void> {
    const guild = await this.client.guilds.fetch(this.guildId).catch(() => null);
    if (!guild) return;

    const category = await this.resolveCategory(guild);
    for (const [key, name] of Object.entries(LOG_CHANNEL_NAMES) as [LogChannelKey, string][]) {
      const channel = await this.resolveTextChannel(guild, name, category.id);
      this.channelIds.set(key, channel.id);
    }
  }

  public async send(key: LogChannelKey, title: string, description: string, fields: { name: string; value: string; inline?: boolean }[] = []): Promise<void> {
    const channelId = this.channelIds.get(key);
    if (!channelId) return;

    const guild = await this.client.guilds.fetch(this.guildId).catch(() => null);
    const channel = guild ? await guild.channels.fetch(channelId).catch(() => null) : null;
    if (!channel || channel.type !== ChannelType.GuildText) return;

    const embed = new EmbedBuilder()
      .setColor(0x8b5cf6)
      .setTitle(title)
      .setDescription(description)
      .addFields(fields)
      .setTimestamp();

    await channel.send({ embeds: [embed] }).catch((error) => {
      logger.warn('Failed to send server log', error instanceof Error ? error.message : error);
    });
  }

  public async fetchExecutor(guild: Guild, type: AuditLogEvent, targetId?: string): Promise<string> {
    const logs = await guild.fetchAuditLogs({ type, limit: 5 }).catch(() => null);
    const entry = logs?.entries.find((item) => {
      const recent = Date.now() - item.createdTimestamp < 10_000;
      const sameTarget = targetId ? item.targetId === targetId : true;
      return recent && sameTarget;
    });

    return entry?.executor ? `${entry.executor.tag} (${entry.executor.id})` : 'غير معروف';
  }

  private async resolveCategory(guild: Guild) {
    const existing = guild.channels.cache.find((channel) => channel.type === ChannelType.GuildCategory && channel.name === LOG_CATEGORY_NAME);
    if (existing && existing.type === ChannelType.GuildCategory) {
      return existing;
    }

    return guild.channels.create({
      name: LOG_CATEGORY_NAME,
      type: ChannelType.GuildCategory,
      permissionOverwrites: [
        {
          id: guild.roles.everyone.id,
          deny: [PermissionFlagsBits.ViewChannel],
        },
      ],
    });
  }

  private async resolveTextChannel(guild: Guild, name: string, parentId: string): Promise<TextChannel> {
    const existing = guild.channels.cache.find((channel) => channel.type === ChannelType.GuildText && channel.name === name);
    if (existing && existing.type === ChannelType.GuildText) {
      return existing;
    }

    return guild.channels.create({
      name,
      type: ChannelType.GuildText,
      parent: parentId,
      permissionOverwrites: [
        {
          id: guild.roles.everyone.id,
          deny: [PermissionFlagsBits.ViewChannel],
        },
      ],
    });
  }
}
