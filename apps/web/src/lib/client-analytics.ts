'use client';

const allowedMetadataKeys = new Set(['path', 'source', 'audience']);

export function trackMarketingEvent(eventType: string, metadata: Record<string, string> = {}) {
  const safeMetadata = Object.fromEntries(
    Object.entries(metadata)
      .filter(([key, value]) => allowedMetadataKeys.has(key) && typeof value === 'string')
      .map(([key, value]) => [key, value.slice(0, 120)])
  );

  void fetch('/api/analytics/event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventType, metadata: safeMetadata }),
    keepalive: true,
  }).catch(() => {});
}
