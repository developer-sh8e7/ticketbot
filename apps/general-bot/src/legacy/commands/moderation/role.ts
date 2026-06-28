// ══════════════════════════════════════════════════════════════
//  /role — Add or remove a role from a user
//  V2 — Application Emojis, no Unicode emojis
// ══════════════════════════════════════════════════════════════

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  GuildMember,
} from "discord.js";
import { Command } from "../../types";
import { errorEmbed, successEmbed } from "../../utils/embed";
import { isModerator, noPermission } from "../../utils/permissions";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("role")
    .setDescription("Add or remove a role from a member")
    .addUserOption((o) => o.setName("user").setDescription("The user to manage").setRequired(true))
    .addRoleOption((o) => o.setName("role").setDescription("The role to add or remove").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  async execute(interaction: ChatInputCommandInteraction) {
    const member = interaction.member as GuildMember;
    if (!isModerator(member)) return noPermission(interaction);

    const targetUser = interaction.options.getUser("user", true);
    const role = interaction.options.getRole("role", true);
    const targetMember = interaction.guild?.members.cache.get(targetUser.id);

    if (!targetMember) {
      return interaction.reply({
        embeds: [errorEmbed("Error", "Member not found in this server.")],
        ephemeral: true,
      });
    }

    // Role hierarchy check
    if (role.position >= member.roles.highest.position) {
      return interaction.reply({
        embeds: [errorEmbed("Permission Denied", "You cannot manage a role that is higher or equal to your highest role.")],
        ephemeral: true,
      });
    }

    if (role.position >= (interaction.guild?.members.me?.roles.highest.position ?? 0)) {
      return interaction.reply({
        embeds: [errorEmbed("Permission Denied", "I cannot manage a role that is higher or equal to my highest role.")],
        ephemeral: true,
      });
    }

    try {
      if (targetMember.roles.cache.has(role.id)) {
        await targetMember.roles.remove(role.id);
        return interaction.reply({
          embeds: [successEmbed("Role Removed", `Successfully removed the role ${role} from ${targetUser}.`)],
        });
      } else {
        await targetMember.roles.add(role.id);
        return interaction.reply({
          embeds: [successEmbed("Role Added", `Successfully added the role ${role} to ${targetUser}.`)],
        });
      }
    } catch (err) {
      return interaction.reply({
        embeds: [errorEmbed("Error", "Failed to update member roles.")],
        ephemeral: true,
      });
    }
  },
};

export default command;
