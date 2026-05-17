// ══════════════════════════════════════════════════════════════
//  /unban — Unban a user from the server
//  V2 — Application Emojis, no Unicode emojis
// ══════════════════════════════════════════════════════════════

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  GuildMember,
} from "discord.js";
import { Command } from "../../types";
import { errorEmbed, successEmbed, modEmbed } from "../../utils/embed";
import { isModerator, noPermission } from "../../utils/permissions";
import { getGuildConfig } from "../../db/guilds";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("unban")
    .setDescription("Unban a user from the server")
    .addStringOption((o) =>
      o.setName("userid").setDescription("The user ID to unban").setRequired(true),
    )
    .addStringOption((o) => o.setName("reason").setDescription("Reason for the unban"))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  async execute(interaction: ChatInputCommandInteraction) {
    const member = interaction.member as GuildMember;
    const allowedUnbanRoles = [
      "1483212264025886886",
      "1483021277181644842",
      "1483020976966074479",
      "1482858415469367336",
      "1483038264393990164"
    ];
    const hasRole = member.roles.cache.some((role) => allowedUnbanRoles.includes(role.id)) ||
                    member.id === interaction.guild?.ownerId;
    if (!hasRole) return noPermission(interaction);

    const userId = interaction.options.getString("userid", true);
    const reason = interaction.options.getString("reason") ?? "No reason provided";

    try {
      const bannedUser = await interaction.guild?.bans.fetch(userId);
      if (!bannedUser) {
        return interaction.reply({
          embeds: [errorEmbed("Not Found", "This user is not banned.")],
          ephemeral: true,
        });
      }

      await interaction.guild?.members.unban(userId, `${reason} | By: ${interaction.user.tag}`);

      await interaction.reply({
        embeds: [
          successEmbed(
            "Member Unbanned",
            `**User:** ${bannedUser.user.tag} (\`${userId}\`)\n**Reason:** ${reason}`,
          ).setThumbnail(bannedUser.user.displayAvatarURL()),
        ],
      });

      const dbConfig = await getGuildConfig(interaction.guildId!);
      const logsChannel = interaction.guild?.channels.cache.get(dbConfig.channels.logs_channel ?? "");
      if (logsChannel?.isTextBased()) {
        await logsChannel.send({
          embeds: [
            modEmbed(
              "Member Unbanned",
              `**User:** ${bannedUser.user.tag} (\`${userId}\`)\n**Moderator:** ${interaction.user.tag}\n**Reason:** ${reason}`,
            ).setThumbnail(bannedUser.user.displayAvatarURL()),
          ],
        });
      }
    } catch {
      await interaction.reply({
        embeds: [errorEmbed("Unban Failed", "Could not unban. Make sure the user ID is correct.")],
        ephemeral: true,
      });
    }
  },
};

export default command;
