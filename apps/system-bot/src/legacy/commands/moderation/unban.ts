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
import { Command } from "../../types.js";
import { errorEmbed, successEmbed, modEmbed } from "../../utils/embed.js";
import { isModerator, noPermission } from "../../utils/permissions.js";
import { getGuildConfig } from "../../db/guilds.js";

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
    if (!isModerator(member)) return noPermission(interaction);

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
