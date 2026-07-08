import { PermissionsBitField, type Guild, type Message } from 'discord.js';
import { buildPanelComponents, buildPanelFiles } from '../builders/panelBuilder.js';
import { isGuildTextChannelType } from '../utils/discord.js';
import { ConfigStore } from './configStore.js';
import type { MediatorRepository } from '../database/mediatorRepository.js';

export class PanelService {
  public constructor(
    private readonly configStore: ConfigStore,
    private readonly mediatorRepository: MediatorRepository,
  ) {}

  private async resolvePanelChannel(guild: Guild, overrideChannelId?: string) {
    const config = this.configStore.get(guild.id);
    const channelId = overrideChannelId || config.panel.channelId;

    if (!channelId) {
      throw new Error('Panel channel ID is not configured. Run infrastructure setup first.');
    }

    const channel = await guild.channels.fetch(channelId).catch(() => null);

    if (!isGuildTextChannelType(channel)) {
      throw new Error(`Configured panel channel (${channelId}) is not a text channel or does not exist.`);
    }

    return channel;
  }

  private ensureCanSendPanel(channel: Awaited<ReturnType<PanelService['resolvePanelChannel']>>, hasFiles: boolean): void {
    const me = channel.guild.members.me;
    const permissions = me ? channel.permissionsFor(me) : null;
    if (!permissions) return;

    const required = [
      PermissionsBitField.Flags.ViewChannel,
      PermissionsBitField.Flags.SendMessages,
    ];
    if (hasFiles) required.push(PermissionsBitField.Flags.AttachFiles);

    const missing = permissions.missing(required);
    if (missing.length > 0) {
      throw new Error(`البوت ما عنده صلاحيات كافية في <#${channel.id}>. الصلاحيات الناقصة: ${missing.join(', ')}`);
    }
  }

  private async buildPayload(guild: Guild) {
    const config = this.configStore.get(guild.id);
    const mediatorConfig = await this.mediatorRepository.getMediatorConfig();

    const content = [config.panel.description.trim(), config.panel.defaultMention.trim()]
      .filter(Boolean)
      .join('\n\n');

    return {
      content: content || undefined,
      embeds: [],
      files: await buildPanelFiles(config),
      attachments: [],
      components: buildPanelComponents(config, mediatorConfig),
      allowedMentions: {
        parse: ['everyone', 'roles', 'users'] as const,
      },
    };
  }

  public async sendPanel(guild: Guild, channelId?: string): Promise<Message> {
    const channel = await this.resolvePanelChannel(guild, channelId);
    const payload = await this.buildPayload(guild);
    this.ensureCanSendPanel(channel, payload.files.length > 0);
    return channel.send(payload);
  }

  public async refreshPanel(guild: Guild, messageId?: string): Promise<Message> {
    const channel = await this.resolvePanelChannel(guild);
    const targetMessageId = messageId || this.configStore.get(guild.id).panel.messageId;

    if (!targetMessageId) {
      return this.sendPanel(guild);
    }

    try {
      const payload = await this.buildPayload(guild);
      this.ensureCanSendPanel(channel, payload.files.length > 0);
      const message = await channel.messages.fetch(targetMessageId);
      return message.edit(payload);
    } catch {
      return this.sendPanel(guild);
    }
  }
}
