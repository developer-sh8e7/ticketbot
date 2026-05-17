// ══════════════════════════════════════════════════════════════
//  Event — messageCreate (XP, Anti-Spam, Anti-Links, Anti-Swear)
//  V2 — Application Emojis, Advanced Profanity Filter
// ══════════════════════════════════════════════════════════════

import { Client, Message, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import { getMemberData, updateMemberData } from "../db/members";
import { getGuildConfig } from "../db/guilds";
import { filterEmbed, errorEmbed, Colors } from "../utils/embed";
import { Emojis } from "../utils/emojis";
import { Config } from "../config";
import { Logger } from "../utils/logger";
import { checkProfanity, checkSpam, SPAM_CONFIG } from "../utils/profanityFilter";

const SWEAR_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 1 day timeout for swearing

export default {
  name: "messageCreate" as const,
  once: false,
  async execute(_client: Client, message: Message) {
    if (message.author.bot || !message.guild) return;

    const guildConfig = await getGuildConfig(message.guild.id);
    const isStaff = message.member?.permissions.has(PermissionFlagsBits.ManageMessages);

    // ── Anti-Swear / Profanity Filter ───────────────────────
    if (guildConfig.modules.antiswear_enabled) {
      const result = checkProfanity(message.content);
      if (result.detected) {
        Logger.filter(`Profanity detected from ${message.author.tag}: "${result.word}" (${result.type})`);

        // Delete the message
        await message.delete().catch(() => {});

        // Timeout the user for 1 day
        await message.member?.timeout(SWEAR_TIMEOUT_MS, `Auto-Filter: Profanity detected (${result.type})`).catch(() => {});

        // Send warning embed
        const warnEmbed = new EmbedBuilder()
          .setTitle(`${Emojis.filter}  الفلتر التلقائي (حظر الكلمات)`)
          .setDescription(
            [
              `${message.author} تم إسكاته مؤقتاً لمدة **24 ساعة**.`,
              "",
              `**السبب:** استخدام كلمات بذيئة / غير لائقة في السيرفر`,
              `**التصنيف:** ${result.type}`,
            ].join("\n"),
          )
          .setColor(Colors.filter)
          .setFooter({ text: Config.embed.footer })
          .setTimestamp();

        if (message.channel.isTextBased() && "send" in message.channel) {
          const sent = await message.channel.send({
            embeds: [warnEmbed],
          }).catch(() => null);
          if (sent) setTimeout(() => sent.delete().catch(() => {}), 8000);
        }

        // Log to mod logs channel
        if (guildConfig.modules.logging_enabled && guildConfig.channels.logs_channel) {
          const logChannel = message.guild.channels.cache.get(guildConfig.channels.logs_channel);
          if (logChannel?.isTextBased()) {
            const logEmbed = new EmbedBuilder()
              .setTitle(`${Emojis.filter}  سجل الفلتر التلقائي`)
              .setDescription(
                [
                  `**المستخدم:** ${message.author.tag} (\`${message.author.id}\`)`,
                  `**الروم:** ${message.channel}`,
                  `**نوع التصفية:** ${result.type}`,
                  `**الكلمة المخالفة:** ||\`${result.word}\`||`,
                  `**الرسالة الأصلية:** ||\`${message.content.slice(0, 500)}\`||`,
                  `**الإجراء المتخذ:** إسكات 24 ساعة + حذف الرسالة تلقائياً`,
                ].join("\n"),
              )
              .setColor(Colors.filter)
              .setFooter({ text: Config.embed.footer })
              .setTimestamp();

            await logChannel.send({ embeds: [logEmbed] }).catch(() => {});
          }
        }

        return;
      }
    }

    // ── Anti-Links ─────────────────────────────────────────────
    if (guildConfig.modules.antilinks_enabled && !isStaff) {
      const linkRegex = /(https?:\/\/[^\s]+)/gi;
      if (linkRegex.test(message.content)) {
        await message.delete().catch(() => {});
        if (message.channel.isTextBased() && "send" in message.channel) {
          const sent = await message.channel.send({
            content: `${message.author}`,
            embeds: [filterEmbed("🚫 منع الروابط", "يُمنع إرسال الروابط الخارجية في هذا السيرفر.")],
          }).catch(() => null);
          if (sent) setTimeout(() => sent.delete().catch(() => {}), 5000);
        }
        return;
      }
    }

    // ── Anti-Spam ──────────────────────────────────────────────
    if (guildConfig.modules.antispam_enabled && !isStaff) {
      const mentionCount = message.mentions.users.size + message.mentions.roles.size;
      const isSpamming = checkSpam(message.author.id, message.content, mentionCount);

      if (isSpamming) {
        await message.delete().catch(() => {});
        await message.member?.timeout(SPAM_CONFIG.timeoutMs, "Auto-Filter: Spam detected").catch(() => {});

        if (message.channel.isTextBased() && "send" in message.channel) {
          const sent = await message.channel.send({
            content: `${message.author}`,
            embeds: [filterEmbed("🚫 منع التكرار والسبام", "تم اكتشاف إرسال رسائل أو منشن مكرر بشكل مفرط. تم إسكاتك مؤقتاً لمدة دقيقة واحدة لحماية السيرفر.")],
          }).catch(() => null);
          if (sent) setTimeout(() => sent.delete().catch(() => {}), 5000);
        }
        return;
      }
    }

    // ── XP & Leveling ──────────────────────────────────────────
    const memberData = await getMemberData(message.guild.id, message.author.id);
    if (memberData) {
      const xpToAdd = Math.floor(Math.random() * 10) + 5; // 5-15 XP
      const newXP = Number(memberData.xp) + xpToAdd;
      const nextLevelXP = memberData.level * memberData.level * 100;

      if (newXP >= nextLevelXP) {
        const newLevel = memberData.level + 1;
        await updateMemberData(message.guild.id, message.author.id, {
          xp: newXP,
          level: newLevel,
        });
      } else {
        await updateMemberData(message.guild.id, message.author.id, {
          xp: newXP,
        });
      }
    }
  },
};
