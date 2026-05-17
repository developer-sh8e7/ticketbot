// ══════════════════════════════════════════════════════════════
//  /show — Show a channel to @everyone
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
import { errorEmbed, successEmbed } from "../../utils/embed";
import { isModerator, noPermission } from "../../utils/permissions";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("show")
    .setDescription("Show the current channel to everyone")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction: ChatInputCommandInteraction) {
    const member = interaction.member as GuildMember;
    const allowedShowRoles = [
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
    const hasRole = member.roles.cache.some((role) => allowedShowRoles.includes(role.id)) ||
                    member.id === interaction.guild?.ownerId;
    if (!hasRole) return noPermission(interaction);

    const channel = interaction.channel as TextChannel;
    if (!channel.isTextBased()) {
      return interaction.reply({
        embeds: [errorEmbed("Error", "This command can only be used in text channels.")],
        ephemeral: true,
      });
    }

    try {
      await channel.permissionOverwrites.edit(interaction.guild!.roles.everyone, {
        ViewChannel: true,
      });

      return interaction.reply({
        embeds: [successEmbed("Channel Visible", "The channel is now visible to `@everyone`.")],
      });
    } catch (err) {
      return interaction.reply({
        embeds: [errorEmbed("Error", "Failed to show the channel.")],
        ephemeral: true,
      });
    }
  },
};

export default command;
