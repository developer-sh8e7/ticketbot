import {
  ActionRowBuilder,
  EmbedBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  type APIInteractionDataResolvedChannel,
  type Guild,
} from 'discord.js';
import type { AppConfig } from '../types/config.js';
import { hexToDecimal } from '../utils/color.js';
import { componentEmojiFromId } from '../utils/emoji.js';

export async function buildPanelEmbeds(config: AppConfig, guild: Guild): Promise<EmbedBuilder[]> {
  const introEmbed = new EmbedBuilder()
    .setColor(hexToDecimal(config.bot.embedColor));

  if (config.images.panelBannerUrl) introEmbed.setImage(config.images.panelBannerUrl);

  return [introEmbed];
}

export function buildPanelComponents(config: AppConfig): ActionRowBuilder<StringSelectMenuBuilder>[] {
  const enabledCategories = config.categories.filter((category) => category.enabled);

  const menu = new StringSelectMenuBuilder()
    .setCustomId(config.panel.menuCustomId)
    .setPlaceholder(config.panel.menuPlaceholder)
    .addOptions(
      enabledCategories.map((category) => {
        const option = new StringSelectMenuOptionBuilder()
          .setLabel(category.label)
          .setDescription(category.description.slice(0, 100))
          .setValue(category.key);

        const emoji = componentEmojiFromId(config.emojis.categories[category.key]);
        if (emoji) {
          option.setEmoji(emoji);
        }

        return option;
      }),
    );

  return [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)];
}

export interface ResolvedPanelChannel {
  id: string;
  name: string;
  type: number;
}

export function isResolvedPanelChannel(
  channel: APIInteractionDataResolvedChannel | ResolvedPanelChannel | null | undefined,
): channel is ResolvedPanelChannel {
  return Boolean(channel && typeof channel.id === 'string' && typeof channel.name === 'string');
}
