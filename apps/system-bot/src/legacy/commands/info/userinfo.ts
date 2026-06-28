// ══════════════════════════════════════════════════════════════
//  /userinfo — Display user information
//  V2 — Application Emojis, no Unicode emojis
// ══════════════════════════════════════════════════════════════

import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, GuildMember } from "discord.js";
import { Command } from "../../types.js";
import { Colors } from "../../utils/embed.js";
import { Emojis } from "../../utils/emojis.js";
import { Config } from "../../config.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("userinfo")
    .setDescription("Display information about a user")
    .addUserOption((o) => o.setName("user").setDescription("The user to inspect")),

  async execute(interaction: ChatInputCommandInteraction) {
    const target = interaction.options.getUser("user") ?? interaction.user;
    const member = interaction.guild?.members.cache.get(target.id) as GuildMember | undefined;

    // Badges logic would ideally map to Emojis as well, falling back to simple text for now
    // Since emojis like Staff, Partner etc are dynamic, we just list them without Unicode emojis
    const badges = target.flags?.toArray().map(f => f.replace(/_/g, " ")).join(", ") || "None";

    const embed = new EmbedBuilder()
      .setTitle(`${Emojis.user}  ${target.tag}`)
      .setColor(member?.displayHexColor ?? Colors.primary)
      .setThumbnail(target.displayAvatarURL({ size: 512 }))
      .addFields(
        {
          name: "User Info",
          value: [
            `**ID:** \`${target.id}\``,
            `**Username:** ${target.username}`,
            `**Bot:** ${target.bot ? "Yes" : "No"}`,
            `**Created:** <t:${Math.floor(target.createdTimestamp / 1000)}:R>`,
            `**Flags:** ${badges}`,
          ].join("\n"),
          inline: true,
        },
      );

    if (member) {
      const roles = member.roles.cache
        .filter((r) => r.id !== interaction.guild!.id)
        .sort((a, b) => b.position - a.position)
        .map((r) => `${r}`)
        .slice(0, 15)
        .join(", ");

      embed.addFields(
        {
          name: "Server Info",
          value: [
            `**Nickname:** ${member.nickname ?? "None"}`,
            `**Joined:** <t:${Math.floor(member.joinedTimestamp! / 1000)}:R>`,
            `**Boosting:** ${member.premiumSince ? `<t:${Math.floor(member.premiumSinceTimestamp! / 1000)}:R>` : "No"}`,
            `**Highest Role:** ${member.roles.highest}`,
          ].join("\n"),
          inline: true,
        },
        {
          name: `Roles [${member.roles.cache.size - 1}]`,
          value: roles || "None",
          inline: false,
        },
      );
    }

    embed.setFooter({ text: Config.embed.footer }).setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
