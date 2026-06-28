import sharp from 'sharp';
import { VOUCHES_IMAGE_URL } from './vouchesService.js';

export const VOUCHES_REVIEW_MAX_LENGTH = 120;

const TEMPLATE_WIDTH = 2172;
const TEMPLATE_HEIGHT = 724;
const AVATAR_SIZE = 338;
const AVATAR_LEFT = 238;
const AVATAR_TOP = 205;

const NAME_X = 1588;
const NAME_Y = 292;
const NAME_MAX_LENGTH = 24;

const REVIEW_CENTER_X = 1458;
const REVIEW_CENTER_Y = 455;
const REVIEW_MAX_LINES = 3;
const REVIEW_MAX_CHARS_PER_LINE = 34;

const STAR_START_X = 1232;
const STAR_Y = 650;
const STAR_GAP = 92;

function escapeXml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function truncate(input: string, max: number): string {
  const clean = input.trim().replace(/\s+/g, ' ');
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

function wrapText(input: string, maxCharsPerLine: number, maxLines: number): string[] {
  const clean = input.trim().replace(/\s+/g, ' ');
  const words = clean.split(' ');
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxCharsPerLine) {
      current = next;
      continue;
    }

    if (current) lines.push(current);

    if (word.length > maxCharsPerLine) {
      lines.push(word.slice(0, maxCharsPerLine));
      current = word.slice(maxCharsPerLine);
    } else {
      current = word;
    }

    if (lines.length >= maxLines) break;
  }

  if (current && lines.length < maxLines) lines.push(current);

  if (lines.length > maxLines) return lines.slice(0, maxLines);
  return lines.map((line, index) => {
    if (index === maxLines - 1 && clean.length > lines.join(' ').length) {
      return truncate(line, Math.max(1, maxCharsPerLine - 1));
    }
    return line;
  });
}

function buildTextOverlay(review: string, rating: number, customerName: string): Buffer {
  const name = escapeXml(truncate(customerName, NAME_MAX_LENGTH));
  const safeReview = truncate(review, VOUCHES_REVIEW_MAX_LENGTH);
  const lines = wrapText(safeReview, REVIEW_MAX_CHARS_PER_LINE, REVIEW_MAX_LINES);
  const reviewFontSize = lines.length <= 1 ? 58 : lines.length === 2 ? 50 : 43;
  const reviewLineHeight = Math.round(reviewFontSize * 1.34);
  const reviewStartY = REVIEW_CENTER_Y - ((lines.length - 1) * reviewLineHeight) / 2;

  const stars = Array.from({ length: 5 }, (_, index) => {
    const active = index < rating;
    return `<text x="${STAR_START_X + index * STAR_GAP}" y="${STAR_Y}" text-anchor="middle" font-size="72" font-weight="900" font-family="Arial, sans-serif" fill="${active ? '#ffffff' : '#4b4b4b'}" stroke="${active ? '#bdbdbd' : '#222'}" stroke-width="1.4">★</text>`;
  }).join('');

  const reviewSvg = lines.map((line, index) => {
    const y = reviewStartY + index * reviewLineHeight;
    return `<text x="${REVIEW_CENTER_X}" y="${y}" direction="rtl" unicode-bidi="plaintext" text-anchor="middle" font-size="${reviewFontSize}" font-weight="700" font-family="Arial, Tahoma, 'Noto Sans Arabic', sans-serif" fill="#d7d7d7">${escapeXml(line)}</text>`;
  }).join('');

  const svg = `
  <svg width="${TEMPLATE_WIDTH}" height="${TEMPLATE_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
    <rect x="1188" y="198" width="716" height="116" rx="24" fill="#0d0d0d" opacity="1"/>
    <text x="${NAME_X}" y="${NAME_Y}" direction="rtl" unicode-bidi="plaintext" text-anchor="middle" font-size="62" font-weight="800" font-family="Arial, Tahoma, 'Noto Sans Arabic', sans-serif" fill="#f2f2f2">${name}</text>

    <rect x="908" y="356" width="1110" height="166" rx="54" fill="#0b0b0b" opacity="1"/>
    ${reviewSvg}

    <rect x="1148" y="586" width="570" height="96" rx="32" fill="#0b0b0b" opacity="1"/>
    ${stars}
  </svg>`;

  return Buffer.from(svg);
}

async function fetchBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

async function circularAvatar(avatarUrl: string): Promise<Buffer> {
  const avatar = await fetchBuffer(avatarUrl);
  const mask = Buffer.from(
    `<svg width="${AVATAR_SIZE}" height="${AVATAR_SIZE}" xmlns="http://www.w3.org/2000/svg"><circle cx="${AVATAR_SIZE / 2}" cy="${AVATAR_SIZE / 2}" r="${AVATAR_SIZE / 2}" fill="#fff"/></svg>`,
  );

  return sharp(avatar)
    .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: 'cover' })
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer();
}

let cachedTemplate: Buffer | null = null;

async function getTemplate(): Promise<Buffer> {
  if (cachedTemplate) return cachedTemplate;
  cachedTemplate = await fetchBuffer(VOUCHES_IMAGE_URL);
  return cachedTemplate;
}

export async function buildVouchImage(input: {
  review: string;
  rating: number;
  customerName: string;
  avatarUrl: string;
}): Promise<Buffer> {
  const [template, avatar] = await Promise.all([
    getTemplate(),
    circularAvatar(input.avatarUrl),
  ]);

  const overlay = buildTextOverlay(input.review, input.rating, input.customerName);

  const avatarBackdrop = Buffer.from(
    `<svg width="${TEMPLATE_WIDTH}" height="${TEMPLATE_HEIGHT}" xmlns="http://www.w3.org/2000/svg"><circle cx="${AVATAR_LEFT + AVATAR_SIZE / 2}" cy="${AVATAR_TOP + AVATAR_SIZE / 2}" r="${AVATAR_SIZE / 2 + 7}" fill="#0b0b0b" opacity="1"/></svg>`,
  );

  return sharp(template)
    .resize(TEMPLATE_WIDTH, TEMPLATE_HEIGHT, { fit: 'cover' })
    .composite([
      { input: avatarBackdrop, left: 0, top: 0 },
      { input: avatar, left: AVATAR_LEFT, top: AVATAR_TOP },
      { input: overlay, left: 0, top: 0 },
    ])
    .png()
    .toBuffer();
}
