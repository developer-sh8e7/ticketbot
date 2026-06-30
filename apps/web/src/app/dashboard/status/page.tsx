import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Users, Eye, ShoppingBag, DollarSign, TrendingDown, Activity } from 'lucide-react';
import { getSession } from '@/lib/sessions';
import { sessionIsOwner } from '@/lib/owner';
import { getSiteStatus, type SiteStatus } from '@/lib/analytics-data';
import { getAdminStats } from '@/lib/admin-data';

export const dynamic = 'force-dynamic';

const EVENT_LABEL: Record<string, string> = {
  order_created: 'محاولة شراء',
  purchase_success: 'عملية شراء ناجحة',
  capture_error: 'خطأ في الدفع',
  order_create_error: 'فشل إنشاء طلب',
  provision_pending: 'تفعيل مؤجل (نفد التوكن)',
  owner_grant_trial: 'منح تجربة',
  owner_add_token: 'إضافة توكن',
  owner_bot_action: 'إجراء على بوت',
  bot_profile_update: 'تعديل بروفايل بوت',
  unauthorized_owner_access: '⚠ محاولة وصول غير مصرّح',
  config_update: 'تحديث إعدادات',
};

function fmtNum(n: number) {
  return n.toLocaleString('en-US');
}
function pct(part: number, whole: number) {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
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

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-2xl border border-opus-border bg-opus-surface p-5">
      <div className="flex items-center gap-2 text-opus-muted">
        {icon}
        <span className="font-arabic text-xs font-bold">{label}</span>
      </div>
      <p className="mt-3 font-english text-3xl font-extrabold text-opus-text">{value}</p>
      {sub ? <p className="mt-1 font-arabic text-[11px] text-opus-muted">{sub}</p> : null}
    </div>
  );
}

