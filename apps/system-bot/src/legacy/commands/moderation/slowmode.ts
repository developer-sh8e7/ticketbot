// ══════════════════════════════════════════════════════════════
//  /slowmode — Set channel slowmode
// ══════════════════════════════════════════════════════════════

import { SlashCommandBuilder, ChatInputCommandInteraction, TextChannel } from "discord.js";
import { Command } from "../../types.js";
import { successEmbed, errorEmbed } from "../../utils/embed.js";
import { requireCommandAccess } from "../../utils/permissions.js";
import { BOT_PERMISSIONS, ensureBotPermission } from "../../utils/moderation.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("slowmode")
    .setDescription("Set channel slowmode")
    .addIntegerOption((o) => o.setName("seconds").setDescription("Slowmode duration in seconds (0 to disable)").setMinValue(0).setMaxValue(21600).setRequired(true))
    .addChannelOption((o) => o.setName("channel").setDescription("Channel to set slowmode for")),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!(await requireCommandAccess(interaction, "slowmode"))) return;
    if (!(await ensureBotPermission(interaction, BOT_PERMISSIONS.channels, "Slowmode"))) return;

    const seconds = interaction.options.getInteger("seconds", true);
    const channel = (interaction.options.getChannel("channel") as TextChannel) ?? (interaction.channel as TextChannel);
    if (!channel || !("setRateLimitPerUser" in channel)) {
      return interaction.reply({ embeds: [errorEmbed("Failed", "هذا الأمر يعمل داخل الرومات النصية فقط.")], ephemeral: true });
    }

    try {
      await channel.setRateLimitPerUser(seconds, `Slowmode updated by ${interaction.user.tag}`);
      const msg = seconds === 0 ? `Slowmode has been **disabled** in ${channel}.` : `Slowmode set to **${seconds}s** in ${channel}.`;
      await interaction.reply({ embeds: [successEmbed("Slowmode Updated", msg)] });
    } catch {
      await interaction.reply({ embeds: [errorEmbed("Failed", "ما قدرت أعدل السلومود. تأكد أن البوت عنده Manage Channels.")], ephemeral: true });
    }
  },
};

export default command;
