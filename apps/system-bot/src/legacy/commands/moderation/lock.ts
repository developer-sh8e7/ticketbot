// ══════════════════════════════════════════════════════════════
//  /lock & /unlock — Lock/Unlock a channel
// ══════════════════════════════════════════════════════════════

import { SlashCommandBuilder, ChatInputCommandInteraction, TextChannel } from "discord.js";
import { Command } from "../../types.js";
import { successEmbed, errorEmbed } from "../../utils/embed.js";
import { Emojis } from "../../utils/emojis.js";
import { requireCommandAccess } from "../../utils/permissions.js";
import { BOT_PERMISSIONS, ensureBotPermission } from "../../utils/moderation.js";

export const lockCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("lock")
    .setDescription("Lock a channel")
    .addChannelOption((o) => o.setName("channel").setDescription("Channel to lock"))
    .addStringOption((o) => o.setName("reason").setDescription("Reason for locking")),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!(await requireCommandAccess(interaction, "lock"))) return;
    if (!(await ensureBotPermission(interaction, BOT_PERMISSIONS.channels, "Lock"))) return;

    const channel = (interaction.options.getChannel("channel") as TextChannel) ?? (interaction.channel as TextChannel);
    const reason = interaction.options.getString("reason") ?? "No reason provided";

    if (!channel || !("permissionOverwrites" in channel)) {
      return interaction.reply({ embeds: [errorEmbed("Failed", "هذا الأمر يعمل داخل الرومات النصية فقط.")], ephemeral: true });
    }

    try {
      await channel.permissionOverwrites.edit(interaction.guild!.id, { SendMessages: false }, { reason: `Locked by ${interaction.user.tag}: ${reason}` });
      await interaction.reply({ embeds: [successEmbed("Channel Locked", `${Emojis.lock} ${channel} has been locked.\n**Reason:** ${reason}`)] });
    } catch {
      await interaction.reply({ embeds: [errorEmbed("Failed", "ما قدرت أقفل الروم. تأكد أن البوت عنده Manage Channels.")], ephemeral: true });
    }
  },
};

export const unlockCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("unlock")
    .setDescription("Unlock a channel")
    .addChannelOption((o) => o.setName("channel").setDescription("Channel to unlock")),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!(await requireCommandAccess(interaction, "unlock"))) return;
    if (!(await ensureBotPermission(interaction, BOT_PERMISSIONS.channels, "Unlock"))) return;

    const channel = (interaction.options.getChannel("channel") as TextChannel) ?? (interaction.channel as TextChannel);
    if (!channel || !("permissionOverwrites" in channel)) {
      return interaction.reply({ embeds: [errorEmbed("Failed", "هذا الأمر يعمل داخل الرومات النصية فقط.")], ephemeral: true });
    }

    try {
      await channel.permissionOverwrites.edit(interaction.guild!.id, { SendMessages: null }, { reason: `Unlocked by ${interaction.user.tag}` });
      await interaction.reply({ embeds: [successEmbed("Channel Unlocked", `${Emojis.unlock} ${channel} has been unlocked.`)] });
    } catch {
      await interaction.reply({ embeds: [errorEmbed("Failed", "ما قدرت أفتح الروم. تأكد أن البوت عنده Manage Channels.")], ephemeral: true });
    }
  },
};
