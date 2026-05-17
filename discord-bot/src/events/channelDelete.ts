// ══════════════════════════════════════════════════════════════
//  Event — channelDelete (Anti-Nuke Protection)
//  V2 — Auto-restores deleted channels & punishes griefers
// ══════════════════════════════════════════════════════════════

import { 
  Client, 
  AuditLogEvent, 
  GuildMember, 
  ChannelType, 
  GuildChannel,
  TextChannel,
  VoiceChannel,
  CategoryChannel,
  ForumChannel,
  StageChannel,
  PermissionFlagsBits
} from "discord.js";
import { Logger } from "../utils/logger";
import { getGuildConfig } from "../db/guilds";
import { modEmbed } from "../utils/embed";

// In-memory tracking of channel deletions
// Key: userId, Value: Array of timestamps of deletions
const deletionHistory = new Map<string, number[]>();

export default {
  name: "channelDelete" as const,
  once: false,
  async execute(client: Client, channel: GuildChannel) {
    if (!channel.guild) return;

    try {
      // 1. Fetch the audit logs to find the executor
      // Wait a short duration to ensure Discord audit logs are updated
      await new Promise((resolve) => setTimeout(resolve, 1000));
      
      const fetchedLogs = await channel.guild.fetchAuditLogs({
        limit: 1,
        type: AuditLogEvent.ChannelDelete,
      });

      const deletionLog = fetchedLogs.entries.first();
      if (!deletionLog) {
        Logger.warn(`Channel ${channel.name} was deleted, but no audit log entry was found.`);
        return;
      }

      const { executor, target } = deletionLog;

      // Ensure the audit log target matches the deleted channel id
      if (!target || target.id !== channel.id) {
        Logger.warn(`Audit log target mismatch for channel ${channel.name}.`);
        return;
      }

      if (!executor || executor.bot) return; // Ignore if deleted by a bot (including this bot)
      if (executor.id === channel.guild.ownerId) return; // Ignore if deleted by server owner

      Logger.warn(`🚨 Anti-Nuke: Channel "${channel.name}" was deleted by ${executor.tag} (${executor.id})!`);

      // ── Step 1: Auto-Restore the deleted channel (Unconditionally) ──
      Logger.info(`Anti-Nuke: Auto-restoring deleted channel "${channel.name}"...`);
      
      const parentId = channel.parentId;
      const position = channel.position;
      const permissionOverwrites = channel.permissionOverwrites.cache.map((overwrite) => ({
        id: overwrite.id,
        type: overwrite.type,
        allow: overwrite.allow.toArray(),
        deny: overwrite.deny.toArray(),
      }));

      // Create parameters for recreation
      const newChannelOptions: any = {
        name: channel.name,
        type: channel.type,
        parent: parentId || undefined,
        position: position,
        permissionOverwrites: permissionOverwrites,
      };

      if (channel instanceof TextChannel) {
        newChannelOptions.topic = channel.topic || undefined;
        newChannelOptions.nsfw = channel.nsfw;
        newChannelOptions.rateLimitPerUser = channel.rateLimitPerUser;
      } else if (channel instanceof VoiceChannel) {
        newChannelOptions.userLimit = channel.userLimit;
        newChannelOptions.bitrate = channel.bitrate;
      }

      const restoredChannel = await channel.guild.channels.create(newChannelOptions).catch((err) => {
        Logger.error(`Anti-Nuke: Failed to restore channel "${channel.name}": ${err}`);
        return null;
      });

      if (restoredChannel) {
        Logger.success(`Anti-Nuke: Successfully restored channel "${channel.name}"!`);
      }

      // ── Step 2: Punish Griefer (If possible) ──
      const executorMember = await channel.guild.members.fetch(executor.id).catch(() => null);
      let isKicked = false;
      let punished = false;

      if (executorMember) {
        const botMember = channel.guild.members.me;
        if (botMember && executorMember.roles.highest.position < botMember.roles.highest.position) {
          punished = true;
          // Keep track of recent channel deletions (Time frame: 2 minutes = 120,000 ms)
          const now = Date.now();
          const twoMinutes = 2 * 60 * 1000;
          
          let userHistory = deletionHistory.get(executor.id) || [];
          userHistory = userHistory.filter((timestamp) => now - timestamp < twoMinutes);
          userHistory.push(now);
          deletionHistory.set(executor.id, userHistory);

          const deletionCount = userHistory.length;
          Logger.info(`Anti-Nuke: ${executor.tag} has deleted ${deletionCount} channels in the last 2 minutes.`);

          if (deletionCount >= 4) {
            // Punish: STRIP ALL ROLES + KICK
            Logger.warn(`🚨 GRIEFER DETECTED! ${executor.tag} deleted ${deletionCount} channels in under 2 minutes. Kicking...`);
            
            // Strip roles first
            if (executorMember.manageable) {
              await executorMember.roles.set([]).catch((err) => {
                Logger.error(`Anti-Nuke: Failed to strip roles from ${executor.tag}: ${err}`);
              });
            }

            // Kick from server
            if (executorMember.kickable) {
              await executorMember.kick("Anti-Nuke Protection: Deleted 4 channels in less than 2 minutes.").then(() => {
                isKicked = true;
                Logger.success(`Anti-Nuke: Successfully kicked griefer ${executor.tag}.`);
              }).catch((err) => {
                Logger.error(`Anti-Nuke: Failed to kick ${executor.tag}: ${err}`);
              });
            }
          } else {
            // Punish: STRIP ALL ROLES
            Logger.warn(`Anti-Nuke: Stripping all roles from ${executor.tag} for deleting channel "${channel.name}".`);
            if (executorMember.manageable) {
              await executorMember.roles.set([]).catch((err) => {
                Logger.error(`Anti-Nuke: Failed to strip roles from ${executor.tag}: ${err}`);
              });
            }
          }
        } else {
          Logger.warn(`Anti-Nuke: Cannot punish ${executor.tag} because their role is higher than the bot.`);
        }
      }

      // ── Step 3: Log to standard Logs channel ──
      const dbConfig = await getGuildConfig(channel.guild.id);
      const logsChannel = channel.guild.channels.cache.get(dbConfig.channels.logs_channel ?? "");
      if (logsChannel?.isTextBased()) {
        let punishmentText = `⚠️ **لم يتم اتخاذ إجراء عقابي لعدم امتلاك البوت الصلاحية الكافية (رتبة الفاعل أعلى من البوت)**`;
        if (punished) {
          punishmentText = isKicked 
            ? `❌ **طرد العضو لسحب رتبه بالكامل وطره من السيرفر لتجاوزه الحد المسموح (حذف 4 رومات في أقل من دقيقتين)**`
            : `⚠️ **سحب رتب العضو بالكامل لـ محاولة تخريب وحذف الروم**`;
        }

        const logEmbed = modEmbed(
          "نظام حماية السيرفر — Anti-Nuke",
          `**الروم المحذوف:** \`#${channel.name}\` (تمت إعادته تلقائياً)\n` +
          `**الفاعل:** ${executor} (\`${executor.id}\`)\n` +
          `**الإجراء المتخذ:**\n${punishmentText}`
        ).setColor(0xff0000);

        await logsChannel.send({ embeds: [logEmbed] }).catch(() => {});
      }

    } catch (err) {
      Logger.error(`Anti-Nuke: Fatal error inside channelDelete event: ${err}`);
    }
  },
};
