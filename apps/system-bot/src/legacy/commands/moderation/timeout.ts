// ══════════════════════════════════════════════════════════════
//  /timeout — Timeout (mute) a member
//  V2 — Application Emojis, no Unicode emojis
// ══════════════════════════════════════════════════════════════

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  GuildMember,
} from "discord.js";
import ms from "ms";
import { Command } from "../../types";
import { modEmbed, errorEmbed, successEmbed } from "../../utils/embed";
import { isModerator, noPermission } from "../../utils/permissions";
import { getGuildConfig } from "../../db/guilds";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("timeout")
    .setDescription("Timeout a member")
    .addUserOption((o) => o.setName("user").setDescription("The user to timeout").setRequired(true))
    .addStringOption((o) =>
      o.setName("duration").setDescription("Duration (e.g. 10m, 1h, 1d)").setRequired(true),
    )
    .addStringOption((o) => o.setName("reason").setDescription("Reason for the timeout"))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction: ChatInputCommandInteraction) {
    const member = interaction.member as GuildMember;
    if (!isModerator(member)) return noPermission(interaction);

    const target = interaction.options.getUser("user", true);
    const durationStr = interaction.options.getString("duration", true);
    const reason = interaction.options.getString("reason") ?? "No reason provided";
    const targetMember = interaction.guild?.members.cache.get(target.id);

    if (!targetMember) {
      return interaction.reply({
        embeds: [errorEmbed("Not Found", "This user is not in the server.")],
        ephemeral: true,
      });
    }

    const duration = ms(durationStr as ms.StringValue);
    if (!duration || duration < 5000 || duration > 28 * 24 * 60 * 60 * 1000) {
      return interaction.reply({
        embeds: [errorEmbed("Invalid Duration", "Duration must be between 5s and 28 days.\nExamples: `10m`, `1h`, `1d`")],
        ephemeral: true,
      });
    }

    if (member.roles.highest.position <= targetMember.roles.highest.position) {
      return interaction.reply({
        embeds: [errorEmbed("Cannot Timeout", "This user has a higher or equal role than you.")],
        ephemeral: true,
      });
    }

    try {
      await targetMember.timeout(duration, `${reason} | By: ${interaction.user.tag}`);

      try {
        await target.send({
          embeds: [
            modEmbed(
              "You have been timed out",
              `**Server:** ${interaction.guild?.name}\n**Duration:** ${durationStr}\n**Reason:** ${reason}\n**Moderator:** ${interaction.user.tag}`,
            ),
          ],
        });
      } catch {}

      await interaction.reply({
        embeds: [
          successEmbed(
            "Member Timed Out",
            `**User:** ${target.tag} (\`${target.id}\`)\n**Duration:** ${durationStr}\n**Reason:** ${reason}`,
          ).setThumbnail(target.displayAvatarURL()),
        ],
      });

      const dbConfig = await getGuildConfig(interaction.guildId!);
      const logsChannel = interaction.guild?.channels.cache.get(dbConfig.channels.logs_channel ?? "");
      if (logsChannel?.isTextBased()) {
        await logsChannel.send({
          embeds: [
            modEmbed(
              "Member Timed Out",
              `**User:** ${target.tag} (\`${target.id}\`)\n**Duration:** ${durationStr}\n**Moderator:** ${interaction.user.tag}\n**Reason:** ${reason}`,
            ).setThumbnail(target.displayAvatarURL()),
          ],
        });
      }
    } catch {
      await interaction.reply({
        embeds: [errorEmbed("Timeout Failed", "I couldn't timeout this user. Check my permissions.")],
        ephemeral: true,
      });
    }
  },
};

export default command;
