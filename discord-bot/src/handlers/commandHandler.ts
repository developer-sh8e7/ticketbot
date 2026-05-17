import { readdirSync } from 'fs';
import { join } from 'path';
import { REST, Routes } from 'discord.js';
import { ExtendedClient, Command } from '../types';
import { logger } from '../utils/logger';
import { config } from '../config';

export async function loadCommands(client: ExtendedClient): Promise<void> {
  const foldersPath = join(__dirname, '..', 'commands');
  const folders = readdirSync(foldersPath);

  for (const folder of folders) {
    const commandsPath = join(foldersPath, folder);
    const files = readdirSync(commandsPath).filter(f => (f.endsWith('.ts') || f.endsWith('.js')) && !f.endsWith('.d.ts'));

    for (const file of files) {
      const filePath = join(commandsPath, file);
      const command: Command = (await import(filePath)).default;

      if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        logger.info(`Loaded command: ${command.data.name}`);
      }
    }
  }
}

export async function deployCommands(client: ExtendedClient): Promise<void> {
  if (!config.token || !config.clientId) {
    logger.warn('Skipping command deployment: missing token or clientId');
    return;
  }

  const commandsJSON = client.commands.map(cmd => cmd.data.toJSON());
  const rest = new REST({ version: '10' }).setToken(config.token);

  try {
    logger.info(`Started refreshing ${commandsJSON.length} application (/) commands.`);
    
    if (config.guildId) {
      await rest.put(
        Routes.applicationGuildCommands(config.clientId, config.guildId),
        { body: commandsJSON },
      );
      logger.info('Successfully reloaded guild commands.');
    } else {
      await rest.put(
        Routes.applicationCommands(config.clientId),
        { body: commandsJSON },
      );
      logger.info('Successfully reloaded global commands.');
    }
  } catch (error) {
    logger.error(`Error deploying commands: ${error}`);
  }
}
