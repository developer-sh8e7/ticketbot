import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { Command } from "../../types.js";
import { errorEmbed, infoEmbed } from "../../utils/embed.js";
import { requireCommandAccess } from "../../utils/permissions.js";
import { listWarnings } from "../../services/warnings.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("warnings")
    .setDescription("Show a member's warnings")
    .addUserOption((o) => o.setName("user").setDescription("The user to inspect").setRequired(true)),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!(await requireCommandAccess(interaction, "warnings"))) return;

    const target = interaction.options.getUser("user", true);
    try {
      const warnings = await listWarnings(interaction.guildId!, target.id, 10);
      if (warnings.length === 0) {
        return interaction.reply({ embeds: [infoEmbed("No Warnings", `${target} has no warnings.`)], ephemeral: true });
      }

      const lines = warnings.map((w, i) => {
        const ts = Math.floor(new Date(w.created_at).getTime() / 1000);
        return `**${i + 1}.** <t:${ts}:R> by <@${w.moderator_id}>\n${w.reason.slice(0, 160)}`;
      });

      return interaction.reply({
        embeds: [infoEmbed("Member Warnings", `**User:** ${target} (\`${target.id}\`)\n**Showing:** ${warnings.length}\n\n${lines.join("\n\n")}`)],
        ephemeral: true,
      });
    } catch {
      return interaction.reply({ embeds: [errorEmbed("Warnings Failed", "تعذّر جلب التحذيرات. تأكد من تطبيق جدول guild_warnings.")], ephemeral: true });
    }
  },
};

export default command;
