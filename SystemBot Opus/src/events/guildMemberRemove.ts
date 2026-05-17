// ══════════════════════════════════════════════════════════════
//  Event — guildMemberRemove (Leave message)
//  V2 — Application Emojis, no Unicode emojis
// ══════════════════════════════════════════════════════════════

import { Client, GuildMember, EmbedBuilder, PartialGuildMember } from "discord.js";
import { Colors } from "../utils/embed";
import { Emojis } from "../utils/emojis";
import { Config } from "../config";
import { Logger } from "../utils/logger";
import { getGuildConfig } from "../db/guilds";

export default {
  name: "guildMemberRemove" as const,
  once: false,
  async execute(_client: Client, member: GuildMember | PartialGuildMember) {
    Logger.event(`Member left: ${member.user?.tag ?? "Unknown"} from ${member.guild.name}`);

    const dbConfig = await getGuildConfig(member.guild.id);

    // ── Leave Message ─────────────────────────────────────
    if (dbConfig.modules.leave_enabled && dbConfig.channels.leave_channel) {
      const channel = member.guild.channels.cache.get(dbConfig.channels.leave_channel);
      if (channel?.isTextBased()) {
        const roles = member.roles?.cache
          .filter((r) => r.id !== member.guild.id)
          .map((r) => `${r}`)
          .join(", ");

        const embed = new EmbedBuilder()
          .setTitle(`${Emojis.leave}  Goodbye!`)
          .setDescription(
            [
              `**${member.user?.tag ?? "Unknown"}** has left the server.`,
              "",
              `We now have **${member.guild.memberCount}** members.`,
              roles ? `\n**Roles:** ${roles}` : "",
            ].join("\n"),
          )
          .setColor(dbConfig.settings.embed_color ? parseInt(dbConfig.settings.embed_color, 16) : Colors.leave)
          .setThumbnail(member.user?.displayAvatarURL({ size: 512 }) ?? null)
          .setFooter({ text: Config.embed.footer })
          .setTimestamp();

        await channel.send({ embeds: [embed] });
      }
    }

    // ── Leave Logs ────────────────────────────────────────
    if (dbConfig.modules.logging_enabled && dbConfig.channels.join_leave_logs_channel) {
      const logChannel = member.guild.channels.cache.get(dbConfig.channels.join_leave_logs_channel);
      if (logChannel?.isTextBased()) {
        const logEmbed = new EmbedBuilder()
          .setTitle(`${Emojis.arrow}  Member Left`)
          .setDescription(
            [
              `**User:** ${member.user?.tag ?? "Unknown"} (\`${member.id}\`)`,
              `**Joined:** ${member.joinedAt ? `<t:${Math.floor(member.joinedTimestamp! / 1000)}:R>` : "Unknown"}`,
              `**Total Members:** ${member.guild.memberCount}`,
            ].join("\n"),
          )
          .setColor(Colors.error)
          .setThumbnail(member.user?.displayAvatarURL() ?? null)
          .setFooter({ text: Config.embed.footer })
          .setTimestamp();

        await logChannel.send({ embeds: [logEmbed] });
      }
    }
  },
};
