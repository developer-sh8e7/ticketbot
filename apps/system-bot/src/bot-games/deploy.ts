import { REST, Routes } from 'discord.js';
import { readdirSync } from 'fs';
import { join } from 'path';
import { config } from './config';
import { logger } from './utils/logger';

const commands: object[] = [];
const foldersPath = join(__dirname, 'commands');
const folders = readdirSync(foldersPath);

for (const folder of folders) {
  const commandsPath = join(foldersPath, folder);
  const files = readdirSync(commandsPath).filter(f => f.endsWith('.ts') || f.endsWith('.js'));

  for (const file of files) {
    const command = require(join(commandsPath, file)).default;
    if ('data' in command) {
      commands.push(command.data.toJSON());
      logger.info(`Prepared command: ${command.data.name}`);
    }
  }
}

const rest = new REST().setToken(config.token);

(async () => {
  try {
    logger.info(`Deploying ${commands.length} commands...`);
    await rest.put(
      Routes.applicationGuildCommands(config.clientId, config.guildId),
      { body: commands }
    );
    logger.success('Commands deployed successfully!');
  } catch (error) {
    logger.error(`Deploy error: ${error}`);
  }
})();
