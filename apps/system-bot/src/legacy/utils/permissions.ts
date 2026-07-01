// ══════════════════════════════════════════════════════════════
//  Opus System Bot — Permission Helpers
// ══════════════════════════════════════════════════════════════

import { GuildMember, PermissionFlagsBits, ChatInputCommandInteraction, PermissionsBitField } from "discord.js";
import { Config } from "../config.js";
import { errorEmbed } from "./embed.js";
import { getCommandSetting, memberMatchesCustomAccess, type SystemCommandName } from "../services/commandSettings.js";

/** Check if a user is a bot owner */
export function isOwner(userId: string): boolean {
  return Config.ownerIds.includes(userId);
}

/** Check if member has admin perms */
export function isAdmin(member: GuildMember): boolean {
  return member.permissions.has(PermissionFlagsBits.Administrator) || isOwner(member.id);
}

/** Check if member has mod perms */
export function isModerator(member: GuildMember): boolean {
  return (
    member.permissions.has(PermissionFlagsBits.Administrator) ||
    member.permissions.has(PermissionFlagsBits.BanMembers) ||
    member.permissions.has(PermissionFlagsBits.KickMembers) ||
    member.permissions.has(PermissionFlagsBits.ModerateMembers) ||
    member.permissions.has(PermissionFlagsBits.ManageMessages) ||
    member.permissions.has(PermissionFlagsBits.ManageChannels) ||
    member.permissions.has(PermissionFlagsBits.ManageRoles) ||
    isOwner(member.id)
  );
}

const DEFAULT_COMMAND_PERMISSIONS: Record<SystemCommandName, bigint> = {
  ban: PermissionFlagsBits.BanMembers,
  softban: PermissionFlagsBits.BanMembers,
  kick: PermissionFlagsBits.KickMembers,
  timeout: PermissionFlagsBits.ModerateMembers,
  mute: PermissionFlagsBits.ModerateMembers,
  unmute: PermissionFlagsBits.ModerateMembers,
  warn: PermissionFlagsBits.ModerateMembers,
  warnings: PermissionFlagsBits.ModerateMembers,
  clearwarns: PermissionFlagsBits.ModerateMembers,
  clear: PermissionFlagsBits.ManageMessages,
  unban: PermissionFlagsBits.BanMembers,
  slowmode: PermissionFlagsBits.ManageChannels,
  lock: PermissionFlagsBits.ManageChannels,
  unlock: PermissionFlagsBits.ManageChannels,
  nuke: PermissionFlagsBits.Administrator,
  role: PermissionFlagsBits.ManageRoles,
  nick: PermissionFlagsBits.ManageNicknames,
  hide: PermissionFlagsBits.ManageChannels,
  show: PermissionFlagsBits.ManageChannels,
};

function permissionName(permission: bigint): string {
  return PermissionsBitField.Flags.Administrator === permission ? "Administrator" : new PermissionsBitField(permission).toArray()[0] ?? "required permission";
}

/** Standard "no permission" reply */
export async function noPermission(interaction: ChatInputCommandInteraction, message = "ما عندك صلاحية استخدام هذا الأمر.") {
  return interaction.reply({
    embeds: [errorEmbed("No Permission", message)],
    ephemeral: true,
  });
}

/** Dashboard-aware command permission check. Admin/owner always bypasses to prevent lockout. */
export async function requireCommandAccess(interaction: ChatInputCommandInteraction, commandName: SystemCommandName): Promise<boolean> {
  if (!interaction.guildId || !interaction.member || !(interaction.member instanceof GuildMember)) {
    await noPermission(interaction, "هذا الأمر يعمل داخل السيرفر فقط.");
    return false;
  }

  const member = interaction.member;
  const setting = await getCommandSetting(interaction.guildId, commandName);
  if (!setting.enabled) {
    await noPermission(interaction, "هذا الأمر مقفّل من لوحة تحكم السيستم.");
    return false;
  }

  if (isAdmin(member)) return true;

  const hasCustomAllowlist = setting.allowedRoleIds.length > 0 || setting.allowedUserIds.length > 0;
  if (hasCustomAllowlist) {
    if (memberMatchesCustomAccess(member, setting)) return true;
    await noPermission(interaction, "هذا الأمر مسموح فقط لرتب/أشخاص محددين من لوحة السيستم.");
    return false;
  }

  const required = DEFAULT_COMMAND_PERMISSIONS[commandName];
  if (member.permissions.has(required)) return true;

  await noPermission(interaction, `تحتاج صلاحية Discord: **${permissionName(required)}** أو أضف رتبتك/حسابك من لوحة السيستم.`);
  return false;
}
