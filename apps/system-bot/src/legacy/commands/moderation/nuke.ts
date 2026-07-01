// ══════════════════════════════════════════════════════════════
//  /nuke — Clone & delete a channel (reset)
// ══════════════════════════════════════════════════════════════

import { SlashCommandBuilder, ChatInputCommandInteraction, TextChannel } from "discord.js";
import { Command } from "../../types.js";
import { successEmbed, errorEmbed } from "../../utils/embed.js";
import { Emojis } from "../../utils/emojis.js";
import { requireCommandAccess } from "../../utils/permissions.js";
import { BOT_PERMISSIONS, ensureBotPermission } from "../../utils/moderation.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("nuke")
    .setDescription("Clone & delete a channel (reset all messages)"),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!(await requireCommandAccess(interaction, "nuke"))) return;
    if (!(await ensureBotPermission(interaction, BOT_PERMISSIONS.channels, "Nuke"))) return;

    const channel = interaction.channel as TextChannel;
    if (!channel || !("clone" in channel) || !("delete" in channel)) {
      return interaction.reply({ embeds: [errorEmbed("Nuke Failed", "هذا الأمر يعمل داخل الرومات النصية فقط.")], ephemeral: true });
    }

    try {
      await interaction.deferReply({ ephemeral: true });
      const cloned = await channel.clone({ position: channel.position, reason: `Nuked by ${interaction.user.tag}` });
      await channel.delete(`Nuked by ${interaction.user.tag}`);
      await cloned.send({ embeds: [successEmbed("Channel Nuked", `${Emojis.nuke} This channel has been nuked by ${interaction.user}.\nAll previous messages have been deleted.`)] });
    } catch {
      const payload = { embeds: [errorEmbed("Nuke Failed", "ما قدرت أسوي nuke. تأكد أن البوت عنده Manage Channels وأن رتبته مناسبة.")], ephemeral: true };
      if (interaction.deferred || interaction.replied) await interaction.followUp(payload).catch(() => null);
      else await interaction.reply(payload).catch(() => null);
    }
  },
};

export default command;
