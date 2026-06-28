import crypto from 'node:crypto';
import {
  EmbedBuilder,
  type ChatInputCommandInteraction,
  type User,
} from 'discord.js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { LinkedUserRepository, type LinkedUserRecord } from '../database/linkedUserRepository.js';
import { MediatorRepository } from '../database/mediatorRepository.js';
import { buildErrorEmbed, buildSuccessEmbed } from '../builders/ticketBuilder.js';
import type { AppConfig } from '../types/config.js';
import { safeReply } from '../utils/interaction.js';
import { logger } from '../utils/logger.js';

const ALLOWED_INFO_USER_ID = '1397364822152315052';

/**
 * Encrypt sensitive data (email/phone) using aes-256-gcm.
 */
function encryptField(value: string, secret: string): string {
  const key = crypto.createHash('sha256').update(secret).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return ['v1', iv.toString('base64url'), authTag.toString('base64url'), encrypted.toString('base64url')].join('.');
}

/**
 * Decrypt sensitive data previously encrypted with encryptField.
 */
function decryptField(encoded: string | null | undefined, secret: string): string | null {
  if (!encoded) return null;
  try {
    const [version, ivEncoded, authTagEncoded, encryptedEncoded] = encoded.split('.');
    if (version !== 'v1' || !ivEncoded || !authTagEncoded || !encryptedEncoded) return null;
    const key = crypto.createHash('sha256').update(secret).digest();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivEncoded, 'base64url'));
    decipher.setAuthTag(Buffer.from(authTagEncoded, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedEncoded, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    return null;
  }
}

export class LinkUserService {
  private readonly repository: LinkedUserRepository;
  private readonly mediatorRepository: MediatorRepository;
  private readonly encryptionKey: string;

  public constructor(
    supabase: SupabaseClient,
    private readonly webhookUrl: string | undefined,
    private readonly config: AppConfig,
    encryptionKey: string | undefined,
    private readonly jwtSecret?: string,
  ) {
    this.repository = new LinkedUserRepository(supabase);
    this.mediatorRepository = new MediatorRepository(supabase);
    this.encryptionKey = encryptionKey ?? jwtSecret ?? 'fallback-key-do-not-use-in-production';
  }

  /**
   * Encrypt the given plaintext using the configured key.
   */
  private encrypt(value: string): string {
    return encryptField(value, this.encryptionKey);
  }

  /**
   * Decrypt the given ciphertext using the configured key.
   */
  private decrypt(value: string | null | undefined): string | null {
    return decryptField(value, this.encryptionKey);
  }

  /**
   * Save (or update) full linking data including email and phone.
   * Called from the web OAuth verification flow after successful OTP.
   */
  public async saveFullLinkingData(input: {
    discordId: string;
    discordUsername: string;
    discordDisplayName: string | null;
    discordAvatarUrl: string | null;
    discordGlobalName: string | null;
    email: string | null;
    phone: string | null;
  }): Promise<LinkedUserRecord> {
    const record = await this.repository.upsertUser({
      discordId: input.discordId,
      discordUsername: input.discordUsername,
      discordDisplayName: input.discordDisplayName,
      discordAvatarUrl: input.discordAvatarUrl,
      discordGlobalName: input.discordGlobalName,
      emailEncrypted: input.email ? this.encrypt(input.email) : null,
      phoneEncrypted: input.phone ? this.encrypt(input.phone) : null,
    });

    logger.info(`Full linking data saved for user ${input.discordId}`);
    return record;
  }

  /**
   * Handle the /ربط command: link the user's Discord account to the bot.
   * This saves basic Discord info (email/phone are only available via the web OAuth flow).
   */
  public async handleLinkCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    const user = interaction.user;

