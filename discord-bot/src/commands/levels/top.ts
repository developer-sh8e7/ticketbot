// ══════════════════════════════════════════════════════════════
//  /top — Show the server leaderboard (leveling)
//  V2 — Application Emojis, no Unicode emojis
// ══════════════════════════════════════════════════════════════

import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { Command } from "../../types";
import { supabase } from "../../db/supabase";
import { levelEmbed, errorEmbed } from "../../utils/embed";
import { Emojis } from "../../utils/emojis";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("top")
    .setDescription("Display the server leveling leaderboard"),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();
    const { data, error } = await supabase
      .from("members")
      .select("user_id, level, xp")
      .eq("guild_id", interaction.guildId)
      .order("level", { ascending: false })
      .order("xp", { ascending: false })
      .limit(10);

    if (error || !data || data.length === 0) {
      return interaction.editReply({
        embeds: [errorEmbed("❌ لا توجد بيانات", "لا توجد بيانات تفاعل أو مستويات مسجلة لهذا السيرفر بعد.")],
      });
    }

    const leaderboard = await Promise.all(
      data.map(async (row, index) => {
        let user;
        try {
          user = await interaction.client.users.fetch(row.user_id);
        } catch {
          user = null;
        }

        const tag = user ? user.username : `عضو غير معروف (${row.user_id})`;
        const rankPrefix = index === 0 ? "👑" : `**#${index + 1}**`;
        return `${rankPrefix} **${tag}** — المستوى: **${row.level}** (XP: ${row.xp})`;
      }),
    );

    await interaction.editReply({
      embeds: [
        levelEmbed(`🏆 قائمة المتصدرين — ${interaction.guild?.name}`, leaderboard.join("\n\n")),
      ],
    });
  },
};

export default command;
