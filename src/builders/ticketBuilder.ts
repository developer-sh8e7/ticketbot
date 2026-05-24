import {
  ActionRowBuilder,
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
  if (answerKey === 'house_color') return icons.house;
  if (answerKey === 'purchase_type') return icons.purchase;
  return icons.info;
}

export async function buildTicketEmbeds(
  guild: Guild,
  config: AppConfig,
  ticket: TicketRecord,
): Promise<EmbedBuilder[]> {
  const paddedNumber = padTicketNumber(ticket.ticket_number, config.naming.zeroPadLength);

  const ticketIcon = await resolveEmojiMention(guild, config.emojis.ticketIcon);
  const categoryIcon = await resolveEmojiMention(guild, config.emojis.categories[ticket.category_key]);
  const infoIcon = await resolveEmojiMention(guild, config.emojis.infoIcon);
  const epicIcon = await resolveEmojiMention(guild, config.emojis.epicIcon);
  const houseIcon = await resolveEmojiMention(guild, config.emojis.categories.house_unlock);
  const purchaseIcon = await resolveEmojiMention(guild, config.emojis.categories.purchase);
  const statsIcon = await resolveEmojiMention(guild, config.ticket.controls.stats.emojiId);
  const claimIcon = await resolveEmojiMention(guild, config.ticket.controls.claim.emojiId);
  const pinIcon = await resolveEmojiMention(guild, config.ticket.controls.pin.emojiId);

  const icons = {
    ticket: ticketIcon || categoryIcon,
    category: categoryIcon || infoIcon,
    info: infoIcon || statsIcon || categoryIcon,
    epic: epicIcon || categoryIcon,
    house: houseIcon || categoryIcon,
    purchase: purchaseIcon || categoryIcon,
    stats: statsIcon || infoIcon || categoryIcon,
    user: claimIcon || categoryIcon,
    number: pinIcon || statsIcon || categoryIcon,
  };

  const embed = new EmbedBuilder()
    .setColor(hexToDecimal(config.bot.embedColor))
    .setTitle(withIcon(icons.ticket, config.ticket.welcomeTitle))
    .setDescription(config.ticket.welcomeDescription)
    .setThumbnail(config.images.thumbnailUrl || null)
    .setImage(config.images.ticketBannerUrl || null)
    .addFields(
      { name: '\u200b', value: `**${withIcon(icons.info, config.ticket.summaryTitle)}**` },
      { name: withIcon(icons.category, 'نوع الطلب'), value: ticket.category_label, inline: true },
      { name: withIcon(icons.user, 'صاحب التذكرة'), value: `<@${ticket.creator_id}>`, inline: true },
      { name: withIcon(icons.number, 'رقم التذكرة'), value: `#${paddedNumber}`, inline: true },
    )
    .setFooter({
      text: `${config.bot.footerText} • #${paddedNumber}`,
      iconURL: config.bot.footerIconUrl || undefined,
    })
    .setTimestamp();

  if (ticket.answers.length > 0) {
    for (const answer of ticket.answers) {
      const fieldIcon = iconForAnswer(answer.key, icons);
      embed.addFields({
        name: withIcon(fieldIcon, answer.label),
        value: truncateText(answer.value, 1024) || '\u200b',
        inline: false,
      });
    }
  }

  return [embed];
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
    new ButtonBuilder()
      .setCustomId(TICKET_BUTTON_IDS.proof)
      .setLabel('📦 دليل التسليم')
      .setStyle(ButtonStyle.Success)
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
