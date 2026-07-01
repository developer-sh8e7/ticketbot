import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { Command } from "../../types.js";
import { errorEmbed, modEmbed, successEmbed } from "../../utils/embed.js";
import { requireCommandAccess } from "../../utils/permissions.js";
import { clearWarnings } from "../../services/warnings.js";
import { getGuildConfig } from "../../db/guilds.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("clearwarns")
    .setDescription("Clear all warnings for a member")
    .addUserOption((o) => o.setName("user").setDescription("The user to clear warnings for").setRequired(true))
    .addStringOption((o) => o.setName("reason").setDescription("Reason for clearing warnings")),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!(await requireCommandAccess(interaction, "clearwarns"))) return;

    const target = interaction.options.getUser("user", true);
    const reason = interaction.options.getString("reason") ?? "No reason provided";

    try {
      const deleted = await clearWarnings(interaction.guildId!, target.id);
      await interaction.reply({ embeds: [successEmbed("Warnings Cleared", `**User:** ${target} (\`${target.id}\`)\n**Deleted:** ${deleted}\n**Reason:** ${reason}`)], ephemeral: true });

      const dbConfig = await getGuildConfig(interaction.guildId!);
      const logsChannel = interaction.guild?.channels.cache.get(dbConfig.channels.logs_channel ?? "");
      if (logsChannel?.isTextBased()) {
        await logsChannel.send({ embeds: [modEmbed("Warnings Cleared", `**User:** ${target.tag} (\`${target.id}\`)\n**Moderator:** ${interaction.user.tag}\n**Deleted:** ${deleted}\n**Reason:** ${reason}`)] });
      }
    } catch {
      await interaction.reply({ embeds: [errorEmbed("Clear Warnings Failed", "تعذّر حذف التحذيرات. تأكد من تطبيق جدول guild_warnings.")], ephemeral: true });
    }
  },
};

export default command;
