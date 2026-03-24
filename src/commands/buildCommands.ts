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
  ];
}
