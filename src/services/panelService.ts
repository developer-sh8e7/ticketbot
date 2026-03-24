import type { Guild, Message } from 'discord.js';
import { buildPanelComponents, buildPanelEmbeds } from '../builders/panelBuilder.js';
import { isGuildTextChannelType } from '../utils/discord.js';
import { ConfigStore } from './configStore.js';

export class PanelService {
  public constructor(private readonly configStore: ConfigStore) {}

  private async resolvePanelChannel(guild: Guild) {
    const channel = await guild.channels.fetch(this.configStore.current.panel.channelId);

    if (!isGuildTextChannelType(channel)) {
      throw new Error('Configured panel channel is not a text channel.');
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
