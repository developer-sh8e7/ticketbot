// ══════════════════════════════════════════════════════════════
//  /unban — Unban a user from the server
// ══════════════════════════════════════════════════════════════

import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { Command } from "../../types.js";
import { errorEmbed, successEmbed, modEmbed } from "../../utils/embed.js";
import { requireCommandAccess } from "../../utils/permissions.js";
import { BOT_PERMISSIONS, ensureBotPermission } from "../../utils/moderation.js";
import { getGuildConfig } from "../../db/guilds.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("unban")
    .setDescription("Unban a user from the server")
    .addStringOption((o) => o.setName("userid").setDescription("The user ID to unban").setRequired(true))
    .addStringOption((o) => o.setName("reason").setDescription("Reason for the unban")),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!(await requireCommandAccess(interaction, "unban"))) return;
    if (!(await ensureBotPermission(interaction, BOT_PERMISSIONS.ban, "Unban"))) return;

    const userId = interaction.options.getString("userid", true).replace(/\D/g, "");
    const reason = interaction.options.getString("reason") ?? "No reason provided";
    if (!/^\d{17,20}$/.test(userId)) {
      return interaction.reply({ embeds: [errorEmbed("Invalid User ID", "اكتب User ID صحيح أو منشن وانسخ الآيدي.")], ephemeral: true });
    }

    try {
      const bannedUser = await interaction.guild?.bans.fetch(userId);
      if (!bannedUser) return interaction.reply({ embeds: [errorEmbed("Not Found", "This user is not banned.")], ephemeral: true });

      await interaction.guild?.members.unban(userId, `${reason} | By: ${interaction.user.tag}`);
      await interaction.reply({
        embeds: [successEmbed("Member Unbanned", `**User:** ${bannedUser.user.tag} (\`${userId}\`)\n**Reason:** ${reason}`).setThumbnail(bannedUser.user.displayAvatarURL())],
      });

      const dbConfig = await getGuildConfig(interaction.guildId!);
      const logsChannel = interaction.guild?.channels.cache.get(dbConfig.channels.logs_channel ?? "");
      if (logsChannel?.isTextBased()) {
        await logsChannel.send({
          embeds: [modEmbed("Member Unbanned", `**User:** ${bannedUser.user.tag} (\`${userId}\`)\n**Moderator:** ${interaction.user.tag}\n**Reason:** ${reason}`).setThumbnail(bannedUser.user.displayAvatarURL())],
        });
      }
    } catch {
      await interaction.reply({ embeds: [errorEmbed("Unban Failed", "ما قدرت أفك الباند. تأكد أن الآيدي صحيح وأن البوت عنده Ban Members.")], ephemeral: true });
    }
  },
};

export default command;
