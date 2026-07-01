// ══════════════════════════════════════════════════════════════
//  بطاقة بروفايل بصيغة صورة — تحاكي بروفايل Discord الحقيقي:
//  بنر فوق + أفاتار دائري متداخل مع الحافة + الاسم + شارات.
//  مبنية بـ @napi-rs/canvas مع خط مرفق (Tajawal) يدعم العربي
//  والإنجليزي — فالنص يظهر دائماً بشكل صحيح بلا مربّعات.
// ══════════════════════════════════════════════════════════════

import { fileURLToPath } from "node:url";
import { createCanvas, loadImage, GlobalFonts, type SKRSContext2D } from "@napi-rs/canvas";
import { User, GuildMember } from "discord.js";

// خط عربي/لاتيني مرفق داخل المشروع — يُسجَّل مرة واحدة عند التحميل.
function fontPath(file: string): string {
  return fileURLToPath(new URL(`../../../assets/fonts/${file}`, import.meta.url));
}
try {
  GlobalFonts.registerFromPath(fontPath("Tajawal-Bold.ttf"), "TajawalBold");
  GlobalFonts.registerFromPath(fontPath("Tajawal-Regular.ttf"), "TajawalReg");
} catch {
  /* في التطوير قد يختلف المسار — الرسم يكمل بخط النظام الاحتياطي */
}

const W = 720;
const H = 400;
const RADIUS = 24;
const BANNER_H = 168;
const PANEL = "#1e1f22";
const AVATAR = 148;
const RING = 8;
const AVATAR_X = 44;
const AVATAR_CY = BANNER_H; // مركز الأفاتار على خط انتهاء البنر (تداخل)

async function fetchImage(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`asset fetch ${res.status}: ${url}`);
  return loadImage(Buffer.from(await res.arrayBuffer()));
}

/** يرسم صورة بأسلوب cover داخل مستطيل مقصوص. */
function drawCover(ctx: SKRSContext2D, img: Awaited<ReturnType<typeof loadImage>>, x: number, y: number, w: number, h: number) {
  const scale = Math.max(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

/** الشارات العامة التي يكشفها Discord للبوتات. Nitro يُستدل عليه بالصورة المتحركة. */
function badgesFor(user: User): string[] {
  const flags = user.flags?.toArray() ?? [];
  const out: string[] = [];
  if (flags.includes("Staff")) out.push("Staff");
  if (flags.includes("Partner")) out.push("Partner");
  if (flags.includes("Hypesquad")) out.push("HypeSquad");
  if (flags.includes("HypeSquadOnlineHouse1")) out.push("Bravery");
  if (flags.includes("HypeSquadOnlineHouse2")) out.push("Brilliance");
  if (flags.includes("HypeSquadOnlineHouse3")) out.push("Balance");
  if (flags.includes("BugHunterLevel1") || flags.includes("BugHunterLevel2")) out.push("Bug Hunter");
  if (flags.includes("CertifiedModerator")) out.push("Mod");
  if (flags.includes("ActiveDeveloper")) out.push("Developer");
  if (flags.includes("VerifiedDeveloper")) out.push("Verified Dev");
  if (flags.includes("PremiumEarlySupporter")) out.push("Early Supporter");
  if (user.avatar?.startsWith("a_") || user.banner?.startsWith("a_")) out.push("Nitro");
  return out;
}

export async function buildProfileCard(user: User, member: GuildMember | null): Promise<Buffer> {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  // ── لوحة البطاقة بحواف دائرية ──
  ctx.beginPath();
  ctx.roundRect(0, 0, W, H, RADIUS);
  ctx.fillStyle = PANEL;
  ctx.fill();
  ctx.save();
  ctx.clip(); // كل ما يُرسم بعده يبقى داخل الحواف الدائرية

  // ── البنر ──
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, BANNER_H);
  ctx.clip();
  if (user.banner) {
    try {
      const banner = await fetchImage(user.bannerURL({ extension: "png", size: 1024 })!);
      drawCover(ctx, banner, 0, 0, W, BANNER_H);
    } catch {
      paintGradientBanner(ctx, user);
    }
  } else {
    paintGradientBanner(ctx, user);
  }
  ctx.restore();

  // ── حلقة الأفاتار (بلون اللوحة لتفصله عن البنر) ثم الأفاتار الدائري ──
  ctx.beginPath();
  ctx.arc(AVATAR_X + AVATAR / 2, AVATAR_CY, AVATAR / 2 + RING, 0, Math.PI * 2);
  ctx.fillStyle = PANEL;
  ctx.fill();

  try {
    const avatar = await fetchImage(user.displayAvatarURL({ extension: "png", size: 256 }));
    ctx.save();
    ctx.beginPath();
    ctx.arc(AVATAR_X + AVATAR / 2, AVATAR_CY, AVATAR / 2, 0, Math.PI * 2);
    ctx.clip();
    drawCover(ctx, avatar, AVATAR_X, AVATAR_CY - AVATAR / 2, AVATAR, AVATAR);
    ctx.restore();
  } catch {
    /* لو فشل تحميل الأفاتار نترك الحلقة فقط */
  }

  // ── الاسم + المعرّف ──
  const displayName = member?.nickname ?? user.globalName ?? user.username;
  const nameY = AVATAR_CY + AVATAR / 2 + 24;

  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#f2f3f5";
  ctx.font = "34px TajawalBold";
  ctx.fillText(truncate(ctx, displayName, W - AVATAR_X * 2), AVATAR_X, nameY + 30);

  ctx.fillStyle = "#b5bac1";
  ctx.font = "18px TajawalReg";
  ctx.fillText(`@${user.username}`, AVATAR_X, nameY + 58);

  // ── الشارات ──
  const badges = badgesFor(user);
  if (badges.length) drawBadges(ctx, badges, AVATAR_X, nameY + 78);

  ctx.restore();
  return canvas.toBuffer("image/png");
}

function paintGradientBanner(ctx: SKRSContext2D, user: User) {
  const accent = user.accentColor ? `#${user.accentColor.toString(16).padStart(6, "0")}` : "#5865f2";
  const g = ctx.createLinearGradient(0, 0, W, BANNER_H);
  g.addColorStop(0, accent);
  g.addColorStop(1, "#232428");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, BANNER_H);
}

function drawBadges(ctx: SKRSContext2D, badges: string[], startX: number, y: number) {
  const h = 30;
  let x = startX;
  ctx.font = "14px TajawalBold";
  for (const label of badges) {
    const w = Math.ceil(ctx.measureText(label).width) + 26;
    if (x + w > W - 24) break; // ما نتجاوز حافة البطاقة
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 15);
    ctx.fillStyle = "#2b2d31";
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#3f4147";
    ctx.stroke();
    ctx.fillStyle = "#dbdee1";
    ctx.textBaseline = "middle";
    ctx.fillText(label, x + 13, y + h / 2 + 1);
    ctx.textBaseline = "alphabetic";
    x += w + 8;
  }
}

function truncate(ctx: SKRSContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(s + "…").width > maxWidth) s = s.slice(0, -1);
  return s + "…";
}
