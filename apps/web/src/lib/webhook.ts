/**
 * Discord webhook logger.
 * Reads webhook URLs directly from process.env (no Zod dependency)
 * so it works in all runtimes without schema-parsing failures.
 *
 * DISCORD_WEBHOOK_LOGS → visits + payment problems
 * DISCORD_BUY_WEB      → successful purchases only
 */

type WebhookColor = number;

type WebhookField = {
  name: string;
  value: string;
  inline?: boolean;
};

type WebhookPayload = {
  title: string;
  description?: string;
  color: WebhookColor;
  fields?: WebhookField[];
  footer?: string;
};

function colorForEvent(eventType: string): WebhookColor {
  if (eventType.includes('purchase_success') || eventType.includes('capture_success')) return 0x00d4aa;
  if (eventType.includes('error') || eventType.includes('fail') || eventType.includes('rejected')) return 0xef4444;
  if (eventType.includes('attempt') || eventType.includes('pending')) return 0xf59e0b;
  if (eventType.includes('page_view') || eventType.includes('visit')) return 0x3b82f6;
  if (eventType.includes('click') || eventType.includes('cta')) return 0xffb866;
  return 0xff8a00;
}

function getEnv(key: string): string | undefined {
  try {
    return (process.env as Record<string, string | undefined>)[key] || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Send an embed to a Discord webhook.
 * NEVER throws — returns true if sent, false if skipped/failed.
 */
async function sendToWebhook(webhookUrl: string | undefined, eventType: string, payload: WebhookPayload): Promise<boolean> {
  try {
    if (!webhookUrl) return false;

    const body = {
      embeds: [
        {
          title: payload.title,
          description: payload.description ?? '',
          color: payload.color ?? colorForEvent(eventType),
          fields: payload.fields ?? [],
          footer: payload.footer ? { text: payload.footer } : undefined,
          timestamp: new Date().toISOString(),
        },
      ],
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.warn(`[webhook] ${eventType}: Discord returned ${response.status}: ${text.slice(0, 200)}`);
      return false;
    }

    return true;
  } catch (error) {
    console.warn(`[webhook] ${eventType}: Failed:`, error instanceof Error ? error.message : error);
    return false;
  }
}

/** Send to DISCORD_WEBHOOK_LOGS (visits + payment problems) */
export async function sendDiscordWebhook(eventType: string, payload: WebhookPayload): Promise<boolean> {
  return sendToWebhook(getEnv('DISCORD_WEBHOOK_LOGS'), eventType, payload);
}

/** Send to DISCORD_BUY_WEB (successful purchases only) */
export async function sendBuyWebhook(eventType: string, payload: WebhookPayload): Promise<boolean> {
  return sendToWebhook(getEnv('DISCORD_BUY_WEB'), eventType, payload);
}
