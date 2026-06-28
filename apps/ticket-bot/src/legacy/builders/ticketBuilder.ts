import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type Guild,
} from 'discord.js';
import { TICKET_BUTTON_IDS } from '../constants/customIds.js';
import type { TicketRecord } from '../database/types.js';
import type { AppConfig, TicketControlConfig } from '../types/config.js';
import { buttonStyleFromName } from '../utils/discord.js';
import { componentEmojiFromId, resolveEmojiMention } from '../utils/emoji.js';
import { hexToDecimal } from '../utils/color.js';
import { padTicketNumber, truncateText } from '../utils/text.js';

function buildButton(customId: string, config: TicketControlConfig): ButtonBuilder {
  const button = new ButtonBuilder()
    .setCustomId(customId)
    .setLabel(config.label)
    .setStyle(buttonStyleFromName(config.style) as ButtonStyle);

  const emoji = componentEmojiFromId(config.emojiId);
  if (emoji) {
    button.setEmoji(emoji);
  }

  return button;
}

function withIcon(icon: string, label: string): string {
  return icon ? `${icon} ${label}` : label;
}

function iconForAnswer(answerKey: string, icons: Record<string, string>): string {
  if (answerKey === 'epic_id') return icons.epic;
  if (answerKey === 'trade_amount') return icons.stats;
  if (answerKey === 'trade_give') return icons.epic;
  if (answerKey === 'trade_receive') return icons.house;
  if (answerKey === 'tip') return icons.stats;
  if (answerKey === 'house_color') return icons.house;
  if (answerKey === 'purchase_type') return icons.purchase;
  return icons.info;
}

const ticketImageCache = new Map<string, Buffer>();

async function fetchTicketImageBuffer(url: string): Promise<Buffer> {
  const cached = ticketImageCache.get(url);
  if (cached) return cached;

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch ticket image: ${response.status}`);

  const buffer = Buffer.from(await response.arrayBuffer());
  ticketImageCache.set(url, buffer);
  return buffer;
}

export async function buildTicketFiles(config: AppConfig): Promise<AttachmentBuilder[]> {
  if (!config.images.ticketBannerUrl) return [];

  const buffer = await fetchTicketImageBuffer(config.images.ticketBannerUrl);
  return [new AttachmentBuilder(buffer, { name: 'ticket.png' })];
}

export async function buildTicketEmbeds(
  guild: Guild,
  config: AppConfig,
  ticket: TicketRecord,
): Promise<EmbedBuilder[]> {
  // Ticket control messages now use a raw image attachment + buttons only.
  // Keep this function for compatibility with older call sites, but do not render an embed.
  void guild;
  void config;
  void ticket;
  return [];
}

export function buildTicketActionRows(config: AppConfig, isClaimed = false): ActionRowBuilder<ButtonBuilder>[] {
  const claimConfig: TicketControlConfig = isClaimed
    ? { ...config.ticket.controls.claim, label: 'إلغاء الاستلام', style: 'Danger' }
    : config.ticket.controls.claim;

  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    buildButton(TICKET_BUTTON_IDS.close, config.ticket.controls.close),
    buildButton(TICKET_BUTTON_IDS.add, config.ticket.controls.add),
    buildButton(TICKET_BUTTON_IDS.remove, config.ticket.controls.remove),
    buildButton(TICKET_BUTTON_IDS.claim, claimConfig),
    buildButton(TICKET_BUTTON_IDS.pin, config.ticket.controls.pin),
  );

  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    buildButton(TICKET_BUTTON_IDS.stats, config.ticket.controls.stats),
  );

  return [row1, row2];
}

export function buildAlreadyOpenEmbed(config: AppConfig, channelId: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(hexToDecimal(config.bot.errorColor))
    .setTitle('تذكرة مفتوحة')
    .setDescription(`${config.ticket.messages.alreadyOpen} <#${channelId}>`)
    .setTimestamp();
}

export function buildSuccessEmbed(config: AppConfig, title: string, description: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(hexToDecimal(config.bot.successColor))
    .setTitle(title)
    .setDescription(description)
    .setTimestamp();
}

export function buildErrorEmbed(config: AppConfig, description: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(hexToDecimal(config.bot.errorColor))
    .setTitle('خطأ')
    .setDescription(description)
    .setTimestamp();
}
