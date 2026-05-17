// ══════════════════════════════════════════════════════════════
//  Opus System Bot — Configuration
// ══════════════════════════════════════════════════════════════

import dotenv from "dotenv";
dotenv.config();

function env(key: string, fallback?: string): string {
  const value = process.env[key] ?? (key === "BOT_TOKEN" ? process.env["TOKEN"] : undefined) ?? fallback;
  if (!value) throw new Error(`⛔ Missing environment variable: ${key}`);
  return value;
}

function envOptional(key: string, fallback?: string): string | undefined {
  return process.env[key] ?? fallback;
}

export const Config = {
  /** Discord bot token */
  token: env("BOT_TOKEN"),

  /** Application / Client ID */
  clientId: env("CLIENT_ID"),

  /** Main guild for dev‑mode slash command registration */
  guildId: envOptional("GUILD_ID"),

  /** Bot owner Discord IDs (comma‑separated) */
  ownerIds: (process.env.OWNER_IDS || "").split(",").filter(Boolean),

  // ── Database ──────────────────────────────────────────────
  supabaseUrl: env("SUPABASE_URL"),
  supabaseKey: env("SUPABASE_KEY"),

  // ── Embed Defaults ────────────────────────────────────────
  embed: {
    color: parseInt(env("EMBED_COLOR", "5865F2"), 16),
    footer: env("FOOTER_TEXT", "Opus System Bot"),
    avatar: envOptional("BOT_AVATAR_URL"),
  },
} as const;
