import { deflateSync } from 'node:zlib';
import type { Guild } from 'discord.js';
import { logger } from '../utils/logger.js';

export interface ResolvedEmojis {
  categoryEmojis: Record<string, string>;
  buttonEmojis: Record<string, string>;
}

type IconKind =
  | 'middleman'
  | 'house'
  | 'purchase'
  | 'close'
  | 'add'
  | 'remove'
  | 'claim'
  | 'pin'
  | 'stats'
  | 'allow'
  | 'deny'
  | 'limit';

interface EmojiDesign {
  name: string;
  kind: IconKind;
  primary: [number, number, number];
  secondary: [number, number, number];
}

const CATEGORY_DESIGNS: Record<string, EmojiDesign> = {
  middleman: {
    name: 'stb_ticket_middleman',
    kind: 'middleman',
    primary: [245, 158, 11],
    secondary: [255, 244, 191],
  },
  house_unlock: {
    name: 'stb_ticket_house',
    kind: 'house',
    primary: [34, 197, 94],
    secondary: [198, 255, 221],
  },
  purchase: {
    name: 'stb_ticket_purchase',
    kind: 'purchase',
    primary: [59, 130, 246],
    secondary: [219, 234, 254],
  },
};

const BUTTON_DESIGNS: Record<string, EmojiDesign> = {
  close: { name: 'stb_btn_close', kind: 'close', primary: [239, 68, 68], secondary: [254, 226, 226] },
  add: { name: 'stb_btn_add', kind: 'add', primary: [34, 197, 94], secondary: [220, 252, 231] },
  remove: { name: 'stb_btn_remove', kind: 'remove', primary: [244, 63, 94], secondary: [255, 228, 230] },
  claim: { name: 'stb_btn_claim', kind: 'claim', primary: [14, 165, 233], secondary: [224, 242, 254] },
  pin: { name: 'stb_btn_pin', kind: 'pin', primary: [168, 85, 247], secondary: [243, 232, 255] },
  stats: { name: 'stb_btn_stats', kind: 'stats', primary: [20, 184, 166], secondary: [204, 251, 241] },
};

const SYSTEM_DESIGNS: EmojiDesign[] = [
  { name: 'stb_role_allow', kind: 'allow', primary: [34, 197, 94], secondary: [220, 252, 231] },
  { name: 'stb_role_deny', kind: 'deny', primary: [239, 68, 68], secondary: [254, 226, 226] },
  { name: 'stb_role_limit', kind: 'limit', primary: [245, 158, 11], secondary: [255, 247, 237] },
];

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuffer = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

class Raster {
  public readonly data: Buffer;

  public constructor(public readonly width = 128, public readonly height = 128) {
    this.data = Buffer.alloc(width * height * 4);
  }

  public setPixel(x: number, y: number, color: [number, number, number], alpha = 255): void {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const index = (y * this.width + x) * 4;
    this.data[index] = color[0];
    this.data[index + 1] = color[1];
    this.data[index + 2] = color[2];
    this.data[index + 3] = alpha;
  }

  public circle(cx: number, cy: number, radius: number, color: [number, number, number], alpha = 255): void {
    const radiusSq = radius * radius;
    for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y++) {
      for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x++) {
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy <= radiusSq) this.setPixel(x, y, color, alpha);
      }
    }
  }

  public rect(x: number, y: number, width: number, height: number, color: [number, number, number], alpha = 255): void {
    for (let yy = y; yy < y + height; yy++) {
      for (let xx = x; xx < x + width; xx++) {
        this.setPixel(xx, yy, color, alpha);
      }
    }
  }

  public roundedRect(x: number, y: number, width: number, height: number, radius: number, color: [number, number, number], alpha = 255): void {
    for (let yy = y; yy < y + height; yy++) {
      for (let xx = x; xx < x + width; xx++) {
        const rx = xx < x + radius ? x + radius : xx >= x + width - radius ? x + width - radius - 1 : xx;
        const ry = yy < y + radius ? y + radius : yy >= y + height - radius ? y + height - radius - 1 : yy;
        const dx = xx - rx;
        const dy = yy - ry;
        if (dx * dx + dy * dy <= radius * radius) this.setPixel(xx, yy, color, alpha);
      }
    }
  }

  public line(x1: number, y1: number, x2: number, y2: number, thickness: number, color: [number, number, number], alpha = 255): void {
    const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
    for (let i = 0; i <= steps; i++) {
      const t = steps === 0 ? 0 : i / steps;
      const x = Math.round(x1 + (x2 - x1) * t);
      const y = Math.round(y1 + (y2 - y1) * t);
      this.circle(x, y, thickness / 2, color, alpha);
    }
  }

  public triangle(points: [number, number][], color: [number, number, number], alpha = 255): void {
    const [a, b, c] = points;
    const minX = Math.min(a[0], b[0], c[0]);
    const maxX = Math.max(a[0], b[0], c[0]);
    const minY = Math.min(a[1], b[1], c[1]);
    const maxY = Math.max(a[1], b[1], c[1]);
    const area = (p1: [number, number], p2: [number, number], p3: [number, number]) =>
      (p1[0] * (p2[1] - p3[1]) + p2[0] * (p3[1] - p1[1]) + p3[0] * (p1[1] - p2[1])) / 2;
    const full = Math.abs(area(a, b, c));
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const p: [number, number] = [x, y];
        const sum = Math.abs(area(p, b, c)) + Math.abs(area(a, p, c)) + Math.abs(area(a, b, p));
        if (Math.abs(sum - full) < 0.5) this.setPixel(x, y, color, alpha);
      }
    }
  }

  public toPng(): Buffer {
    const raw = Buffer.alloc((this.width * 4 + 1) * this.height);
    for (let y = 0; y < this.height; y++) {
      const rowStart = y * (this.width * 4 + 1);
      raw[rowStart] = 0;
      this.data.copy(raw, rowStart + 1, y * this.width * 4, (y + 1) * this.width * 4);
    }

    const header = Buffer.alloc(13);
    header.writeUInt32BE(this.width, 0);
    header.writeUInt32BE(this.height, 4);
    header[8] = 8;
    header[9] = 6;
    header[10] = 0;
    header[11] = 0;
    header[12] = 0;

    return Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      pngChunk('IHDR', header),
      pngChunk('IDAT', deflateSync(raw)),
      pngChunk('IEND', Buffer.alloc(0)),
    ]);
  }
}

