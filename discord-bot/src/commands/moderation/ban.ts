// ══════════════════════════════════════════════════════════════
//  /ban — Ban a member from the server
//  V2 — Application Emojis, no Unicode emojis
// ══════════════════════════════════════════════════════════════

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  GuildMember,
} from "discord.js";
import { Command } from "../../types";
import { modEmbed, errorEmbed, successEmbed } from "../../utils/embed";
import { Emojis } from "../../utils/emojis";
import { isModerator, noPermission } from "../../utils/permissions";
import { getGuildConfig } from "../../db/guilds";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Ban a member from the server")
    .addUserOption((o) => o.setName("user").setDescription("The user to ban").setRequired(true))
    .addStringOption((o) => o.setName("reason").setDescription("Reason for the ban"))
    .addIntegerOption((o) =>
      o
        .setName("days")
        .setDescription("Days of messages to delete (0-7)")
        .setMinValue(0)
        .setMaxValue(7),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  async execute(interaction: ChatInputCommandInteraction) {
    const member = interaction.member as GuildMember;
    const allowedBanRoles = [
      "1483212264025886886",
      "1483021277181644842",
      "1483020976966074479",
      "1482858415469367336",
      "1483038264393990164"
    ];
    const hasRole = member.roles.cache.some((role) => allowedBanRoles.includes(role.id)) ||
                    member.id === interaction.guild?.ownerId;
    if (!hasRole) return noPermission(interaction);

    const target = interaction.options.getUser("user", true);
    const reason = interaction.options.getString("reason") ?? "No reason provided";
    const days = interaction.options.getInteger("days") ?? 0;
    const targetMember = interaction.guild?.members.cache.get(target.id);

    // Hierarchy check
    if (targetMember && member.roles.highest.position <= targetMember.roles.highest.position) {
      return interaction.reply({
        embeds: [errorEmbed("Cannot Ban", "This user has a higher or equal role than you.")],
        ephemeral: true,
      });
    }

    try {
      // DM the user before banning
      try {
        await target.send({
          embeds: [
            modEmbed(
              "You have been banned",
              `**Server:** ${interaction.guild?.name}\n**Reason:** ${reason}\n**Moderator:** ${interaction.user.tag}`,
            ),
          ],
        });
      } catch {}

      await interaction.guild?.members.ban(target, {
        reason: `${reason} | By: ${interaction.user.tag}`,
        deleteMessageDays: days,
      });

      await interaction.reply({
        embeds: [
          successEmbed(
            "Member Banned",
            `**User:** ${target.tag} (\`${target.id}\`)\n**Reason:** ${reason}\n**Messages Deleted:** ${days} day(s)`,
          ).setThumbnail(target.displayAvatarURL()),
        ],
      });

      // Send to logs channel
      const dbConfig = await getGuildConfig(interaction.guildId!);
      const logsChannel = interaction.guild?.channels.cache.get(dbConfig.channels.logs_channel ?? "");
      if (logsChannel?.isTextBased()) {
        await logsChannel.send({
          embeds: [
            modEmbed(
              "Member Banned",
              `**User:** ${target.tag} (\`${target.id}\`)\n**Moderator:** ${interaction.user.tag}\n**Reason:** ${reason}`,
            ).setThumbnail(target.displayAvatarURL()),
          ],
        });
      }
    } catch {
      await interaction.reply({
        embeds: [errorEmbed("Ban Failed", "I couldn't ban this user. Check my permissions and role hierarchy.")],
        ephemeral: true,
      });
    }
  },
};

export default command;
