import { GuildMember, EmbedBuilder, TextChannel } from 'discord.js';
import { getServerConfig } from '../utils/database';
import { logger } from '../utils/logger';

export const name = 'guildMemberAdd';
export const once = false;

export async function execute(member: GuildMember): Promise<void> {
  try {
    const config = getServerConfig(member.guild.id);

    // Auto role
    if (config.unverifiedRoleId) {
      const role = member.guild.roles.cache.get(config.unverifiedRoleId);
      if (role) await member.roles.add(role);
    } else if (config.defaultRoleId) {
      const role = member.guild.roles.cache.get(config.defaultRoleId);
      if (role) await member.roles.add(role);
    }

    // Welcome message
    if (config.welcomeChannelId) {
      const channel = member.guild.channels.cache.get(config.welcomeChannelId) as TextChannel;
      if (channel) {
        const embed = new EmbedBuilder()
          .setColor(0x2ecc71)
          .setTitle('🎉 عضو جديد!')
          .setDescription(`أهلاً وسهلاً **${member.user.username}** في **${member.guild.name}**!`)
          .setThumbnail(member.user.displayAvatarURL())
          .addFields(
            { name: '👤 العضو', value: `${member}`, inline: true },
            { name: '👥 عدد الأعضاء', value: `${member.guild.memberCount}`, inline: true },
            { name: '📅 تاريخ الانضمام', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
          )
          .setFooter({ text: member.guild.name, iconURL: member.guild.iconURL() || undefined })
          .setTimestamp();

        await channel.send({ embeds: [embed] });
      }
    }

    // DM welcome
    try {
      await member.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0x3498db)
            .setTitle(`مرحباً في ${member.guild.name}! 👋`)
            .setDescription('نتمنى لك وقتاً ممتعاً معنا. اقرأ القوانين واستمتع!')
            .setTimestamp()
        ]
      });
    } catch { /* DMs might be closed */ }

    // Admin notification
    if (config.adminChannelId) {
      const adminChannel = member.guild.channels.cache.get(config.adminChannelId) as TextChannel;
      if (adminChannel) {
        await adminChannel.send({
          embeds: [
            new EmbedBuilder()
              .setColor(0xf39c12)
              .setTitle('📊 عضو جديد انضم')
              .setDescription(`${member} انضم للسيرفر\nالعدد الكلي: **${member.guild.memberCount}**`)
              .setTimestamp()
          ]
        });
      }
    }

    logger.info(`Member joined: ${member.user.tag}`);
  } catch (error) {
    logger.error(`Error in guildMemberAdd: ${error}`);
  }
}
