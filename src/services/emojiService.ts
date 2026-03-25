import type { Guild } from 'discord.js';
import { logger } from '../utils/logger.js';

const EMOJI_PREFIX = 'stb';

export interface ResolvedEmojis {
  categoryEmojis: Record<string, string>;
  buttonEmojis: Record<string, string>;
}

const TWEMOJI_BASE = 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72';

const CATEGORY_EMOJI_URLS: Record<number, string> = {
  1: `${TWEMOJI_BASE}/1f91d.png`,
  2: `${TWEMOJI_BASE}/1f3e0.png`,
  3: `${TWEMOJI_BASE}/1f6d2.png`,
};

const BUTTON_EMOJI_URLS: Record<string, string> = {
  close:  `${TWEMOJI_BASE}/1f512.png`,
  add:    `${TWEMOJI_BASE}/2795.png`,
  remove: `${TWEMOJI_BASE}/2796.png`,
  claim:  `${TWEMOJI_BASE}/2705.png`,
  pin:    `${TWEMOJI_BASE}/1f4cc.png`,
};

async function downloadImage(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function findOrCreateEmoji(
  guild: Guild,
  name: string,
  imageUrl: string,
  forceRecreate = false,
): Promise<string | null> {
  const existing = guild.emojis.cache.find((e) => e.name === name);

  if (existing && forceRecreate) {
    logger.info(`Deleting old emoji for recreation: ${name} (${existing.id})`);
    await existing.delete('Recreating with updated image').catch(() => null);
  } else if (existing) {
    logger.info(`Emoji already exists: ${name} (${existing.id})`);
    return existing.id;
  }

  try {
    const buffer = await downloadImage(imageUrl);
    const emoji = await guild.emojis.create({
      attachment: buffer,
      name,
      reason: 'Auto-created by ticket bot',
    });

    logger.info(`Created emoji: ${name} (${emoji.id})`);
    return emoji.id;
  } catch (error) {
    logger.error(`Failed to create emoji ${name}:`, error instanceof Error ? error.message : error);
    return null;
  }
}

export async function ensureEmojis(
  guild: Guild,
  categoryKeys: string[],
  forceRecreate = false,
): Promise<ResolvedEmojis> {
  await guild.emojis.fetch();

  const categoryEmojis: Record<string, string> = {};
  const buttonEmojis: Record<string, string> = {};

  for (let i = 0; i < categoryKeys.length; i++) {
    const name = `${EMOJI_PREFIX}_${i + 1}`;
    const url = CATEGORY_EMOJI_URLS[i + 1];
    if (!url) continue;
    const id = await findOrCreateEmoji(guild, name, url, forceRecreate);
    if (id) {
      categoryEmojis[categoryKeys[i]] = id;
    }
  }

  for (const [key, url] of Object.entries(BUTTON_EMOJI_URLS)) {
    const name = `${EMOJI_PREFIX}_${key}`;
    const id = await findOrCreateEmoji(guild, name, url, forceRecreate);
    if (id) {
      buttonEmojis[key] = id;
    }
  }

  return { categoryEmojis, buttonEmojis };
}
