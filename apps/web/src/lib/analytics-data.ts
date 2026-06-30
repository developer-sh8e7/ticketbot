/**
 * Owner-only site analytics ("Status" dashboard).
 * All metrics are aggregated accurately IN POSTGRES via the get_site_status()
 * RPC (no row caps, real COUNT/COUNT DISTINCT). Built only from recorded data:
 * website_logs (page views), website_events (funnel/checkout), payments.
 * Service-role call: only invoke after a server-side owner check.
 */
import { supabaseAdmin } from './supabase';

export type SiteStatus = {
  traffic: { visits24h: number; visits7d: number; visits30d: number; visitsTotal: number; unique7d: number; unique30d: number };
  visitsByDay: { date: string; count: number }[];
  topPages: { label: string; count: number }[];
  devices: { desktop: number; mobile: number; tablet: number };
  topReferers: { referer: string; count: number }[];
  funnel: { visitors: number; viewedPricing: number; reachedCart: number; loggedIn: number; purchases: number };
  events30d: { orderCreated: number; purchaseSuccess: number; captureError: number; pending: number };
  recentEvents: { type: string; at: string }[];
};

const EMPTY: SiteStatus = {
  traffic: { visits24h: 0, visits7d: 0, visits30d: 0, visitsTotal: 0, unique7d: 0, unique30d: 0 },
  visitsByDay: [],
  topPages: [],
  devices: { desktop: 0, mobile: 0, tablet: 0 },
  topReferers: [],
  funnel: { visitors: 0, viewedPricing: 0, reachedCart: 0, loggedIn: 0, purchases: 0 },
  events30d: { orderCreated: 0, purchaseSuccess: 0, captureError: 0, pending: 0 },
  recentEvents: [],
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

function refererHost(referer: string): string {
  try {
    return new URL(referer).hostname.replace(/^www\./, '');
  } catch {
    return referer;
  }
}

const num = (v: unknown) => (typeof v === 'number' ? v : Number(v) || 0);

export async function getSiteStatus(): Promise<SiteStatus> {
  const { data, error } = await supabaseAdmin().rpc('get_site_status');
  if (error || !data || typeof data !== 'object') {
    if (error) console.warn('[analytics] get_site_status RPC failed (run the schema):', error.message);
    return EMPTY;
  }

  const d = data as Record<string, any>;
  const t = d.traffic ?? {};
  const f = d.funnel ?? {};
  const e = d.events30d ?? {};
  const dev = d.devices ?? {};

  return {
    traffic: {
      visits24h: num(t.visits24h),
      visits7d: num(t.visits7d),
      visits30d: num(t.visits30d),
      visitsTotal: num(t.visitsTotal),
      unique7d: num(t.unique7d),
      unique30d: num(t.unique30d),
    },
    visitsByDay: Array.isArray(d.visitsByDay) ? d.visitsByDay.map((x: any) => ({ date: String(x.date), count: num(x.count) })) : [],
    topPages: Array.isArray(d.topPages) ? d.topPages.map((x: any) => ({ label: pageLabel(String(x.path)), count: num(x.count) })) : [],
    devices: { desktop: num(dev.desktop), mobile: num(dev.mobile), tablet: num(dev.tablet) },
    topReferers: Array.isArray(d.topReferers) ? d.topReferers.map((x: any) => ({ referer: refererHost(String(x.referer)), count: num(x.count) })) : [],
    funnel: {
      visitors: num(f.visitors),
      viewedPricing: num(f.viewedPricing),
      reachedCart: num(f.reachedCart),
      loggedIn: num(f.loggedIn),
      purchases: num(f.purchases),
    },
    events30d: {
      orderCreated: num(e.orderCreated),
      purchaseSuccess: num(e.purchaseSuccess),
      captureError: num(e.captureError),
      pending: num(e.pending),
    },
    recentEvents: Array.isArray(d.recentEvents) ? d.recentEvents.map((x: any) => ({ type: String(x.type), at: String(x.at) })) : [],
  };
}
