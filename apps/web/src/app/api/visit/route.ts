/**
 * Visit logging endpoint — called fire-and-forget from middleware.
 * Parses user-agent for general device/browser/OS info and logs to Supabase.
 * Returns immediately (no waiting for Supabase).
 */
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

type VisitBody = {
  path?: unknown;
  ip?: unknown;
  userAgent?: unknown;
  referer?: unknown;
};

function parseUserAgent(ua: string): {
  browser: string;
  browserVersion: string;
  os: string;
  osVersion: string;
  deviceType: 'mobile' | 'tablet' | 'desktop' | 'unknown';
} {
  const lower = ua.toLowerCase();

  // Device type
  let deviceType: 'mobile' | 'tablet' | 'desktop' | 'unknown' = 'desktop';
  if (/tablet|ipad|playbook|silk/i.test(lower)) deviceType = 'tablet';
  else if (/mobile|iphone|ipod|android.*mobile|blackberry|windows phone/i.test(lower)) deviceType = 'mobile';

  // Browser
  let browser = 'unknown';
  let browserVersion = '';

  if (ua.includes('Edg/') || ua.includes('Edge/')) {
    browser = 'Edge';
    browserVersion = ua.match(/Edg\/([\d.]+)/)?.[1] || ua.match(/Edge\/([\d.]+)/)?.[1] || '';
  } else if (ua.includes('Chrome/') && !ua.includes('Edg/')) {
    browser = 'Chrome';
    browserVersion = ua.match(/Chrome\/([\d.]+)/)?.[1] || '';
  } else if (ua.includes('Firefox/')) {
    browser = 'Firefox';
    browserVersion = ua.match(/Firefox\/([\d.]+)/)?.[1] || '';
  } else if (ua.includes('Safari/') && !ua.includes('Chrome/')) {
    browser = 'Safari';
    browserVersion = ua.match(/Version\/([\d.]+)/)?.[1] || '';
  } else if (ua.includes('OPR/') || ua.includes('Opera/')) {
    browser = 'Opera';
    browserVersion = ua.match(/OPR\/([\d.]+)/)?.[1] || ua.match(/Opera\/([\d.]+)/)?.[1] || '';
  }

  // OS
  let os = 'unknown';
  let osVersion = '';

  if (/windows/i.test(lower)) {
    os = 'Windows';
    osVersion = ua.match(/Windows NT ([\d.]+)/)?.[1] || '';
  } else if (/mac os|macintosh/i.test(lower)) {
    os = 'macOS';
    osVersion = ua.match(/Mac OS X ([\d_]+)/)?.[1]?.replace(/_/g, '.') || '';
  } else if (/android/i.test(lower)) {
    os = 'Android';
    osVersion = ua.match(/Android ([\d.]+)/)?.[1] || '';
  } else if (/ios|iphone|ipad/i.test(lower)) {
    os = 'iOS';
    osVersion = ua.match(/OS ([\d_]+)/)?.[1]?.replace(/_/g, '.') || '';
  } else if (/linux/i.test(lower)) {
    os = 'Linux';
  }

  return { browser, browserVersion, os, osVersion, deviceType };
}

function anonymizeIp(ip: string): string {
  // Keep first 2 octets for v4, first 4 groups for v6
  const cleaned = ip.replace(/^::ffff:/, '');
  if (cleaned.includes('.')) {
    return cleaned.replace(/(\d+\.\d+)\.\d+\.\d+/, '$1.x.x');
  }
  if (cleaned.includes(':')) {
    return cleaned.replace(/([0-9a-f]+:[0-9a-f]+):.*/i, '$1:xxxx:xxxx');
  }
  return 'unknown';
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as VisitBody;
    const path = typeof body.path === 'string' ? body.path.slice(0, 200) : '';
    const ip = typeof body.ip === 'string' ? body.ip : '';
    const userAgent = typeof body.userAgent === 'string' ? body.userAgent.slice(0, 500) : '';
    const referer = typeof body.referer === 'string' ? body.referer.slice(0, 500) : '';

    if (!path) {
      return new Response(JSON.stringify({ ok: false }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const parsed = parseUserAgent(userAgent);
    const ipAnonymized = anonymizeIp(ip);

    // Log to Supabase (fire-and-forget, don't await)
    supabaseAdmin()
      .from('website_logs')
      .insert({
        path,
        ip_anonymized: ipAnonymized,
        user_agent: userAgent.slice(0, 500),
        browser: parsed.browser,
        browser_version: parsed.browserVersion,
        os: parsed.os,
        os_version: parsed.osVersion,
        device_type: parsed.deviceType,
        referer: referer || null,
      })
      .then(({ error }) => {
        if (error) console.warn('[visit] Supabase insert failed:', error.message);
      });

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[visit] Error:', error instanceof Error ? error.message : error);
    return new Response(JSON.stringify({ ok: false }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
