// ══════════════════════════════════════════════════════════════
//  Event — channelCreate (Anti-Channel-Creation Nuke)
//  V2 — Auto-deletes malicious mass-created channels
// ══════════════════════════════════════════════════════════════

import { 
  Client, 
  AuditLogEvent, 
  GuildMember, 
  GuildChannel 
} from "discord.js";
import { Logger } from "../utils/logger";
import { getGuildConfig } from "../db/guilds";
import { modEmbed } from "../utils/embed";

// Tracking in-memory channel creations per user
const creationHistory = new Map<string, number[]>();

export default {
  name: "channelCreate" as const,
  once: false,
  async execute(client: Client, channel: GuildChannel) {
    if (!channel.guild) return;

    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      
      const fetchedLogs = await channel.guild.fetchAuditLogs({
        limit: 1,
        type: AuditLogEvent.ChannelCreate,
      });

      const creationLog = fetchedLogs.entries.first();
      if (!creationLog) return;

      const { executor, target } = creationLog;

      if (!target || target.id !== channel.id) return;
      if (!executor || executor.bot) return;
      if (executor.id === channel.guild.ownerId) return;

      // Fetch executor as member
      const executorMember = await channel.guild.members.fetch(executor.id).catch(() => null);
      if (!executorMember) return;

      // Hierarchy check
      const botMember = channel.guild.members.me;
      if (botMember && executorMember.roles.highest.position >= botMember.roles.highest.position) return;

      Logger.warn(`🚨 Anti-Nuke: Channel "${channel.name}" created by ${executor.tag}!`);

      // Track creations in a 2 minute window
      const now = Date.now();
      const twoMinutes = 2 * 60 * 1000;
      
      let userHistory = creationHistory.get(executor.id) || [];
      userHistory = userHistory.filter((timestamp) => now - timestamp < twoMinutes);
      userHistory.push(now);
      creationHistory.set(executor.id, userHistory);

      const creationCount = userHistory.length;
      let isKicked = false;

      if (creationCount >= 4) {
        // Kick griefer + strip roles
        Logger.warn(`🚨 Anti-Nuke: Kicking ${executor.tag} for channel creation spam!`);
        if (executorMember.manageable) {
          await executorMember.roles.set([]).catch(() => {});
        }
        if (executorMember.kickable) {
          await executorMember.kick("Anti-Nuke: Mass channel creation spam.").then(() => {
            isKicked = true;
          }).catch(() => {});
        }
      } else {
        // Strip roles
        if (executorMember.manageable) {
          await executorMember.roles.set([]).catch(() => {});
        }
      }

      // Auto-delete the spawned channel
      if (channel.deletable) {
        await channel.delete(`Anti-Nuke: Mass channel creation spam by ${executor.tag}`).catch(() => {});
      }

      // Log to logs channel
      const dbConfig = await getGuildConfig(channel.guild.id);
      const logsChannel = channel.guild.channels.cache.get(dbConfig.channels.logs_channel ?? "");
      if (logsChannel?.isTextBased()) {
        const actionText = isKicked
          ? `❌ **طرد العضو لسحب رتبه بالكامل وطره من السيرفر لتجاوزه الحد المسموح (إنشاء 4 رومات في أقل من دقيقتين)**`
          : `⚠️ **سحب رتب العضو بالكامل لـ محاولة تخريب وإنشاء رومات عشوائية**`;

        const logEmbed = modEmbed(
          "نظام حماية السيرفر — Anti-Nuke (إنشاء رومات)",
          `**الروم المنشأ:** \`#${channel.name}\` (تم حذفه تلقائياً)\n` +
          `**الفاعل:** ${executor} (\`${executor.id}\`)\n` +
          `**الإجراء المتخذ:**\n${actionText}`
        ).setColor(0xff0000);

        await logsChannel.send({ embeds: [logEmbed] }).catch(() => {});
      }

    } catch (err) {
      Logger.error(`Anti-Nuke: Error in channelCreate event: ${err}`);
    }
  }
};
