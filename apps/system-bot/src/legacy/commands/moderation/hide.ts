// ══════════════════════════════════════════════════════════════
//  /hide — Hide a channel from @everyone
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
    .setName("hide")
    .setDescription("Hide the current channel from everyone")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction: ChatInputCommandInteraction) {
    const member = interaction.member as GuildMember;
    if (!isModerator(member)) return noPermission(interaction);

    const channel = interaction.channel as TextChannel;
    if (!channel.isTextBased()) {
      return interaction.reply({
        embeds: [errorEmbed("Error", "This command can only be used in text channels.")],
        ephemeral: true,
      });
    }

    try {
      await channel.permissionOverwrites.edit(interaction.guild!.roles.everyone, {
        ViewChannel: false,
      });

      return interaction.reply({
        embeds: [successEmbed("Channel Hidden", "The channel is now hidden from `@everyone`.")],
      });
    } catch (err) {
      return interaction.reply({
        embeds: [errorEmbed("Error", "Failed to hide the channel.")],
        ephemeral: true,
      });
    }
  },
};

export default command;
