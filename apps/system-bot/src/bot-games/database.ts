import { ServerConfig } from '../types';

const db = new Map<string, ServerConfig>();

export function initDatabase(): void {
  console.log('[DB] In-memory database initialized.');
}

export function getServerConfig(guildId: string): ServerConfig {
  if (!db.has(guildId)) {
    db.set(guildId, { rules: [] });
  }
  return db.get(guildId)!;
}

export function setServerConfig(guildId: string, config: Partial<ServerConfig>): void {
  const current = getServerConfig(guildId);
  db.set(guildId, { ...current, ...config });
}
