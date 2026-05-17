// ══════════════════════════════════════════════════════════════
//  /roll — Roll a dice
//  V2 — Application Emojis, no Unicode emojis
// ══════════════════════════════════════════════════════════════

import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { Command } from "../../types";
import { createEmbed, Colors } from "../../utils/embed";
import { Emojis } from "../../utils/emojis";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("roll")
    .setDescription("Roll a dice (1-6) or specify a maximum number")
    .addIntegerOption((o) =>
      o.setName("max").setDescription("Maximum number to roll (default: 6)").setMinValue(2),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const max = interaction.options.getInteger("max") ?? 6;
    const result = Math.floor(Math.random() * max) + 1;

    await interaction.reply({
      embeds: [
        createEmbed(
          `${Emojis.dice}  Dice Roll`,
          `You rolled a **${result}** (1-${max})`,
          Colors.info,
        ),
      ],
    });
  },
};

export default command;
