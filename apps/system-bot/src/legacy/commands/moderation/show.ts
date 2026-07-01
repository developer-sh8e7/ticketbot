// ══════════════════════════════════════════════════════════════
//  /show — Show a channel to @everyone
// ══════════════════════════════════════════════════════════════

import { SlashCommandBuilder, ChatInputCommandInteraction, TextChannel } from "discord.js";
import { Command } from "../../types.js";
import { errorEmbed, successEmbed } from "../../utils/embed.js";
import { requireCommandAccess } from "../../utils/permissions.js";
import { BOT_PERMISSIONS, ensureBotPermission } from "../../utils/moderation.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("show")
    .setDescription("Show a channel to everyone")
    .addChannelOption((o) => o.setName("channel").setDescription("Channel to show")),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!(await requireCommandAccess(interaction, "show"))) return;
    if (!(await ensureBotPermission(interaction, BOT_PERMISSIONS.channels, "Show"))) return;

    const channel = (interaction.options.getChannel("channel") as TextChannel) ?? (interaction.channel as TextChannel);
    if (!channel || !("permissionOverwrites" in channel)) {
      return interaction.reply({ embeds: [errorEmbed("Error", "This command can only be used in text channels.")], ephemeral: true });
    }

    try {
      await channel.permissionOverwrites.edit(interaction.guild!.roles.everyone, { ViewChannel: null }, { reason: `Shown by ${interaction.user.tag}` });
      return interaction.reply({ embeds: [successEmbed("Channel Visible", `${channel} is now visible to @everyone.`)] });
    } catch {
      return interaction.reply({ embeds: [errorEmbed("Error", "فشل إظهار الروم. تأكد أن البوت عنده Manage Channels.")], ephemeral: true });
    }
  },
};

export default command;
