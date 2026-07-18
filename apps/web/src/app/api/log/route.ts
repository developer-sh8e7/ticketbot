/**
 * Client-side log endpoint — proxies webhook events from the browser
 * so we don't expose server-side env vars to the client.
 *
 * Hardened: rate-limited per IP, event types allow-listed, lengths clamped,
 * and the footer is forced so browser-originated embeds can never impersonate
 * server-side events (e.g. a forged "purchase success").
 *
 * POST /api/log
 * Body: { eventType: string; title: string; description?: string; color?: number; fields?: {...}[] }
 */
import { NextRequest } from 'next/server';
import { sendBuyWebhook } from '@/lib/webhook';
import { rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

// Only the events the site's own client code actually sends.
const ALLOWED_EVENTS = new Set(['capture_failed', 'payment_cancelled', 'payment_error']);
const CLIENT_FOOTER = 'Opus • Client';

export async function POST(req: NextRequest) {
  try {
    if (!rateLimit(req, 'client-log', 10, 60_000).allowed) {
      return new Response(JSON.stringify({ ok: false, error: 'rate_limited' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return new Response(JSON.stringify({ ok: false, error: 'Invalid JSON' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const eventType = typeof body.eventType === 'string' ? body.eventType.trim() : '';
    if (!ALLOWED_EVENTS.has(eventType)) {
      return new Response(JSON.stringify({ ok: false, error: 'Unknown event type' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const title = typeof body.title === 'string' ? body.title.slice(0, 100) : '📝 حدث';
    const description = typeof body.description === 'string' ? body.description.slice(0, 500) : undefined;

    let color = 0xff8a00;
    if (typeof body.color === 'number' && Number.isFinite(body.color)) {
      color = body.color;
    }

    let fields: { name: string; value: string; inline?: boolean }[] | undefined;
    if (Array.isArray(body.fields)) {
      fields = body.fields
        .filter(
          (f): f is { name: string; value: string; inline?: boolean } =>
            f !== null && typeof f === 'object' && typeof (f as Record<string, unknown>).name === 'string' && typeof (f as Record<string, unknown>).value === 'string'
        )
        .slice(0, 6)
        .map((f) => ({ name: f.name.slice(0, 60), value: f.value.slice(0, 300), inline: f.inline === true }));
    }

    const sent = await sendBuyWebhook(eventType, {
      title,
      description,
      color,
      fields,
      footer: CLIENT_FOOTER,
    });

    return new Response(JSON.stringify({ ok: true, sent }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[api/log] Unhandled error:', error instanceof Error ? error.message : 'Unknown error');
    return new Response(JSON.stringify({ ok: false }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
