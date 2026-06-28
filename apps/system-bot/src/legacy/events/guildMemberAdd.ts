// ══════════════════════════════════════════════════════════════
//  Event — guildMemberAdd (Welcome + Auto-Role)
//  V2 — Application Emojis, no Unicode emojis
// ══════════════════════════════════════════════════════════════

import { Client, GuildMember, EmbedBuilder } from "discord.js";
import { Colors } from "../utils/embed";
import { Emojis } from "../utils/emojis";
import { Config } from "../config";
import { Logger } from "../utils/logger";
import { getGuildConfig } from "../db/guilds";

export default {
  name: "guildMemberAdd" as const,
  once: false,
  async execute(_client: Client, member: GuildMember) {
    Logger.event(`Member joined: ${member.user.tag} in ${member.guild.name}`);

    const dbConfig = await getGuildConfig(member.guild.id);

    // ── Anti-Bots ─────────────────────────────────────────
    if (dbConfig.modules.antibots_enabled && member.user.bot) {
      try {
        await member.kick("Anti-Bots protection enabled");
        Logger.info(`Bot ${member.user.tag} was kicked (Anti-Bots)`);
        return;
      } catch (err) {
        Logger.error(`Failed to kick bot: ${err}`);
      }
    }

    // ── Anti-Raid: Account Age ─────────────────────────────
    if (dbConfig.modules.antiraid_enabled) {
      const minAge = 7 * 24 * 60 * 60 * 1000; // 7 days
      if (Date.now() - member.user.createdTimestamp < minAge) {
        try {
          await member.send({
            content: `${Emojis.warning} You were kicked from **${member.guild.name}** because your account is too new (< 7 days).`,
          }).catch(() => {});
          await member.kick("Anti-Raid: Account too new");
          Logger.info(`New account ${member.user.tag} was kicked (Anti-Raid)`);
          return;
        } catch (err) {
          Logger.error(`Failed to kick new account: ${err}`);
        }
      }
    }

    // ── Auto Role ─────────────────────────────────────────
    if (dbConfig.roles.auto_role) {
      try {
        await member.roles.add(dbConfig.roles.auto_role);
        Logger.info(`Auto-role assigned to ${member.user.tag}`);
      } catch (err) {
        Logger.error(`Failed to assign auto-role: ${err}`);
      }
    }

    // ── Welcome Message ───────────────────────────────────
    if (dbConfig.modules.welcome_enabled && dbConfig.channels.welcome_channel) {
      const channel = member.guild.channels.cache.get(dbConfig.channels.welcome_channel);
      if (channel?.isTextBased()) {
        const embed = new EmbedBuilder()
          .setTitle(`${Emojis.welcome}  Welcome!`)
          .setDescription(
            [
              `Welcome to **${member.guild.name}**, ${member}!`,
              "",
              `You are member **#${member.guild.memberCount}**`,
              "",
              `Account created: <t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`,
            ].join("\n"),
          )
          .setColor(dbConfig.settings.embed_color ? parseInt(dbConfig.settings.embed_color, 16) : Colors.welcome)
          .setThumbnail(member.user.displayAvatarURL({ size: 512 }))
          .setImage(member.guild.bannerURL({ size: 1024 }) ?? null)
          .setFooter({ text: Config.embed.footer })
          .setTimestamp();

        await channel.send({ content: `${member}`, embeds: [embed] });
      }
    }

    // ── Join Logs ─────────────────────────────────────────
    if (dbConfig.modules.logging_enabled && dbConfig.channels.join_leave_logs_channel) {
      const logChannel = member.guild.channels.cache.get(dbConfig.channels.join_leave_logs_channel);
      if (logChannel?.isTextBased()) {
        const logEmbed = new EmbedBuilder()
          .setTitle(`${Emojis.arrow}  Member Joined`)
          .setDescription(
            [
              `**User:** ${member.user.tag} (\`${member.id}\`)`,
              `**Account Age:** <t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`,
              `**Total Members:** ${member.guild.memberCount}`,
            ].join("\n"),
          )
          .setColor(Colors.success)
          .setThumbnail(member.user.displayAvatarURL())
          .setFooter({ text: Config.embed.footer })
          .setTimestamp();

        await logChannel.send({ embeds: [logEmbed] });
      }
    }
  },
};
