// ══════════════════════════════════════════════════════════════
//  /daily — Claim daily credits
//  V2 — Application Emojis, no Unicode emojis
// ══════════════════════════════════════════════════════════════

import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { Command } from "../../types.js";
import { getUserData, updateUserData } from "../../db/users.js";
import { errorEmbed, successEmbed, economyEmbed } from "../../utils/embed.js";
import ms from "ms";
import { Emojis } from "../../utils/emojis.js";

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
        embeds: [errorEmbed("Database Error", "Failed to load user data.")],
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
            "Cooldown",
            `You have already claimed your daily credits.\nTry again in **${ms(timeLeft, { long: true })}**.`,
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
          "Daily Claimed",
          `${Emojis.daily} You have claimed your daily **${DAILY_AMOUNT}** credits!\nYour new balance is **${newCredits.toLocaleString()}**.`,
        ),
      ],
    });
  },
};

export default command;
