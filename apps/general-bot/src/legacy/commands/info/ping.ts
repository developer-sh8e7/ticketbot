// ══════════════════════════════════════════════════════════════
//  /ping — Check bot latency
//  V2 — Application Emojis, no Unicode emojis
// ══════════════════════════════════════════════════════════════

import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { Command } from "../../types";
import { Colors } from "../../utils/embed";
import { Emojis } from "../../utils/emojis";
import { Config } from "../../config";

const command: Command = {
  data: new SlashCommandBuilder().setName("ping").setDescription("Check bot latency"),

  async execute(interaction: ChatInputCommandInteraction) {
    const sent = await interaction.reply({ content: "Pinging...", fetchReply: true });
    const latency = sent.createdTimestamp - interaction.createdTimestamp;

    let statusEmoji = Emojis.online;
    if (latency > 200) statusEmoji = Emojis.idle;
    if (latency > 500) statusEmoji = Emojis.dnd;

    const embed = new EmbedBuilder()
      .setTitle(`${Emojis.ping}  Pong!`)
      .setColor(Colors.primary)
      .addFields(
        { name: "Bot Latency", value: `${statusEmoji} ${latency}ms`, inline: true },
        { name: "API Latency", value: `${statusEmoji} ${Math.round(interaction.client.ws.ping)}ms`, inline: true },
      )
      .setFooter({ text: Config.embed.footer })
      .setTimestamp();

    await interaction.editReply({ content: null, embeds: [embed] });
  },
};

export default command;
