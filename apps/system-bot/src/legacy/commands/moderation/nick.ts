import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { Command } from "../../types.js";
import { errorEmbed, successEmbed } from "../../utils/embed.js";
import { requireCommandAccess } from "../../utils/permissions.js";
import { BOT_PERMISSIONS, ensureBotPermission, ensureCanModerateTarget, fetchMember } from "../../utils/moderation.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("nick")
    .setDescription("Change or reset a member nickname")
    .addUserOption((o) => o.setName("user").setDescription("The user to edit").setRequired(true))
    .addStringOption((o) => o.setName("nickname").setDescription("New nickname; leave empty to reset").setMaxLength(32))
    .addStringOption((o) => o.setName("reason").setDescription("Reason for nickname change")),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!(await requireCommandAccess(interaction, "nick"))) return;
    if (!(await ensureBotPermission(interaction, BOT_PERMISSIONS.nicknames, "Nick"))) return;

    const target = interaction.options.getUser("user", true);
    const nickname = interaction.options.getString("nickname");
    const reason = interaction.options.getString("reason") ?? "No reason provided";
    const targetMember = await fetchMember(interaction, target.id);

    if (!targetMember) return interaction.reply({ embeds: [errorEmbed("Not Found", "This user is not in the server.")], ephemeral: true });
    if (!(await ensureCanModerateTarget(interaction, targetMember, "Nick"))) return;

    try {
      await targetMember.setNickname(nickname || null, `${reason} | By: ${interaction.user.tag}`);
      await interaction.reply({ embeds: [successEmbed("Nickname Updated", `**User:** ${target}\n**Nickname:** ${nickname || "Reset to original"}\n**Reason:** ${reason}`)] });
    } catch {
      await interaction.reply({ embeds: [errorEmbed("Nick Failed", "فشل تعديل النك. تأكد أن رتبة البوت فوق رتبة العضو وأن عنده Manage Nicknames.")], ephemeral: true });
    }
  },
};

export default command;
