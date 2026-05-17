import { readdirSync } from 'fs';
import { join } from 'path';
import { ExtendedClient, Command } from '../types';
import { logger } from '../utils/logger';

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
