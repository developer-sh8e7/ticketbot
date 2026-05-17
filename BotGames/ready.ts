import { Client, ActivityType } from 'discord.js';
import { logger } from '../utils/logger';

export const name = 'ready';
export const once = true;

export function execute(client: Client): void {
  logger.success(`Bot is online as ${client.user?.tag}`);
  client.user?.setActivity('بوتات السيرفرات 🎮', { type: ActivityType.Watching });
}
