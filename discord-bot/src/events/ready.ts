import { Client, ActivityType } from 'discord.js';
import { logger } from '../utils/logger';

export const name = 'ready';
export const once = true;

export function execute(client: Client): void {
  logger.info(`Bot is online as ${client.user?.tag}`);
  
  // ضبط الحالة الرسمية لتكون "Watching Opus Solutions" بشكل نظيف ومستقر 100%
  client.user?.setActivity('Opus Solutions', { 
    type: ActivityType.Watching 
  });
}
