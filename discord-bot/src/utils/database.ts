import fs from 'fs';
import path from 'path';
import { ServerConfig } from '../types';

const dbPath = path.join(__dirname, '../../database.json');

let db: Record<string, ServerConfig> = {};

export function initDatabase(): void {
  if (fs.existsSync(dbPath)) {
    try {
      const data = fs.readFileSync(dbPath, 'utf-8');
      db = JSON.parse(data);
      console.log('[DB] Persistent database loaded successfully.');
    } catch (e) {
      console.error('[DB] Failed to parse database.json, starting fresh.', e);
      db = {};
    }
  } else {
    saveDatabase();
    console.log('[DB] New database.json file initialized.');
  }
}

function saveDatabase(): void {
  try {
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
  } catch (e) {
    console.error('[DB] Failed to save database.json', e);
  }
}

export function getServerConfig(guildId: string): ServerConfig {
  if (!db[guildId]) {
    db[guildId] = { rules: [] };
    saveDatabase();
  }
  return db[guildId];
}

export function setServerConfig(guildId: string, config: Partial<ServerConfig>): void {
  const current = getServerConfig(guildId);
  db[guildId] = { ...current, ...config };
  saveDatabase();
}
