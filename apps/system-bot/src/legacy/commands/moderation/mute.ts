import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { Command } from "../../types.js";
import { runTimeoutCommand } from "./timeout.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("mute")
    .setDescription("Mute a member using Discord timeout")
    .addUserOption((o) => o.setName("user").setDescription("The user to mute").setRequired(true))
    .addStringOption((o) => o.setName("duration").setDescription("Duration (e.g. 10m, 1h, 1d)").setRequired(true))
    .addStringOption((o) => o.setName("reason").setDescription("Reason for the mute")),

  async execute(interaction: ChatInputCommandInteraction) {
    await runTimeoutCommand(interaction, "mute");
  },
};

export default command;
