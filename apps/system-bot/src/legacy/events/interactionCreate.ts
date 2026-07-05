// ══════════════════════════════════════════════════════════════
//  Event — interactionCreate (Slash Commands & Buttons)
//  V2 — Application Emojis, no Unicode emojis
// ══════════════════════════════════════════════════════════════

import { Client, Interaction } from "discord.js";
import { errorEmbed } from "../utils/embed.js";
import { Logger } from "../utils/logger.js";
import { handleJailInteraction } from "../services/jailSystem.js";
import { handleSetupBotsInteraction } from "../services/setupBots.js";

export default {
  name: "interactionCreate" as const,
  once: false,
  async execute(client: Client, interaction: Interaction) {
    if (await handleJailInteraction(interaction)) return;
    if (await handleSetupBotsInteraction(interaction)) return;

    if (interaction.isChatInputCommand()) {
      const command = (client as any).commands?.get(interaction.commandName);
      if (!command) {
        Logger.warn(`No command matching ${interaction.commandName} was found.`);
        return;
      }

      try {
        await command.execute(interaction);
      } catch (error) {
        Logger.error(`Error executing ${interaction.commandName}: ${error}`);
        const embed = errorEmbed("Command Failed", "There was an error while executing this command.");
        try {
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ embeds: [embed], ephemeral: true });
          } else {
            await interaction.reply({ embeds: [embed], ephemeral: true });
          }
        } catch (replyError) {
          Logger.error(`Failed to send error reply for ${interaction.commandName}: ${replyError}`);
        }
      }
    }
  },
};
