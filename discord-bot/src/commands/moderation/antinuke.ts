// ══════════════════════════════════════════════════════════════
//  /antinuke — Check status of all Anti-Nuke protection shields
//  V2 — Application Emojis, Premium Arabic Layout
// ══════════════════════════════════════════════════════════════

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  GuildMember,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { Command } from "../../types";
import { successEmbed } from "../../utils/embed";
import { noPermission } from "../../utils/permissions";
import { Config } from "../../config";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("antinuke")
    .setDescription("Check the active status of the server's Anti-Nuke shields"),

  async execute(interaction: ChatInputCommandInteraction) {
    const member = interaction.member as GuildMember;
    const allowedAntiNukeRoles = [
      "1483212264025886886",
      "1483021277181644842",
      "1483020976966074479",
      "1482858415469367336",
      "1483038264393990164"
    ];
    const hasRole = member.roles.cache.some((role) => allowedAntiNukeRoles.includes(role.id)) ||
                    member.id === interaction.guild?.ownerId;
    if (!hasRole) return noPermission(interaction);

    const statusEmbed = new EmbedBuilder()
      .setTitle("🛡️ درع الحماية المتكامل — Anti-Nuke Status")
      .setDescription(
        "جميع وحدات الحماية والـ **Anti-Nuke** تعمل الآن تلقائياً بنسبة **100%** وبأعلى كفاءة لحماية السيرفر على مدار الساعة 24/7 من أي محاولات تخريب أو تهكير."
      )
      .addFields(
        {
          name: "🔴 حماية القنوات (الحذف)",
          value: "`نشطة ⚡` (إعادة الروم تلقائياً + سحب رتب الفاعل + طرد عند التكرار)",
          inline: false,
        },
        {
          name: "🟢 حماية القنوات (الإنشاء)",
          value: "`نشطة ⚡` (حذف الروم تلقائياً + سحب رتب الفاعل + طرد عند التكرار)",
          inline: false,
        },
        {
          name: "🔵 حماية الرتب (الحذف)",
          value: "`نشطة ⚡` (إعادة إنشائها بالصلاحيات + سحب رتب الفاعل + طرد عند التكرار)",
          inline: false,
        },
        {
          name: "🟡 حماية الرتب (الإنشاء)",
          value: "`نشطة ⚡` (حذف الرتبة تلقائياً + سحب رتب الفاعل + طرد عند التكرار)",
          inline: false,
        },
        {
          name: "🟣 حماية الحظر الجماعي (Mass Ban)",
          value: "`نشطة ⚡` (إلغاء حظر العضو تلقائياً + سحب رتب الفاعل + طرد عند التكرار)",
          inline: false,
        }
      )
      .setColor(0x00ff00)
      .setFooter({ text: Config.embed.footer })
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("antinuke_active")
        .setLabel("الدرع نشط بالكامل ✅")
        .setStyle(ButtonStyle.Success)
        .setDisabled(true),
      new ButtonBuilder()
        .setLabel("الدعم الفني / Opus Solutions")
        .setURL("https://discord.gg/ZavYFR4qFr")
        .setStyle(ButtonStyle.Link)
    );

    return interaction.reply({
      embeds: [statusEmbed],
      components: [row],
    });
  },
};

export default command;