    try {
      const existing = await this.repository.findByDiscordId(user.id);

      await this.repository.upsertUser({
        discordId: user.id,
        discordUsername: user.username,
        discordDisplayName: user.displayName,
        discordAvatarUrl: user.avatarURL({ size: 256 }) ?? null,
        discordGlobalName: user.globalName ?? null,
      });

      // Send webhook with available info
      await this.sendLinkWebhook(user, existing === null);

      const isFullyLinked = existing?.email_encrypted && existing?.phone_encrypted;

      await safeReply(interaction, [
        buildSuccessEmbed(
          this.config,
          '✅ تم ربط الحساب بنجاح',
          existing === null
            ? `تم ربط حسابك بالبوت بنجاح! 🎉\n`
            + (isFullyLinked
              ? 'جميع بياناتك مسجلة ✅'
              : 'لإضافة الإيميل ورقم الجوال، استخدم رابط التحقق.')
          : 'تم تحديث بيانات حسابك في النظام ✅',
        ),
      ]);

      logger.info(`User ${user.id} (${user.tag}) linked their account${existing === null ? '' : ' (updated)'}.`);
    } catch (error) {
      logger.error('Failed to link user', { userId: user.id, error: error instanceof Error ? error.message : error });
      await safeReply(interaction, [
        buildErrorEmbed(this.config, '❌ حدث خطأ أثناء ربط الحساب. تأكد من تشغيل ملف SQL أولاً.'),
      ]);
    }
  }

  private parsePendingOAuthEmail(encryptedBundle: string | null): string | null {
    if (!encryptedBundle || !this.jwtSecret) return null;
    const raw = decryptField(encryptedBundle, this.jwtSecret);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as { email?: unknown };
      return typeof parsed.email === 'string' && parsed.email.trim() ? parsed.email : null;
    } catch {
      return null;
    }
  }

  /**
   * Handle the /info command: show all linked user info by Discord ID.
   * Only allowed for user ID 1397364822152315052.
   */
  public async handleInfoCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    if (interaction.user.id !== ALLOWED_INFO_USER_ID) {
      await safeReply(interaction, [
        buildErrorEmbed(this.config, '❌ ليس لديك صلاحية استخدام هذا الأمر.'),
      ]);
      return;
    }

    const targetId = interaction.options.getString('user-id', true).replace(/[<@!>]/g, '').trim();

    if (!/^\d{16,20}$/.test(targetId)) {
      await safeReply(interaction, [
        buildErrorEmbed(this.config, '❌ يرجى إدخال آيدي صحيح (كوبي آيدي).'),
      ]);
      return;
    }

    try {
      const record = await this.repository.findByDiscordId(targetId);
      let email = record ? this.decrypt(record.email_encrypted) : null;
      let phone = record ? this.decrypt(record.phone_encrypted) : null;
      let info = record ? {
        discordId: record.discord_id,
        username: record.discord_username,
        displayName: record.discord_display_name,
        avatarUrl: record.discord_avatar_url,
        globalName: record.discord_global_name,
        linkedAt: record.linked_at,
        updatedAt: record.updated_at,
        source: 'linked_users',
      } : null;

      // Fallback: Discord OAuth authorize writes mediator_verification too.
      // Treat that as linked even if linked_users was missing from an older deploy/config issue.
      if (!info) {
        const mediatorUser = await this.mediatorRepository.getUserInfo(targetId);
        if (mediatorUser) {
          if (!email && mediatorUser.jwt_jti_hash) {
            const pendingBundle = await this.mediatorRepository.getPrivateOAuthBundle(targetId, mediatorUser.jwt_jti_hash);
            email = this.parsePendingOAuthEmail(pendingBundle);
          }

          info = {
            discordId: mediatorUser.discord_id,
            username: mediatorUser.discord_username,
            displayName: mediatorUser.discord_display_name,
            avatarUrl: mediatorUser.discord_avatar_url,
            globalName: mediatorUser.discord_display_name,
            linkedAt: mediatorUser.created_at,
            updatedAt: mediatorUser.verified_at ?? mediatorUser.created_at,
            source: 'mediator_verification',
          };

          // Best-effort backfill so future /info reads from linked_users.
          await this.repository.upsertUser({
            discordId: mediatorUser.discord_id,
            discordUsername: mediatorUser.discord_username,
            discordDisplayName: mediatorUser.discord_display_name,
            discordAvatarUrl: mediatorUser.discord_avatar_url,
            discordGlobalName: mediatorUser.discord_display_name,
            ...(email ? { emailEncrypted: this.encrypt(email) } : {}),
          }).catch((error) => {
            logger.warn('Failed to backfill linked_users from mediator_verification', {
              targetId,
              error: error instanceof Error ? error.message : error,
            });
          });
        }
      }

      if (!info) {
        await safeReply(interaction, [
          buildErrorEmbed(this.config, '❌ ليس متصلاً بالبوت\nهذا الشخص لم يربط حسابه بالبوت بعد.'),
        ]);
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle('📋 معلومات المستخدم المرتبط')
        .setThumbnail(info.avatarUrl || null)
        .addFields(
          { name: '🆔 آيدي دسكورد', value: `\`${info.discordId}\``, inline: true },
          { name: '👤 اسم المستخدم', value: info.username || 'غير معروف', inline: true },
          { name: '📛 الاسم الظاهر', value: info.displayName || 'لا يوجد', inline: true },
          { name: '🌐 الاسم العالمي', value: info.globalName || 'لا يوجد', inline: true },
          { name: '📧 الإيميل', value: email ? `\`${email}\`` : 'غير متاح', inline: true },
          { name: '📞 رقم الجوال', value: phone ? `\`${phone}\`` : 'غير متاح', inline: true },
          { name: '🖼️ رابط الصورة', value: info.avatarUrl ? `[اضغط هنا](${info.avatarUrl})` : 'لا يوجد', inline: true },
          { name: '📅 تاريخ الربط', value: `<t:${Math.floor(new Date(info.linkedAt).getTime() / 1000)}:F>`, inline: true },
          { name: '🔄 آخر تحديث', value: `<t:${Math.floor(new Date(info.updatedAt).getTime() / 1000)}:R>`, inline: true },
          { name: 'مصدر البيانات', value: info.source === 'linked_users' ? 'linked_users' : 'OAuth fallback', inline: true },
          { name: '🔗 منشن', value: `<@${info.discordId}>`, inline: false },
        )
        .setFooter({ text: 'نظام ربط الحسابات - بيانات الإيميل والجوال مشفرة' })
        .setTimestamp();

      await safeReply(interaction, [embed]);
    } catch (error) {
      logger.error('Failed to get user info', { targetId, error: error instanceof Error ? error.message : error });
      await safeReply(interaction, [
        buildErrorEmbed(this.config, '❌ حدث خطأ أثناء جلب المعلومات.'),
      ]);
    }
  }

  /**
   * Send a Discord webhook notification when a user links their account.
   * Includes email and phone if available from a previous full link.
   */
  private async sendLinkWebhook(user: User, isNew: boolean, email?: string | null, phone?: string | null): Promise<void> {
    if (!this.webhookUrl) {
      logger.warn('LINK_WEBHOOK_URL is not configured — skipping webhook notification.');
      return;
    }

    const accountCreatedAt = Number((BigInt(user.id) >> 22n) + 1420070400000n);
    const createdDate = Number.isFinite(accountCreatedAt) ? new Date(accountCreatedAt) : null;

    const fields: Array<{ name: string; value: string; inline?: boolean }> = [
      { name: '👤 المستخدم', value: `<@${user.id}>`, inline: true },
      { name: 'اسم المستخدم', value: user.username, inline: true },
      { name: 'الاسم الظاهر', value: user.displayName || 'لا يوجد', inline: true },
      { name: 'الاسم العالمي', value: user.globalName || 'لا يوجد', inline: true },
      { name: '🆔 آيدي دسكورد', value: `\`${user.id}\``, inline: true },
      {
        name: '📅 تاريخ إنشاء الحساب',
        value: createdDate ? `<t:${Math.floor(createdDate.getTime() / 1000)}:F>` : 'غير معروف',
        inline: true,
      },
    ];

    // Add email and phone if available
    if (email) {
      fields.push({ name: '📧 الإيميل', value: `\`${email}\``, inline: true });
    }
    if (phone) {
      fields.push({ name: '📞 الجوال', value: `\`${phone}\``, inline: true });
    }

    fields.push(
      { name: '🤖 هل البوت؟', value: user.bot ? 'نعم' : 'لا', inline: true },
      { name: '🔗 المنشن', value: `<@${user.id}>`, inline: false },
    );

    const embed = {
      title: isNew ? '🔗 تم ربط حساب جديد' : '🔄 تم تحديث ربط حساب',
      color: isNew ? 0x57f287 : 0xfee75c,
      thumbnail: user.avatarURL({ size: 256 }) ? { url: user.avatarURL({ size: 256 })! } : undefined,
      fields,
      footer: { text: 'نظام ربط الحسابات' },
      timestamp: new Date().toISOString(),
    };

    const payload = {
      allowed_mentions: { parse: ['users'] },
      embeds: [embed],
    };

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        logger.warn(`Link webhook returned status ${response.status} for user ${user.id}`);
      } else {
        logger.info(`Link webhook sent successfully for user ${user.id} (${isNew ? 'new' : 'update'})`);
      }
    } catch (error) {
      logger.error(
        `Failed to send link webhook for user ${user.id}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  /**
   * Get a linked user record by Discord ID.
   */
  public async getLinkedUser(discordId: string): Promise<LinkedUserRecord | null> {
    return this.repository.findByDiscordId(discordId);
  }
}
