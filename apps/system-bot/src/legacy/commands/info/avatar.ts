// ══════════════════════════════════════════════════════════════
//  /avatar — Display a user's avatar
//  V2 — Application Emojis, no Unicode emojis
// ══════════════════════════════════════════════════════════════

import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { Command } from "../../types";
import { Colors } from "../../utils/embed";
import { Emojis } from "../../utils/emojis";
import { Config } from "../../config";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("avatar")
    .setDescription("Display a user's avatar")
    .addUserOption((o) => o.setName("user").setDescription("The user to get the avatar of")),

  async execute(interaction: ChatInputCommandInteraction) {
    const target = interaction.options.getUser("user") ?? interaction.user;
    const member = interaction.guild?.members.cache.get(target.id);

    const globalAvatar = target.displayAvatarURL({ size: 4096 });
    const serverAvatar = member?.displayAvatarURL({ size: 4096 });

    const embed = new EmbedBuilder()
      .setTitle(`${Emojis.avatar}  ${target.tag}'s Avatar`)
      .setColor(Colors.primary)
      .setImage(serverAvatar ?? globalAvatar)
      .setDescription(
        [
          `[Global Avatar](${globalAvatar})`,
          serverAvatar && serverAvatar !== globalAvatar ? `[Server Avatar](${serverAvatar})` : null,
        ]
          .filter(Boolean)
          .join(" • "),
      )
      .setFooter({ text: Config.embed.footer })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
