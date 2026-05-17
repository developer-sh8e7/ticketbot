// ══════════════════════════════════════════════════════════════
//  Event — roleCreate (Anti-Role-Creation Nuke)
//  V2 — Auto-deletes mass created roles & punishes griefers
// ══════════════════════════════════════════════════════════════

import { 
  Client, 
  AuditLogEvent, 
  GuildMember, 
  Role 
} from "discord.js";
import { Logger } from "../utils/logger";
import { getGuildConfig } from "../db/guilds";
import { modEmbed } from "../utils/embed";

// Tracking in-memory role creations
const creationHistory = new Map<string, number[]>();

export default {
  name: "roleCreate" as const,
  once: false,
  async execute(client: Client, role: Role) {
    if (!role.guild) return;

    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      
      const fetchedLogs = await role.guild.fetchAuditLogs({
        limit: 1,
        type: AuditLogEvent.RoleCreate,
      });

      const creationLog = fetchedLogs.entries.first();
      if (!creationLog) return;

      const { executor, target } = creationLog;

      if (!target || target.id !== role.id) return;
      if (!executor || executor.bot) return;
      if (executor.id === role.guild.ownerId) return;

      Logger.warn(`🚨 Anti-Nuke: Role "${role.name}" created by ${executor.tag}!`);

      // Fetch executor as member
      const executorMember = await role.guild.members.fetch(executor.id).catch(() => null);
      if (!executorMember) return;

      // Hierarchy check
      const botMember = role.guild.members.me;
      if (botMember && executorMember.roles.highest.position >= botMember.roles.highest.position) return;

      // Track creations in a 2 minute window
      const now = Date.now();
      const twoMinutes = 2 * 60 * 1000;
      
      let userHistory = creationHistory.get(executor.id) || [];
      userHistory = userHistory.filter((timestamp) => now - timestamp < twoMinutes);
      userHistory.push(now);
      creationHistory.set(executor.id, userHistory);

      const creationCount = userHistory.length;
      let isKicked = false;

      if (creationCount >= 3) {
        // Kick griefer + strip roles
        Logger.warn(`🚨 Anti-Nuke: Kicking ${executor.tag} for role creation spam!`);
        if (executorMember.manageable) {
          await executorMember.roles.set([]).catch(() => {});
        }
        if (executorMember.kickable) {
          await executorMember.kick("Anti-Nuke: Mass role creation spam.").then(() => {
            isKicked = true;
          }).catch(() => {});
        }
      } else {
        // Strip roles
        if (executorMember.manageable) {
          await executorMember.roles.set([]).catch(() => {});
        }
      }

      // Auto-delete the spawned role
      await role.delete(`Anti-Nuke: Mass role creation spam by ${executor.tag}`).catch(() => {});

      // Log to logs channel
      const dbConfig = await getGuildConfig(role.guild.id);
      const logsChannel = role.guild.channels.cache.get(dbConfig.channels.logs_channel ?? "");
      if (logsChannel?.isTextBased()) {
        const actionText = isKicked
          ? `❌ **طرد العضو لسحب رتبه بالكامل وطره من السيرفر لتجاوزه الحد المسموح (إنشاء 3 رتب في أقل من دقيقتين)**`
          : `⚠️ **سحب رتب العضو بالكامل لـ محاولة تخريب وإنشاء رتب عشوائية في السيرفر**`;

        const logEmbed = modEmbed(
          "نظام حماية السيرفر — Anti-Nuke (إنشاء رتب)",
          `**الرتبة المنشأة:** \`@${role.name}\` (تم حذفها تلقائياً)\n` +
          `**الفاعل:** ${executor} (\`${executor.id}\`)\n` +
          `**الإجراء المتخذ:**\n${actionText}`
        ).setColor(0xff0000);

        await logsChannel.send({ embeds: [logEmbed] }).catch(() => {});
      }

    } catch (err) {
      Logger.error(`Anti-Nuke: Error in roleCreate event: ${err}`);
    }
  }
};
