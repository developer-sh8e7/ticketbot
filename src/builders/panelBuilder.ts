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

  if (config.panel.title || config.images.thumbnailUrl) {
    introEmbed.setAuthor({
      name: config.panel.title || '\u200B',
      iconURL: config.images.thumbnailUrl || undefined,
    });
  }

  if (config.panel.subtitle) introEmbed.setTitle(config.panel.subtitle);
  
  const descriptionParts = [];
  if (config.panel.accentText) descriptionParts.push(config.panel.accentText);
  if (config.panel.description) descriptionParts.push(config.panel.description);
  const fullDescription = descriptionParts.join('\n\n').trim();
  
  if (fullDescription) introEmbed.setDescription(fullDescription);
  
  if (config.images.thumbnailUrl) introEmbed.setThumbnail(config.images.thumbnailUrl);
  if (config.images.panelBannerUrl) introEmbed.setImage(config.images.panelBannerUrl);

  if (config.bot.footerText || config.bot.footerIconUrl) {
    introEmbed.setFooter({
      text: config.bot.footerText || '\u200B',
      iconURL: config.bot.footerIconUrl || undefined,
    });
    introEmbed.setTimestamp();
  }

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
