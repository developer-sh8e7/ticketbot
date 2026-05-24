import { createRequire } from 'node:module';
import {
  ChannelType,
  Collection,
  EmbedBuilder,
  PermissionsBitField,
  type ChatInputCommandInteraction,
  type Guild,
  type GuildMember,
  type Message,
  type NewsChannel,
  type TextChannel,
} from 'discord.js';
import { buildErrorEmbed, buildSuccessEmbed } from '../builders/ticketBuilder.js';
import {
  ARABIC_SEVERE_PROFANITY_PHRASES,
  ARABIC_SEVERE_PROFANITY_TERMS,
  ENGLISH_SEVERE_PROFANITY_PHRASES,
  ENGLISH_SEVERE_PROFANITY_TERMS,
} from '../data/moderationWordLists.js';
import type { AppConfig } from '../types/config.js';
import { hexToDecimal } from '../utils/color.js';
import { logger } from '../utils/logger.js';
import { safeEditReply } from '../utils/interaction.js';
import { ServerLogService } from './serverLogService.js';

const DISCORD_INVITE_PATTERN = /(?:discord\.gg|discord(?:app)?\.com\/invite|discord\.com\/invites)\/[a-z0-9-]+/i;
const URL_EXTRACT_PATTERN = /(?:https?:\/\/|www\.|(?:[a-z0-9-]+\.)+(?:com|net|org|gg|io|xyz|me|app|dev|shop|store|site|link|ly|co|tv|to|cc)\b)\S*/gi;
const IMAGE_EXTENSION_PATTERN = /\.(?:png|jpe?g|gif|webp|bmp|avif)(?:[?#].*)?$/i;
const IMAGE_HOSTS = new Set([
  'cdn.discordapp.com',
  'media.discordapp.net',
  'i.imgur.com',
  'images-ext-1.discordapp.net',
  'images-ext-2.discordapp.net',
]);
const INVITE_HINT_WORDS = ['اختصار الدس', 'اختصار دس', 'اختصار دسكورد', 'الدسكورد', 'دسكورد', 'discord'];
const INVITE_CODE_PATTERN = /(?:^|[^a-z0-9])([a-z0-9-]{5,32})(?=$|[^a-z0-9])/i;
const SPAM_MENTION_PATTERN = /(?:@everyone|@here).*(?:@everyone|@here)/is;
const TOKEN_SEPARATOR_PATTERN = '[\\s\\S]{0,24}?';
const WORD_BOUNDARY_PATTERN = '[^\\p{L}\\p{N}]';

type SecurityViolation = {
  reason: 'link' | 'invite' | 'profanity' | 'mention-spam';
  timeoutMs: number;
  title: string;
};

type SecurityLogField = {
  name: string;
  value: string;
  inline?: boolean;
};

type ProfanityI18nModule = {
  filter(input: string): string;
  contains(...input: string[]): boolean;
  list(input: string[]): string[];
  add(input: string[]): void;
  remove(input: string[]): void;
};

type ClearChannelIssue = {
  channelId: string;
  channelName: string;
  reason: string;
};

type ClearableTextChannel = TextChannel | NewsChannel;

type ClearMessageSample = {
  channelId: string;
  channelName: string;
  content: string;
  createdAt: number;
};

type ClearProgress = {
  phase: 'scanning' | 'deleting';
  channelName: string;
  channelsScanned: number;
  totalChannels: number;
  deleted: number;
  matched: number;
};

type ClearResult = {
  deleted: number;
  deletedRecent: number;
  deletedOld: number;
  failed: number;
  matched: number;
  scannedMessages: number;
  channels: number;
  totalChannels: number;
  skippedChannels: number;
  noPermissionChannels: ClearChannelIssue[];
  failedChannels: ClearChannelIssue[];
  samples: ClearMessageSample[];
};

const RECENT_BULK_DELETE_LIMIT_MS = 14 * 24 * 60 * 60 * 1000 - 60_000;
const CLEAR_PROGRESS_INTERVAL_MS = 2500;
const CLEAR_DELETE_CHUNK_SIZE = 100;
const CLEAR_OLD_DELETE_CONCURRENCY = 5;
const CLEAR_SAMPLE_LIMIT = 8;
const CLEAR_CHANNEL_CONCURRENCY = 4;
const PROFANITY_TIMEOUT_MS = 5 * 60 * 1000;
const SECURITY_LINK_BYPASS_USER_IDS = new Set([
  '959896496113844254',
  '1397364822152315052',
  '1148258174474928249',
  '1479484174686486680',
]);
const PROFANITY_I18N_FALSE_POSITIVES = [
  'ال',
];
const CUSTOM_PROFANITY_DICTIONARY = [
  ...ARABIC_SEVERE_PROFANITY_TERMS,
  ...ARABIC_SEVERE_PROFANITY_PHRASES,
  ...ENGLISH_SEVERE_PROFANITY_TERMS,
  ...ENGLISH_SEVERE_PROFANITY_PHRASES,
];

const require = createRequire(import.meta.url);
const profanityI18n = require('profanity-i18n') as ProfanityI18nModule;
profanityI18n.add(CUSTOM_PROFANITY_DICTIONARY);
profanityI18n.remove(PROFANITY_I18N_FALSE_POSITIVES);

export class SecurityService {
  public constructor(
    private readonly config: AppConfig,
    private readonly logs: ServerLogService,
  ) {}

  public async handleMessage(message: Message): Promise<boolean> {
    if (!message.inGuild() || message.author.bot) return false;

    const violation = this.detectViolation(message.content);
    if (!violation) return false;
    if (this.canBypassViolation(message.author.id, violation)) return false;

    let messageDeleted = false;
    let deleteError: string | null = null;
    await message.delete().then(() => {
      messageDeleted = true;
    }).catch((error) => {
      deleteError = error instanceof Error ? error.message : 'تعذر حذف الرسالة.';
      logger.warn('Failed to delete security message', error instanceof Error ? error.message : error);
    });

    const member = message.member;
    let timeoutApplied = false;
    let timeoutError: string | null = null;
    if (member?.moderatable && violation.timeoutMs > 0) {
      await member.timeout(violation.timeoutMs, `Security protection: ${violation.reason}`).then(() => {
        timeoutApplied = true;
      }).catch((error) => {
        timeoutError = error instanceof Error ? error.message : 'تعذر تطبيق التايم أوت.';
        logger.warn('Failed to timeout security user', error instanceof Error ? error.message : error);
      });
    } else if (violation.timeoutMs > 0) {
      timeoutError = 'البوت لا يملك صلاحية تايم أوت على هذا العضو أو رتبة العضو أعلى من البوت.';
    }

    const action = this.securityActionLabel(violation, timeoutApplied, timeoutError);
    const fields: SecurityLogField[] = [
      { name: 'العضو', value: `<@${message.author.id}>\n${message.author.tag}\nID: ${message.author.id}`, inline: true },
      { name: 'الروم', value: `<#${message.channelId}>`, inline: true },
      { name: 'السبب', value: this.securityReasonLabel(violation.reason), inline: true },
      { name: 'الإجراء', value: action, inline: true },
      { name: 'حالة الحذف', value: messageDeleted ? 'تم حذف الرسالة' : 'تعذر حذف الرسالة', inline: true },
      { name: 'مدة التايم أوت', value: this.formatDuration(violation.timeoutMs), inline: true },
      { name: 'آيدي الرسالة', value: message.id, inline: true },
      { name: 'المحتوى', value: this.trimEmbedValue(message.content || 'بدون محتوى') },
    ];

    if (deleteError) {
      fields.push({ name: 'ملاحظة الحذف', value: this.trimEmbedValue(deleteError), inline: false });
    }

    if (timeoutError) {
      fields.push({ name: 'ملاحظة التايم أوت', value: this.trimEmbedValue(timeoutError), inline: false });
    }

    await this.logs.send('security', violation.title, `تم تنفيذ نظام الحماية على رسالة من <@${message.author.id}>.`, fields);

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

    await safeEditReply(interaction, [
      this.buildClearStatusEmbed('جاري تنظيف الرسائل', `بدأ فحص رومات السيرفر بحثاً عن رسائل <@${userId}>.`),
    ]);

    let lastProgressAt = 0;
    const result = await this.deleteMessagesByUser(interaction.guild, userId, async (progress) => {
      if (Date.now() - lastProgressAt < CLEAR_PROGRESS_INTERVAL_MS) return;
      lastProgressAt = Date.now();
      await safeEditReply(interaction, [
        this.buildClearStatusEmbed(
          progress.phase === 'scanning' ? 'جاري فحص الرسائل' : 'جاري حذف الرسائل',
          `الروم الحالي: #${progress.channelName}`,
          [
            { name: 'الرومات المفحوصة', value: `${progress.channelsScanned}`, inline: true },
            { name: 'رسائل مطابقة', value: `${progress.matched}`, inline: true },
            { name: 'المحذوف الآن', value: `${progress.deleted}`, inline: true },
            { name: 'التقدم', value: this.renderProgressBar(progress.channelsScanned, progress.totalChannels), inline: false },
          ],
        ),
      ]);
    });

    await this.logs.send('security', 'تنظيف رسائل عضو', `تم تشغيل أمر /clear على <@${userId}>.`, [
      { name: 'بواسطة', value: `${interaction.user.tag} (${interaction.user.id})`, inline: true },
      { name: 'المحذوف', value: `${result.deleted}`, inline: true },
      { name: 'رسائل مطابقة', value: `${result.matched}`, inline: true },
      { name: 'فشل حذفها', value: `${result.failed}`, inline: true },
      { name: 'الرومات المفحوصة', value: `${result.channels}`, inline: true },
      { name: 'رومات بلا صلاحية', value: `${result.noPermissionChannels.length}`, inline: true },
      { name: 'تفاصيل', value: this.buildClearDetails(result) },
      { name: 'عينات من الرسائل', value: this.buildClearSamples(result) },
    ]);

    const finalEmbed = buildSuccessEmbed(this.config, 'تم التنظيف', `تم حذف ${result.deleted} رسالة من <@${userId}>.`);
    finalEmbed.addFields(
      { name: 'رسائل حديثة حذفت دفعة واحدة', value: `${result.deletedRecent}`, inline: true },
      { name: 'رسائل قديمة حذفت فردي', value: `${result.deletedOld}`, inline: true },
      { name: 'فشل حذفها', value: `${result.failed}`, inline: true },
      { name: 'الرومات المفحوصة', value: `${result.channels}`, inline: true },
      { name: 'الرسائل المفحوصة', value: `${result.scannedMessages}`, inline: true },
      { name: 'رومات تم تخطيها', value: `${result.skippedChannels}`, inline: true },
      { name: 'التقدم', value: this.renderProgressBar(result.channels + result.skippedChannels, result.totalChannels), inline: false },
      { name: 'تفاصيل مهمة', value: this.buildClearDetails(result) },
      { name: 'عينات من رسائل الشخص', value: this.buildClearSamples(result) },
    );

    await safeEditReply(interaction, [finalEmbed]);
  }

  private canUseClear(member: GuildMember, userId: string): boolean {
    return userId === this.config.roleManagement.ownerId || member.permissions.has(PermissionsBitField.Flags.Administrator);
  }

  private detectViolation(content: string): SecurityViolation | null {
    const normalized = this.normalizeContent(content);
    const compact = normalized.replace(/[^\p{L}\p{N}]+/gu, '');

    if (this.hasDiscordInvite(normalized, compact) || this.hasInviteHint(normalized)) {
      return { reason: 'invite', timeoutMs: 0, title: 'حذف اختصار دسكورد' };
    }

    const blockedLinks = this.findBlockedLinks(content);
    if (blockedLinks.length > 0) {
      return { reason: 'link', timeoutMs: 0, title: 'حذف رابط ممنوع' };
    }

    if (SPAM_MENTION_PATTERN.test(normalized)) {
      return { reason: 'mention-spam', timeoutMs: 0, title: 'حذف منشن سبام' };
    }

    if (this.hasSevereProfanity(normalized, compact)) {
      return { reason: 'profanity', timeoutMs: PROFANITY_TIMEOUT_MS, title: 'حذف سب صريح' };
    }

    return null;
  }

  private canBypassViolation(userId: string, violation: SecurityViolation): boolean {
    return SECURITY_LINK_BYPASS_USER_IDS.has(userId) && (violation.reason === 'link' || violation.reason === 'invite');
  }

  private hasDiscordInvite(normalized: string, compact: string): boolean {
    return (
      DISCORD_INVITE_PATTERN.test(normalized) ||
      compact.includes('discordgg') ||
      compact.includes('discordcominvite') ||
      compact.includes('discordcominvites') ||
      compact.includes('discordappcominvite')
    );
  }

  private hasInviteHint(normalized: string): boolean {
    return INVITE_HINT_WORDS.some((word) => {
      const hintIndex = normalized.indexOf(word);
      if (hintIndex === -1) return false;

      const afterHint = normalized.slice(hintIndex + word.length, hintIndex + word.length + 80);
      return INVITE_CODE_PATTERN.test(afterHint);
    });
  }

  private findBlockedLinks(content: string): string[] {
    const urls = this.extractUrls(content);
    return urls.filter((url) => !this.isAllowedImageUrl(url));
  }

  private extractUrls(content: string): string[] {
    return [...content.matchAll(URL_EXTRACT_PATTERN)].map((match) => this.cleanUrl(match[0]));
  }

  private cleanUrl(url: string): string {
    return url.replace(/[)\].,!?،؛]+$/g, '');
  }

  private isAllowedImageUrl(rawUrl: string): boolean {
    const parsed = this.parseUrl(rawUrl);
    if (!parsed) return false;

    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.toLowerCase();
    if (IMAGE_HOSTS.has(host) && (IMAGE_EXTENSION_PATTERN.test(path) || path.length > 1)) return true;
    if (IMAGE_EXTENSION_PATTERN.test(path)) return true;
    if (host.endsWith('tenor.com') && path.includes('/view/')) return true;
    if (host.endsWith('giphy.com') && path.includes('/gifs/')) return true;

    return false;
  }

  private parseUrl(rawUrl: string): URL | null {
    const normalized = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
    try {
      return new URL(normalized);
    } catch {
      return null;
    }
  }

  private hasSevereProfanity(normalized: string, compact: string): boolean {
    return (
      this.hasLibraryProfanity(normalized) ||
      this.hasArabicProfanity(normalized, compact) ||
      this.hasEnglishProfanity(normalized)
    );
  }

  private hasLibraryProfanity(normalized: string): boolean {
    const words = normalized.split(/\s+/).filter(Boolean);
    return words.length > 0 && profanityI18n.contains(...words);
  }

  private hasArabicProfanity(normalized: string, compact: string): boolean {
    for (const term of ARABIC_SEVERE_PROFANITY_TERMS) {
      const normalizedTerm = this.normalizeContent(term);
      if (this.hasStandaloneTerm(normalized, normalizedTerm)) {
        return true;
      }
    }

    for (const phrase of ARABIC_SEVERE_PROFANITY_PHRASES) {
      const normalizedPhrase = this.normalizeContent(phrase);
      if (this.hasFlexiblePhrase(normalized, normalizedPhrase) || compact.includes(normalizedPhrase.replace(/\s+/g, ''))) {
        return true;
      }
    }

    return false;
  }

  private hasEnglishProfanity(normalized: string): boolean {
    for (const term of ENGLISH_SEVERE_PROFANITY_TERMS) {
      if (this.hasStandaloneTerm(normalized, term.toLowerCase())) {
        return true;
      }
    }

    for (const phrase of ENGLISH_SEVERE_PROFANITY_PHRASES) {
      if (this.hasFlexiblePhrase(normalized, phrase.toLowerCase())) {
        return true;
      }
    }

    return false;
  }

  private hasStandaloneTerm(content: string, term: string): boolean {
    const pattern = new RegExp(`(?:^|${WORD_BOUNDARY_PATTERN})${this.escapeRegExp(term)}(?=$|${WORD_BOUNDARY_PATTERN})`, 'iu');
    return pattern.test(content);
  }

  private hasFlexiblePhrase(content: string, phrase: string): boolean {
    const tokens = phrase.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return false;

    const pattern = new RegExp(
      `(?:^|${WORD_BOUNDARY_PATTERN})${tokens.map((token) => this.escapeRegExp(token)).join(TOKEN_SEPARATOR_PATTERN)}(?=$|${WORD_BOUNDARY_PATTERN})`,
      'iu',
    );
    return pattern.test(content);
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private securityReasonLabel(reason: SecurityViolation['reason']): string {
    switch (reason) {
      case 'invite':
        return 'دعوة أو اختصار دسكورد';
      case 'link':
        return 'رابط غير مسموح';
      case 'mention-spam':
        return 'منشن سبام';
      case 'profanity':
        return 'سب صريح';
      default:
        return reason;
    }
  }

  private securityActionLabel(violation: SecurityViolation, timeoutApplied: boolean, timeoutError: string | null): string {
    if (violation.timeoutMs <= 0) return 'حذف الرسالة فقط';
    if (timeoutApplied) return 'حذف الرسالة + تايم أوت';
    if (timeoutError) return 'حذف الرسالة فقط - تعذر التايم أوت';
    return 'حذف الرسالة فقط';
  }

  private formatDuration(ms: number): string {
    if (ms <= 0) return 'لا يوجد';

    const minutes = Math.round(ms / 60_000);
    if (minutes < 60) return `${minutes} دقيقة`;

    const hours = minutes / 60;
    return Number.isInteger(hours) ? `${hours} ساعة` : `${minutes} دقيقة`;
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

  private async deleteMessagesByUser(
    guild: Guild,
    userId: string,
    onProgress?: (progress: ClearProgress) => Promise<void>,
  ): Promise<ClearResult> {
    const channels = await guild.channels.fetch();
    const textChannels = [...channels.values()].filter((channel): channel is ClearableTextChannel => {
      return !!channel && (channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement);
    });
    const botMember = guild.members.me ?? await guild.members.fetchMe().catch(() => null);
    const result: ClearResult = {
      deleted: 0,
      deletedRecent: 0,
      deletedOld: 0,
      failed: 0,
      matched: 0,
      scannedMessages: 0,
      channels: 0,
      totalChannels: textChannels.length,
      skippedChannels: 0,
      noPermissionChannels: [],
      failedChannels: [],
      samples: [],
    };

    if (!botMember) {
      return {
        ...result,
        failedChannels: [{ channelId: guild.id, channelName: guild.name, reason: 'تعذر جلب عضو البوت داخل السيرفر.' }],
      };
    }

    const newestBulkDeleteTime = Date.now() - RECENT_BULK_DELETE_LIMIT_MS;
    let nextChannelIndex = 0;

    const scanChannel = async (channel: ClearableTextChannel): Promise<void> => {
      const channelName = channel.name ?? channel.id;
      const permissions = channel.permissionsFor(botMember);
      const canClear =
        permissions?.has(PermissionsBitField.Flags.ViewChannel) &&
        permissions.has(PermissionsBitField.Flags.ReadMessageHistory) &&
        permissions.has(PermissionsBitField.Flags.ManageMessages);

      if (!canClear) {
        result.skippedChannels++;
        result.noPermissionChannels.push({ channelId: channel.id, channelName, reason: 'البوت يحتاج View Channel + Read Message History + Manage Messages.' });
        return;
      }

      result.channels++;
      let before: string | undefined;

      await this.reportClearProgress(result, channelName, 'scanning', onProgress);

      while (true) {
        const batch = await channel.messages.fetch({ limit: 100, before }).catch((error: unknown) => {
          result.failedChannels.push({
            channelId: channel.id,
            channelName,
            reason: error instanceof Error ? error.message : 'تعذر جلب الرسائل.',
          });
          return null;
        });

        if (!batch || batch.size === 0) break;

        result.scannedMessages += batch.size;
        before = batch.last()?.id;

        const recentMatches = new Collection<string, Message>();
        const oldMatches: Message[] = [];

        for (const message of batch.values()) {
          if (message.author.id !== userId) continue;

          result.matched++;
          this.addClearSample(result, channel, message);

          if (message.createdTimestamp > newestBulkDeleteTime) {
            recentMatches.set(message.id, message);
          } else {
            oldMatches.push(message);
          }
        }

        if (recentMatches.size > 0 || oldMatches.length > 0) {
          await this.reportClearProgress(result, channelName, 'deleting', onProgress);
          await this.deleteClearMatches(channel, channelName, recentMatches, oldMatches, result);
        }

        await this.reportClearProgress(result, channelName, 'scanning', onProgress);

        if (batch.size < 100) break;
      }
    };

    const workerCount = Math.min(CLEAR_CHANNEL_CONCURRENCY, textChannels.length);
    await Promise.all(
      Array.from({ length: workerCount }, async () => {
        while (nextChannelIndex < textChannels.length) {
          const channel = textChannels[nextChannelIndex++];
          if (channel) {
            await scanChannel(channel);
          }
        }
      }),
    );

    return result;
  }

  private async reportClearProgress(
    result: ClearResult,
    channelName: string,
    phase: ClearProgress['phase'],
    onProgress?: (progress: ClearProgress) => Promise<void>,
  ): Promise<void> {
    await onProgress?.({
      phase,
      channelName,
      channelsScanned: Math.min(result.channels + result.skippedChannels, result.totalChannels),
      totalChannels: result.totalChannels,
      deleted: result.deleted,
      matched: result.matched,
    });
  }

  private addClearSample(result: ClearResult, channel: ClearableTextChannel, message: Message): void {
    if (result.samples.length >= CLEAR_SAMPLE_LIMIT) return;

    result.samples.push({
      channelId: channel.id,
      channelName: channel.name ?? channel.id,
      content: this.describeClearMessage(message),
      createdAt: message.createdTimestamp,
    });
  }

  private async deleteClearMatches(
    channel: ClearableTextChannel,
    channelName: string,
    recentMatches: Collection<string, Message>,
    oldMatches: Message[],
    result: ClearResult,
  ): Promise<void> {
    const recentMessages = [...recentMatches.values()];
    for (let index = 0; index < recentMessages.length; index += CLEAR_DELETE_CHUNK_SIZE) {
      const chunk = new Collection<string, Message>();
      for (const message of recentMessages.slice(index, index + CLEAR_DELETE_CHUNK_SIZE)) {
        chunk.set(message.id, message);
      }

      const deleted = await channel.bulkDelete(chunk, true).catch((error: unknown) => {
        result.failed += chunk.size;
        result.failedChannels.push({
          channelId: channel.id,
          channelName,
          reason: error instanceof Error ? error.message : 'فشل الحذف الجماعي.',
        });
        return null;
      });

      if (deleted) {
        result.deleted += deleted.size;
        result.deletedRecent += deleted.size;
        result.failed += Math.max(0, chunk.size - deleted.size);
      }
    }

    for (let index = 0; index < oldMatches.length; index += CLEAR_OLD_DELETE_CONCURRENCY) {
      const chunk = oldMatches.slice(index, index + CLEAR_OLD_DELETE_CONCURRENCY);
      const settled = await Promise.allSettled(chunk.map((message) => message.delete()));
      for (const item of settled) {
        if (item.status === 'fulfilled') {
          result.deleted++;
          result.deletedOld++;
        } else {
          result.failed++;
        }
      }
    }
  }

  private buildClearStatusEmbed(
    title: string,
    description: string,
    fields: { name: string; value: string; inline?: boolean }[] = [],
  ): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(hexToDecimal(this.config.bot.embedColor))
      .setTitle(title)
      .setDescription(description)
      .addFields(fields)
      .setTimestamp();
  }

  private buildClearDetails(result: ClearResult): string {
    const parts = [
      `مطابقة: ${result.matched}`,
      `محذوف: ${result.deleted}`,
      `فشل: ${result.failed}`,
      `بدون صلاحية: ${result.noPermissionChannels.length}`,
    ];

    const issues = [...result.noPermissionChannels, ...result.failedChannels]
      .slice(0, 5)
      .map((issue) => `#${issue.channelName}: ${issue.reason}`);

    if (issues.length > 0) {
      parts.push(`مشاكل:\n${issues.join('\n')}`);
    }

    return this.trimEmbedValue(parts.join('\n'));
  }

  private buildClearSamples(result: ClearResult): string {
    if (result.samples.length === 0) {
      return 'ما لقيت رسائل محفوظة لهذا الشخص ضمن نطاق الفحص.';
    }

    const lines = result.samples.map((sample, index) => {
      const timestamp = Math.floor(sample.createdAt / 1000);
      return `${index + 1}. <#${sample.channelId}> | <t:${timestamp}:R>\n> ${sample.content}`;
    });

    return this.trimEmbedValue(lines.join('\n'));
  }

  private describeClearMessage(message: Message): string {
    const content = message.content?.trim();
    if (content) return this.singleLine(content, 160);

    const attachmentCount = message.attachments.size;
    if (attachmentCount > 0) {
      return attachmentCount === 1 ? 'رسالة فيها مرفق/صورة' : `رسالة فيها ${attachmentCount} مرفقات/صور`;
    }

    return 'رسالة بدون نص';
  }

  private renderProgressBar(current: number, total: number): string {
    if (total <= 0) return '[----------] 0/0';

    const width = 10;
    const filled = Math.max(0, Math.min(width, Math.round((current / total) * width)));
    return `[${'#'.repeat(filled)}${'-'.repeat(width - filled)}] ${current}/${total}`;
  }

  private singleLine(value: string, max: number): string {
    return this.trimEmbedValue(value.replace(/\s+/g, ' ').trim(), max);
  }

  private trimEmbedValue(value: string, max = 1000): string {
    return value.length > max ? `${value.slice(0, max - 3)}...` : value;
  }
}
