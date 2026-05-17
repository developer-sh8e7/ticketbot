import { Client, GatewayIntentBits, Collection } from 'discord.js';
import { config } from './config';
import { logger } from './utils/logger';
import { initDatabase } from './utils/database';
import { loadEvents } from './handlers/eventHandler';
import { loadCommands, deployCommands } from './handlers/commandHandler';
import { ExtendedClient } from './types';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
}) as ExtendedClient;

client.commands = new Collection();
client.cooldowns = new Collection();

async function start(): Promise<void> {
  logger.info('Starting bot...');
  initDatabase();
  await loadCommands(client);
  
  // Automatically deploy slash commands on startup to make multi-server scaling 100% plug-and-play
  await deployCommands(client);
  
  await loadEvents(client);

  if (!config.token) {
    logger.error('No TOKEN in .env file!');
    process.exit(1);
  }

  await client.login(config.token);
}

start().catch(err => {
  logger.error(`Fatal error: ${err}`);
  process.exit(1);
});
