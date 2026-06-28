// ══════════════════════════════════════════════════════════════
//  /coinflip — Flip a coin
//  V2 — Application Emojis, no Unicode emojis
// ══════════════════════════════════════════════════════════════

import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { Command } from "../../types.js";
import { createEmbed, Colors } from "../../utils/embed.js";
import { Emojis } from "../../utils/emojis.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("coinflip")
    .setDescription("Flip a coin (Heads or Tails)"),

  async execute(interaction: ChatInputCommandInteraction) {
    const isHeads = Math.random() < 0.5;
    const result = isHeads ? "Heads" : "Tails";

    await interaction.reply({
      embeds: [
        createEmbed(
          `${Emojis.coin}  Coin Flip`,
          `The coin landed on **${result}**!`,
          Colors.economy,
        ),
      ],
    });
  },
};

export default command;