function VisitsChart({ data }: { data: SiteStatus['visitsByDay'] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="rounded-2xl border border-opus-border bg-opus-surface p-5">
      <h3 className="font-arabic text-sm font-extrabold text-opus-text">الزيارات — آخر 14 يوم</h3>
      <div className="mt-5 flex h-40 items-end gap-1.5">
        {data.map((d) => (
          <div key={d.date} className="group flex flex-1 flex-col items-center justify-end gap-1.5">
            <span className="font-english text-[10px] text-opus-muted opacity-0 transition group-hover:opacity-100">{d.count}</span>
            <div
              className="w-full rounded-t bg-opus-accent transition-all"
              style={{ height: `${Math.max(2, (d.count / max) * 100)}%`, opacity: d.count === 0 ? 0.15 : 0.85 }}
            />
            <span className="font-english text-[9px] text-opus-muted">{d.date.slice(5)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FunnelRow({ label, value, base }: { label: string; value: number; base: number }) {
  const width = base > 0 ? Math.max(3, (value / base) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between font-arabic text-xs">
        <span className="font-bold text-opus-text">{label}</span>
        <span className="text-opus-muted">{fmtNum(value)} ({pct(value, base)}%)</span>
      </div>
      <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-opus-bg">
        <div className="h-full rounded-full bg-opus-accent" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function Bar({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 shrink-0 truncate font-arabic text-xs text-opus-text">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-opus-bg">
        <div className="h-full rounded-full bg-opus-accent-2" style={{ width: `${max > 0 ? Math.max(3, (value / max) * 100) : 0}%` }} />
      </div>
      <span className="w-10 shrink-0 text-left font-english text-xs text-opus-muted">{fmtNum(value)}</span>
    </div>
  );
}

export default async function StatusPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!sessionIsOwner(session)) redirect('/dashboard');

  const [status, stats] = await Promise.all([getSiteStatus(), getAdminStats()]);
  const f = status.funnel;
  const maxPage = Math.max(1, ...status.topPages.map((p) => p.count));
  const maxRef = Math.max(1, ...status.topReferers.map((r) => r.count));
  const checkoutConv = pct(status.events30d.purchaseSuccess, status.events30d.orderCreated);
  const overallConv = pct(f.purchases, f.visitors);

  return (
    <main dir="rtl" className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-arabic text-2xl font-extrabold text-opus-text">حالة الموقع — Status</h1>
          <p className="mt-1 font-arabic text-sm text-opus-muted">كل الأرقام من بيانات حقيقية مسجّلة. النطاق: آخر 30 يوم.</p>
        </div>
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 rounded-xl border border-opus-border px-4 py-2 font-arabic text-sm font-bold text-opus-text transition hover:border-opus-accent">
          <ArrowRight size={15} /> رجوع للوحة
        </Link>
      </div>

      {/* Top KPIs */}
      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<Eye size={15} />} label="زيارات اليوم" value={fmtNum(status.traffic.visits24h)} sub={`${fmtNum(status.traffic.visits7d)} آخر 7 أيام`} />
        <StatCard icon={<Users size={15} />} label="زوّار مميزون (7 أيام)" value={fmtNum(status.traffic.unique7d)} sub={`${fmtNum(status.traffic.unique30d)} خلال 30 يوم`} />
        <StatCard icon={<ShoppingBag size={15} />} label="مبيعات (30 يوم)" value={fmtNum(f.purchases)} sub={`تحويل ${overallConv}% من الزوّار`} />
        <StatCard icon={<DollarSign size={15} />} label="إجمالي الإيراد" value={`$${fmtNum(stats.revenueUsd)}`} sub={`${fmtNum(stats.capturedPayments)} عملية مدفوعة`} />
      </section>

      {/* Visits chart */}
      <section className="mt-4">
        <VisitsChart data={status.visitsByDay} />
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* Funnel */}
        <div className="rounded-2xl border border-opus-border bg-opus-surface p-5">
          <div className="flex items-center gap-2">
            <TrendingDown size={16} className="text-opus-muted" />
            <h3 className="font-arabic text-sm font-extrabold text-opus-text">مسار التحويل (آخر 30 يوم)</h3>
          </div>
          <div className="mt-5 grid gap-4">
            <FunnelRow label="زاروا الموقع" value={f.visitors} base={f.visitors} />
            <FunnelRow label="شاهدوا الأسعار / منتج" value={f.viewedPricing} base={f.visitors} />
            <FunnelRow label="وصلوا السلة" value={f.reachedCart} base={f.visitors} />
            <FunnelRow label="اشتروا فعلاً" value={f.purchases} base={f.visitors} />
          </div>
          <div className="mt-5 grid gap-2 border-t border-opus-border pt-4 font-arabic text-xs text-opus-muted">
            <div className="flex justify-between"><span>خرجوا بدون مشاهدة الأسعار</span><span className="font-bold text-opus-text">{fmtNum(Math.max(0, f.visitors - f.viewedPricing))}</span></div>
            <div className="flex justify-between"><span>شاهدوا الأسعار وما أكملوا للسلة</span><span className="font-bold text-opus-text">{fmtNum(Math.max(0, f.viewedPricing - f.reachedCart))}</span></div>
            <div className="flex justify-between"><span>وصلوا السلة وما اشتروا</span><span className="font-bold text-opus-text">{fmtNum(Math.max(0, f.reachedCart - f.purchases))}</span></div>
          </div>
        </div>

        {/* Checkout health + pages + devices */}
        <div className="grid gap-4">
          <div className="rounded-2xl border border-opus-border bg-opus-surface p-5">
            <h3 className="font-arabic text-sm font-extrabold text-opus-text">صحة الدفع (آخر 30 يوم)</h3>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div><p className="font-english text-2xl font-extrabold text-opus-text">{checkoutConv}%</p><p className="font-arabic text-[11px] text-opus-muted">إتمام الدفع</p></div>
              <div><p className="font-english text-2xl font-extrabold text-opus-text">{fmtNum(status.events30d.orderCreated)}</p><p className="font-arabic text-[11px] text-opus-muted">محاولات شراء</p></div>
              <div><p className="font-english text-2xl font-extrabold text-opus-text">{fmtNum(status.events30d.captureError)}</p><p className="font-arabic text-[11px] text-opus-muted">أخطاء دفع</p></div>
              <div><p className="font-english text-2xl font-extrabold text-opus-text">{fmtNum(status.events30d.pending)}</p><p className="font-arabic text-[11px] text-opus-muted">تفعيل مؤجل (نفد توكن)</p></div>
            </div>
          </div>

          <div className="rounded-2xl border border-opus-border bg-opus-surface p-5">
            <h3 className="font-arabic text-sm font-extrabold text-opus-text">الأجهزة</h3>
            <div className="mt-4 grid gap-2.5">
              <Bar label="كمبيوتر" value={status.devices.desktop} max={Math.max(1, status.devices.desktop, status.devices.mobile, status.devices.tablet)} />
              <Bar label="جوال" value={status.devices.mobile} max={Math.max(1, status.devices.desktop, status.devices.mobile, status.devices.tablet)} />
              <Bar label="تابلت" value={status.devices.tablet} max={Math.max(1, status.devices.desktop, status.devices.mobile, status.devices.tablet)} />
            </div>
          </div>
        </div>
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* Top pages */}
        <div className="rounded-2xl border border-opus-border bg-opus-surface p-5">
          <h3 className="font-arabic text-sm font-extrabold text-opus-text">أكثر الصفحات زيارة</h3>
          <div className="mt-4 grid gap-2.5">
            {status.topPages.length ? status.topPages.map((p) => <Bar key={p.label} label={p.label} value={p.count} max={maxPage} />) : <p className="font-arabic text-xs text-opus-muted">لا بيانات بعد.</p>}
          </div>
          {status.topReferers.length ? (
            <>
              <h3 className="mt-6 font-arabic text-sm font-extrabold text-opus-text">مصادر الزيارة</h3>
              <div className="mt-4 grid gap-2.5">
                {status.topReferers.map((r) => <Bar key={r.referer} label={r.referer} value={r.count} max={maxRef} />)}
              </div>
            </>
          ) : null}
        </div>

        {/* Recent activity */}
        <div className="rounded-2xl border border-opus-border bg-opus-surface p-5">
          <div className="flex items-center gap-2">
            <Activity size={16} className="text-opus-muted" />
            <h3 className="font-arabic text-sm font-extrabold text-opus-text">النشاط الأخير</h3>
          </div>
          <div className="mt-4 grid gap-2">
            {status.recentEvents.length ? status.recentEvents.map((e, i) => (
              <div key={i} className="flex items-center justify-between gap-3 border-b border-opus-border/60 pb-2 last:border-0">
                <span className="font-arabic text-xs text-opus-text">{EVENT_LABEL[e.type] ?? e.type}</span>
                <span className="shrink-0 font-arabic text-[11px] text-opus-muted">{timeAgo(e.at)}</span>
              </div>
            )) : <p className="font-arabic text-xs text-opus-muted">لا نشاط بعد.</p>}
          </div>
        </div>
      </section>
    </main>
  );
}
