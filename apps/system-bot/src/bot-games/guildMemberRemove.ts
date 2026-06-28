import { GuildMember, EmbedBuilder, TextChannel } from 'discord.js';
import { getServerConfig } from '../utils/database';
import { logger } from '../utils/logger';

export const name = 'guildMemberRemove';
export const once = false;

export async function execute(member: GuildMember): Promise<void> {
  try {
    const config = getServerConfig(member.guild.id);

    if (config.goodbyeChannelId) {
      const channel = member.guild.channels.cache.get(config.goodbyeChannelId) as TextChannel;
      if (channel) {
        const joinedAt = member.joinedAt;
        const duration = joinedAt
          ? Math.floor((Date.now() - joinedAt.getTime()) / (1000 * 60 * 60 * 24))
          : 0;

        const embed = new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle('👋 عضو غادر السيرفر')
          .setDescription(`**${member.user.username}** غادر السيرفر`)
          .setThumbnail(member.user.displayAvatarURL())
          .addFields(
            { name: '⏱️ مدة البقاء', value: `${duration} يوم`, inline: true },
            { name: '👥 الأعضاء المتبقين', value: `${member.guild.memberCount}`, inline: true }
          )
          .setTimestamp();

        await channel.send({ embeds: [embed] });
      }
    }

    logger.info(`Member left: ${member.user.tag}`);
  } catch (error) {
    logger.error(`Error in guildMemberRemove: ${error}`);
  }
}
