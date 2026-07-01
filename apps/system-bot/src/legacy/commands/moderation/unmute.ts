import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { Command } from "../../types.js";
import { modEmbed, errorEmbed, successEmbed } from "../../utils/embed.js";
import { requireCommandAccess } from "../../utils/permissions.js";
import { BOT_PERMISSIONS, ensureBotPermission, ensureCanModerateTarget, fetchMember } from "../../utils/moderation.js";
import { getGuildConfig } from "../../db/guilds.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("unmute")
    .setDescription("Remove timeout/mute from a member")
    .addUserOption((o) => o.setName("user").setDescription("The user to unmute").setRequired(true))
    .addStringOption((o) => o.setName("reason").setDescription("Reason for the unmute")),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!(await requireCommandAccess(interaction, "unmute"))) return;
    if (!(await ensureBotPermission(interaction, BOT_PERMISSIONS.timeout, "Unmute"))) return;

    const target = interaction.options.getUser("user", true);
    const reason = interaction.options.getString("reason") ?? "No reason provided";
    const targetMember = await fetchMember(interaction, target.id);

    if (!targetMember) return interaction.reply({ embeds: [errorEmbed("Not Found", "This user is not in the server.")], ephemeral: true });
    if (!(await ensureCanModerateTarget(interaction, targetMember, "Unmute"))) return;

    try {
      await targetMember.timeout(null, `${reason} | By: ${interaction.user.tag}`);
      await interaction.reply({ embeds: [successEmbed("Member Unmuted", `**User:** ${target.tag} (\`${target.id}\`)\n**Reason:** ${reason}`)] });

      const dbConfig = await getGuildConfig(interaction.guildId!);
      const logsChannel = interaction.guild?.channels.cache.get(dbConfig.channels.logs_channel ?? "");
      if (logsChannel?.isTextBased()) {
        await logsChannel.send({ embeds: [modEmbed("Member Unmuted", `**User:** ${target.tag} (\`${target.id}\`)\n**Moderator:** ${interaction.user.tag}\n**Reason:** ${reason}`)] });
      }
    } catch {
      await interaction.reply({ embeds: [errorEmbed("Unmute Failed", "فشل فك الميوت. تأكد من صلاحيات ورتبة البوت.")], ephemeral: true });
    }
  },
};

export default command;
