// ══════════════════════════════════════════════════════════════
//  Guild Configuration Handler with Caching
// ══════════════════════════════════════════════════════════════

import { supabase } from "./supabase.js";
import { Logger } from "../utils/logger.js";
import { Config } from "../config.js";

export interface GuildSettings {
  id: string;
  prefix: string;
  language: string;
  embed_color: string;
}

export interface GuildChannels {
  welcome_channel: string | null;
  leave_channel: string | null;
  logs_channel: string | null;
  message_logs_channel: string | null;
  voice_logs_channel: string | null;
  join_leave_logs_channel: string | null;
}

export interface GuildRoles {
  auto_role: string | null;
  mute_role: string | null;
  mod_role: string | null;
  admin_role: string | null;
}

export interface GuildModules {
  welcome_enabled: boolean;
  leave_enabled: boolean;
  logging_enabled: boolean;
  antiraid_enabled: boolean;
  automod_enabled: boolean;
  antilinks_enabled: boolean;
  antispam_enabled: boolean;
  antibots_enabled: boolean;
  antiswear_enabled: boolean;
}

export interface FullGuildConfig {
  settings: GuildSettings;
  channels: GuildChannels;
  roles: GuildRoles;
  modules: GuildModules;
}

// Memory Cache
const cache = new Map<string, FullGuildConfig>();

// Default settings if database fails or row is missing
const defaultSettings: GuildSettings = { id: "", prefix: "!", language: "en", embed_color: Config.embed.color.toString(16) };
const defaultChannels: GuildChannels = { welcome_channel: null, leave_channel: null, logs_channel: null, message_logs_channel: null, voice_logs_channel: null, join_leave_logs_channel: null };
const defaultRoles: GuildRoles = { auto_role: null, mute_role: null, mod_role: null, admin_role: null };
const defaultModules: GuildModules = { welcome_enabled: true, leave_enabled: true, logging_enabled: true, antiraid_enabled: false, automod_enabled: false, antilinks_enabled: false, antispam_enabled: false, antibots_enabled: false, antiswear_enabled: false };

/**
 * Ensures the guild exists in the database.
 */
async function ensureGuild(guildId: string, ownerId: string = "unknown") {
  const guildRow: { id: string; owner_discord_user_id?: string } = { id: guildId };
  if (ownerId !== "unknown") guildRow.owner_discord_user_id = ownerId;

  const { error: guildError } = await supabase
    .from("guilds")
    .upsert(guildRow, { onConflict: "id" });
  if (guildError) throw guildError;

  const [channelsRes, rolesRes, modulesRes] = await Promise.all([
    supabase.from("guild_channels").upsert({ guild_id: guildId }, { onConflict: "guild_id" }),
    supabase.from("guild_roles").upsert({ guild_id: guildId }, { onConflict: "guild_id" }),
    supabase.from("guild_modules").upsert({ guild_id: guildId }, { onConflict: "guild_id" }),
  ]);

  const error = channelsRes.error ?? rolesRes.error ?? modulesRes.error;
  if (error) throw error;
}

/**
 * Fetch a guild's entire configuration (with cache).
 */
export async function getGuildConfig(guildId: string): Promise<FullGuildConfig> {
  if (cache.has(guildId)) {
    return cache.get(guildId)!;
  }

  try {
    await ensureGuild(guildId);

    const [settingsRes, channelsRes, rolesRes, modulesRes] = await Promise.all([
      supabase.from("guilds").select("*").eq("id", guildId).single(),
      supabase.from("guild_channels").select("*").eq("guild_id", guildId).single(),
      supabase.from("guild_roles").select("*").eq("guild_id", guildId).single(),
      supabase.from("guild_modules").select("*").eq("guild_id", guildId).single(),
    ]);

    const config: FullGuildConfig = {
      settings: settingsRes.data || { ...defaultSettings, id: guildId },
      channels: channelsRes.data || defaultChannels,
      roles: rolesRes.data || defaultRoles,
      modules: modulesRes.data || defaultModules,
    };

    cache.set(guildId, config);
    return config;
  } catch (err) {
    Logger.error(`Failed to fetch config for guild ${guildId}: ${err}`);
    return {
      settings: { ...defaultSettings, id: guildId },
      channels: defaultChannels,
      roles: defaultRoles,
      modules: defaultModules,
    };
  }
}

/**
 * Update a specific table for a guild and clear cache.
 */
export async function updateGuildSetting(
  guildId: string,
  table: "guilds" | "guild_channels" | "guild_roles" | "guild_modules",
  updates: any
) {
  // If updating standard tables, we usually update by guild_id
  const matchCol = table === "guilds" ? "id" : "guild_id";
  await ensureGuild(guildId);

  const { error } = await supabase.from(table).update(updates).eq(matchCol, guildId);
  if (error) {
    Logger.error(`Failed to update ${table} for guild ${guildId}: ${error.message}`);
    throw error;
  }

  // Invalidate cache
  cache.delete(guildId);
  return true;
}

/**
 * Clear the cache for a specific guild
 */
export function clearGuildCache(guildId: string) {
  cache.delete(guildId);
}
