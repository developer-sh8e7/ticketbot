// ══════════════════════════════════════════════════════════════
//  Opus System Bot — Permission Helpers
// ══════════════════════════════════════════════════════════════

import { GuildMember, PermissionFlagsBits, ChatInputCommandInteraction } from "discord.js";
import { Config } from "../config";
import { errorEmbed } from "./embed";

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
    member.permissions.has(PermissionFlagsBits.ModerateMembers) ||
    member.permissions.has(PermissionFlagsBits.BanMembers) ||
    isAdmin(member)
  );
}

/** Standard "no permission" reply */
export async function noPermission(interaction: ChatInputCommandInteraction) {
  return interaction.reply({
    embeds: [errorEmbed("No Permission", "You don't have permission to use this command.")],
    ephemeral: true,
  });
}
