// ══════════════════════════════════════════════════════════════
//  /slowmode — Set channel slowmode
//  V2 — Application Emojis, no Unicode emojis
// ══════════════════════════════════════════════════════════════

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  GuildMember,
  TextChannel,
} from "discord.js";
import { Command } from "../../types";
import { successEmbed, errorEmbed } from "../../utils/embed";
import { isModerator, noPermission } from "../../utils/permissions";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("slowmode")
    .setDescription("Set channel slowmode")
    .addIntegerOption((o) =>
      o
        .setName("seconds")
        .setDescription("Slowmode duration in seconds (0 to disable)")
        .setMinValue(0)
        .setMaxValue(21600)
        .setRequired(true),
    )
    .addChannelOption((o) =>
      o.setName("channel").setDescription("Channel to set slowmode for"),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction: ChatInputCommandInteraction) {
    const member = interaction.member as GuildMember;
    if (!isModerator(member)) return noPermission(interaction);

    const seconds = interaction.options.getInteger("seconds", true);
    const channel = (interaction.options.getChannel("channel") as TextChannel) ?? (interaction.channel as TextChannel);

    try {
      await channel.setRateLimitPerUser(seconds);
      const msg =
        seconds === 0
          ? `Slowmode has been **disabled** in ${channel}.`
          : `Slowmode set to **${seconds}s** in ${channel}.`;

      await interaction.reply({ embeds: [successEmbed("Slowmode Updated", msg)] });
    } catch {
      await interaction.reply({
        embeds: [errorEmbed("Failed", "Couldn't update slowmode. Check permissions.")],
        ephemeral: true,
      });
    }
  },
};

export default command;
