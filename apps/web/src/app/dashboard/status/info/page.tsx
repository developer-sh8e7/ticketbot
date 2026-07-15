import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Monitor, Smartphone, Tablet, HelpCircle, Globe, Users } from 'lucide-react';
import { getSession } from '@/lib/sessions';
import { sessionIsOwner } from '@/lib/owner';
import { getVisitorInfo } from '@/lib/analytics-data';

export const dynamic = 'force-dynamic';

function labelFor(path: string) {
  if (path === '/') return 'الرئيسية';
  if (path.startsWith('/bots')) return 'البوتات والأسعار';
  if (path.startsWith('/pricing')) return 'الأسعار';
  if (path.startsWith('/product')) return 'منتج';
  if (path.startsWith('/cart')) return 'السلة';
  if (path.startsWith('/dashboard')) return 'اللوحة';
  if (path.startsWith('/login')) return 'الدخول';
  return path;
}

function DeviceIcon({ device }: { device: string }) {
  if (device === 'mobile') return <Smartphone size={15} className="text-opus-accent-2" />;
  if (device === 'tablet') return <Tablet size={15} className="text-opus-accent-2" />;
  if (device === 'desktop') return <Monitor size={15} className="text-opus-accent-2" />;
  return <HelpCircle size={15} className="text-opus-muted" />;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'الآن';
  if (m < 60) return `قبل ${m} د`;
  const h = Math.floor(m / 60);
  if (h < 24) return `قبل ${h} س`;
  return `قبل ${Math.floor(h / 24)} يوم`;
}

function Tab({ href, active, children }: { href: string; active?: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`rounded-xl px-4 py-2 font-arabic text-sm font-bold transition ${active ? 'bg-opus-accent text-black' : 'border border-opus-border text-opus-text hover:border-opus-accent'}`}
    >
      {children}
    </Link>
  );
}

export default async function StatusInfoPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!sessionIsOwner(session)) redirect('/dashboard');

  const info = await getVisitorInfo();

  return (
    <main dir="rtl" className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-arabic text-2xl font-extrabold text-opus-text">Info — تفاصيل الزوّار</h1>
          <p className="mt-1 font-arabic text-sm text-opus-muted">من دخل، من وين، وبأي جهاز. والحسابات المرتبطة.</p>
        </div>
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 rounded-xl border border-opus-border px-4 py-2 font-arabic text-sm font-bold text-opus-text transition hover:border-opus-accent">
          <ArrowRight size={15} /> رجوع للوحة
        </Link>
      </div>

      <div className="mt-5 flex gap-2">
        <Tab href="/dashboard/status">نظرة عامة</Tab>
        <Tab href="/dashboard/status/info" active>Info</Tab>
      </div>

      {/* Identified accounts */}
      <section className="mt-6">
        <div className="flex items-center gap-2">
          <Users size={16} className="text-opus-muted" />
          <h2 className="font-arabic text-base font-extrabold text-opus-text">الحسابات المرتبطة ({info.identifiedCount})</h2>
        </div>
        <div className="opus-card mt-3 overflow-hidden p-0">
          <table className="w-full text-right">
            <thead className="bg-opus-bg">
              <tr className="font-arabic text-[11px] uppercase tracking-wide text-opus-muted">
                <th className="px-4 py-3 font-bold">المستخدم</th>
                <th className="px-4 py-3 font-bold">Discord ID</th>
                <th className="px-4 py-3 font-bold">البريد</th>
                <th className="px-4 py-3 font-bold">آخر دخول</th>
              </tr>
            </thead>
            <tbody>
              {info.recentUsers.length ? info.recentUsers.map((u) => (
                <tr key={u.discordId} className="border-t border-opus-border font-arabic text-sm text-opus-text transition-colors hover:bg-white/[0.02]">
                  <td className="px-4 py-3">{u.username || '—'}</td>
                  <td className="px-4 py-3 font-english text-xs text-opus-muted">{u.discordId}</td>
                  <td className="px-4 py-3 font-english text-xs text-opus-muted">{u.email || '—'}</td>
                  <td className="px-4 py-3 text-xs text-opus-muted">{u.lastLogin ? timeAgo(u.lastLogin) : '—'}</td>
                </tr>
              )) : (
                <tr><td colSpan={4} className="px-4 py-6 text-center font-arabic text-sm text-opus-muted">لا حسابات بعد.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Recent visitors */}
      <section className="mt-8">
        <div className="flex items-center gap-2">
          <Globe size={16} className="text-opus-muted" />
          <h2 className="font-arabic text-base font-extrabold text-opus-text">آخر الزيارات</h2>
        </div>
        <div className="opus-card mt-3 overflow-hidden p-0">
          <table className="w-full text-right">
            <thead className="bg-opus-bg">
              <tr className="font-arabic text-[11px] uppercase tracking-wide text-opus-muted">
                <th className="px-4 py-3 font-bold">الصفحة</th>
                <th className="px-4 py-3 font-bold">الجهاز</th>
                <th className="px-4 py-3 font-bold">النظام / المتصفح</th>
                <th className="px-4 py-3 font-bold">المصدر</th>
                <th className="px-4 py-3 font-bold">IP</th>
                <th className="px-4 py-3 font-bold">الوقت</th>
              </tr>
            </thead>
            <tbody>
              {info.recentVisitors.length ? info.recentVisitors.map((v, i) => (
                <tr key={i} className="border-t border-opus-border font-arabic text-sm text-opus-text transition-colors hover:bg-white/[0.02]">
                  <td className="px-4 py-3">{labelFor(v.path)}</td>
                  <td className="px-4 py-3"><span className="inline-flex items-center gap-1.5"><DeviceIcon device={v.device} /> <span className="text-xs">{v.device}</span></span></td>
                  <td className="px-4 py-3 text-xs text-opus-muted">{v.os} · {v.browser}</td>
                  <td className="px-4 py-3 text-xs">{v.source}</td>
                  <td className="px-4 py-3 font-english text-xs text-opus-muted">{v.ip}</td>
                  <td className="px-4 py-3 text-xs text-opus-muted">{timeAgo(v.at)}</td>
                </tr>
              )) : (
                <tr><td colSpan={6} className="px-4 py-6 text-center font-arabic text-sm text-opus-muted">لا زيارات بعد.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-3 font-arabic text-[11px] leading-6 text-opus-muted">
          ملاحظة: الـ IP مُجهّل جزئياً (آخر خانات مخفية) حفاظاً على الخصوصية والامتثال القانوني. تسجيل IP كامل ممكن لكنه يحمل التزامات قانونية — أخبرني لو تريده.
        </p>
      </section>
    </main>
  );
}
