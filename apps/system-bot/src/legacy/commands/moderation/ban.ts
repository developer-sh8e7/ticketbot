// ══════════════════════════════════════════════════════════════
//  /ban — Ban a member from the server
// ══════════════════════════════════════════════════════════════

import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { Command } from "../../types.js";
import { modEmbed, errorEmbed, successEmbed } from "../../utils/embed.js";
import { requireCommandAccess } from "../../utils/permissions.js";
import { BOT_PERMISSIONS, ensureBotPermission, ensureCanModerateTarget, fetchMember } from "../../utils/moderation.js";
import { getGuildConfig } from "../../db/guilds.js";

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
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!(await requireCommandAccess(interaction, "ban"))) return;
    if (!(await ensureBotPermission(interaction, BOT_PERMISSIONS.ban, "Ban"))) return;

    const target = interaction.options.getUser("user", true);
    const reason = interaction.options.getString("reason") ?? "No reason provided";
    const days = interaction.options.getInteger("days") ?? 0;
    const targetMember = await fetchMember(interaction, target.id);

    if (targetMember && !(await ensureCanModerateTarget(interaction, targetMember, "Ban"))) return;

    try {
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

      await interaction.guild?.members.ban(target.id, {
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
        embeds: [errorEmbed("Ban Failed", "فشل الباند. تأكد أن رتبة البوت فوق رتبة العضو وأن عنده Ban Members.")],
        ephemeral: true,
      });
    }
  },
};

export default command;
