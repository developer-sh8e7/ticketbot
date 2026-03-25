import { SlashCommandBuilder } from 'discord.js';
import type { AppConfig } from '../types/config.js';

export function buildCommandDefinitions(config: AppConfig) {
  return [
    new SlashCommandBuilder()
      .setName(config.commands.names.panelSend)
      .setDescription('Send the ticket panel to the configured panel channel.'),
    new SlashCommandBuilder()
      .setName(config.commands.names.panelRefresh)
      .setDescription('Refresh the configured ticket panel message or send a new one.')
      .addStringOption((option) =>
        option
          .setName('message-id')
          .setDescription('Specific panel message id to refresh.')
          .setRequired(false),
      ),
    new SlashCommandBuilder()
      .setName(config.commands.names.configReload)
      .setDescription('Reload config.json without restarting the bot.'),
    new SlashCommandBuilder()
      .setName(config.commands.names.emojiRefresh)
      .setDescription('Delete and recreate all custom bot emojis with updated images.'),
    new SlashCommandBuilder()
      .setName(config.commands.names.ticketClose)
      .setDescription('Close the current ticket channel.')
      .addStringOption((option) =>
        option
          .setName('reason')
          .setDescription('Reason for closing this ticket.')
          .setRequired(false),
      ),
    new SlashCommandBuilder()
      .setName(config.commands.names.ticketStats)
      .setDescription('Show ticket statistics for this server.'),
  ];
}
