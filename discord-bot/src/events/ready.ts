import { Client, ActivityType } from 'discord.js';
import { logger } from '../utils/logger';

export const name = 'ready';
export const once = true;

export function execute(client: Client): void {
  logger.info(`Bot is online as ${client.user?.tag}`);
  
  // ديسكورد يجبرنا على استخدام رابط Twitch أو YouTube لتفعيل زر البث القابل للضغط
  client.user?.setActivity('Opus Solutions 🔗 discord.gg/ZavYFR4qFr', { 
    type: ActivityType.Streaming,
    url: 'https://twitch.tv/discord' 
  });
}
