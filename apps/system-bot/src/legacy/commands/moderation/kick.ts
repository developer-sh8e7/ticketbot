// ══════════════════════════════════════════════════════════════
//  /kick — Kick a member from the server
// ══════════════════════════════════════════════════════════════

import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { Command } from "../../types.js";
import { modEmbed, errorEmbed, successEmbed } from "../../utils/embed.js";
import { requireCommandAccess } from "../../utils/permissions.js";
import { BOT_PERMISSIONS, ensureBotPermission, ensureCanModerateTarget, fetchMember } from "../../utils/moderation.js";
import { getGuildConfig } from "../../db/guilds.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kick a member from the server")
    .addUserOption((o) => o.setName("user").setDescription("The user to kick").setRequired(true))
    .addStringOption((o) => o.setName("reason").setDescription("Reason for the kick")),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!(await requireCommandAccess(interaction, "kick"))) return;
    if (!(await ensureBotPermission(interaction, BOT_PERMISSIONS.kick, "Kick"))) return;

    const target = interaction.options.getUser("user", true);
    const reason = interaction.options.getString("reason") ?? "No reason provided";
    const targetMember = await fetchMember(interaction, target.id);

    if (!targetMember) {
      return interaction.reply({ embeds: [errorEmbed("Not Found", "This user is not in the server.")], ephemeral: true });
    }
    if (!(await ensureCanModerateTarget(interaction, targetMember, "Kick"))) return;

    try {
      try {
        await target.send({
          embeds: [
            modEmbed(
              "You have been kicked",
              `**Server:** ${interaction.guild?.name}\n**Reason:** ${reason}\n**Moderator:** ${interaction.user.tag}`,
            ),
          ],
        });
      } catch {}

      await targetMember.kick(`${reason} | By: ${interaction.user.tag}`);

      await interaction.reply({
        embeds: [successEmbed("Member Kicked", `**User:** ${target.tag} (\`${target.id}\`)\n**Reason:** ${reason}`).setThumbnail(target.displayAvatarURL())],
      });

      const dbConfig = await getGuildConfig(interaction.guildId!);
      const logsChannel = interaction.guild?.channels.cache.get(dbConfig.channels.logs_channel ?? "");
      if (logsChannel?.isTextBased()) {
        await logsChannel.send({
          embeds: [
            modEmbed(
              "Member Kicked",
              `**User:** ${target.tag} (\`${target.id}\`)\n**Moderator:** ${interaction.user.tag}\n**Reason:** ${reason}`,
            ).setThumbnail(target.displayAvatarURL()),
          ],
        });
      }
    } catch {
      await interaction.reply({
        embeds: [errorEmbed("Kick Failed", "فشل الطرد. تأكد أن رتبة البوت فوق رتبة العضو وأن عنده Kick Members.")],
        ephemeral: true,
      });
    }
  },
};

export default command;
