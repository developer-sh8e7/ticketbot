import { env } from './env';
const DISCORD_API = 'https://discord.com/api/v10';
const PROJECT_NOTIFICATION_OWNER_ID = '1397364822152315052';

/**
 * Sends a privacy-safe DM only to the fixed store-owner account.
 * Project text and phone numbers are deliberately never copied to Discord.
 */
export async function notifyOwnerOfProjectRequest(input: {
  requestId: string;
  requesterName?: string | null;
  kind: 'created' | 'message';
}) {
  const token = env().OPUS_CONTROL_BOT_TOKEN;
  if (!token) return false;

  try {
    const channelResponse = await fetch(`${DISCORD_API}/users/@me/channels`, {
      method: 'POST',
      headers: { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipient_id: PROJECT_NOTIFICATION_OWNER_ID }),
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    if (!channelResponse.ok) return false;

    const channel = (await channelResponse.json()) as { id?: string };
    if (!channel.id) return false;

    const dashboardUrl = `${env().APP_URL.replace(/\/$/, '')}/dashboard/projects`;
    const title = input.kind === 'created' ? '📨 طلب مشروع جديد' : '💬 رسالة جديدة في طلب مشروع';
    const safeName = input.requesterName?.trim().slice(0, 80) || 'أحد العملاء';
    const messageResponse = await fetch(`${DISCORD_API}/channels/${channel.id}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: `<@${PROJECT_NOTIFICATION_OWNER_ID}>`,
        allowed_mentions: { users: [PROJECT_NOTIFICATION_OWNER_ID] },
        embeds: [{
          title,
          description: `${safeName} ${input.kind === 'created' ? 'أرسل فكرة مشروع جديدة.' : 'أرسل رداً جديداً.'}\n\n🔐 تفاصيل الطلب لا تُرسل إلى Discord؛ افتح لوحة المالك لقراءتها بأمان.`,
          color: 0xff8a00,
          fields: [{ name: 'رقم الطلب', value: `\`${input.requestId.slice(0, 8)}\``, inline: true }],
          url: dashboardUrl,
          timestamp: new Date().toISOString(),
        }],
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    return messageResponse.ok;
  } catch {
    return false;
  }
}
