import {
  ActionRowBuilder,
  ButtonBuilder,
  EmbedBuilder,
  type ButtonStyle,
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


export async function buildTicketEmbeds(
  guild: Guild,
  config: AppConfig,
  ticket: TicketRecord,
): Promise<EmbedBuilder[]> {
  const ticketIcon = config.emojis.ticketIcon
    ? await guild.emojis.fetch(config.emojis.ticketIcon).catch(() => null)
    : null;
  const paddedNumber = padTicketNumber(ticket.ticket_number, config.naming.zeroPadLength);

  const infoEmoji = await resolveEmojiMention(guild, config.emojis.infoIcon);
  const epicEmoji = await resolveEmojiMention(guild, config.emojis.epicIcon);

  const summaryLabel = infoEmoji
    ? `${infoEmoji} ${config.ticket.summaryTitle}`
    : config.ticket.summaryTitle;

  const embed = new EmbedBuilder()
    .setColor(hexToDecimal(config.bot.embedColor))
    .setTitle(config.ticket.welcomeTitle)
    .setDescription(config.ticket.welcomeDescription)
    .setThumbnail(config.images.thumbnailUrl)
    .setImage(config.images.ticketBannerUrl)
    .addFields(
      { name: '\u200b', value: `**${summaryLabel}**` },
      { name: 'التصنيف', value: ticket.category_label, inline: true },
      { name: 'صاحب التذكرة', value: `<@${ticket.creator_id}>`, inline: true },
      { name: 'رقم التذكرة', value: `#${paddedNumber}`, inline: true },
    )
    .setFooter({
      text: `${config.bot.footerText} • #${paddedNumber}`,
      iconURL: config.bot.footerIconUrl || undefined,
    })
    .setTimestamp();

  if (ticketIcon) {
    embed.setAuthor({
      name: `${ticketIcon.toString()} ${ticket.category_label}`,
      iconURL: config.images.thumbnailUrl,
    });
  }

  if (ticket.answers.length > 0) {
    for (const answer of ticket.answers) {
      const fieldName = answer.key === 'epic_id' && epicEmoji
        ? `${epicEmoji} ${answer.label}`
        : answer.label;
      embed.addFields({
        name: fieldName,
        value: truncateText(answer.value, 1024) || '\u200b',
        inline: false,
      });
    }
  }

  return [embed];
}

export function buildTicketActionRows(config: AppConfig, isClaimed = false): ActionRowBuilder<ButtonBuilder>[] {
  const claimConfig: TicketControlConfig = isClaimed
    ? { ...config.ticket.controls.claim, label: 'انسحاب من الاستلام', style: 'Danger' }
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
