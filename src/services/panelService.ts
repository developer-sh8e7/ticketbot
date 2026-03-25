import type { Guild, Message } from 'discord.js';
import { buildPanelComponents, buildPanelEmbeds } from '../builders/panelBuilder.js';
import { isGuildTextChannelType } from '../utils/discord.js';
import { ConfigStore } from './configStore.js';

export class PanelService {
  public constructor(private readonly configStore: ConfigStore) {}

  private async resolvePanelChannel(guild: Guild) {
    const channelId = this.configStore.current.panel.channelId;

    if (!channelId) {
      throw new Error('Panel channel ID is not configured. Run infrastructure setup first.');
    }

    const channel = await guild.channels.fetch(channelId).catch(() => null);

    if (!isGuildTextChannelType(channel)) {
      throw new Error(`Configured panel channel (${channelId}) is not a text channel or does not exist.`);
    }

    return channel;
  }

  private async buildPayload(guild: Guild) {
    const config = this.configStore.current;

    return {
      content: config.panel.defaultMention.trim() || undefined,
      embeds: await buildPanelEmbeds(config, guild),
      components: buildPanelComponents(config),
      allowedMentions: {
        parse: ['everyone', 'roles', 'users'] as const,
      },
    };
  }

  public async sendPanel(guild: Guild): Promise<Message> {
    const channel = await this.resolvePanelChannel(guild);
    const payload = await this.buildPayload(guild);
    return channel.send(payload);
  }

  public async refreshPanel(guild: Guild, messageId?: string): Promise<Message> {
    const channel = await this.resolvePanelChannel(guild);
    const targetMessageId = messageId || this.configStore.current.panel.messageId;

    if (!targetMessageId) {
      return this.sendPanel(guild);
    }

    try {
      const message = await channel.messages.fetch(targetMessageId);
      return message.edit(await this.buildPayload(guild));
    } catch {
      return this.sendPanel(guild);
    }
  }
}
