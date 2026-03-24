import {
  ChannelType,
  OverwriteType,
  PermissionFlagsBits,
  type CategoryChannel,
  type Client,
  type Guild,
  type TextChannel,
} from 'discord.js';
import { InfrastructureRepository, type InfrastructureRecord } from '../database/infrastructureRepository.js';
import type { AppConfig } from '../types/config.js';
import { ConfigStore } from './configStore.js';
import { logger } from '../utils/logger.js';

interface InfrastructureServiceDependencies {
  configStore: ConfigStore;
  infrastructureRepository: InfrastructureRepository;
}

interface ResolvedInfrastructure {
  ticketCategoryId: string;
  archiveCategoryId: string;
  logChannelId: string;
  transcriptChannelId: string;
  panelChannelId: string;
}

export class InfrastructureService {
  private readonly configStore: ConfigStore;
  private readonly infrastructureRepository: InfrastructureRepository;

  public constructor(deps: InfrastructureServiceDependencies) {
    this.configStore = deps.configStore;
    this.infrastructureRepository = deps.infrastructureRepository;
  }

  private get config(): AppConfig {
    return this.configStore.current;
  }

  public async ensureInfrastructure(client: Client): Promise<void> {
    const guildId = this.config.guild.id;
    const guild = await client.guilds.fetch(guildId).catch(() => null);

    if (!guild) {
      logger.error(`Could not fetch guild ${guildId}. Infrastructure setup skipped.`);
      return;
    }

    logger.info(`Ensuring infrastructure for guild: ${guild.name} (${guild.id})`);

    const existing = await this.infrastructureRepository.findByGuildId(guildId).catch(() => null);

    const resolved = await this.resolveOrCreate(guild, existing);

    await this.infrastructureRepository.upsert({
      guild_id: guildId,
      ticket_category_id: resolved.ticketCategoryId,
      archive_category_id: resolved.archiveCategoryId,
      log_channel_id: resolved.logChannelId,
      transcript_channel_id: resolved.transcriptChannelId,
      panel_channel_id: resolved.panelChannelId,
    });

    this.configStore.patchGuild({
      categoryId: resolved.ticketCategoryId,
      archiveCategoryId: resolved.archiveCategoryId,
      logChannelId: resolved.logChannelId,
      transcriptChannelId: resolved.transcriptChannelId,
    });

    this.configStore.patchPanel({
      channelId: resolved.panelChannelId,
    });

    logger.info('Infrastructure setup complete.');
    logger.info(`  Ticket Category : ${resolved.ticketCategoryId}`);
    logger.info(`  Archive Category: ${resolved.archiveCategoryId}`);
    logger.info(`  Log Channel     : ${resolved.logChannelId}`);
    logger.info(`  Transcript Ch.  : ${resolved.transcriptChannelId}`);
    logger.info(`  Panel Channel   : ${resolved.panelChannelId}`);
  }

  private async resolveOrCreate(
    guild: Guild,
    existing: InfrastructureRecord | null,
  ): Promise<ResolvedInfrastructure> {
    const ticketCategoryId = await this.resolveCategory(
      guild,
      'ticketCategoryId',
      existing?.ticket_category_id,
      '📩 التذاكر المفتوحة',
      0,
    );

    const archiveCategoryId = await this.resolveCategory(
      guild,
      'archiveCategoryId',
      existing?.archive_category_id,
      '📁 الأرشيف',
      1,
    );

    const logChannelId = await this.resolveTextChannel(
      guild,
      'logChannelId',
      existing?.log_channel_id,
      'ticket-logs',
      ticketCategoryId,
    );

    const transcriptChannelId = await this.resolveTextChannel(
      guild,
      'transcriptChannelId',
      existing?.transcript_channel_id,
      'ticket-transcripts',
      ticketCategoryId,
    );

    const panelChannelId = await this.resolveTextChannel(
      guild,
      'panelChannelId',
      existing?.panel_channel_id,
      'open-ticket',
      null,
      true,
    );

    return {
      ticketCategoryId,
      archiveCategoryId,
      logChannelId,
      transcriptChannelId,
      panelChannelId,
    };
  }

