import { SlashCommandBuilder } from 'discord.js';
import type { AppConfig } from '../types/config.js';

export function buildCommandDefinitions(config: AppConfig) {
  const names = config.commands?.names ?? {} as Record<string, string>;
  const commands: SlashCommandBuilder[] = [];

  if (names.panelSend) {
    commands.push(
      new SlashCommandBuilder()
        .setName(names.panelSend)
        .setDescription('Send the ticket panel to the configured panel channel.') as SlashCommandBuilder,
    );
  }

  if (names.panelRefresh) {
    commands.push(
      new SlashCommandBuilder()
        .setName(names.panelRefresh)
        .setDescription('Refresh the configured ticket panel message or send a new one.')
        .addStringOption((option) =>
          option
            .setName('message-id')
            .setDescription('Specific panel message id to refresh.')
            .setRequired(false),
        ) as unknown as SlashCommandBuilder,
    );
  }

  if (names.configReload) {
    commands.push(
      new SlashCommandBuilder()
        .setName(names.configReload)
        .setDescription('Reload config.json without restarting the bot.') as SlashCommandBuilder,
    );
  }

  if (names.emojiRefresh) {
    commands.push(
      new SlashCommandBuilder()
        .setName(names.emojiRefresh)
        .setDescription('Delete and recreate all custom bot emojis with updated images.') as SlashCommandBuilder,
    );
  }

  if (names.ticketClose) {
    commands.push(
      new SlashCommandBuilder()
        .setName(names.ticketClose)
        .setDescription('Close the current ticket channel.')
        .addStringOption((option) =>
          option
            .setName('reason')
            .setDescription('Reason for closing this ticket.')
            .setRequired(false),
        ) as unknown as SlashCommandBuilder,
    );
  }

  if (names.ticketStats) {
    commands.push(
      new SlashCommandBuilder()
        .setName(names.ticketStats)
        .setDescription('Show ticket statistics for this server.') as SlashCommandBuilder,
    );
  }

  commands.push(
    new SlashCommandBuilder()
      .setName('clear')
      .setDescription('Delete all messages sent by a specific user id across the server.')
      .addStringOption((option) =>
        option
          .setName('user-id')
          .setDescription('Copy ID of the user whose messages should be deleted.')
          .setRequired(true),
      ) as unknown as SlashCommandBuilder,
  );

  commands.push(
    new SlashCommandBuilder()
      .setName('logs')
      .setDescription('Respawn all bot log channels and post what each log is for.') as SlashCommandBuilder,
  );

  // AI Toggle command
  commands.push(
    new SlashCommandBuilder()
      .setName('ai')
      .setDescription('تشغيل أو إيقاف المساعد الآلي (AI) في السيرفر')
      .addSubcommand((sub) =>
        sub
          .setName('on')
          .setDescription('تفعيل المساعد الآلي للتذاكر بالكامل')
      )
      .addSubcommand((sub) =>
        sub
          .setName('off')
          .setDescription('إيقاف المساعد الآلي للتذاكر بالكامل')
      ) as unknown as SlashCommandBuilder
  );

  // Ticket Control Panel commands
  commands.push(
    new SlashCommandBuilder()
      .setName('panel')
      .setDescription('فتح لوحة التحكم الكاملة بالتذاكر (للأدمن فقط)') as SlashCommandBuilder
  );
  commands.push(
    new SlashCommandBuilder()
      .setName('panle')
      .setDescription('فتح لوحة التحكم الكاملة بالتذاكر (للأدمن فقط) - كتابة بديلة') as SlashCommandBuilder
  );

  commands.push(
    new SlashCommandBuilder()
      .setName('panel-mm')
      .setDescription('فتح لوحة التحكم الكاملة بالوسطاء (للإدارة فقط)') as SlashCommandBuilder
  );

  commands.push(
    new SlashCommandBuilder()
      .setName('panel-complaints-send')
      .setDescription('ارسال لوحة الشكاوي والاعتراضات لمركز الشكاوي (للأدمن فقط)') as SlashCommandBuilder
  );

  return commands;
}
