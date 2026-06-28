// ══════════════════════════════════════════════════════════════
//  /credits — Check or transfer credits
//  V2 — Application Emojis, no Unicode emojis
// ══════════════════════════════════════════════════════════════

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from "discord.js";
import { Command } from "../../types.js";
import { getUserData, updateUserData } from "../../db/users.js";
import { errorEmbed, successEmbed, economyEmbed } from "../../utils/embed.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("credits")
    .setDescription("Check your credits or transfer to someone else")
    .addUserOption((o) => o.setName("user").setDescription("The user to check/transfer to"))
    .addIntegerOption((o) =>
      o.setName("amount").setDescription("Amount to transfer").setMinValue(1),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();
    const target = interaction.options.getUser("user");
    const amount = interaction.options.getInteger("amount");

    // 1. Just checking balance
    if (!target && !amount) {
      const userData = await getUserData(interaction.user.id, interaction.user.username);
      return interaction.editReply({
        embeds: [economyEmbed("Bank Balance", `You currently have **${userData?.credits.toLocaleString() ?? 0}** credits.`)],
      });
    }

    // Checking someone else's balance
    if (target && !amount) {
      if (target.bot) {
        return interaction.editReply({
          embeds: [errorEmbed("Invalid Target", "Bots do not have credits.")],
        });
      }
      const targetData = await getUserData(target.id, target.username);
      return interaction.editReply({
        embeds: [economyEmbed("Bank Balance", `${target.tag} has **${targetData?.credits.toLocaleString() ?? 0}** credits.`)],
      });
    }

    // 2. Transferring credits
    if (target && amount) {
      if (target.id === interaction.user.id) {
        return interaction.editReply({
          embeds: [errorEmbed("Invalid Transfer", "You cannot transfer credits to yourself.")],
        });
      }

      if (target.bot) {
        return interaction.editReply({
          embeds: [errorEmbed("Invalid Transfer", "You cannot transfer credits to a bot.")],
        });
      }

      const senderData = await getUserData(interaction.user.id, interaction.user.username);
      if (!senderData || senderData.credits < amount) {
        return interaction.editReply({
          embeds: [errorEmbed("Insufficient Funds", "You do not have enough credits for this transfer.")],
        });
      }

      const targetData = await getUserData(target.id, target.username);
      if (!targetData) {
        return interaction.editReply({
          embeds: [errorEmbed("Error", "Could not fetch the target user's data.")],
        });
      }

      // 5% tax
      const tax = Math.floor(amount * 0.05);
      const received = amount - tax;

      await updateUserData(interaction.user.id, { credits: senderData.credits - amount });
      await updateUserData(target.id, { credits: targetData.credits + received });

      return interaction.editReply({
        embeds: [
          successEmbed(
            "Transfer Successful",
            `Transferred **${amount.toLocaleString()}** credits to ${target}.\n*A 5% tax (${tax.toLocaleString()} credits) was applied.*`,
          ),
        ],
      });
    }
  },
};

export default command;
