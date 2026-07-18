/**
 * Visit webhook endpoint — called ONCE per session by the VisitLogger client component.
 * Reads IP and user-agent from headers (server-side) and sends a single clean Discord embed.
 */
import { NextRequest } from 'next/server';
import { sendDiscordWebhook } from '@/lib/webhook';
import { rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

function parseUA(ua: string) {
  const lower = ua.toLowerCase();
  let device = 'Desktop';
  if (/tablet|ipad|playbook|silk/i.test(lower)) device = 'Tablet';
  else if (/mobile|iphone|ipod|android.*mobile|blackberry|windows phone/i.test(lower)) device = 'Mobile';

  let browser = 'Other';
  let ver = '';
  if (ua.includes('Edg/') || ua.includes('Edge/')) { browser = 'Edge'; ver = ua.match(/Edg\/([\d.]+)/)?.[1] || ''; }
  else if (ua.includes('Chrome/') && !ua.includes('Edg/')) { browser = 'Chrome'; ver = ua.match(/Chrome\/([\d.]+)/)?.[1] || ''; }
  else if (ua.includes('Firefox/')) { browser = 'Firefox'; ver = ua.match(/Firefox\/([\d.]+)/)?.[1] || ''; }
  else if (ua.includes('Safari/') && !ua.includes('Chrome/')) { browser = 'Safari'; ver = ua.match(/Version\/([\d.]+)/)?.[1] || ''; }
  else if (ua.includes('OPR/') || ua.includes('Opera/')) { browser = 'Opera'; ver = ua.match(/OPR\/([\d.]+)/)?.[1] || ''; }

  let os = 'Other';
  let osVer = '';
  if (/windows/i.test(lower)) { os = 'Windows'; osVer = ua.match(/Windows NT ([\d.]+)/)?.[1] || ''; }
  else if (/mac os|macintosh/i.test(lower)) { os = 'macOS'; osVer = ua.match(/Mac OS X ([\d_]+)/)?.[1]?.replace(/_/g, '.') || ''; }
  else if (/android/i.test(lower)) { os = 'Android'; osVer = ua.match(/Android ([\d.]+)/)?.[1] || ''; }
  else if (/ios|iphone|ipad/i.test(lower)) { os = 'iOS'; osVer = ua.match(/OS ([\d_]+)/)?.[1]?.replace(/_/g, '.') || ''; }
  else if (/linux/i.test(lower)) { os = 'Linux'; }

  return { device, browser, ver: ver || '', os, osVer: osVer || '' };
}

function timeNow(): string {
  try {
    return new Date().toLocaleString('ar-SA', { timeZone: 'Asia/Riyadh' });
  } catch {
    return new Date().toISOString().replace('T', ' ').slice(0, 19);
  }
}

const PAGE_ICONS: Record<string, string> = {
  '/': '🏠',
  '/pricing': '💰',
  '/commands': '⚡',
  '/dashboard': '📊',
  '/login': '🔑',
};

const PAGE_LABELS: Record<string, string> = {
  '/': 'الرئيسية',
  '/pricing': 'الأسعار',
  '/commands': 'الأوامر',
  '/dashboard': 'لوحة التحكم',
  '/login': 'تسجيل الدخول',
};

export async function POST(req: NextRequest) {
  try {
    if (!rateLimit(req, 'log-visit', 5, 60_000).allowed) {
      return new Response(JSON.stringify({ ok: false }), { status: 429, headers: { 'Content-Type': 'application/json' } });
    }
    const body = await req.json().catch(() => ({})) as { path?: string };
    const path = (typeof body.path === 'string' ? body.path : '/').slice(0, 120);

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'مجهول';
    const userAgent = req.headers.get('user-agent') || '';

    const ua = parseUA(userAgent);
    const icon = PAGE_ICONS[path] || '📄';
    const label = PAGE_LABELS[path] || path;

    await sendDiscordWebhook('visit', {
      title: `${icon} ${label}`,
      description: `زيارة جديدة للموقع`,
      color: 0x3b82f6,
      fields: [
        { name: '🌐 IP', value: `\`${ip}\``, inline: true },
        { name: '💻 الجهاز', value: ua.device, inline: true },
        { name: '🌍 المتصفح', value: `${ua.browser} ${ua.ver}`.trim() || ua.browser, inline: true },
        { name: '⚙️ نظام التشغيل', value: `${ua.os} ${ua.osVer}`.trim() || ua.os, inline: true },
        { name: '🕒 الوقت', value: timeNow(), inline: true },
      ],
      footer: 'Opus • Visit',
    });

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[api/log/visit] Error:', error instanceof Error ? error.message : error);
    return new Response(JSON.stringify({ ok: false }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
