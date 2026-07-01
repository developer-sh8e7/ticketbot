// ══════════════════════════════════════════════════════════════
//  /avatar — Full Discord-style profile card (banner + avatar +
//  badges), sent as a plain public image reply with download
//  buttons — no embed, not ephemeral.
// ══════════════════════════════════════════════════════════════

import { SlashCommandBuilder, ChatInputCommandInteraction, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { Command } from "../../types.js";
import { buildProfileCard } from "../../services/profileCard.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("avatar")
    .setDescription("Display a user's full profile card")
    .addUserOption((o) => o.setName("user").setDescription("The user to inspect")),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();
    const targetPartial = interaction.options.getUser("user") ?? interaction.user;
    // Force fetch: banner/accentColor are not populated on cached/partial users.
    const target = await targetPartial.fetch(true).catch(() => targetPartial);
    const member = interaction.guild?.members.cache.get(target.id) ?? null;

    const card = await buildProfileCard(target, member);
    const attachment = new AttachmentBuilder(card, { name: "profile.png" });

    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel("Download image")
        .setStyle(ButtonStyle.Link)
        .setURL(target.displayAvatarURL({ extension: "png", size: 4096 })),
    );
    if (target.banner) {
      buttons.addComponents(
        new ButtonBuilder()
          .setLabel("Download banner")
          .setStyle(ButtonStyle.Link)
          .setURL(target.bannerURL({ extension: "png", size: 4096 })!),
      );
    }

    await interaction.editReply({ files: [attachment], components: [buttons] });
  },
};

export default command;
