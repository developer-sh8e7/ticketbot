// ══════════════════════════════════════════════════════════════
//  /rep — Give reputation points
//  V2 — Application Emojis, no Unicode emojis
// ══════════════════════════════════════════════════════════════

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from "discord.js";
import { Command } from "../../types.js";
import { getUserData, updateUserData } from "../../db/users.js";
import { errorEmbed, successEmbed } from "../../utils/embed.js";
import { Emojis } from "../../utils/emojis.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("rep")
    .setDescription("Give a reputation point to another user")
    .addUserOption((o) => o.setName("user").setDescription("The user to give rep to").setRequired(true)),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();
    const target = interaction.options.getUser("user", true);

    if (target.id === interaction.user.id) {
      return interaction.editReply({
        embeds: [errorEmbed("Invalid Action", "You cannot give reputation to yourself.")],
      });
    }

    if (target.bot) {
      return interaction.editReply({
        embeds: [errorEmbed("Invalid Action", "You cannot give reputation to bots.")],
      });
    }

    const targetData = await getUserData(target.id, target.username);
    if (!targetData) {
      return interaction.editReply({
        embeds: [errorEmbed("Error", "Failed to fetch target user data.")],
      });
    }

    // Optional: Add cooldown logic here

    const newRep = (targetData.rep || 0) + 1;
    await updateUserData(target.id, { rep: newRep });

    return interaction.editReply({
      embeds: [
        successEmbed(
          "Reputation Given",
          `${Emojis.rep} You have given a reputation point to ${target}!\nTheir total rep is now **${newRep}**.`,
        ),
      ],
    });
  },
};

export default command;
