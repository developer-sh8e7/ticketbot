import { REST, Routes, SlashCommandBuilder } from 'discord.js';
import type { AppConfig } from '../types/config.js';
import type { ProductType } from '../database/botInstanceRepository.js';

/**
 * PRODUCT_COMMAND_REGISTRY
 *
 * Maps each product_type to the set of command IDs it's allowed to register.
 * Add new product types here with their specific command sets.
 * ADMIN_COMMANDS lists commands that should never appear on client bots.
 */
const PRODUCT_COMMANDS: Record<ProductType, ReadonlySet<string>> = {
  ticket: new Set([
    'panel_send',
    'panel_refresh',
    'ticket_close',
    'ticket_stats',
    'restore-panel',
  ]),
  system: new Set<string>(),
  verify: new Set<string>(),
  custom: new Set<string>(),
  web: new Set<string>(),
};

function buildTicketCommands(config: AppConfig): SlashCommandBuilder[] {
  const names = config.commands?.names ?? ({} as Record<string, string>);
  const cmds: SlashCommandBuilder[] = [];

  if (names.panelSend) {
    cmds.push(
      new SlashCommandBuilder()
        .setName(names.panelSend)
        .setDescription('Send the ticket panel to the configured panel channel.') as SlashCommandBuilder,
    );
  }
  if (names.panelRefresh) {
    cmds.push(
      new SlashCommandBuilder()
        .setName(names.panelRefresh)
        .setDescription('Refresh the ticket panel message.')
        .addStringOption((option) =>
          option
            .setName('message-id')
            .setDescription('Specific panel message id to refresh.')
            .setRequired(false),
        ) as unknown as SlashCommandBuilder,
    );
  }
  if (names.ticketClose) {
    cmds.push(
      new SlashCommandBuilder()
        .setName(names.ticketClose)
        .setDescription('Close the current ticket channel.')
        .addStringOption((option) =>
          option.setName('reason').setDescription('Reason for closing.').setRequired(false),
        ) as unknown as SlashCommandBuilder,
    );
  }
  if (names.ticketStats) {
    cmds.push(
      new SlashCommandBuilder()
        .setName(names.ticketStats)
        .setDescription('Show ticket statistics for this server.') as SlashCommandBuilder,
    );
  }

  // Built-in ticket commands (fixed names, always available)
  cmds.push(
    new SlashCommandBuilder()
      .setName('restore-panel')
      .setDescription('إعادة لوحة التحكم داخل التذكرة الحالية إذا اختفت.') as SlashCommandBuilder,
  );

  return cmds;
}

/**
 * Build command definitions filtered by product_type.
 */
export function buildProductCommands(config: AppConfig, productType: ProductType): SlashCommandBuilder[] {
  switch (productType) {
    case 'ticket':
      return buildTicketCommands(config);
    default:
      return [];
  }
}

/**
 * Register product-scoped commands for a bot instance (always guild-scoped).
 */
export async function registerProductCommands(
  token: string,
  clientId: string,
  config: AppConfig,
  productType: ProductType,
): Promise<void> {
  const rest = new REST({ version: '10' }).setToken(token);
  const commands = buildProductCommands(config, productType).map((cmd) => cmd.toJSON());

  // Client bots must never keep global commands. Clear any old accidental global registrations first.
  await rest.put(Routes.applicationCommands(clientId), { body: [] });

  // Register only on the bot instance's configured guild.
  await rest.put(Routes.applicationGuildCommands(clientId, config.guild.id), {
    body: commands,
  });
}
