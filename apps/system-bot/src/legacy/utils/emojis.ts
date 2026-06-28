// ══════════════════════════════════════════════════════════════
//  Opus System Bot V2 — Application Emoji Registry
//  Uses Discord Application Emojis (uploaded via Developer Portal)
//  Bot can use these anywhere without adding to any server
// ══════════════════════════════════════════════════════════════

/**
 * Application Emoji Registry
 * 
 * HOW IT WORKS:
 * Discord allows bots to own up to 2,000 custom emojis via the Developer Portal.
 * These are called "Application Emojis" — the bot can use them in any server
 * without adding them to that server. This is how Rythm and ProBot do it.
 * 
 * HOW TO SET UP:
 * 1. Go to https://discord.com/developers/applications
 * 2. Select your bot application
 * 3. Click the "Emojis" tab in the sidebar
 * 4. Upload each emoji with the exact name listed below
 * 5. Copy each emoji's ID and paste it in this file
 * 
 * OR: Run the uploadEmojis.ts script to auto-upload them via the API.
 * 
 * FORMAT: <:name:id> for static, <a:name:id> for animated
 * If an emoji ID is not set (empty string), the bot will use the name as fallback text.
 */

// ── Emoji ID Configuration ──────────────────────────────────
// Replace "0" with actual emoji IDs after uploading to Developer Portal
const EMOJI_IDS: Record<string, string> = {
  // Status
  opus_success: "0",
  opus_error: "0",
  opus_warning: "0",
  opus_info: "0",

  // Moderation
  opus_ban: "0",
  opus_kick: "0",
  opus_timeout: "0",
  opus_warn: "0",
  opus_shield: "0",
  opus_filter: "0",

  // General
  opus_welcome: "0",
  opus_leave: "0",
  opus_voice: "0",
  opus_logs: "0",
  opus_settings: "0",

  // Economy & Levels
  opus_credits: "0",
  opus_xp: "0",
  opus_rank: "0",
  opus_daily: "0",
  opus_rep: "0",

  // Fun
  opus_dice: "0",
  opus_coin: "0",

  // Info
  opus_ping: "0",
  opus_help: "0",
  opus_avatar: "0",
  opus_profile: "0",

  // Actions
  opus_role: "0",
  opus_lock: "0",
  opus_unlock: "0",
  opus_nuke: "0",
  opus_clear: "0",
  opus_slowmode: "0",

  // Status indicators
  opus_online: "0",
  opus_idle: "0",
  opus_dnd: "0",

  // Logs
  opus_delete: "0",
  opus_edit: "0",
  opus_link: "0",
  opus_spam: "0",
  opus_arrow: "0",

  // Special
  opus_antiraid: "0",
  opus_antilinks: "0",
  opus_antispam: "0",
  opus_antibots: "0",
  opus_antiswear: "0",
  opus_embed: "0",
  opus_autorole: "0",
  opus_server: "0",
  opus_user: "0",
  opus_hide: "0",
  opus_show: "0",
};

// ── Emoji Builder Function ──────────────────────────────────

/**
 * Get an Application Emoji reference string.
 * If the emoji ID is not configured (still "0"), returns the name as fallback.
 */
function e(name: string): string {
  const id = EMOJI_IDS[name];
  if (!id || id === "0") {
    // Fallback: return the name in a readable format
    // This makes the bot functional even before emojis are uploaded
    return `**[${name.replace("opus_", "").toUpperCase()}]**`;
  }
  return `<:${name}:${id}>`;
}

/**
 * Get an animated Application Emoji reference string.
 */
function ae(name: string): string {
  const id = EMOJI_IDS[name];
  if (!id || id === "0") {
    return `**[${name.replace("opus_", "").toUpperCase()}]**`;
  }
  return `<a:${name}:${id}>`;
}

// ── Exported Emoji Constants ────────────────────────────────

export const Emojis = {
  // Status
  success: e("opus_success"),
  error: e("opus_error"),
  warning: e("opus_warning"),
  info: e("opus_info"),

  // Moderation
  ban: e("opus_ban"),
  kick: e("opus_kick"),
  timeout: e("opus_timeout"),
  warn: e("opus_warn"),
  shield: e("opus_shield"),
  filter: e("opus_filter"),

  // General
  welcome: e("opus_welcome"),
  leave: e("opus_leave"),
  voice: e("opus_voice"),
  logs: e("opus_logs"),
  settings: e("opus_settings"),

  // Economy & Levels
  credits: e("opus_credits"),
  xp: e("opus_xp"),
  rank: e("opus_rank"),
  daily: e("opus_daily"),
  rep: e("opus_rep"),

  // Fun
  dice: e("opus_dice"),
  coin: e("opus_coin"),

  // Info
  ping: e("opus_ping"),
  help: e("opus_help"),
  avatar: e("opus_avatar"),
  profile: e("opus_profile"),

  // Actions
  role: e("opus_role"),
  lock: e("opus_lock"),
  unlock: e("opus_unlock"),
  nuke: e("opus_nuke"),
  clear: e("opus_clear"),
  slowmode: e("opus_slowmode"),

  // Status indicators
  online: e("opus_online"),
  idle: e("opus_idle"),
  dnd: e("opus_dnd"),

  // Logs
  delete: e("opus_delete"),
  edit: e("opus_edit"),
  link: e("opus_link"),
  spam: e("opus_spam"),
  arrow: e("opus_arrow"),

  // Protection
  antiraid: e("opus_antiraid"),
  antilinks: e("opus_antilinks"),
  antispam: e("opus_antispam"),
  antibots: e("opus_antibots"),
  antiswear: e("opus_antiswear"),

  // Special
  embed: e("opus_embed"),
  autorole: e("opus_autorole"),
  server: e("opus_server"),
  user: e("opus_user"),
  hide: e("opus_hide"),
  show: e("opus_show"),
};

// ── Emoji Upload Guide ──────────────────────────────────────

export const EMOJI_UPLOAD_GUIDE = `
╔══════════════════════════════════════════════════════════════╗
║  Opus System Bot V2 — Emoji Upload Guide                    ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  1. Go to: https://discord.com/developers/applications       ║
║  2. Select your bot application                              ║
║  3. Click "Emojis" in the sidebar                            ║
║  4. Upload each emoji with the exact name listed below       ║
║  5. After uploading, copy each emoji ID                      ║
║  6. Paste the IDs in src/utils/emojis.ts (EMOJI_IDS object) ║
║                                                              ║
║  You can find emojis at:                                     ║
║  - https://emoji.gg (search for each type)                   ║
║  - Use dark/grey themed emojis for consistency               ║
║                                                              ║
║  Required emojis (${Object.keys(EMOJI_IDS).length} total):                              ║
${Object.keys(EMOJI_IDS).map(name => `║  - ${name.padEnd(54)}║`).join("\n")}
║                                                              ║
║  TIP: Search emoji.gg for keywords like:                     ║
║  "checkmark", "cross", "warning", "ban", "shield",          ║
║  "coin", "star", "trophy", "dice", "lock", "mute"           ║
║  Choose dark/grey themed emojis for a premium look.          ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`;
