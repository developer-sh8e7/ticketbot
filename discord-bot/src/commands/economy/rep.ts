// ══════════════════════════════════════════════════════════════
//  /rep — Give reputation points
//  V2 — Application Emojis, no Unicode emojis
// ══════════════════════════════════════════════════════════════

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from "discord.js";
import { Command } from "../../types";
import { getUserData, updateUserData } from "../../db/users";
import { errorEmbed, successEmbed } from "../../utils/embed";
import { Emojis } from "../../utils/emojis";

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
        embeds: [errorEmbed("❌ خطأ", "لا يمكنك إعطاء نقطة سمعة لنفسك.")],
      });
    }

    if (target.bot) {
      return interaction.editReply({
        embeds: [errorEmbed("❌ خطأ", "لا يمكنك إعطاء نقطة سمعة للبوتات.")],
      });
    }

    const targetData = await getUserData(target.id, target.username);
    if (!targetData) {
      return interaction.editReply({
        embeds: [errorEmbed("❌ خطأ", "فشل جلب بيانات المستخدم المستهدف.")],
      });
    }

    // Optional: Add cooldown logic here

    const newRep = (targetData.rep || 0) + 1;
    await updateUserData(target.id, { rep: newRep });

    return interaction.editReply({
      embeds: [
        successEmbed(
          "⭐ تم إعطاء سمعة",
          `${Emojis.rep} لقد قمت بإعطاء نقطة سمعة إلى ${target} بنجاح!\nإجمالي نقاط سمعته الآن هو **${newRep}**.`,
        ),
      ],
    });
  },
};

export default command;
