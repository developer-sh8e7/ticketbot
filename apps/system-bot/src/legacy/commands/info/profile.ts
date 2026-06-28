// ══════════════════════════════════════════════════════════════
//  /profile — View a user's profile
//  V2 — Application Emojis, no Unicode emojis
// ══════════════════════════════════════════════════════════════

import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { Command } from "../../types";
import { getUserData } from "../../db/users";
import { getMemberData } from "../../db/members";
import { Colors } from "../../utils/embed";
import { Emojis } from "../../utils/emojis";
import { Config } from "../../config";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("profile")
    .setDescription("Display a user's profile card")
    .addUserOption((o) => o.setName("user").setDescription("The user to inspect")),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();
    const target = interaction.options.getUser("user") ?? interaction.user;

    const userData = await getUserData(target.id, target.username);
    const memberData = await getMemberData(interaction.guildId!, target.id);

    const credits = userData?.credits ?? 0;
    const rep = userData?.rep ?? 0;

    const level = memberData?.level ?? 1;
    const xp = memberData?.xp ?? 0;
    const nextLevelXP = level * level * 100;

    const embed = new EmbedBuilder()
      .setTitle(`${Emojis.profile}  ${target.tag}'s Profile`)
      .setColor(Colors.primary)
      .setThumbnail(target.displayAvatarURL({ size: 512 }))
      .addFields(
        {
          name: `${Emojis.credits} Economy`,
          value: [
            `**Credits:** ${credits.toLocaleString()}`,
            `**Reputation:** ${rep}`,
          ].join("\n"),
          inline: true,
        },
        {
          name: `${Emojis.xp} Leveling`,
          value: [
            `**Level:** ${level}`,
            `**XP:** ${xp.toLocaleString()} / ${nextLevelXP.toLocaleString()}`,
          ].join("\n"),
          inline: true,
        },
      )
      .setFooter({ text: Config.embed.footer })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};

export default command;
