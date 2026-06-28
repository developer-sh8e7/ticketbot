import {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
} from 'discord.js';
import {
  ADD_MEMBER_MODAL_ID,
  MEMBER_MODAL_FIELD_ID,
  OPEN_TICKET_MODAL_PREFIX,
  REMOVE_MEMBER_MODAL_ID,
} from '../constants/customIds.js';
import type { TicketCategoryConfig } from '../types/config.js';

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

export function buildOpenTicketModal(category: TicketCategoryConfig): ModalBuilder {
  const modal = new ModalBuilder()
    .setCustomId(`${OPEN_TICKET_MODAL_PREFIX}${category.key}`)
    .setTitle(truncate(category.label, 45));

  const rows = category.questions.map((question) => {
    const style = question.style === 'Paragraph' ? 2 : 1;
    const input = new TextInputBuilder()
      .setCustomId(question.key)
      .setLabel(truncate(question.label, 45))
      .setStyle(style)
      .setRequired(question.required ?? true);

    if (typeof question.minLength === 'number' && question.minLength > 0) {
      input.setMinLength(question.minLength);
    }
    if (typeof question.maxLength === 'number' && question.maxLength > 0) {
      input.setMaxLength(question.maxLength);
    }
    if (question.placeholder) {
      input.setPlaceholder(truncate(question.placeholder, 100));
    }

    return new ActionRowBuilder<TextInputBuilder>().addComponents(input);
  });

  modal.addComponents(...rows);
  return modal;
}

function buildMemberModal(customId: string, title: string, placeholder: string): ModalBuilder {
  const input = new TextInputBuilder()
    .setCustomId(MEMBER_MODAL_FIELD_ID)
    .setLabel('Member ID or Mention')
    .setStyle(1)
    .setPlaceholder(placeholder)
    .setRequired(true)
    .setMinLength(2)
    .setMaxLength(100);

  return new ModalBuilder()
    .setCustomId(customId)
    .setTitle(title)
    .addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
}

export function buildAddMemberModal(): ModalBuilder {
  return buildMemberModal(ADD_MEMBER_MODAL_ID, 'إضافة عضو', '123456789012345678 أو @member');
}

export function buildRemoveMemberModal(): ModalBuilder {
  return buildMemberModal(REMOVE_MEMBER_MODAL_ID, 'إزالة عضو', '123456789012345678 أو @member');
}
