// ══════════════════════════════════════════════════════════════
//  صورة الترحيب المخصّصة — يركّب أفاتار العضو الجديد (دائري) +
//  اسمه فوق صورة الخلفية اللي رفعها العميل، حسب المواقع اللي
//  حددها بمحرر السحب والإفلات بالداشبورد (نسب مئوية 0..1).
// ══════════════════════════════════════════════════════════════

import sharp from "sharp";
import { GuildMember } from "discord.js";

export interface WelcomeImageConfig {
  backgroundUrl: string;
  avatar?: { xPct?: number; yPct?: number; radiusPct?: number };
  text?: { xPct?: number; yPct?: number; fontSizePct?: number; color?: string };
}

async function fetchBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch image asset (${res.status}): ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

async function circularAvatar(avatarUrl: string, size: number): Promise<Buffer> {
  const avatar = await fetchBuffer(avatarUrl);
  const mask = Buffer.from(
    `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`,
  );
  return sharp(avatar).resize(size, size, { fit: "cover" }).composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** يركّب صورة الترحيب النهائية حسب إعدادات العميل. يرمي استثناء إذا فشل التحميل/التركيب. */
export async function buildWelcomeImage(config: WelcomeImageConfig, member: GuildMember): Promise<Buffer> {
  const background = await fetchBuffer(config.backgroundUrl);
  const meta = await sharp(background).metadata();
  const width = meta.width ?? 1024;
  const height = meta.height ?? 576;

  const composites: { input: Buffer; left: number; top: number }[] = [];

  const avatarCfg = config.avatar ?? {};
  const radiusPct = avatarCfg.radiusPct ?? 0.18;
  const avatarSize = Math.max(16, Math.round(width * radiusPct * 2));
  const avatarUrl = member.displayAvatarURL({ extension: "png", size: 512 });
  const avatar = await circularAvatar(avatarUrl, avatarSize);
  const ax = Math.round(width * (avatarCfg.xPct ?? 0.5) - avatarSize / 2);
  const ay = Math.round(height * (avatarCfg.yPct ?? 0.5) - avatarSize / 2);
  composites.push({ input: avatar, left: ax, top: ay });

  const textCfg = config.text;
  if (textCfg) {
    const fontSize = Math.max(10, Math.round(width * (textCfg.fontSizePct ?? 0.05)));
    const color = textCfg.color ?? "#ffffff";
    const tx = Math.round(width * (textCfg.xPct ?? 0.5));
    const ty = Math.round(height * (textCfg.yPct ?? 0.85));
    const svgText = `<svg width="${width}" height="${height}"><text x="${tx}" y="${ty}" font-size="${fontSize}" fill="${color}" text-anchor="middle" font-family="sans-serif" font-weight="bold">${escapeXml(member.user.username)}</text></svg>`;
    composites.push({ input: Buffer.from(svgText), left: 0, top: 0 });
  }

  return sharp(background).composite(composites).png().toBuffer();
}
