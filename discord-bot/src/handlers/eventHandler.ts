import { readdirSync } from 'fs';
import { join } from 'path';
import { ExtendedClient } from '../types';
import { logger } from '../utils/logger';

export async function loadEvents(client: ExtendedClient): Promise<void> {
  const eventsPath = join(__dirname, '..', 'events');
  const files = readdirSync(eventsPath).filter(f => (f.endsWith('.ts') || f.endsWith('.js')) && !f.endsWith('.d.ts'));

  for (const file of files) {
    const filePath = join(eventsPath, file);
    const event = await import(filePath);

    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args, client));
    } else {
      client.on(event.name, (...args) => event.execute(...args, client));
    }

    logger.info(`Loaded event: ${event.name}`);
  }
}
