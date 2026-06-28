// ══════════════════════════════════════════════════════════════
//  /nuke — Clone & delete a channel (reset)
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
import { successEmbed, errorEmbed } from "../../utils/embed.js";
import { Emojis } from "../../utils/emojis.js";
import { isAdmin, noPermission } from "../../utils/permissions.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("nuke")
    .setDescription("Clone & delete a channel (reset all messages)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction: ChatInputCommandInteraction) {
    const member = interaction.member as GuildMember;
    if (!isAdmin(member)) return noPermission(interaction);

    const channel = interaction.channel as TextChannel;

    try {
      const cloned = await channel.clone({
        position: channel.position,
        reason: `Nuked by ${interaction.user.tag}`,
      });

      await channel.delete();

      await cloned.send({
        embeds: [
          successEmbed(
            "Channel Nuked",
            `${Emojis.nuke} This channel has been nuked by ${interaction.user}.\nAll previous messages have been deleted.`,
          ),
        ],
      });
    } catch {
      await interaction.reply({
        embeds: [errorEmbed("Nuke Failed", "Couldn't nuke this channel. Check my permissions.")],
        ephemeral: true,
      });
    }
  },
};

export default command;
