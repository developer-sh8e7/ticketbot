// ══════════════════════════════════════════════════════════════
//  بطاقة بروفايل بصيغة صورة — تحاكي شكل بروفايل Discord الحقيقي:
//  بنر فوق + أفاتار دائري متداخل مع الحافة + شارات + الاسم.
//  تُستخدم من /avatar بدل الـ embed التقليدي.
// ══════════════════════════════════════════════════════════════

import sharp from "sharp";
import { User, GuildMember } from "discord.js";

const WIDTH = 700;
const HEIGHT = 380;
const BANNER_HEIGHT = 190;
const AVATAR_SIZE = 168;
const AVATAR_BORDER = 8;
const PANEL_BG = "#1e1f22";
const FALLBACK_BANNER = ["#3a3d44", "#232428"]; // تدرج محايد لمن ما عنده بنر

async function fetchBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch image asset (${res.status}): ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** يحوّل بايت اللمسات العامة (public flags) لشارات نصية مختصرة — Discord ما يعطي بوتات صورة الشارة الرسمية. */
function badgesFor(user: User): string[] {
  const flags = user.flags?.toArray() ?? [];
  const badges: string[] = [];
  if (flags.includes("Staff")) badges.push("Staff");
  if (flags.includes("Partner")) badges.push("Partner");
  if (flags.includes("Hypesquad")) badges.push("HypeSquad");
  if (flags.includes("BugHunterLevel1") || flags.includes("BugHunterLevel2")) badges.push("Bug Hunter");
  if (flags.includes("CertifiedModerator")) badges.push("Mod");
  if (flags.includes("ActiveDeveloper")) badges.push("Developer");
  if (flags.includes("PremiumEarlySupporter")) badges.push("Early Supporter");
  // Discord ما يكشف حالة Nitro مباشرة لبوت — الأفاتار/البنر المتحرك مؤشر عملي عليها.
  if (user.avatar?.startsWith("a_") || user.banner?.startsWith("a_")) badges.push("Nitro");
  return badges;
}

function badgesSvg(badges: string[], startX: number, y: number): string {
  if (badges.length === 0) return "";
  const chipH = 26;
  let x = startX;
  const chips = badges.map((label) => {
    const w = Math.max(50, label.length * 8 + 20);
    const chip = `<rect x="${x}" y="${y}" width="${w}" height="${chipH}" rx="13" fill="#2b2d31" stroke="#3f4147" stroke-width="1"/>` +
      `<text x="${x + w / 2}" y="${y + chipH / 2 + 5}" font-size="12" font-weight="700" fill="#dbdee1" text-anchor="middle" font-family="sans-serif">${escapeXml(label)}</text>`;
    x += w + 8;
    return chip;
  });
  return chips.join("");
}

export async function buildProfileCard(user: User, member: GuildMember | null): Promise<Buffer> {
  // ── البنر (خلفية علوية) ──
  let bannerLayer: Buffer;
  if (user.banner) {
    const bannerUrl = user.bannerURL({ extension: "png", size: 1024 })!;
    const raw = await fetchBuffer(bannerUrl);
    bannerLayer = await sharp(raw).resize(WIDTH, BANNER_HEIGHT, { fit: "cover" }).png().toBuffer();
  } else {
    const [c1, c2] = user.accentColor
      ? [`#${user.accentColor.toString(16).padStart(6, "0")}`, PANEL_BG]
      : FALLBACK_BANNER;
    const gradient = `<svg width="${WIDTH}" height="${BANNER_HEIGHT}">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/>
      </linearGradient></defs>
      <rect width="${WIDTH}" height="${BANNER_HEIGHT}" fill="url(#g)"/>
    </svg>`;
    bannerLayer = await sharp(Buffer.from(gradient)).png().toBuffer();
  }

  // ── لوحة أساسية (خلفية داكنة + البنر بالأعلى) ──
  const base = sharp({ create: { width: WIDTH, height: HEIGHT, channels: 4, background: PANEL_BG } });

  // ── الأفاتار الدائري متداخل مع الحافة (حلقة بلون الخلفية تفصله عن البنر) ──
  const avatarUrl = user.displayAvatarURL({ extension: "png", size: 256 });
  const avatarRaw = await fetchBuffer(avatarUrl);
  const ringSize = AVATAR_SIZE + AVATAR_BORDER * 2;
  const ringMask = Buffer.from(`<svg width="${ringSize}" height="${ringSize}"><circle cx="${ringSize / 2}" cy="${ringSize / 2}" r="${ringSize / 2}" fill="#fff"/></svg>`);
  const ring = await sharp({ create: { width: ringSize, height: ringSize, channels: 4, background: PANEL_BG } })
    .composite([{ input: ringMask, blend: "dest-in" }])
    .png()
    .toBuffer();

  const avatarMask = Buffer.from(`<svg width="${AVATAR_SIZE}" height="${AVATAR_SIZE}"><circle cx="${AVATAR_SIZE / 2}" cy="${AVATAR_SIZE / 2}" r="${AVATAR_SIZE / 2}" fill="#fff"/></svg>`);
  const avatarCircle = await sharp(avatarRaw)
    .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: "cover" })
    .composite([{ input: avatarMask, blend: "dest-in" }])
    .png()
    .toBuffer();

  const avatarLeft = 36;
  const avatarTop = BANNER_HEIGHT - ringSize / 2;

  // ── الاسم + الشارات ──
  const displayName = member?.nickname ?? user.globalName ?? user.username;
  const badges = badgesFor(user);
  const textY = avatarTop + ringSize + 44;
  const badgesY = textY + 20;

  const textSvg = `<svg width="${WIDTH}" height="${HEIGHT}">
    <text x="${avatarLeft}" y="${textY}" font-size="30" font-weight="800" fill="#f2f3f5" font-family="sans-serif">${escapeXml(displayName)}</text>
    <text x="${avatarLeft}" y="${textY + 26}" font-size="15" fill="#949ba4" font-family="sans-serif">@${escapeXml(user.username)}</text>
    ${badgesSvg(badges, avatarLeft, badgesY + 14)}
  </svg>`;

  const composed = await base
    .composite([
      { input: bannerLayer, left: 0, top: 0 },
      { input: ring, left: avatarLeft - AVATAR_BORDER, top: avatarTop },
      { input: avatarCircle, left: avatarLeft, top: avatarTop + AVATAR_BORDER },
      { input: Buffer.from(textSvg), left: 0, top: 0 },
    ])
    .png()
    .toBuffer();

  return composed;
}
