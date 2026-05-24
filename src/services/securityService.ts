import {
  ChannelType,
  PermissionsBitField,
  type ChatInputCommandInteraction,
  type Guild,
  type GuildMember,
  type Message,
} from 'discord.js';
import { buildErrorEmbed, buildSuccessEmbed } from '../builders/ticketBuilder.js';
import type { AppConfig } from '../types/config.js';
import { logger } from '../utils/logger.js';
import { safeEditReply } from '../utils/interaction.js';
import { ServerLogService } from './serverLogService.js';

const DISCORD_INVITE_PATTERN = /(?:discord\.gg|discord(?:app)?\.com\/invite|discord\.com\/invites)\/[a-z0-9-]+/i;
const URL_PATTERN = /(?:https?:\/\/|www\.|[a-z0-9-]+\.(?:com|net|org|gg|io|xyz|me|app|dev|shop|store|site|link|ly|co)\b)\S*/i;
const INVITE_HINT_PATTERN = /(?:اختصار\s*الدس|اختصار\s*دس|دسكورد|الدسكورد|discord|دس)\s*[:：]?\s*[a-z0-9-]{5,32}/i;
const SPAM_MENTION_PATTERN = /(?:@everyone|@here).*(?:@everyone|@here)/is;
const PROFANITY_PATTERNS = [
  /(?:ك\s*ل\s*ب|كلب|حمار|زق|زبال|قحبه|شرموط|كس\s*ام|انيك|نيك|منيوك|مخنث|يلعن)/i,
  /(?:fuck|shit|bitch|slut|whore|nigg|retard|dick|pussy|asshole)/i,
];

type SecurityViolation = {
  reason: 'link' | 'invite' | 'profanity' | 'mention-spam';
  timeoutMs: number;
  title: string;
};

export class SecurityService {
  public constructor(
    private readonly config: AppConfig,
    private readonly logs: ServerLogService,
  ) {}

  public async handleMessage(message: Message): Promise<boolean> {
    if (!message.inGuild() || message.author.bot) return false;

    const violation = this.detectViolation(message.content);
    if (!violation) return false;

    await message.delete().catch(() => null);

    const member = message.member;
    if (member?.moderatable && violation.timeoutMs > 0) {
      await member.timeout(violation.timeoutMs, `Security protection: ${violation.reason}`).catch((error) => {
        logger.warn('Failed to timeout security user', error instanceof Error ? error.message : error);
      });
    }

    await this.logs.send('security', violation.title, `تم حذف رسالة من <@${message.author.id}>${violation.timeoutMs > 0 ? ' وإعطاؤه تايم أوت.' : '.'}`, [
      { name: 'العضو', value: `${message.author.tag} (${message.author.id})`, inline: true },
      { name: 'الروم', value: `<#${message.channelId}>`, inline: true },
      { name: 'السبب', value: violation.reason, inline: true },
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

  private detectViolation(content: string): SecurityViolation | null {
    const normalized = this.normalizeContent(content);
    const compact = normalized.replace(/[\s._\-|/\\:]+/g, '');

    if (
      URL_PATTERN.test(normalized) ||
      URL_PATTERN.test(compact) ||
      DISCORD_INVITE_PATTERN.test(normalized) ||
      compact.includes('discordgg') ||
      compact.includes('discordcominvite') ||
      compact.includes('discordappcominvite')
    ) {
      return { reason: 'link', timeoutMs: 60 * 60 * 1000, title: 'حذف رابط ممنوع' };
    }

    if (INVITE_HINT_PATTERN.test(normalized)) {
      return { reason: 'invite', timeoutMs: 60 * 60 * 1000, title: 'حذف اختصار دسكورد' };
    }

    if (SPAM_MENTION_PATTERN.test(normalized)) {
      return { reason: 'mention-spam', timeoutMs: 30 * 60 * 1000, title: 'حذف منشن سبام' };
    }

    if (PROFANITY_PATTERNS.some((pattern) => pattern.test(normalized) || pattern.test(compact))) {
      return { reason: 'profanity', timeoutMs: 10 * 60 * 1000, title: 'حذف سب' };
    }

    return null;
  }

  private normalizeContent(content: string): string {
    return content
      .toLowerCase()
      .normalize('NFKC')
      .replace(/[\u064B-\u065F\u0670]/g, '')
      .replace(/[إأآ]/g, 'ا')
      .replace(/[ى]/g, 'ي')
      .replace(/[ة]/g, 'ه')
      .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));
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