  private async resolveCategory(
    guild: Guild,
    configKey: 'ticketCategoryId' | 'archiveCategoryId',
    dbValue: string | null | undefined,
    defaultName: string,
    position: number,
  ): Promise<string> {
    const configMapping: Record<string, string> = {
      ticketCategoryId: this.config.guild.categoryId,
      archiveCategoryId: this.config.guild.archiveCategoryId,
    };

    const configValue = configMapping[configKey];
    if (configValue) {
      const ch = await guild.channels.fetch(configValue).catch(() => null);
      if (ch && ch.type === ChannelType.GuildCategory) {
        logger.info(`Using config-provided category for ${configKey}: ${ch.name} (${ch.id})`);
        return ch.id;
      }
    }

    if (dbValue) {
      const ch = await guild.channels.fetch(dbValue).catch(() => null);
      if (ch && ch.type === ChannelType.GuildCategory) {
        logger.info(`Reusing existing category for ${configKey}: ${ch.name} (${ch.id})`);
        return ch.id;
      }
    }

    const allChannels = await guild.channels.fetch();
    const existingCat = allChannels.find(
      (c) => c !== null && c.type === ChannelType.GuildCategory && c.name === defaultName,
    );
    if (existingCat) {
      logger.info(`Found category by name for ${configKey}: ${existingCat.name} (${existingCat.id})`);
      return existingCat.id;
    }

    const created = await guild.channels.create({
      name: defaultName,
      type: ChannelType.GuildCategory,
      position,
      permissionOverwrites: [
        {
          id: guild.roles.everyone.id,
          deny: [PermissionFlagsBits.ViewChannel],
          type: OverwriteType.Role,
        },
      ],
    });

    logger.info(`Created category for ${configKey}: ${created.name} (${created.id})`);
    return created.id;
  }

  private async resolveTextChannel(
    guild: Guild,
    configKey: string,
    dbValue: string | null | undefined,
    defaultName: string,
    parentId: string | null,
    publicReadOnly: boolean = false,
  ): Promise<string> {
    const configMapping: Record<string, string> = {
      logChannelId: this.config.guild.logChannelId,
      transcriptChannelId: this.config.guild.transcriptChannelId,
      panelChannelId: this.config.panel.channelId,
    };

    const configValue = configMapping[configKey];
    if (configValue) {
      const ch = await guild.channels.fetch(configValue).catch(() => null);
      if (ch && ch.type === ChannelType.GuildText) {
        logger.info(`Using config-provided channel for ${configKey}: ${ch.name} (${ch.id})`);
        return ch.id;
      }
    }

    if (dbValue) {
      const ch = await guild.channels.fetch(dbValue).catch(() => null);
      if (ch && ch.type === ChannelType.GuildText) {
        logger.info(`Reusing existing channel for ${configKey}: ${ch.name} (${ch.id})`);
        return ch.id;
      }
    }

    const allChannels = await guild.channels.fetch();
    const existingCh = allChannels.find(
      (c) => c !== null && c.type === ChannelType.GuildText && c.name === defaultName,
    );
    if (existingCh) {
      logger.info(`Found channel by name for ${configKey}: ${existingCh.name} (${existingCh.id})`);
      return existingCh.id;
    }

    const permissionOverwrites = publicReadOnly
      ? [
          {
            id: guild.roles.everyone.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
            deny: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.AddReactions],
            type: OverwriteType.Role as const,
          },
        ]
      : [
          {
            id: guild.roles.everyone.id,
            deny: [PermissionFlagsBits.ViewChannel],
            type: OverwriteType.Role as const,
          },
        ];

    const created = await guild.channels.create({
      name: defaultName,
      type: ChannelType.GuildText,
      parent: parentId ?? undefined,
      permissionOverwrites,
    });

    logger.info(`Created channel for ${configKey}: ${created.name} (${created.id})`);
    return created.id;
  }
}
