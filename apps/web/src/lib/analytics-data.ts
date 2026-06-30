/**
 * Owner-only site analytics ("Status" dashboard).
 * Everything here is computed from REAL recorded data — website_logs (page
 * visits), website_events (funnel/checkout events) and payments. No estimates.
 * Service-role queries: only call after a server-side owner check.
 */
import { supabaseAdmin } from './supabase';

const DAY = 86_400_000;
const LOG_CAP = 10_000;   // bound aggregation work on busy days
const EVENT_CAP = 3_000;

export type SiteStatus = {
  traffic: { visits24h: number; visits7d: number; visits30d: number; visitsTotal: number; unique7d: number; unique30d: number };
  visitsByDay: { date: string; count: number }[];
  topPages: { label: string; count: number }[];
  devices: { desktop: number; mobile: number; tablet: number; unknown: number };
  topReferers: { referer: string; count: number }[];
  funnel: { visitors: number; viewedPricing: number; reachedCart: number; loggedIn: number; purchases: number };
  events30d: { orderCreated: number; purchaseSuccess: number; captureError: number; pending: number };
  recentEvents: { type: string; message: string; at: string }[];
};

function pageLabel(path: string): string {
  if (path === '/') return 'الرئيسية';
  if (path.startsWith('/pricing')) return 'الأسعار';
  if (path.startsWith('/product')) return 'صفحة منتج';
  if (path.startsWith('/cart')) return 'السلة';
  if (path.startsWith('/dashboard')) return 'لوحة التحكم';
  if (path.startsWith('/login')) return 'تسجيل الدخول';
  if (path.startsWith('/commands')) return 'الأوامر';
  return path;
}

function refererHost(referer: string | null): string | null {
  if (!referer) return null;
  try {
    return new URL(referer).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

export async function getSiteStatus(): Promise<SiteStatus> {
  const supabase = supabaseAdmin();
  const now = Date.now();
  const since30 = new Date(now - 30 * DAY).toISOString();
  const since7 = now - 7 * DAY;
  const since24 = now - DAY;

  const [logsRes, totalRes, eventsRes, paymentsRes, accountsRes] = await Promise.all([
    supabase.from('website_logs').select('path,ip_anonymized,device_type,referer,created_at').gte('created_at', since30).order('created_at', { ascending: false }).limit(LOG_CAP),
    supabase.from('website_logs').select('id', { count: 'exact', head: true }),
    supabase.from('website_events').select('event_type,message,created_at').gte('created_at', since30).order('created_at', { ascending: false }).limit(EVENT_CAP),
    supabase.from('payments').select('created_at,status').eq('status', 'captured').gte('created_at', since30).limit(2000),
    supabase.from('accounts').select('id', { count: 'exact', head: true }),
  ]);

  const logs = (logsRes.data ?? []) as { path: string; ip_anonymized: string | null; device_type: string | null; referer: string | null; created_at: string }[];
  const events = (eventsRes.data ?? []) as { event_type: string; message: string | null; created_at: string }[];
  const payments = (paymentsRes.data ?? []) as { created_at: string }[];

  // ── Traffic ──
  let visits24h = 0, visits7d = 0;
  const uniq7 = new Set<string>();
  const uniq30 = new Set<string>();
  const byDay = new Map<string, number>();
  const pages = new Map<string, number>();
  const refs = new Map<string, number>();
  const devices = { desktop: 0, mobile: 0, tablet: 0, unknown: 0 };

  for (let i = 13; i >= 0; i--) byDay.set(new Date(now - i * DAY).toISOString().slice(0, 10), 0);

  for (const row of logs) {
    const t = new Date(row.created_at).getTime();
    const ip = row.ip_anonymized || 'unknown';
    uniq30.add(ip);
    if (t >= since24) visits24h++;
    if (t >= since7) { visits7d++; uniq7.add(ip); }

    const day = row.created_at.slice(0, 10);
    if (byDay.has(day)) byDay.set(day, (byDay.get(day) ?? 0) + 1);

    const label = pageLabel(row.path);
    pages.set(label, (pages.get(label) ?? 0) + 1);

    const dev = (row.device_type ?? 'unknown') as keyof typeof devices;
    if (dev in devices) devices[dev]++; else devices.unknown++;

    const host = refererHost(row.referer);
    if (host) refs.set(host, (refs.get(host) ?? 0) + 1);
  }

  // ── Funnel (unique visitors by IP within 30d) ──
  const fVisitors = new Set<string>();
  const fPricing = new Set<string>();
  const fCart = new Set<string>();
  const fLogin = new Set<string>();
  for (const row of logs) {
    const ip = row.ip_anonymized || 'unknown';
    fVisitors.add(ip);
    if (row.path.startsWith('/pricing') || row.path.startsWith('/product')) fPricing.add(ip);
    if (row.path.startsWith('/cart')) fCart.add(ip);
    if (row.path.startsWith('/dashboard')) fLogin.add(ip);
  }

  // ── Events ──
  const ev = { orderCreated: 0, purchaseSuccess: 0, captureError: 0, pending: 0 };
  for (const e of events) {
    if (e.event_type === 'order_created') ev.orderCreated++;
    else if (e.event_type === 'purchase_success') ev.purchaseSuccess++;
    else if (e.event_type === 'capture_error' || e.event_type === 'order_create_error') ev.captureError++;
    else if (e.event_type === 'provision_pending') ev.pending++;
  }

  const topN = (m: Map<string, number>, n: number) =>
    [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);

  return {
    traffic: {
      visits24h,
      visits7d,
      visits30d: logs.length,
      visitsTotal: totalRes.count ?? logs.length,
      unique7d: uniq7.size,
      unique30d: uniq30.size,
    },
    visitsByDay: [...byDay.entries()].map(([date, count]) => ({ date, count })),
    topPages: topN(pages, 6).map(([label, count]) => ({ label, count })),
    devices,
    topReferers: topN(refs, 5).map(([referer, count]) => ({ referer, count })),
    funnel: {
      visitors: fVisitors.size,
      viewedPricing: fPricing.size,
      reachedCart: fCart.size,
      loggedIn: fLogin.size,
      purchases: payments.length,
    },
    events30d: ev,
    recentEvents: events.slice(0, 15).map((e) => ({ type: e.event_type, message: e.message ?? '', at: e.created_at })),
  };
}
