export interface VerificationAlertPayload {
  discordId: string;
  discordUsername: string;
  discordDisplayName: string;
  phoneNumber: string;
  ipAddress: string;
  userAgent: string;
  verifiedAt: Date;
}

async function postWebhook(url: string, payload: unknown): Promise<boolean> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  return response.ok;
}

export async function sendVerificationAlert(data: VerificationAlertPayload): Promise<void> {
  const webhookUrl = process.env.VERIFICATION_WEBHOOK_URL?.trim();
  if (!webhookUrl) {
    console.warn('[VerificationWebhook] VERIFICATION_WEBHOOK_URL is not configured.');
    return;
  }

  const payload = {
    embeds: [
      {
        title: '🛡️ وسيط جديد — تم التحقق من الهوية',
        color: 0x57f287,
        fields: [
          { name: '👤 اليوزر', value: data.discordUsername || 'غير معروف', inline: true },
          { name: '🏷️ الاسم', value: data.discordDisplayName || 'غير معروف', inline: true },
          { name: '🆔 Discord ID', value: `\`${data.discordId}\``, inline: false },
          { name: '📱 رقم الواتساب', value: `\`${data.phoneNumber}\``, inline: false },
          { name: '🌐 عنوان IP', value: `\`${data.ipAddress}\``, inline: true },
          { name: '🖥️ المتصفح', value: data.userAgent.slice(0, 80) || 'غير معروف', inline: false },
          { name: '📅 وقت التحقق', value: data.verifiedAt.toISOString(), inline: false },
        ],
        footer: {
          text: '⚠️ هذه المعلومات سرية وللاستخدام القانوني فقط عند الحاجة',
        },
        timestamp: new Date().toISOString(),
      },
    ],
  };

  try {
    const ok = await postWebhook(webhookUrl, payload);
    if (ok) {
      console.info('[VerificationWebhook] Verification alert sent.');
      return;
    }
  } catch (error) {
    console.warn('[VerificationWebhook] First attempt failed.', error instanceof Error ? error.message : error);
  }

  await new Promise((resolve) => setTimeout(resolve, 5000));

  try {
    const ok = await postWebhook(webhookUrl, payload);
    if (ok) {
      console.info('[VerificationWebhook] Verification alert sent on retry.');
      return;
    }
    console.warn('[VerificationWebhook] Retry failed with non-2xx response.');
  } catch (error) {
    console.warn('[VerificationWebhook] Retry failed.', error instanceof Error ? error.message : error);
  }
}
