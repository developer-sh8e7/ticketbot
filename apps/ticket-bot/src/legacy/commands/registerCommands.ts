import { REST, Routes } from 'discord.js';
import { buildCommandDefinitions, type BuildCommandOptions } from './buildCommands.js';
import type { AppConfig } from '../types/config.js';

/**
 * Register commands for one specific guild only.
 *
 * Important: never register global commands here. Global application commands leak
 * across every guild where the same bot application is installed, which breaks
 * per-guild/per-config command isolation.
 */
export async function registerCommands(
  token: string,
  clientId: string,
  config: AppConfig,
  options: BuildCommandOptions = {},
): Promise<void> {
  const rest = new REST({ version: '10' }).setToken(token);
  const commands = buildCommandDefinitions(config, options).map((command) => command.toJSON());

  // Cleanup any old accidental global registrations for this application.
  await rest.put(Routes.applicationCommands(clientId), { body: [] });

  // Register only for this config's guild.
  await rest.put(Routes.applicationGuildCommands(clientId, config.guild.id), {
    body: commands,
  });
}
