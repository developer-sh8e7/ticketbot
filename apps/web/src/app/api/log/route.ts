/**
 * Client-side log endpoint — proxies webhook events from the browser
 * so we don't expose server-side env vars to the client.
 *
 * POST /api/log
 * Body: { eventType: string; title: string; description?: string; color?: number; fields?: {...}[]; footer?: string }
 */
import { sendBuyWebhook } from '@/lib/webhook';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    // Read body as text first to diagnose empty/invalid requests
    const text = await req.text();
    if (!text.trim()) {
      console.warn('[api/log] Empty request body');
      return new Response(JSON.stringify({ ok: false, error: 'Empty body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(text);
    } catch {
      console.warn('[api/log] Invalid JSON:', text.slice(0, 200));
      return new Response(JSON.stringify({ ok: false, error: 'Invalid JSON' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const eventType = typeof body.eventType === 'string' ? body.eventType.trim() : 'client_event';
    const title = typeof body.title === 'string' ? body.title : '📝 حدث';
    const description = typeof body.description === 'string' ? body.description : undefined;

    let color = 0x7c5cfc;
    if (typeof body.color === 'number' && Number.isFinite(body.color)) {
      color = body.color;
    }

    let fields: { name: string; value: string; inline?: boolean }[] | undefined;
    if (Array.isArray(body.fields)) {
      fields = body.fields.filter(
        (f): f is { name: string; value: string; inline?: boolean } =>
          f !== null && typeof f === 'object' && typeof (f as Record<string, unknown>).name === 'string' && typeof (f as Record<string, unknown>).value === 'string'
      );
    }

    const footer = typeof body.footer === 'string' ? body.footer : undefined;

    const sent = await sendBuyWebhook(eventType, {
      title,
      description,
      color,
      fields,
      footer,
    });

    if (!sent) {
      // Discord webhook not configured or failed silently — still return 200
      // so the client doesn't spam retries on a working site
      return new Response(JSON.stringify({ ok: true, sent: false }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true, sent: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[api/log] Unhandled error:', msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
