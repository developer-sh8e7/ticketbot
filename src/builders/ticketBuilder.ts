import {
  ActionRowBuilder,
  ButtonBuilder,
  EmbedBuilder,
  type ButtonStyle,
  type Guild,
} from 'discord.js';
import { TICKET_BUTTON_IDS } from '../constants/customIds.js';
import type { TicketRecord } from '../database/types.js';
import type { AppConfig, TicketAnswer, TicketControlConfig } from '../types/config.js';
import { buttonStyleFromName } from '../utils/discord.js';
import { componentEmojiFromId } from '../utils/emoji.js';
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

function formatAnswers(answers: TicketAnswer[]): string {
  if (answers.length === 0) {
    return 'لا توجد إجابات مسجلة.';
  }

  return answers
    .map((answer) => `**${answer.label}**\n${truncateText(answer.value, 1024)}`)
    .join('\n\n');
}

export async function buildTicketEmbeds(
  guild: Guild,
  config: AppConfig,
  ticket: TicketRecord,
): Promise<EmbedBuilder[]> {
  const ticketIcon = await guild.emojis.fetch(config.emojis.ticketIcon).catch(() => null);
  const paddedNumber = padTicketNumber(ticket.ticket_number, config.naming.zeroPadLength);

  const welcomeEmbed = new EmbedBuilder()
    .setColor(hexToDecimal(config.bot.embedColor))
    .setTitle(config.ticket.welcomeTitle)
    .setDescription(config.ticket.welcomeDescription)
    .setThumbnail(config.images.thumbnailUrl)
    .setImage(config.images.ticketBannerUrl)
    .setFooter({
      text: `${config.bot.footerText} • #${paddedNumber}`,
      iconURL: config.bot.footerIconUrl || undefined,
    })
    .setTimestamp();

  if (ticketIcon) {
    welcomeEmbed.setAuthor({
      name: `${ticketIcon.toString()} ${ticket.category_label}`,
      iconURL: config.images.thumbnailUrl,
    });
  }

  const summaryEmbed = new EmbedBuilder()
    .setColor(hexToDecimal(config.bot.embedColor))
    .setTitle(config.ticket.summaryTitle)
    .addFields(
      {
        name: 'رقم التذكرة',
        value: `#${paddedNumber}`,
        inline: true,
      },
      {
        name: 'صاحب التذكرة',
        value: `<@${ticket.creator_id}>`,
        inline: true,
      },
      {
        name: 'التصنيف',
        value: ticket.category_label,
        inline: true,
      },
      {
        name: 'الإجابات',
        value: formatAnswers(ticket.answers),
      },
    )
    .setFooter({
      text: guild.name,
      iconURL: guild.iconURL() || undefined,
    });

  return [welcomeEmbed, summaryEmbed];
}

export function buildTicketActionRows(config: AppConfig): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      buildButton(TICKET_BUTTON_IDS.close, config.ticket.controls.close),
      buildButton(TICKET_BUTTON_IDS.add, config.ticket.controls.add),
      buildButton(TICKET_BUTTON_IDS.remove, config.ticket.controls.remove),
      buildButton(TICKET_BUTTON_IDS.claim, config.ticket.controls.claim),
      buildButton(TICKET_BUTTON_IDS.pin, config.ticket.controls.pin),
    ),
  ];
}

export function buildAlreadyOpenEmbed(config: AppConfig, channelId: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(hexToDecimal(config.bot.errorColor))
    .setTitle('Open Ticket')
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
