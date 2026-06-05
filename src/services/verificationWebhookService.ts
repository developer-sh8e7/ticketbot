import { logger } from '../utils/logger.js';

export interface VerificationAlertPayload {
  discordId: string;
  discordUsername: string;
  discordDisplayName: string;
  discordAvatarUrl?: string;
  phoneNumber: string;
  ipAddress: string;
  userAgent: string;
  verifiedAt: Date;
}

async function postWebhook(url: string, payload: unknown): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    return response.ok;
  } finally {
    clearTimeout(timeout);
  }
}

export async function sendVerificationAlert(data: VerificationAlertPayload): Promise<void> {
  const webhookUrl = process.env.VERIFICATION_WEBHOOK_URL?.trim();
  if (!webhookUrl) {
    logger.warn('Verification webhook is not configured.');
    return;
  }

  const embed = {
    title: 'تم التحقق من هوية متقدم وسيط',
    color: 0x57f287,
    thumbnail: data.discordAvatarUrl ? { url: data.discordAvatarUrl } : undefined,
    fields: [
      { name: 'المستخدم', value: `<@${data.discordId}>`, inline: true },
      { name: 'اسم الحساب', value: data.discordUsername || 'غير معروف', inline: true },
      { name: 'Discord ID', value: `\`${data.discordId}\``, inline: false },
      { name: 'رقم الواتساب', value: `\`${data.phoneNumber}\``, inline: false },
      { name: 'عنوان IP', value: `\`${data.ipAddress}\``, inline: true },
      { name: 'المتصفح', value: data.userAgent.slice(0, 100) || 'غير معروف', inline: false },
      { name: 'وقت التحقق', value: data.verifiedAt.toISOString(), inline: false },
    ],
    footer: {
      text: '⚠️ هذه المعلومات سرية للغاية — للاستخدام القانوني فقط عند الضرورة',
    },
    timestamp: data.verifiedAt.toISOString(),
  };

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      if (await postWebhook(webhookUrl, { embeds: [embed] })) {
        logger.info('Verification webhook delivered.', { discordId: data.discordId, attempt });
        return;
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
}
