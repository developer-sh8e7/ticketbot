// ══════════════════════════════════════════════════════════════
//  /lock & /unlock — Lock/Unlock a channel
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
import { isModerator, noPermission } from "../../utils/permissions.js";

export const lockCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("lock")
    .setDescription("Lock a channel")
    .addChannelOption((o) => o.setName("channel").setDescription("Channel to lock"))
    .addStringOption((o) => o.setName("reason").setDescription("Reason for locking"))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction: ChatInputCommandInteraction) {
    const member = interaction.member as GuildMember;
    if (!isModerator(member)) return noPermission(interaction);

    const channel = (interaction.options.getChannel("channel") as TextChannel) ?? (interaction.channel as TextChannel);
    const reason = interaction.options.getString("reason") ?? "No reason provided";

    try {
      await channel.permissionOverwrites.edit(interaction.guild!.id, {
        SendMessages: false,
      });

      await interaction.reply({
        embeds: [
          successEmbed(
            "Channel Locked",
            `${Emojis.lock} ${channel} has been locked.\n**Reason:** ${reason}`,
          ),
        ],
      });
    } catch {
      await interaction.reply({
        embeds: [errorEmbed("Failed", "Couldn't lock the channel.")],
        ephemeral: true,
      });
    }
  },
};

export const unlockCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("unlock")
    .setDescription("Unlock a channel")
    .addChannelOption((o) => o.setName("channel").setDescription("Channel to unlock"))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction: ChatInputCommandInteraction) {
    const member = interaction.member as GuildMember;
    if (!isModerator(member)) return noPermission(interaction);

    const channel = (interaction.options.getChannel("channel") as TextChannel) ?? (interaction.channel as TextChannel);

    try {
      await channel.permissionOverwrites.edit(interaction.guild!.id, {
        SendMessages: null,
      });

      await interaction.reply({
        embeds: [successEmbed("Channel Unlocked", `${Emojis.unlock} ${channel} has been unlocked.`)],
      });
    } catch {
      await interaction.reply({
        embeds: [errorEmbed("Failed", "Couldn't unlock the channel.")],
        ephemeral: true,
      });
    }
  },
};
