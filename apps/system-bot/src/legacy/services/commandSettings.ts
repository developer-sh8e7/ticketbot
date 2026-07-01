import { GuildMember } from "discord.js";
import { supabase } from "../db/supabase.js";
import { Logger } from "../utils/logger.js";

export const SYSTEM_COMMAND_NAMES = [
  "ban",
  "softban",
  "kick",
  "timeout",
  "mute",
  "unmute",
  "warn",
  "warnings",
  "clearwarns",
  "clear",
  "unban",
  "slowmode",
  "lock",
  "unlock",
  "nuke",
  "role",
  "nick",
  "hide",
  "show",
] as const;

export type SystemCommandName = (typeof SYSTEM_COMMAND_NAMES)[number];

export type CommandAccessSetting = {
  commandName: SystemCommandName;
  enabled: boolean;
  allowedRoleIds: string[];
  allowedUserIds: string[];
};

const SETTINGS_TTL_MS = 60_000;
const settingsCache = new Map<string, { settings: Map<string, CommandAccessSetting>; expiresAt: number }>();

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((v) => String(v)).filter(Boolean) : [];
}

function defaultSetting(commandName: SystemCommandName): CommandAccessSetting {
  return { commandName, enabled: true, allowedRoleIds: [], allowedUserIds: [] };
}

export function isSystemCommandName(value: string): value is SystemCommandName {
  return (SYSTEM_COMMAND_NAMES as readonly string[]).includes(value);
}

export async function getGuildCommandSettings(guildId: string): Promise<Map<string, CommandAccessSetting>> {
  const cached = settingsCache.get(guildId);
  if (cached && cached.expiresAt > Date.now()) return cached.settings;

  const settings = new Map<string, CommandAccessSetting>();
  for (const name of SYSTEM_COMMAND_NAMES) settings.set(name, defaultSetting(name));

  try {
    const { data, error } = await supabase
      .from("guild_command_settings")
      .select("command_name,enabled,allowed_role_ids,allowed_user_ids")
      .eq("guild_id", guildId);
    if (error) throw error;

    for (const row of data ?? []) {
      const commandName = String(row.command_name ?? "");
      if (!isSystemCommandName(commandName)) continue;
      settings.set(commandName, {
        commandName,
        enabled: row.enabled !== false,
        allowedRoleIds: asStringArray(row.allowed_role_ids),
        allowedUserIds: asStringArray(row.allowed_user_ids),
      });
    }
  } catch (err) {
    Logger.error(`Failed to load command settings for guild ${guildId}: ${err}`);
  }

  settingsCache.set(guildId, { settings, expiresAt: Date.now() + SETTINGS_TTL_MS });
  return settings;
}

export async function getCommandSetting(guildId: string, commandName: SystemCommandName): Promise<CommandAccessSetting> {
  return (await getGuildCommandSettings(guildId)).get(commandName) ?? defaultSetting(commandName);
}

export function memberMatchesCustomAccess(member: GuildMember, setting: CommandAccessSetting): boolean {
  if (setting.allowedUserIds.includes(member.id)) return true;
  // Never treat @everyone (guild id) as a custom allow role for dangerous commands.
  if (setting.allowedRoleIds.some((roleId) => roleId !== member.guild.id && member.roles.cache.has(roleId))) return true;
  return false;
}

export function clearCommandSettingsCache(guildId: string) {
  settingsCache.delete(guildId);
}
