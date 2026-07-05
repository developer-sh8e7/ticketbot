// ══════════════════════════════════════════════════════════════
//  Event — messageCreate (XP, Anti-Spam, Anti-Links, Anti-Swear)
//  V2 — Application Emojis, Advanced Profanity Filter
// ══════════════════════════════════════════════════════════════

import { Client, Message, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import { getMemberData, updateMemberData } from "../db/members.js";
import { getGuildConfig } from "../db/guilds.js";
import { filterEmbed, errorEmbed, Colors } from "../utils/embed.js";
import { Emojis } from "../utils/emojis.js";
import { Config } from "../config.js";
import { Logger } from "../utils/logger.js";
import { checkProfanity, checkSpam, SPAM_CONFIG } from "../utils/profanityFilter.js";
import { tryDispatchAlias } from "../services/aliasCommands.js";
import { handleJailMessage } from "../services/jailSystem.js";
import { handleSetupBotsMessage } from "../services/setupBots.js";

const SWEAR_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 1 day timeout for swearing

export default {
  name: "messageCreate" as const,
  once: false,
  async execute(client: Client, message: Message) {
    if (message.author.bot || !message.guild) return;

    // ── نظام السجن بدون بريفكس داخل روم سجن-تحكم ─────────
    if (await handleJailMessage(client, message)) return;

    // ── أمر !setup-bots (لوحة عرض البوتات — سيرفر محدد فقط) ─────────
    if (await handleSetupBotsMessage(message)) return;

    // ── اختصارات الأوامر (مثل "باند @شخص" => /ban) ─────────
    const commands = (client as any).commands;
    if (commands && (await tryDispatchAlias(message, commands))) return;

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
          .setTitle(`${Emojis.filter}  Auto-Filter`)
          .setDescription(
            [
              `${message.author} has been timed out for **24 hours**.`,
              "",
              `**Reason:** Profanity / Offensive language detected`,
              `**Detection:** ${result.type}`,
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
              .setTitle(`${Emojis.filter}  Auto-Filter Log`)
              .setDescription(
                [
                  `**User:** ${message.author.tag} (\`${message.author.id}\`)`,
                  `**Channel:** ${message.channel}`,
                  `**Detection Type:** ${result.type}`,
                  `**Matched Word:** ||\`${result.word}\`||`,
                  `**Original Message:** ||\`${message.content.slice(0, 500)}\`||`,
                  `**Action:** Timeout 24h + Message Deleted`,
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
            embeds: [filterEmbed("Anti-Links", "Links are not allowed in this server.")],
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
            embeds: [filterEmbed("Anti-Spam", "Spam detected. You have been muted for 1 minute.")],
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
