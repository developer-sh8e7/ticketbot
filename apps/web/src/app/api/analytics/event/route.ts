import { NextRequest } from 'next/server';
import { logWebsiteEvent } from '@/lib/events';
import { rateLimit } from '@/lib/rate-limit';

const ALLOWED_EVENTS = new Set([
  'project_form_viewed',
  'project_form_started',
  'whatsapp_click',
]);

export async function POST(req: NextRequest) {
  try {
    if (!rateLimit(req, 'marketing-event', 30, 60_000).allowed) {
      return Response.json({ ok: false }, { status: 429 });
    }

    const body = (await req.json().catch(() => ({}))) as { eventType?: unknown; metadata?: unknown };
    const eventType = typeof body.eventType === 'string' ? body.eventType : '';
    if (!ALLOWED_EVENTS.has(eventType)) return Response.json({ ok: false }, { status: 400 });

    const rawMetadata = body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata)
      ? body.metadata as Record<string, unknown>
      : {};
    const metadata = Object.fromEntries(
      Object.entries(rawMetadata)
        .filter(([key, value]) => ['path', 'source', 'audience'].includes(key) && typeof value === 'string')
        .map(([key, value]) => [key, String(value).slice(0, 120)])
    );

    await logWebsiteEvent({
      eventType,
      message: eventType.replaceAll('_', ' '),
      metadata,
    });

    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
}
