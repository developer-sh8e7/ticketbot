// ══════════════════════════════════════════════════════════════
//  /warn — Warn a member
// ══════════════════════════════════════════════════════════════

import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { Command } from "../../types.js";
import { modEmbed, errorEmbed, successEmbed } from "../../utils/embed.js";
import { requireCommandAccess } from "../../utils/permissions.js";
import { getGuildConfig } from "../../db/guilds.js";
import { addWarning } from "../../services/warnings.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Warn a member")
    .addUserOption((o) => o.setName("user").setDescription("The user to warn").setRequired(true))
    .addStringOption((o) => o.setName("reason").setDescription("Reason for the warning").setRequired(true)),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!(await requireCommandAccess(interaction, "warn"))) return;

    const target = interaction.options.getUser("user", true);
    const reason = interaction.options.getString("reason", true);
    const totalWarnings = await addWarning(interaction.guildId!, target.id, interaction.user.id, reason);

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
            `**User:** ${target.tag} (\`${target.id}\`)\n**Reason:** ${reason}${totalWarnings === null ? "" : `\n**Total Warnings:** ${totalWarnings}`}`,
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
      await interaction.reply({ embeds: [errorEmbed("Warn Failed", "Something went wrong.")], ephemeral: true });
    }
  },
};

export default command;
