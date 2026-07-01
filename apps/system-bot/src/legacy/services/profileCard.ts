// ══════════════════════════════════════════════════════════════
//  بطاقة بروفايل بصيغة صورة — تحاكي بروفايل Discord الحقيقي بأقصى
//  ما تسمح به واجهة البوتات: بنر + أفاتار دائري بنقطة حالة +
//  حالة مخصّصة + الاسم + شارات + تواريخ + الرولات.
//
//  ملاحظة: البايو (About Me)، الـ Pronouns، والأصدقاء المشتركون
//  لا تكشفها Discord للبوتات إطلاقاً، فلا يمكن عرضها.
// ══════════════════════════════════════════════════════════════

import { fileURLToPath } from "node:url";
import { createCanvas, loadImage, GlobalFonts, type SKRSContext2D } from "@napi-rs/canvas";
import { User, GuildMember, ActivityType } from "discord.js";

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
const H = 500;
const RADIUS = 24;
const BANNER_H = 168;
const PANEL = "#1e1f22";
const AVATAR = 148;
const RING = 8;
const AVATAR_X = 44;
const AVATAR_CY = BANNER_H;
const CX0 = AVATAR_X + AVATAR / 2;

const STATUS_COLORS: Record<string, string> = {
  online: "#23a55a",
  idle: "#f0b232",
  dnd: "#f23f43",
  offline: "#80848e",
  invisible: "#80848e",
};

async function fetchImage(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`asset fetch ${res.status}: ${url}`);
  return loadImage(Buffer.from(await res.arrayBuffer()));
}

