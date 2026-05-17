// ══════════════════════════════════════════════════════════════
//  /serverinfo — Display server information
//  V2 — Application Emojis, no Unicode emojis
// ══════════════════════════════════════════════════════════════

import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ChannelType } from "discord.js";
import { Command } from "../../types";
import { Colors } from "../../utils/embed";
import { Emojis } from "../../utils/emojis";
import { Config } from "../../config";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("serverinfo")
    .setDescription("Display detailed server information"),

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild!;
    await guild.members.fetch();

    const textChannels = guild.channels.cache.filter((c) => c.type === ChannelType.GuildText).size;
    const voiceChannels = guild.channels.cache.filter((c) => c.type === ChannelType.GuildVoice).size;
    const categories = guild.channels.cache.filter((c) => c.type === ChannelType.GuildCategory).size;
    const roles = guild.roles.cache.size - 1; // Exclude @everyone
    const emojis = guild.emojis.cache.size;
    const stickers = guild.stickers.cache.size;
    const boosts = guild.premiumSubscriptionCount ?? 0;
    const boostTier = guild.premiumTier;
    const online = guild.members.cache.filter((m) => m.presence?.status === "online").size;
    const humans = guild.members.cache.filter((m) => !m.user.bot).size;
    const bots = guild.members.cache.filter((m) => m.user.bot).size;

    const verificationLevels: Record<number, string> = {
      0: "None",
      1: "Low",
      2: "Medium",
      3: "High",
      4: "Very High",
    };

    const embed = new EmbedBuilder()
      .setTitle(`${Emojis.server}  ${guild.name}`)
      .setColor(Colors.primary)
      .setThumbnail(guild.iconURL({ size: 512 }) ?? null)
      .setImage(guild.bannerURL({ size: 1024 }) ?? null)
      .addFields(
        {
          name: "General",
          value: [
            `**Owner:** <@${guild.ownerId}>`,
            `**Created:** <t:${Math.floor(guild.createdTimestamp / 1000)}:R>`,
            `**ID:** \`${guild.id}\``,
            `**Verification:** ${verificationLevels[guild.verificationLevel]}`,
          ].join("\n"),
          inline: true,
        },
        {
          name: "Members",
          value: [
            `**Total:** ${guild.memberCount}`,
            `**Humans:** ${humans}`,
            `**Bots:** ${bots}`,
            `**Online:** ${online}`,
          ].join("\n"),
          inline: true,
        },
        {
          name: "Channels",
          value: [
            `**Text:** ${textChannels}`,
            `**Voice:** ${voiceChannels}`,
            `**Categories:** ${categories}`,
            `**Total:** ${guild.channels.cache.size}`,
          ].join("\n"),
          inline: true,
        },
        {
          name: "Extras",
          value: [
            `**Roles:** ${roles}`,
            `**Emojis:** ${emojis}`,
            `**Stickers:** ${stickers}`,
            `**Boosts:** ${boosts} (Tier ${boostTier})`,
          ].join("\n"),
          inline: true,
        },
      )
      .setFooter({ text: Config.embed.footer })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
