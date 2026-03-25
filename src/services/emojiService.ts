import sharp from 'sharp';
import type { Guild } from 'discord.js';
import { logger } from '../utils/logger.js';

const EMOJI_PREFIX = 'stb';

export interface ResolvedEmojis {
  categoryEmojis: Record<string, string>;
  buttonEmojis: Record<string, string>;
}

function numberSvg(num: number): string {
  return `<svg width="128" height="128" xmlns="http://www.w3.org/2000/svg">
    <rect width="128" height="128" rx="32" fill="#8b5cf6"/>
    <text x="64" y="95" font-size="78" font-weight="800" font-family="Arial,Helvetica,sans-serif" fill="#ffffff" text-anchor="middle">${num}</text>
  </svg>`;
}

function closeSvg(): string {
  return `<svg width="128" height="128" xmlns="http://www.w3.org/2000/svg">
    <rect width="128" height="128" rx="32" fill="#2b2d31"/>
    <rect x="36" y="58" width="56" height="42" rx="6" fill="none" stroke="#ffffff" stroke-width="7"/>
    <rect x="46" y="32" width="36" height="32" rx="18" fill="none" stroke="#ffffff" stroke-width="7"/>
    <circle cx="64" cy="76" r="6" fill="#ffffff"/>
    <rect x="62" y="76" width="4" height="12" rx="2" fill="#ffffff"/>
  </svg>`;
}

function addSvg(): string {
  return `<svg width="128" height="128" xmlns="http://www.w3.org/2000/svg">
    <rect width="128" height="128" rx="32" fill="#2b2d31"/>
    <circle cx="56" cy="46" r="16" fill="none" stroke="#ffffff" stroke-width="7"/>
    <path d="M30 100 C30 78 82 78 82 100" fill="none" stroke="#ffffff" stroke-width="7" stroke-linecap="round"/>
    <line x1="98" y1="72" x2="98" y2="100" stroke="#ffffff" stroke-width="7" stroke-linecap="round"/>
    <line x1="84" y1="86" x2="112" y2="86" stroke="#ffffff" stroke-width="7" stroke-linecap="round"/>
  </svg>`;
}

function removeSvg(): string {
  return `<svg width="128" height="128" xmlns="http://www.w3.org/2000/svg">
    <rect width="128" height="128" rx="32" fill="#2b2d31"/>
    <circle cx="56" cy="46" r="16" fill="none" stroke="#ffffff" stroke-width="7"/>
    <path d="M30 100 C30 78 82 78 82 100" fill="none" stroke="#ffffff" stroke-width="7" stroke-linecap="round"/>
    <line x1="84" y1="86" x2="112" y2="86" stroke="#ffffff" stroke-width="7" stroke-linecap="round"/>
  </svg>`;
}

function claimSvg(): string {
  return `<svg width="128" height="128" xmlns="http://www.w3.org/2000/svg">
    <rect width="128" height="128" rx="32" fill="#5b65ea"/>
    <polyline points="36,68 56,88 96,42" fill="none" stroke="#ffffff" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

function pinSvg(): string {
  return `<svg width="128" height="128" xmlns="http://www.w3.org/2000/svg">
    <rect width="128" height="128" rx="32" fill="#2b2d31"/>
    <path d="M64 24 L78 52 L108 56 L86 78 L92 108 L64 92 L36 108 L42 78 L20 56 L50 52 Z" fill="none" stroke="#ffffff" stroke-width="6" stroke-linejoin="round"/>
  </svg>`;
}

const BUTTON_SVGS: Record<string, () => string> = {
  close: closeSvg,
  add: addSvg,
  remove: removeSvg,
  claim: claimSvg,
  pin: pinSvg,
};

async function svgToPng(svg: string): Promise<Buffer> {
  return sharp(Buffer.from(svg)).resize(128, 128).png().toBuffer();
}

async function findOrCreateEmoji(
  guild: Guild,
  name: string,
  svgContent: string,
): Promise<string | null> {
  const existing = guild.emojis.cache.find((e) => e.name === name);
  if (existing) {
    logger.info(`Emoji already exists: ${name} (${existing.id})`);
    return existing.id;
  }

  try {
    const buffer = await svgToPng(svgContent);
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
): Promise<ResolvedEmojis> {
  await guild.emojis.fetch();

  const categoryEmojis: Record<string, string> = {};
  const buttonEmojis: Record<string, string> = {};

  for (let i = 0; i < categoryKeys.length; i++) {
    const name = `${EMOJI_PREFIX}_${i + 1}`;
    const svg = numberSvg(i + 1);
    const id = await findOrCreateEmoji(guild, name, svg);
    if (id) {
      categoryEmojis[categoryKeys[i]] = id;
    }
  }

  for (const [key, svgFn] of Object.entries(BUTTON_SVGS)) {
    const name = `${EMOJI_PREFIX}_${key}`;
    const svg = svgFn();
    const id = await findOrCreateEmoji(guild, name, svg);
    if (id) {
      buttonEmojis[key] = id;
    }
  }

  return { categoryEmojis, buttonEmojis };
}
