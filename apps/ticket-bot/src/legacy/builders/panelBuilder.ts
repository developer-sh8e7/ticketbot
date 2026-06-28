import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  type APIInteractionDataResolvedChannel,
} from 'discord.js';
import type { AppConfig } from '../types/config.js';
import type { MediatorConfigRecord } from '../database/mediatorRepository.js';
import { APPLY_MEDIATOR } from '../constants/customIds.js';
import { componentEmojiFromId } from '../utils/emoji.js';

const panelImageCache = new Map<string, Buffer>();

async function fetchImageBuffer(url: string): Promise<Buffer> {
  const cached = panelImageCache.get(url);
  if (cached) return cached;

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch panel image: ${response.status}`);

  const buffer = Buffer.from(await response.arrayBuffer());
  panelImageCache.set(url, buffer);
  return buffer;
}

export async function buildPanelFiles(config: AppConfig): Promise<AttachmentBuilder[]> {
  if (!config.images.panelBannerUrl) return [];

  const buffer = await fetchImageBuffer(config.images.panelBannerUrl);
  return [new AttachmentBuilder(buffer, { name: 'panel.png' })];
}

export function buildPanelComponents(
  config: AppConfig,
  mediatorConfig?: MediatorConfigRecord,
): ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>[] {
  const enabledCategories = config.categories.filter(
    (category) => category.enabled && category.key !== 'mediator_apply',
  );

  const menu = new StringSelectMenuBuilder()
    .setCustomId(config.panel.menuCustomId)
    .setPlaceholder(config.panel.menuPlaceholder)
    .addOptions(
      enabledCategories.map((category) => {
        const option = new StringSelectMenuOptionBuilder()
          .setLabel(category.label)
          .setDescription(category.description.slice(0, 100))
          .setValue(category.customId ?? category.key);

        const emoji = componentEmojiFromId(config.emojis.categories[category.key]);
        if (emoji) {
          option.setEmoji(emoji);
        }

        return option;
      }),
    );

  const rows: ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>[] = [
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu),
  ];

  if (config.features.applicationsPanel) {
    const mediatorOpen = Boolean(
      mediatorConfig?.is_open
      && mediatorConfig.current_count < mediatorConfig.max_count,
    );
    const mediatorButton = new ButtonBuilder()
      .setCustomId(APPLY_MEDIATOR)
      .setLabel(mediatorOpen ? 'التقديم على رتبة وسيط' : 'التقديم مغلق')
      .setStyle(mediatorOpen ? ButtonStyle.Success : ButtonStyle.Secondary)
      .setEmoji('🛡️')
      .setDisabled(!mediatorOpen);
    rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(mediatorButton));
  }

  return rows;
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
