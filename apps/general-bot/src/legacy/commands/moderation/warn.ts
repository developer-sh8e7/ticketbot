// ══════════════════════════════════════════════════════════════
//  /warn — Warn a member
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
import { isModerator, noPermission } from "../../utils/permissions";
import { getGuildConfig } from "../../db/guilds";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Warn a member")
    .addUserOption((o) => o.setName("user").setDescription("The user to warn").setRequired(true))
    .addStringOption((o) => o.setName("reason").setDescription("Reason for the warning").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction: ChatInputCommandInteraction) {
    const member = interaction.member as GuildMember;
    if (!isModerator(member)) return noPermission(interaction);

    const target = interaction.options.getUser("user", true);
    const reason = interaction.options.getString("reason", true);

    try {
      try {
        await target.send({
          embeds: [
            modEmbed(
              "You have been warned",
              `**Server:** ${interaction.guild?.name}\n**Reason:** ${reason}\n**Moderator:** ${interaction.user.tag}`,
            ),
          ],
        });
      } catch {}

      await interaction.reply({
        embeds: [
          successEmbed(
            "Member Warned",
            `**User:** ${target.tag} (\`${target.id}\`)\n**Reason:** ${reason}`,
          ).setThumbnail(target.displayAvatarURL()),
        ],
      });

      const dbConfig = await getGuildConfig(interaction.guildId!);
      const logsChannel = interaction.guild?.channels.cache.get(dbConfig.channels.logs_channel ?? "");
      if (logsChannel?.isTextBased()) {
        await logsChannel.send({
          embeds: [
            modEmbed(
              "Member Warned",
              `**User:** ${target.tag} (\`${target.id}\`)\n**Moderator:** ${interaction.user.tag}\n**Reason:** ${reason}`,
            ).setThumbnail(target.displayAvatarURL()),
          ],
        });
      }
    } catch {
      await interaction.reply({
        embeds: [errorEmbed("Warn Failed", "Something went wrong.")],
        ephemeral: true,
      });
    }
  },
};

export default command;
