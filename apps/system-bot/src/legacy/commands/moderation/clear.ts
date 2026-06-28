// ══════════════════════════════════════════════════════════════
//  /clear — Bulk delete messages
//  V2 — Application Emojis, no Unicode emojis
// ══════════════════════════════════════════════════════════════

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  GuildMember,
  TextChannel,
} from "discord.js";
import { Command } from "../../types.js";
import { errorEmbed, successEmbed } from "../../utils/embed.js";
import { isModerator, noPermission } from "../../utils/permissions.js";

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
    .addUserOption((o) => o.setName("user").setDescription("Only delete messages from this user"))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction: ChatInputCommandInteraction) {
    const member = interaction.member as GuildMember;
    if (!isModerator(member)) return noPermission(interaction);

    const amount = interaction.options.getInteger("amount", true);
    const targetUser = interaction.options.getUser("user");
    const channel = interaction.channel as TextChannel;

    try {
      let messages = await channel.messages.fetch({ limit: amount });

      if (targetUser) {
        messages = messages.filter((m) => m.author.id === targetUser.id);
      }

      // Filter out messages older than 14 days (Discord API limitation)
      const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
      messages = messages.filter((m) => m.createdTimestamp > twoWeeksAgo);

      const deleted = await channel.bulkDelete(messages, true);

      const reply = await interaction.reply({
        embeds: [
          successEmbed(
            "Messages Cleared",
            `**Deleted:** ${deleted.size} message(s)${targetUser ? `\n**From:** ${targetUser.tag}` : ""}`,
          ),
        ],
        ephemeral: true,
      });

      // Auto-delete reply after 5 seconds
      setTimeout(() => reply.delete().catch(() => {}), 5000);
    } catch {
      await interaction.reply({
        embeds: [errorEmbed("Clear Failed", "I couldn't delete messages. Check my permissions.")],
        ephemeral: true,
      });
    }
  },
};

export default command;
