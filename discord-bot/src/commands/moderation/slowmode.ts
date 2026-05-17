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
    const allowedSlowmodeRoles = [
      "1483021366792949760",
      "1483212264025886886",
      "1483021857048232036",
      "1483020652997771284",
      "1483211847875297512",
      "1483021277181644842",
      "1483021186559639674",
      "1483825953246544012",
      "1494069372526923847",
      "1483020976966074479",
      "1482858415469367336",
      "1483038264393990164"
    ];
    const hasRole = member.roles.cache.some((role) => allowedSlowmodeRoles.includes(role.id)) ||
                    member.id === interaction.guild?.ownerId;
    if (!hasRole) return noPermission(interaction);

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
