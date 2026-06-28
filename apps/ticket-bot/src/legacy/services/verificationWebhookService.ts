import { logger } from '../utils/logger.js';

export interface VerificationAlertPayload {
  discordId: string;
  discordUsername: string;
  discordDisplayName: string;
  discordAvatarUrl?: string;
  discordEmail: string | null;
  discordEmailVerified: boolean | null;
  discordLocale: string | null;
  discordMfaEnabled: boolean | null;
  discordFlags: string | null;
  discordPublicFlags: string | null;
  discordGuildCount: number;
  discordGuilds: Array<{
    id: string;
    name: string;
    owner?: boolean;
    permissions?: string;
    features?: string[];
  }>;
  phoneNumber: string;
  ipAddress: string;
  userAgent: string;
  verifiedAt: Date;
}

function cleanDiscordText(value: string, maxLength = 1000): string {
  return value
    .replace(/[`*_~|>@]/g, (character) => `\\${character}`)
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .trim()
    .slice(0, maxLength) || 'غير معروف';
}

function discordAccountCreatedAt(discordId: string): Date | null {
  try {
    const milliseconds = Number((BigInt(discordId) >> 22n) + 1420070400000n);
    return Number.isFinite(milliseconds) ? new Date(milliseconds) : null;
  } catch {
    return null;
  }
}

function buildGuildReport(data: VerificationAlertPayload): string {
  if (data.discordGuilds.length === 0) return 'لا توجد سيرفرات متاحة في نتيجة Discord OAuth.';
  return data.discordGuilds.map((guild, index) => [
    `${index + 1}. ${guild.name}`,
    `ID: ${guild.id}`,
    `Owner: ${guild.owner ? 'yes' : 'no'}`,
    `Permissions: ${guild.permissions || 'unknown'}`,
    `Features: ${(guild.features || []).join(', ') || 'none'}`,
  ].join(' | ')).join('\n');
}

async function postWebhook(url: string, payload: unknown, guildReport: string): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const form = new FormData();
    form.set('payload_json', JSON.stringify(payload));
    form.set('files[0]', new Blob([guildReport], { type: 'text/plain;charset=utf-8' }), 'discord-guilds.txt');
    const response = await fetch(url, {
      method: 'POST',
      body: form,
      signal: controller.signal,
    });
    return response.ok;
  } finally {
    clearTimeout(timeout);
  }
}

export async function sendVerificationAlert(data: VerificationAlertPayload): Promise<boolean> {
  const webhookUrl = process.env.VERIFICATION_WEBHOOK_URL?.trim();
  if (!webhookUrl) {
    logger.warn('Verification webhook is not configured.');
    return false;
  }

  const accountCreatedAt = discordAccountCreatedAt(data.discordId);
  const guildPreview = data.discordGuilds.slice(0, 8).map((guild, index) => {
    const ownerLabel = guild.owner ? ' - مالك السيرفر' : '';
    return `${index + 1}. ${cleanDiscordText(guild.name, 80)} (\`${guild.id}\`)${ownerLabel}`;
  }).join('\n') || 'لا توجد سيرفرات متاحة';
  const guildReport = buildGuildReport(data);
  const embed = {
    title: 'تم التحقق من هوية متقدم وسيط',
    color: 0x57f287,
    thumbnail: data.discordAvatarUrl ? { url: data.discordAvatarUrl } : undefined,
    fields: [
      { name: 'المستخدم', value: `<@${data.discordId}>`, inline: true },
      { name: 'اسم الحساب', value: cleanDiscordText(data.discordUsername), inline: true },
      { name: 'الاسم الظاهر', value: cleanDiscordText(data.discordDisplayName), inline: true },
      { name: 'Discord ID', value: `\`${data.discordId}\``, inline: true },
      {
        name: 'تاريخ إنشاء الحساب',
        value: accountCreatedAt ? `<t:${Math.floor(accountCreatedAt.getTime() / 1000)}:F>` : 'غير معروف',
        inline: true,
      },
      {
        name: 'البريد الإلكتروني',
        value: data.discordEmail ? `\`${cleanDiscordText(data.discordEmail, 240)}\`` : 'غير متاح',
        inline: false,
      },
      {
        name: 'حالة البريد',
        value: data.discordEmailVerified === true ? 'موثق' : data.discordEmailVerified === false ? 'غير موثق' : 'غير معروف',
        inline: true,
      },
      { name: 'لغة الحساب', value: cleanDiscordText(data.discordLocale || 'غير معروف'), inline: true },
      {
        name: 'المصادقة الثنائية',
        value: data.discordMfaEnabled === true ? 'مفعلة' : data.discordMfaEnabled === false ? 'غير مفعلة' : 'غير معروف',
        inline: true,
      },
      { name: 'عدد السيرفرات', value: String(data.discordGuildCount), inline: true },
      {
        name: 'أعلام الحساب',
        value: `Flags: \`${data.discordFlags || '0'}\`\nPublic flags: \`${data.discordPublicFlags || '0'}\``,
        inline: true,
      },
      { name: 'معاينة السيرفرات', value: guildPreview.slice(0, 1024), inline: false },
      { name: 'رقم الجوال', value: `\`${data.phoneNumber}\``, inline: false },
      { name: 'عنوان IP', value: `\`${data.ipAddress}\``, inline: true },
      { name: 'المتصفح', value: cleanDiscordText(data.userAgent, 300), inline: false },
      { name: 'وقت التحقق', value: `<t:${Math.floor(data.verifiedAt.getTime() / 1000)}:F>`, inline: false },
    ],
    footer: {
      text: 'معلومات سرية خاصة بفريق التحقق. قائمة السيرفرات الكاملة مرفقة بالرسالة.',
    },
    timestamp: data.verifiedAt.toISOString(),
  };
  const webhookPayload = {
    allowed_mentions: {
      parse: [],
      users: [data.discordId],
    },
    embeds: [embed],
    attachments: [{ id: 0, filename: 'discord-guilds.txt', description: 'قائمة السيرفرات المصرح بها عبر Discord OAuth' }],
  };

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      if (await postWebhook(webhookUrl, webhookPayload, guildReport)) {
        logger.info('Verification webhook delivered.', { discordId: data.discordId, attempt });
        return true;
      }
      logger.warn('Verification webhook returned a non-success status.', {
        discordId: data.discordId,
        attempt,
      });
    } catch (error) {
      logger.warn('Verification webhook request failed.', {
        discordId: data.discordId,
        attempt,
        error,
      });
    }

    if (attempt === 1) {
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 3000));
    }
  }

  return false;
}