function drawIcon(canvas: Raster, design: EmojiDesign): void {
  const dark: [number, number, number] = [15, 23, 42];
  const white: [number, number, number] = [255, 255, 255];

  canvas.circle(64, 64, 58, design.primary);
  canvas.circle(64, 64, 49, dark);
  canvas.circle(64, 64, 43, design.primary, 230);

  switch (design.kind) {
    case 'middleman':
      canvas.triangle([[64, 24], [94, 38], [88, 78], [64, 101], [40, 78], [34, 38]] as [number, number][], design.secondary);
      canvas.line(46, 60, 60, 74, 9, dark);
      canvas.line(60, 74, 84, 48, 9, dark);
      break;
    case 'house':
      canvas.triangle([[28, 61], [64, 30], [100, 61]], design.secondary);
      canvas.roundedRect(38, 58, 52, 42, 6, design.secondary);
      canvas.rect(58, 75, 13, 25, dark);
      break;
    case 'purchase':
      canvas.roundedRect(34, 49, 60, 49, 8, design.secondary);
      canvas.line(48, 50, 48, 39, 6, design.secondary);
      canvas.line(48, 39, 80, 39, 6, design.secondary);
      canvas.line(80, 39, 80, 50, 6, design.secondary);
      canvas.circle(54, 72, 5, dark);
      canvas.circle(74, 72, 5, dark);
      break;
    case 'close':
      canvas.line(42, 42, 86, 86, 12, white);
      canvas.line(86, 42, 42, 86, 12, white);
      break;
    case 'add':
      canvas.line(64, 36, 64, 92, 13, white);
      canvas.line(36, 64, 92, 64, 13, white);
      break;
    case 'remove':
      canvas.line(36, 64, 92, 64, 14, white);
      break;
    case 'claim':
      canvas.line(36, 66, 55, 85, 12, white);
      canvas.line(55, 85, 94, 43, 12, white);
      break;
    case 'pin':
      canvas.circle(64, 38, 13, white);
      canvas.rect(58, 48, 12, 34, white);
      canvas.triangle([[50, 78], [78, 78], [64, 103]], white);
      break;
    case 'stats':
      canvas.roundedRect(38, 70, 10, 24, 4, white);
      canvas.roundedRect(58, 54, 10, 40, 4, white);
      canvas.roundedRect(78, 38, 10, 56, 4, white);
      break;
    case 'allow':
      canvas.roundedRect(36, 52, 56, 42, 8, design.secondary);
      canvas.line(47, 72, 60, 84, 9, dark);
      canvas.line(60, 84, 84, 56, 9, dark);
      break;
    case 'deny':
      canvas.roundedRect(35, 35, 58, 58, 10, design.secondary);
      canvas.line(45, 45, 83, 83, 10, dark);
      canvas.line(83, 45, 45, 83, 10, dark);
      break;
    case 'limit':
      canvas.circle(64, 64, 31, design.secondary);
      canvas.line(64, 43, 64, 66, 8, dark);
      canvas.line(64, 66, 82, 78, 8, dark);
      canvas.line(50, 32, 78, 32, 7, design.secondary);
      break;
  }
}

function renderEmoji(design: EmojiDesign): Buffer {
  const canvas = new Raster();
  drawIcon(canvas, design);
  return canvas.toPng();
}

async function findOrCreateEmoji(
  guild: Guild,
  design: EmojiDesign,
  forceRecreate = false,
): Promise<string | null> {
  const existing = guild.emojis.cache.find((e) => e.name === design.name);

  if (existing && forceRecreate) {
    logger.info(`Deleting old emoji for recreation: ${design.name} (${existing.id})`);
    await existing.delete('Recreating with updated custom image').catch(() => null);
  } else if (existing) {
    logger.info(`Emoji already exists: ${design.name} (${existing.id})`);
    return existing.id;
  }

  try {
    const emoji = await guild.emojis.create({
      attachment: renderEmoji(design),
      name: design.name,
      reason: 'Auto-created by ticket bot',
    });

    logger.info(`Created emoji: ${design.name} (${emoji.id})`);
    return emoji.id;
  } catch (error) {
    logger.error(`Failed to create emoji ${design.name}:`, error instanceof Error ? error.message : error);
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

  for (const categoryKey of categoryKeys) {
    const design = CATEGORY_DESIGNS[categoryKey];
    if (!design) continue;
    const id = await findOrCreateEmoji(guild, design, forceRecreate);
    if (id) categoryEmojis[categoryKey] = id;
  }

  for (const [key, design] of Object.entries(BUTTON_DESIGNS)) {
    const id = await findOrCreateEmoji(guild, design, forceRecreate);
    if (id) buttonEmojis[key] = id;
  }

  for (const design of SYSTEM_DESIGNS) {
    await findOrCreateEmoji(guild, design, forceRecreate);
  }

  return { categoryEmojis, buttonEmojis };
}
