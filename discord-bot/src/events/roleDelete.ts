// ══════════════════════════════════════════════════════════════
//  Event — roleDelete (Anti-Role-Deletion Nuke)
//  V2 — Auto-restores deleted roles & punishes griefers
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

// Tracking in-memory role deletions
const deletionHistory = new Map<string, number[]>();

export default {
  name: "roleDelete" as const,
  once: false,
  async execute(client: Client, role: Role) {
    if (!role.guild) return;

    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      
      const fetchedLogs = await role.guild.fetchAuditLogs({
        limit: 1,
        type: AuditLogEvent.RoleDelete,
      });

      const deletionLog = fetchedLogs.entries.first();
      if (!deletionLog) return;

      const { executor, target } = deletionLog;

      if (!target || target.id !== role.id) return;
      if (!executor || executor.bot) return;
      if (executor.id === role.guild.ownerId) return;

      Logger.warn(`🚨 Anti-Nuke: Role "${role.name}" deleted by ${executor.tag}!`);

      // ── Step 1: Auto-Restore the deleted role (Unconditionally) ──
      Logger.info(`Anti-Nuke: Restoring deleted role "${role.name}"...`);
      const restoredRole = await role.guild.roles.create({
        name: role.name,
        color: role.color,
        hoist: role.hoist,
        permissions: role.permissions,
        mentionable: role.mentionable,
        position: role.position,
        reason: `Anti-Nuke: Restoring deleted role by ${executor.tag}`
      }).catch((err) => {
        Logger.error(`Anti-Nuke: Failed to restore role "${role.name}": ${err}`);
        return null;
      });

      // ── Step 2: Punish Griefer (If possible) ──
      const executorMember = await role.guild.members.fetch(executor.id).catch(() => null);
      let isKicked = false;
      let punished = false;

      if (executorMember) {
        const botMember = role.guild.members.me;
        if (botMember && executorMember.roles.highest.position < botMember.roles.highest.position) {
          punished = true;
          // Track deletions in a 2 minute window
          const now = Date.now();
          const twoMinutes = 2 * 60 * 1000;
          
          let userHistory = deletionHistory.get(executor.id) || [];
          userHistory = userHistory.filter((timestamp) => now - timestamp < twoMinutes);
          userHistory.push(now);
          deletionHistory.set(executor.id, userHistory);

          const deletionCount = userHistory.length;

          if (deletionCount >= 3) {
            // Kick griefer + strip roles
            Logger.warn(`🚨 Anti-Nuke: Kicking ${executor.tag} for role deletion spam!`);
            if (executorMember.manageable) {
              await executorMember.roles.set([]).catch(() => {});
            }
            if (executorMember.kickable) {
              await executorMember.kick("Anti-Nuke: Mass role deletion spam.").then(() => {
                isKicked = true;
              }).catch(() => {});
            }
          } else {
            // Strip roles
            if (executorMember.manageable) {
              await executorMember.roles.set([]).catch(() => {});
            }
          }
        } else {
          Logger.warn(`Anti-Nuke: Cannot punish ${executor.tag} because their role is higher than the bot.`);
        }
      }

      // ── Step 3: Log to standard Logs channel ──
      const dbConfig = await getGuildConfig(role.guild.id);
      const logsChannel = role.guild.channels.cache.get(dbConfig.channels.logs_channel ?? "");
      if (logsChannel?.isTextBased()) {
        let actionText = `⚠️ **لم يتم اتخاذ إجراء عقابي لعدم امتلاك البوت الصلاحية الكافية (رتبة الفاعل أعلى من البوت)**`;
        if (punished) {
          actionText = isKicked
            ? `❌ **طرد العضو لسحب رتبه بالكامل وطره من السيرفر لتجاوزه الحد المسموح (حذف 3 رتب في أقل من دقيقتين)**`
            : `⚠️ **سحب رتب العضو بالكامل لـ محاولة تخريب وحذف رتب السيرفر**`;
        }

        const logEmbed = modEmbed(
          "نظام حماية السيرفر — Anti-Nuke (حذف رتب)",
          `**الرتبة المحذوفة:** \`@${role.name}\` (تمت إعادتها تلقائياً)\n` +
          `**الفاعل:** ${executor} (\`${executor.id}\`)\n` +
          `**الإجراء المتخذ:**\n${actionText}`
        ).setColor(0xff0000);

        await logsChannel.send({ embeds: [logEmbed] }).catch(() => {});
      }

    } catch (err) {
      Logger.error(`Anti-Nuke: Error in roleDelete event: ${err}`);
    }
  }
};
