import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { Command } from "../../types.js";
import { modEmbed, errorEmbed, successEmbed } from "../../utils/embed.js";
import { requireCommandAccess } from "../../utils/permissions.js";
import { BOT_PERMISSIONS, ensureBotPermission, ensureCanModerateTarget, fetchMember } from "../../utils/moderation.js";
import { getGuildConfig } from "../../db/guilds.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("softban")
    .setDescription("Ban then unban a member to clean recent messages")
    .addUserOption((o) => o.setName("user").setDescription("The user to softban").setRequired(true))
    .addStringOption((o) => o.setName("reason").setDescription("Reason for the softban"))
    .addIntegerOption((o) => o.setName("days").setDescription("Days of messages to delete (0-7)").setMinValue(0).setMaxValue(7)),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!(await requireCommandAccess(interaction, "softban"))) return;
    if (!(await ensureBotPermission(interaction, BOT_PERMISSIONS.ban, "Softban"))) return;

    const target = interaction.options.getUser("user", true);
    const reason = interaction.options.getString("reason") ?? "No reason provided";
    const days = interaction.options.getInteger("days") ?? 1;
    const targetMember = await fetchMember(interaction, target.id);

    if (targetMember && !(await ensureCanModerateTarget(interaction, targetMember, "Softban"))) return;

    try {
      await interaction.guild?.members.ban(target.id, { reason: `${reason} | Softban by: ${interaction.user.tag}`, deleteMessageDays: days });
      await interaction.guild?.members.unban(target.id, `Softban completed | By: ${interaction.user.tag}`);
      await interaction.reply({ embeds: [successEmbed("Member Softbanned", `**User:** ${target.tag} (\`${target.id}\`)\n**Messages Deleted:** ${days} day(s)\n**Reason:** ${reason}`)] });

      const dbConfig = await getGuildConfig(interaction.guildId!);
      const logsChannel = interaction.guild?.channels.cache.get(dbConfig.channels.logs_channel ?? "");
      if (logsChannel?.isTextBased()) {
        await logsChannel.send({ embeds: [modEmbed("Member Softbanned", `**User:** ${target.tag} (\`${target.id}\`)\n**Moderator:** ${interaction.user.tag}\n**Reason:** ${reason}`)] });
      }
    } catch {
      await interaction.reply({ embeds: [errorEmbed("Softban Failed", "فشل السوفت باند. تأكد من صلاحيات ورتبة البوت.")], ephemeral: true });
    }
  },
};

export default command;
