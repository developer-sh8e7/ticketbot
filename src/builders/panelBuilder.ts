import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  type APIInteractionDataResolvedChannel,
  type Guild,
} from 'discord.js';
import type { AppConfig } from '../types/config.js';
import { APPLY_MEDIATOR } from '../constants/customIds.js';
import { hexToDecimal } from '../utils/color.js';
import { componentEmojiFromId } from '../utils/emoji.js';

export async function buildPanelEmbeds(config: AppConfig, guild: Guild): Promise<EmbedBuilder[]> {
  const introEmbed = new EmbedBuilder()
    .setColor(hexToDecimal(config.bot.embedColor));

  if (config.images.panelBannerUrl) introEmbed.setImage(config.images.panelBannerUrl);

  return [introEmbed];
}

export function buildPanelComponents(config: AppConfig): ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>[] {
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

  const mediatorButton = new ButtonBuilder()
    .setCustomId(APPLY_MEDIATOR)
    .setLabel('التقديم على رتبة وسيط')
    .setStyle(ButtonStyle.Secondary)
    .setEmoji('🛡️');

  return [
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu),
    new ActionRowBuilder<ButtonBuilder>().addComponents(mediatorButton),
  ];
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