function drawCover(ctx: SKRSContext2D, img: Awaited<ReturnType<typeof loadImage>>, x: number, y: number, w: number, h: number) {
  const scale = Math.max(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

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

function fmtDate(ts?: number | null): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}

function customStatus(member: GuildMember | null): string | null {
  const act = member?.presence?.activities?.find((a) => a.type === ActivityType.Custom);
  const text = act?.state?.trim();
  return text && text.length ? text : null;
}

export async function buildProfileCard(user: User, member: GuildMember | null): Promise<Buffer> {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  ctx.beginPath();
  ctx.roundRect(0, 0, W, H, RADIUS);
  ctx.fillStyle = PANEL;
  ctx.fill();
  ctx.save();
  ctx.clip();

  // ── البنر ──
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, BANNER_H);
  ctx.clip();
  let bannerDrawn = false;
  if (user.banner) {
    try {
      const banner = await fetchImage(user.bannerURL({ extension: "png", size: 1024 })!);
      drawCover(ctx, banner, 0, 0, W, BANNER_H);
      bannerDrawn = true;
    } catch {
      /* fallthrough to gradient */
    }
  }
  if (!bannerDrawn) paintGradientBanner(ctx, user);
  ctx.restore();

  // ── الحالة المخصّصة (فقاعة على البنر) ──
  const status = customStatus(member);
  if (status) drawStatusBubble(ctx, status);

  // ── حلقة الأفاتار + الأفاتار الدائري ──
  ctx.beginPath();
  ctx.arc(CX0, AVATAR_CY, AVATAR / 2 + RING, 0, Math.PI * 2);
  ctx.fillStyle = PANEL;
  ctx.fill();
  try {
    const avatar = await fetchImage(user.displayAvatarURL({ extension: "png", size: 256 }));
    ctx.save();
    ctx.beginPath();
    ctx.arc(CX0, AVATAR_CY, AVATAR / 2, 0, Math.PI * 2);
    ctx.clip();
    drawCover(ctx, avatar, AVATAR_X, AVATAR_CY - AVATAR / 2, AVATAR, AVATAR);
    ctx.restore();
  } catch {
    /* keep ring only */
  }

  // ── نقطة الحالة (متصل/مشغول/خامل) بقصّة كحلقة اللون ──
  const presence = member?.presence?.status;
  if (presence && STATUS_COLORS[presence]) {
    const r = AVATAR / 2;
    const dotR = 21;
    const dx = CX0 + r * Math.cos(Math.PI / 4);
    const dy = AVATAR_CY + r * Math.sin(Math.PI / 4);
    ctx.beginPath();
    ctx.arc(dx, dy, dotR + 6, 0, Math.PI * 2);
    ctx.fillStyle = PANEL;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(dx, dy, dotR, 0, Math.PI * 2);
    ctx.fillStyle = STATUS_COLORS[presence];
    ctx.fill();
    if (presence === "idle") {
      // قمر صغير للحالة الخاملة (قصّة دائرية)
      ctx.beginPath();
      ctx.arc(dx - 6, dy - 6, dotR * 0.75, 0, Math.PI * 2);
      ctx.fillStyle = PANEL;
      ctx.fill();
    } else if (presence === "dnd") {
      ctx.beginPath();
      ctx.roundRect(dx - dotR * 0.55, dy - 4, dotR * 1.1, 8, 4);
      ctx.fillStyle = PANEL;
      ctx.fill();
    }
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

  const badges = badgesFor(user);
  let cursorY = nameY + 78;
  if (badges.length) {
    drawBadges(ctx, badges, AVATAR_X, cursorY);
    cursorY += 42;
  }

  // ── لوحة المعلومات السفلية (تواريخ + رولات) ──
  const panelX = AVATAR_X;
  const panelW = W - AVATAR_X * 2;
  const panelY = Math.max(cursorY + 4, H - 120);
  ctx.beginPath();
  ctx.roundRect(panelX, panelY, panelW, H - panelY - 24, 16);
  ctx.fillStyle = "#111214";
  ctx.fill();

  const px = panelX + 20;
  // صف التواريخ (عمودان)
  ctx.font = "13px TajawalReg";
  ctx.fillStyle = "#949ba4";
  ctx.fillText("Member Since", px, panelY + 28);
  ctx.fillText("Joined Server", px + panelW / 2, panelY + 28);
  ctx.font = "16px TajawalBold";
  ctx.fillStyle = "#dbdee1";
  ctx.fillText(fmtDate(user.createdTimestamp), px, panelY + 50);
  ctx.fillText(fmtDate(member?.joinedTimestamp), px + panelW / 2, panelY + 50);

  // صف الرولات
  const roles = member
    ? [...member.roles.cache.values()]
        .filter((role) => role.id !== member.guild.id)
        .sort((a, b) => b.position - a.position)
        .slice(0, 6)
    : [];
  if (roles.length) {
    let rx = px;
    const ry = panelY + 68;
    ctx.font = "13px TajawalBold";
    for (const role of roles) {
      const label = role.name;
      const w = Math.ceil(ctx.measureText(label).width) + 30;
      if (rx + w > panelX + panelW - 16) break;
      ctx.beginPath();
      ctx.roundRect(rx, ry, w, 26, 13);
      ctx.fillStyle = "#2b2d31";
      ctx.fill();
      const color = role.color ? `#${role.color.toString(16).padStart(6, "0")}` : "#c9cdd4";
      ctx.beginPath();
      ctx.arc(rx + 13, ry + 13, 5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.fillStyle = "#dbdee1";
      ctx.textBaseline = "middle";
      ctx.fillText(label, rx + 24, ry + 14);
      ctx.textBaseline = "alphabetic";
      rx += w + 8;
    }
  }

  ctx.restore();
  return canvas.toBuffer("image/png");
}

function paintGradientBanner(ctx: SKRSContext2D, user: User) {
  const accent = user.accentColor ? `#${user.accentColor.toString(16).padStart(6, "0")}` : "#4e5058";
  const g = ctx.createLinearGradient(0, 0, W, BANNER_H);
  g.addColorStop(0, accent);
  g.addColorStop(1, "#232428");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, BANNER_H);
}

function drawStatusBubble(ctx: SKRSContext2D, text: string) {
  ctx.font = "16px TajawalReg";
  const clean = text.length > 40 ? text.slice(0, 39) + "…" : text;
  const w = Math.ceil(ctx.measureText(clean).width) + 28;
  const h = 38;
  const x = AVATAR_X + AVATAR + 24;
  const y = BANNER_H - 64;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 12);
  ctx.fillStyle = "rgba(30,31,34,0.92)";
  ctx.fill();
  ctx.fillStyle = "#dbdee1";
  ctx.textBaseline = "middle";
  ctx.fillText(clean, x + 14, y + h / 2 + 1);
  ctx.textBaseline = "alphabetic";
}

function drawBadges(ctx: SKRSContext2D, badges: string[], startX: number, y: number) {
  const h = 30;
  let x = startX;
  ctx.font = "14px TajawalBold";
  for (const label of badges) {
    const w = Math.ceil(ctx.measureText(label).width) + 26;
    if (x + w > W - 24) break;
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
