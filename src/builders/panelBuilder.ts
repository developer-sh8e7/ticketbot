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

function buildCategoryLines(config: AppConfig): string[] {
  const enabledCategories = config.categories.filter((category) => category.enabled);

  return enabledCategories.map((category, index) => {
    const numberPrefix = config.panel.showNumbers ? `**${index + 1}**` : '-';
    return `${numberPrefix} **${category.label}**\n${category.description}`;
  });
}

export async function buildPanelEmbeds(config: AppConfig, guild: Guild): Promise<EmbedBuilder[]> {
  const panelIcon = await guild.emojis.fetch(config.emojis.panelIcon).catch(() => null);
  const categoryLines = buildCategoryLines(config);

  const introEmbed = new EmbedBuilder()
    .setColor(hexToDecimal(config.bot.embedColor))
    .setAuthor({
      name: config.panel.title,
      iconURL: config.images.thumbnailUrl,
    })
    .setTitle(config.panel.subtitle)
    .setDescription(`${config.panel.accentText}\n\n${config.panel.description}`)
    .setThumbnail(config.images.thumbnailUrl)
    .setImage(config.images.panelBannerUrl)
    .setFooter({
      text: config.bot.footerText,
      iconURL: config.bot.footerIconUrl || undefined,
    })
    .setTimestamp();

  if (panelIcon) {
    introEmbed.setAuthor({
      name: `${panelIcon.toString()} ${config.panel.title}`,
      iconURL: config.images.thumbnailUrl,
    });
  }

  const categoriesEmbed = new EmbedBuilder()
    .setColor(hexToDecimal(config.bot.embedColor))
    .setTitle('التصنيفات المتاحة')
    .setDescription(categoryLines.join('\n\n'))
    .setFooter({
      text: guild.name,
      iconURL: guild.iconURL() || undefined,
    });

  return [introEmbed, categoriesEmbed];
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
