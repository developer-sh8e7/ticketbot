// ══════════════════════════════════════════════════════════════
//  /help — Display all commands
//  V2 — Application Emojis, premium styling
// ══════════════════════════════════════════════════════════════

import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { Command } from "../../types.js";
import { Colors } from "../../utils/embed.js";
import { Emojis } from "../../utils/emojis.js";
import { Config } from "../../config.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Display a list of all commands"),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const embed = new EmbedBuilder()
      .setTitle(`${Emojis.help}  Opus Commands`)
      .setDescription("Here is a list of all available commands for Opus System Bot V2.")
      .setColor(Colors.primary)
      .addFields(
        {
          name: `${Emojis.shield} Moderation`,
          value: "`ban`, `softban`, `kick`, `timeout`, `mute`, `unmute`, `warn`, `warnings`, `clearwarns`, `clear`, `unban`, `slowmode`, `lock`, `unlock`, `nuke`, `role`, `nick`, `hide`, `show`",
        },
        {
          name: `${Emojis.settings} Settings & Protection`,
          value: "`setwelcome`, `setleave`, `setlogs`, `autorole`, `embed`, `antiraid`, `antilinks`, `antispam`, `antibots`, `antiswear`",
        },
        {
          name: `${Emojis.info} Information`,
          value: "`serverinfo`, `userinfo`, `avatar`, `ping`, `help`, `profile`",
        },
        {
          name: `${Emojis.credits} Economy`,
          value: "`credits`, `daily`, `rep`",
        },
        {
          name: `${Emojis.xp} Levels`,
          value: "`rank`, `top`",
        },
        {
          name: `${Emojis.dice} Fun`,
          value: "`roll`, `coinflip`",
        },
      )
      .setThumbnail(interaction.client.user?.displayAvatarURL() ?? null)
      .setFooter({ text: Config.embed.footer })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};

export default command;
