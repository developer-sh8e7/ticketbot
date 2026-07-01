// ══════════════════════════════════════════════════════════════
//  /timeout — Timeout (mute) a member
// ══════════════════════════════════════════════════════════════

import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import ms from "ms";
import { Command } from "../../types.js";
import { modEmbed, errorEmbed, successEmbed } from "../../utils/embed.js";
import { requireCommandAccess } from "../../utils/permissions.js";
import { BOT_PERMISSIONS, ensureBotPermission, ensureCanModerateTarget, fetchMember } from "../../utils/moderation.js";
import { getGuildConfig } from "../../db/guilds.js";

export async function runTimeoutCommand(interaction: ChatInputCommandInteraction, commandName: "timeout" | "mute") {
  if (!(await requireCommandAccess(interaction, commandName))) return;
  if (!(await ensureBotPermission(interaction, BOT_PERMISSIONS.timeout, "Timeout"))) return;

  const target = interaction.options.getUser("user", true);
  const durationStr = interaction.options.getString("duration", true);
  const reason = interaction.options.getString("reason") ?? "No reason provided";
  const targetMember = await fetchMember(interaction, target.id);

  if (!targetMember) {
    return interaction.reply({ embeds: [errorEmbed("Not Found", "This user is not in the server.")], ephemeral: true });
  }

  const duration = ms(durationStr as ms.StringValue);
  if (!duration || duration < 5000 || duration > 28 * 24 * 60 * 60 * 1000) {
    return interaction.reply({
      embeds: [errorEmbed("Invalid Duration", "Duration must be between 5s and 28 days.\nExamples: `10m`, `1h`, `1d`")],
      ephemeral: true,
    });
  }

  if (!(await ensureCanModerateTarget(interaction, targetMember, "Timeout"))) return;

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
      embeds: [errorEmbed("Timeout Failed", "فشل التايم آوت. تأكد أن رتبة البوت فوق رتبة العضو وأن عنده Moderate Members.")],
      ephemeral: true,
    });
  }
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("timeout")
    .setDescription("Timeout a member")
    .addUserOption((o) => o.setName("user").setDescription("The user to timeout").setRequired(true))
    .addStringOption((o) => o.setName("duration").setDescription("Duration (e.g. 10m, 1h, 1d)").setRequired(true))
    .addStringOption((o) => o.setName("reason").setDescription("Reason for the timeout")),

  async execute(interaction: ChatInputCommandInteraction) {
    await runTimeoutCommand(interaction, "timeout");
  },
};

export default command;
