// ══════════════════════════════════════════════════════════════
//  /daily — Claim daily credits
//  V2 — Application Emojis, no Unicode emojis
// ══════════════════════════════════════════════════════════════

import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { Command } from "../../types";
import { getUserData, updateUserData } from "../../db/users";
import { errorEmbed, successEmbed, economyEmbed } from "../../utils/embed";
import ms from "ms";
import { Emojis } from "../../utils/emojis";

const DAILY_AMOUNT = 500;
const DAILY_COOLDOWN = 24 * 60 * 60 * 1000; // 24 hours

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("daily")
    .setDescription("Claim your daily free credits"),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();
    const userData = await getUserData(interaction.user.id, interaction.user.username);
    if (!userData) {
      return interaction.editReply({
        embeds: [errorEmbed("❌ خطأ", "فشل تحميل بيانات المستخدم من قاعدة البيانات.")],
      });
    }

    const now = new Date();
    const lastDaily = userData.last_daily ? new Date(userData.last_daily) : new Date(0);
    const timeSinceLast = now.getTime() - lastDaily.getTime();

    if (timeSinceLast < DAILY_COOLDOWN) {
      const timeLeft = DAILY_COOLDOWN - timeSinceLast;
      return interaction.editReply({
        embeds: [
          errorEmbed(
            "⏳ فترة الانتظار",
            `لقد قمت بالمطالبة بنقاطك اليومية بالفعل اليوم.\nحاول مجدداً بعد **${ms(timeLeft, { long: true })}**.`,
          ),
        ],
      });
    }

    const newCredits = userData.credits + DAILY_AMOUNT;
    await updateUserData(interaction.user.id, {
      credits: newCredits,
      last_daily: now.toISOString(),
    });

    return interaction.editReply({
      embeds: [
        successEmbed(
          "🎁 تمت المطالبة بالنقاط",
          `${Emojis.daily} لقد حصلت على نقاطك اليومية المجانية بقيمة **${DAILY_AMOUNT}** نقطة!\nرصيدك الإجمالي الجديد هو **${newCredits.toLocaleString()}** نقطة.`,
        ),
      ],
    });
  },
};

export default command;
