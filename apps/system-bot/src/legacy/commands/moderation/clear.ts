// ══════════════════════════════════════════════════════════════
//  /clear — Bulk delete messages
// ══════════════════════════════════════════════════════════════

import { SlashCommandBuilder, ChatInputCommandInteraction, TextChannel } from "discord.js";
import { Command } from "../../types.js";
import { errorEmbed, successEmbed } from "../../utils/embed.js";
import { requireCommandAccess } from "../../utils/permissions.js";
import { BOT_PERMISSIONS, ensureBotPermission } from "../../utils/moderation.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("clear")
    .setDescription("Delete messages in bulk")
    .addIntegerOption((o) =>
      o
        .setName("amount")
        .setDescription("Number of messages to delete (1-100)")
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(true),
    )
    .addUserOption((o) => o.setName("user").setDescription("Only delete messages from this user")),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!(await requireCommandAccess(interaction, "clear"))) return;
    if (!(await ensureBotPermission(interaction, BOT_PERMISSIONS.messages, "Clear"))) return;

    const amount = interaction.options.getInteger("amount", true);
    const targetUser = interaction.options.getUser("user");
    const channel = interaction.channel as TextChannel;

    if (!channel || !("bulkDelete" in channel)) {
      return interaction.reply({ embeds: [errorEmbed("Clear Failed", "هذا الأمر يعمل داخل الرومات النصية فقط.")], ephemeral: true });
    }

    try {
      let messages = await channel.messages.fetch({ limit: amount });
      if (targetUser) messages = messages.filter((m) => m.author.id === targetUser.id);

      const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
      messages = messages.filter((m) => m.createdTimestamp > twoWeeksAgo);

      const deleted = await channel.bulkDelete(messages, true);
      await interaction.reply({
        embeds: [successEmbed("Messages Cleared", `**Deleted:** ${deleted.size} message(s)${targetUser ? `\n**From:** ${targetUser.tag}` : ""}`)],
        ephemeral: true,
      });

      setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);
    } catch {
      await interaction.reply({ embeds: [errorEmbed("Clear Failed", "ما قدرت أحذف الرسائل. تأكد أن البوت عنده Manage Messages.")], ephemeral: true });
    }
  },
};

export default command;
