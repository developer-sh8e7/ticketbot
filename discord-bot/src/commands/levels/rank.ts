// ══════════════════════════════════════════════════════════════
//  /rank — Check your or someone else's level/rank
//  V2 — Application Emojis, no Unicode emojis
// ══════════════════════════════════════════════════════════════

import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { Command } from "../../types";
import { getMemberData } from "../../db/members";
import { levelEmbed, errorEmbed } from "../../utils/embed";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("rank")
    .setDescription("Check your rank and level")
    .addUserOption((o) => o.setName("user").setDescription("The user to check")),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();
    const target = interaction.options.getUser("user") ?? interaction.user;

    if (target.bot) {
      return interaction.editReply({
        embeds: [errorEmbed("❌ خطأ", "البوتات لا تمتلك مستويات أو لفل.")],
      });
    }

    const memberData = await getMemberData(interaction.guildId!, target.id);
    const level = memberData?.level ?? 1;
    const xp = memberData?.xp ?? 0;
    const nextLevelXP = level * level * 100;

    // A simple progress bar using text
    const progress = Math.min(Math.floor((Number(xp) / nextLevelXP) * 10), 10);
    const progressBar = "█".repeat(progress) + "▒".repeat(10 - progress);

    await interaction.editReply({
      embeds: [
        levelEmbed(
          `📈 مستوى وترتيب — ${target.username}`,
          [
            `**المستوى الحالي:** \`Lvl ${level}\``,
            `**نقاط الخبرة (XP):** \`${Number(xp).toLocaleString()} / ${nextLevelXP.toLocaleString()}\``,
            "",
            `**شريط التقدم:** \`[ ${progressBar} ]\` ${Math.floor((Number(xp) / nextLevelXP) * 100)}%`,
          ].join("\n"),
        ).setThumbnail(target.displayAvatarURL()),
      ],
    });
  },
};

export default command;
