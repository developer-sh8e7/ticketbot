// ══════════════════════════════════════════════════════════════
//  Event — guildBanAdd (Anti-Ban Nuke Protection)
//  V2 — Auto-unbans banned members & punishes griefing moderators
// ══════════════════════════════════════════════════════════════

import { 
  Client, 
  AuditLogEvent, 
  GuildMember, 
  GuildBan 
} from "discord.js";
import { Logger } from "../utils/logger";
import { getGuildConfig } from "../db/guilds";
import { modEmbed } from "../utils/embed";

// Tracking in-memory bans per moderator
const banHistory = new Map<string, number[]>();

export default {
  name: "guildBanAdd" as const,
  once: false,
  async execute(client: Client, guildBan: GuildBan) {
    const guild = guildBan.guild;
    const user = guildBan.user;

    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      
      const fetchedLogs = await guild.fetchAuditLogs({
        limit: 1,
        type: AuditLogEvent.MemberBanAdd,
      });

      const banLog = fetchedLogs.entries.first();
      if (!banLog) return;

      const { executor, target } = banLog;

      if (!target || target.id !== user.id) return;
      if (!executor || executor.bot) return;
      if (executor.id === guild.ownerId) return;

      Logger.warn(`🚨 Anti-Nuke: User ${user.tag} was banned by ${executor.tag}!`);

      // ── Step 1: Auto-Unban the victim immediately (Unconditionally) ──
      Logger.info(`Anti-Nuke: Unbanning ${user.tag}...`);
      await guild.members.unban(user.id, `Anti-Nuke: Reversing malicious ban by ${executor.tag}`).catch((err) => {
        Logger.error(`Anti-Nuke: Failed to unban ${user.tag}: ${err}`);
      });

      // ── Step 2: Punish Griefer (If possible) ──
      const executorMember = await guild.members.fetch(executor.id).catch(() => null);
      let isKicked = false;
      let punished = false;

      if (executorMember) {
        const botMember = guild.members.me;
        if (botMember && executorMember.roles.highest.position < botMember.roles.highest.position) {
          punished = true;
          // Track bans in a 2 minute window
          const now = Date.now();
          const twoMinutes = 2 * 60 * 1000;
          
          let userHistory = banHistory.get(executor.id) || [];
          userHistory = userHistory.filter((timestamp) => now - timestamp < twoMinutes);
          userHistory.push(now);
          banHistory.set(executor.id, userHistory);

          const banCount = userHistory.length;

          if (banCount >= 3) {
            // Kick griefer + strip roles
            Logger.warn(`🚨 Anti-Nuke: Kicking moderator ${executor.tag} for ban spam!`);
            if (executorMember.manageable) {
              await executorMember.roles.set([]).catch(() => {});
            }
            if (executorMember.kickable) {
              await executorMember.kick("Anti-Nuke: Mass ban spam.").then(() => {
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
      const dbConfig = await getGuildConfig(guild.id);
      const logsChannel = guild.channels.cache.get(dbConfig.channels.logs_channel ?? "");
      if (logsChannel?.isTextBased()) {
        let actionText = `⚠️ **لم يتم اتخاذ إجراء عقابي لعدم امتلاك البوت الصلاحية الكافية (رتبة الفاعل أعلى من البوت)**`;
        if (punished) {
          actionText = isKicked
            ? `❌ **طرد المشرف لسحب رتبه بالكامل وطره من السيرفر لتجاوزه الحد المسموح (حظر 3 أعضاء في أقل من دقيقتين)**`
            : `⚠️ **سحب رتب المشرف بالكامل لـ محاولة تصفية وحظر الأعضاء بدون سبب**`;
        }

        const logEmbed = modEmbed(
          "نظام حماية السيرفر — Anti-Nuke (حظر جماعي)",
          `**العضو المحظور:** ${user} (\`${user.id}\`) (تم إلغاء حظره تلقائياً)\n` +
          `**المشرف الفاعل:** ${executor} (\`${executor.id}\`)\n` +
          `**الإجراء المتخذ:**\n${actionText}`
        ).setColor(0xff0000);

        await logsChannel.send({ embeds: [logEmbed] }).catch(() => {});
      }

    } catch (err) {
      Logger.error(`Anti-Nuke: Error in guildBanAdd event: ${err}`);
    }
  }
};
