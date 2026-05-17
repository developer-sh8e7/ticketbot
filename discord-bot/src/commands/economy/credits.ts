// ══════════════════════════════════════════════════════════════
//  /credits — Check or transfer credits
//  V2 — Application Emojis, no Unicode emojis
// ══════════════════════════════════════════════════════════════

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from "discord.js";
import { Command } from "../../types";
import { getUserData, updateUserData } from "../../db/users";
import { errorEmbed, successEmbed, economyEmbed } from "../../utils/embed";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("credits")
    .setDescription("Check your credits or transfer to someone else")
    .addUserOption((o) => o.setName("user").setDescription("The user to check/transfer to"))
    .addIntegerOption((o) =>
      o.setName("amount").setDescription("Amount to transfer").setMinValue(1),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();
    const target = interaction.options.getUser("user");
    const amount = interaction.options.getInteger("amount");

    // 1. Just checking balance
    if (!target && !amount) {
      const userData = await getUserData(interaction.user.id, interaction.user.username);
      return interaction.editReply({
        embeds: [economyEmbed("💳 رصيدك البنكي", `أنت تمتلك حالياً **${userData?.credits.toLocaleString() ?? 0}** نقطة/كريديت.`)],
      });
    }

    // Checking someone else's balance
    if (target && !amount) {
      if (target.bot) {
        return interaction.editReply({
          embeds: [errorEmbed("❌ خطأ", "البوتات لا تمتلك رصيداً أو نقاطاً.")],
        });
      }
      const targetData = await getUserData(target.id, target.username);
      return interaction.editReply({
        embeds: [economyEmbed("💳 الرصيد البنكي", `العضو ${target} يمتلك حالياً **${targetData?.credits.toLocaleString() ?? 0}** نقطة/كريديت.`)],
      });
    }

    // 2. Transferring credits
    if (target && amount) {
      if (target.id === interaction.user.id) {
        return interaction.editReply({
          embeds: [errorEmbed("❌ تحويل غير صالح", "لا يمكنك تحويل النقاط لنفسك.")],
        });
      }

      if (target.bot) {
        return interaction.editReply({
          embeds: [errorEmbed("❌ تحويل غير صالح", "لا يمكنك تحويل النقاط للبوتات.")],
        });
      }

      const senderData = await getUserData(interaction.user.id, interaction.user.username);
      if (!senderData || senderData.credits < amount) {
        return interaction.editReply({
          embeds: [errorEmbed("❌ رصيد غير كافٍ", "رصيدك الحالي غير كافٍ لإتمام عملية التحويل هذه.")],
        });
      }

      const targetData = await getUserData(target.id, target.username);
      if (!targetData) {
        return interaction.editReply({
          embeds: [errorEmbed("❌ خطأ", "حدث خطأ أثناء محاولة جلب بيانات المستلم.")],
        });
      }

      // 5% tax
      const tax = Math.floor(amount * 0.05);
      const received = amount - tax;

      await updateUserData(interaction.user.id, { credits: senderData.credits - amount });
      await updateUserData(target.id, { credits: targetData.credits + received });

      return interaction.editReply({
        embeds: [
          successEmbed(
            "✅ تم التحويل بنجاح",
            `تم تحويل **${amount.toLocaleString()}** نقطة إلى ${target} بنجاح.\n*ضريبة التحويل 5% بقيمة (${tax.toLocaleString()} نقطة) تم استقطاعها.*`,
          ),
        ],
      });
    }
  },
};

export default command;
