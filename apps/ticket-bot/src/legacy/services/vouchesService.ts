import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', '..', 'data');
const DATA_FILE = join(DATA_DIR, 'vouches_usage.json');

type VouchesData = Record<string, number>; // key: `${guildId}:${userId}` → count

function readData(): VouchesData {
  try {
    if (!existsSync(DATA_DIR)) {
      mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!existsSync(DATA_FILE)) {
      writeFileSync(DATA_FILE, '{}', 'utf-8');
      return {};
    }
    const raw = readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(raw) as VouchesData;
  } catch {
    return {};
  }
}

function writeData(data: VouchesData): void {
  try {
    if (!existsSync(DATA_DIR)) {
      mkdirSync(DATA_DIR, { recursive: true });
    }
    writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('[vouches] Failed to write data file:', error);
  }
}

export function getVouchCount(guildId: string, userId: string): number {
  const data = readData();
  return data[`${guildId}:${userId}`] ?? 0;
}

export function incrementVouchCount(guildId: string, userId: string): number {
  const data = readData();
  const key = `${guildId}:${userId}`;
  data[key] = (data[key] ?? 0) + 1;
  writeData(data);
  return data[key];
}

/** Role IDs */
export const VOUCHES_LIMITED_ROLE_ID = '1395859969152127048';
export const VOUCHES_UNLIMITED_ROLE_ID = '1396566007413215242';
export const VOUCHES_TARGET_CHANNEL_ID = '1517613203004326049';
export const VOUCHES_MAX_LIMITED_USES = 2;
export const VOUCHES_IMAGE_URL = 'https://i.imgur.com/0WqDZfM.png';

/**
 * Check if a member has permission to use /vouches.
 * Returns null if allowed, or an ephemeral error message string if denied.
 */
export function checkVouchesPermission(
  memberRoles: import('discord.js').Snowflake[],
  guildId: string,
  userId: string,
): { allowed: boolean; error?: string } {
  const hasUnlimited = memberRoles.includes(VOUCHES_UNLIMITED_ROLE_ID);
  const hasLimited = memberRoles.includes(VOUCHES_LIMITED_ROLE_ID);

  // No relevant role at all
  if (!hasUnlimited && !hasLimited) {
    return { allowed: false, error: 'ما عندك صلاحية استخدام هذا الأمر' };
  }

  // Unlimited (Technical Support) — always allowed
  if (hasUnlimited) {
    return { allowed: true };
  }

  // Limited role — check usage count
  const current = getVouchCount(guildId, userId);
  if (current >= VOUCHES_MAX_LIMITED_USES) {
    return { allowed: false, error: `وصلت الحد الأقصى للتقييمات (${VOUCHES_MAX_LIMITED_USES} تقييم)` };
  }

  return { allowed: true };
}
