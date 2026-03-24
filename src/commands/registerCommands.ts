import { REST, Routes } from 'discord.js';
import { buildCommandDefinitions } from './buildCommands.js';
import type { AppConfig } from '../types/config.js';

export async function registerCommands(token: string, clientId: string, config: AppConfig): Promise<void> {
  const rest = new REST({ version: '10' }).setToken(token);
  const commands = buildCommandDefinitions(config).map((command) => command.toJSON());

  if (config.commands.guildScoped) {
    await rest.put(Routes.applicationGuildCommands(clientId, config.guild.id), {
      body: commands,
    });

    return;
  }

  await rest.put(Routes.applicationCommands(clientId), {
    body: commands,
  });
}
