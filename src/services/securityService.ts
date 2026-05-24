import {
  ChannelType,
  PermissionsBitField,
  type ChatInputCommandInteraction,
  type Guild,
  type GuildMember,
  type Message,
  type TextBasedChannel,
} from 'discord.js';
import { buildErrorEmbed, buildSuccessEmbed } from '../builders/ticketBuilder.js';
import type { AppConfig } from '../types/config.js';
import { logger } from '../utils/logger.js';
import { safeEditReply } from '../utils/interaction.js';
import { ServerLogService } from './serverLogService.js';

const DISCORD_INVITE_PATTERN = /(?:discord\.gg|discord(?:app)?\.com\/invite)\/[a-z0-9-]+/i;
const URL_PATTERN = /(?:https?:\/\/|www\.)\S+/i;
const INVITE_HINT_PATTERN = /(?:اختصار\s*الدس|اختصار\s*دس|دسكورد|الدسكورد|discord|دس)\s*[:：]?\s*[a-z0-9-]{5,32}/i;

export class SecurityService {
  public constructor(
    private readonly config: AppConfig,
    private readonly logs: ServerLogService,
  ) {}

  public async handleMessage(message: Message): Promise<boolean> {
    if (!message.inGuild() || message.author.bot) return false;
    if (!this.hasBlockedLink(message.content)) return false;

    await message.delete().catch(() => null);

    const member = message.member;
    if (member?.moderatable) {
      await member.timeout(60 * 60 * 1000, 'Anti-link protection: blocked link or Discord invite shortcut.').catch((error) => {
        logger.warn('Failed to timeout anti-link user', error instanceof Error ? error.message : error);
      });
    }

    await this.logs.send('security', 'حذف رابط مشبوه', `تم حذف رسالة من <@${message.author.id}> وإعطاؤه تايم أوت ساعة.`, [
      { name: 'العضو', value: `${message.author.tag} (${message.author.id})`, inline: true },
      { name: 'الروم', value: `<#${message.channelId}>`, inline: true },
      { name: 'المحتوى', value: message.content.slice(0, 1000) || 'بدون محتوى' },
    ]);

    return true;
  }

  public async clearUserMessages(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.inCachedGuild()) return;

    const allowed = this.canUseClear(interaction.member as GuildMember, interaction.user.id);
    if (!allowed) {
      await safeEditReply(interaction, [buildErrorEmbed(this.config, 'ما عندك صلاحيات كافية.')]);
      return;
    }

    const userId = interaction.options.getString('user-id', true).replace(/[<@!>]/g, '').trim();
    if (!/^\d{16,20}$/.test(userId)) {
      await safeEditReply(interaction, [buildErrorEmbed(this.config, 'اكتب كوبي آيدي صحيح للشخص.')]);
      return;
    }

    const result = await this.deleteMessagesByUser(interaction.guild, userId);
    await this.logs.send('security', 'تنظيف رسائل عضو', `تم تشغيل أمر /clear على <@${userId}>.`, [
      { name: 'بواسطة', value: `${interaction.user.tag} (${interaction.user.id})`, inline: true },
      { name: 'المحذوف', value: `${result.deleted}`, inline: true },
      { name: 'القنوات المفحوصة', value: `${result.channels}`, inline: true },
    ]);

    await safeEditReply(interaction, [
      buildSuccessEmbed(this.config, 'تم التنظيف', `تم حذف ${result.deleted} رسالة من <@${userId}> داخل ${result.channels} روم.`),
    ]);
  }

  private canUseClear(member: GuildMember, userId: string): boolean {
    return userId === this.config.roleManagement.ownerId || member.permissions.has(PermissionsBitField.Flags.Administrator);
  }

  private hasBlockedLink(content: string): boolean {
    const normalized = content.toLowerCase();
    return URL_PATTERN.test(normalized) || DISCORD_INVITE_PATTERN.test(normalized) || INVITE_HINT_PATTERN.test(normalized);
  }

  private async deleteMessagesByUser(guild: Guild, userId: string): Promise<{ deleted: number; channels: number }> {
    const channels = await guild.channels.fetch();
    let deleted = 0;
    let scannedChannels = 0;

    for (const channel of channels.values()) {
      if (!channel || channel.type !== ChannelType.GuildText) continue;

      scannedChannels++;
      let before: string | undefined;

      while (true) {
        const batch = await channel.messages.fetch({ limit: 100, before }).catch(() => null);
        if (!batch || batch.size === 0) break;

        before = batch.last()?.id;
        const matches = batch.filter((message) => message.author.id === userId);

        for (const message of matches.values()) {
          await message.delete().then(() => {
            deleted++;
          }).catch(() => null);
        }

        if (batch.size < 100) break;
      }
    }

    return { deleted, channels: scannedChannels };
  }
}
