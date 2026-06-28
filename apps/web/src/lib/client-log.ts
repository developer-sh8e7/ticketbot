/**
 * Client-side logging helper.
 * Fires a POST to /api/log which proxies to Discord webhook.
 * Fire-and-forget — never blocks or throws.
 */

type LogField = { name: string; value: string; inline?: boolean };

type ClientLogPayload = {
  eventType?: string;
  title: string;
  description?: string;
  color?: number;
  fields?: LogField[];
  footer?: string;
};

export function clientLog(payload: ClientLogPayload) {
  fetch('/api/log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => {
    // silently ignore — this is best-effort logging
  });
}
