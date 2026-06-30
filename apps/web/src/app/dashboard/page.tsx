import { redirect } from 'next/navigation';
import { BarChart3, Bot, Settings } from 'lucide-react';
import { DashboardShell } from '@/components/DashboardShell';
import { OwnerPanel } from '@/components/dashboard/OwnerPanel';
import { BotProfileEditor } from '@/components/dashboard/BotProfileEditor';
import { getSession } from '@/lib/sessions';
import { getOwnedBots } from '@/lib/dashboard-data';
import { sessionIsOwner } from '@/lib/owner';
import { getAdminStats, getSubscribers, getTokenPool } from '@/lib/admin-data';
import { botInviteUrl } from '@/lib/bot-invite';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

type OwnedBot = Awaited<ReturnType<typeof getOwnedBots>>[number];

const productLabels: Record<string, string> = {
  ticket: 'بوت التذاكر',
  voice_rooms: 'الغرف المؤقتة',
  general: 'بوت الإدارة',
};

const statusMeta: Record<string, { label: string; dot: string; text: string }> = {
  active: { label: 'نشط', dot: 'bg-emerald-400', text: 'text-emerald-300' },
  paused: { label: 'موقوف مؤقتاً', dot: 'bg-amber-400', text: 'text-amber-300' },
  expired: { label: 'منتهي', dot: 'bg-red-400', text: 'text-red-300' },
  cancelled: { label: 'ملغى', dot: 'bg-red-400', text: 'text-red-300' },
  rejected: { label: 'مرفوض', dot: 'bg-red-400', text: 'text-red-300' },
};

function fmtDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' }) : '—';
}

function daysLeft(expires: string | null | undefined): number | null {
  if (!expires) return null;
  const diff = new Date(expires).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function BotCard({ bot }: { bot: OwnedBot }) {
  const meta = statusMeta[String(bot.status ?? '')] ?? { label: bot.status ?? '—', dot: 'bg-gray-400', text: 'text-opus-muted' };
  const remaining = daysLeft(bot.expires_at);
  const isPaid = bot.plan_type !== 'trial';
  const appId = (bot as { bot_application_id?: string | null }).bot_application_id;
  const avatarUrl = (bot as { bot_avatar_url?: string | null }).bot_avatar_url;
  const bannerUrl = (bot as { bot_banner_url?: string | null }).bot_banner_url;
  const productLabel = productLabels[String(bot.product_type)] ?? bot.product_type ?? 'بوت';
  const botName = bot.bot_name || productLabel;
  const canEditProfile = bot.status === 'active' || bot.status === 'paused';
  const inviteUrl = appId && canEditProfile ? botInviteUrl(appId, bot.guild_id) : null;

  return (
    <div className="opus-card overflow-hidden p-0 transition hover:border-opus-accent-2/40">
      {/* Banner + avatar header — shows the bot's identity in every status */}
      <div
        className="h-20 w-full bg-opus-bg"
        style={bannerUrl ? { backgroundImage: `url(${bannerUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
      />
      <div className="px-5 pb-5">
        <div className="-mt-8 flex items-end justify-between gap-3">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-4 border-opus-surface bg-opus-bg">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt={botName} className="h-full w-full object-cover" />
            ) : (
              <span className="font-arabic text-xl font-extrabold text-opus-muted">{botName.slice(0, 1)}</span>
            )}
          </div>
          <span className={`mb-1 inline-flex items-center gap-2 rounded-full border border-opus-border bg-opus-surface px-3 py-1 font-arabic text-xs font-bold ${meta.text}`}>
            <span className={`inline-block h-2 w-2 rounded-full ${meta.dot}`} />
            {meta.label}
          </span>
        </div>

        <div className="mt-3">
          <p className="font-arabic text-lg font-extrabold text-opus-text">{botName}</p>
          <p className="mt-0.5 font-english text-xs text-opus-muted">{productLabel} · {bot.guild_name || bot.guild_id}</p>
        </div>

      <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div>
          <dt className="font-arabic text-xs text-opus-muted">الباقة</dt>
          <dd className="mt-1 font-arabic text-sm font-bold text-opus-text">{isPaid ? 'مدفوعة' : 'تجريبية'}</dd>
        </div>
        <div>
          <dt className="font-arabic text-xs text-opus-muted">ينتهي في</dt>
          <dd className="mt-1 font-arabic text-sm font-bold text-opus-text">{fmtDate(bot.expires_at)}</dd>
        </div>
        <div>
          <dt className="font-arabic text-xs text-opus-muted">المتبقي</dt>
          <dd className="mt-1 font-arabic text-sm font-bold text-opus-text">
            {remaining === null ? 'غير محدود' : remaining > 0 ? `${remaining} يوم` : 'منتهي'}
          </dd>
        </div>
        <div className="col-span-2 sm:col-span-3">
          <dt className="font-arabic text-xs text-opus-muted">السيرفر</dt>
          <dd className="mt-1 font-english text-sm text-opus-text">{bot.guild_id || '—'}</dd>
        </div>
      </dl>

      {inviteUrl ? (
        <div className="mt-5 rounded-xl border border-opus-border bg-opus-bg/40 p-4">
          <p className="font-arabic text-xs font-bold text-opus-text">أضف البوت لسيرفرك</p>
          <p className="mt-1 font-arabic text-[11px] leading-5 text-opus-muted">
            انسخ الرابط وافتحه، وافق على الإضافة — البوت يدخل سيرفرك ويشتغل تلقائياً.
          </p>
          <a
            href={inviteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex w-full items-center justify-center rounded-lg bg-opus-accent px-4 py-2 font-arabic text-sm font-extrabold text-black transition hover:opacity-90"
          >
            إضافة البوت إلى السيرفر
          </a>
        </div>
      ) : null}

      {bot.status !== 'active' ? (
        <a
          href="/pricing"
          className="mt-3 inline-flex rounded-xl bg-opus-accent px-4 py-2 font-arabic text-sm font-extrabold text-black transition hover:opacity-90"
        >
          تجديد الاشتراك
        </a>
      ) : remaining !== null && remaining <= 7 ? (
        <a
          href="/pricing"
          className="mt-3 inline-flex rounded-xl border border-amber-500/50 px-4 py-2 font-arabic text-sm font-bold text-amber-300 transition hover:bg-amber-500/10"
        >
          ينتهي قريباً — جدّد الآن
        </a>
      ) : null}

      {bot.product_type === 'general' && canEditProfile ? (
        <a
          href={`/dashboard/bot/${bot.id}/system`}
          className="mt-3 inline-flex items-center justify-center gap-2 rounded-xl border border-opus-border px-4 py-2 font-arabic text-sm font-bold text-opus-text transition hover:border-opus-accent"
        >
          <Settings size={15} /> لوحة السيستم (الترحيب والمزيد)
        </a>
      ) : null}

      {canEditProfile ? <BotProfileEditor botId={bot.id} /> : null}
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const owner = sessionIsOwner(session);

  const [bots, payments] = await Promise.all([
    getOwnedBots(session.discordUserId).catch(() => [] as OwnedBot[]),
    (async () => {
      const { data: account } = await supabaseAdmin().from('accounts').select('id').eq('discord_user_id', session.discordUserId).maybeSingle();
      if (!account?.id) return [] as { amount_cents: number; currency: string; status: string; created_at: string }[];
      const { data } = await supabaseAdmin()
        .from('payments')
        .select('amount_cents,currency,status,created_at')
        .eq('account_id', account.id)
        .order('created_at', { ascending: false })
        .limit(10);
      return data || [];
    })().catch(() => []),
  ]);

  // Owner-only data — fetched server-side, never sent to non-owners.
  const ownerData = owner
    ? await Promise.all([getAdminStats(), getSubscribers(100), getTokenPool()])
        .then(([stats, subscribers, tokenPool]) => ({ stats, subscribers, tokenPool }))
        .catch(() => null)
    : null;

  return (
    <DashboardShell
      title={`أهلاً، ${session.username || 'بك'}`}
      subtitle="تابع حالة بوتاتك واشتراكاتك من مكان واحد."
      badge={owner ? 'مالك المتجر' : 'حساب عميل'}
    >
      {owner ? (
        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          <a
            href="/dashboard/status"
            className="opus-card flex items-center justify-between gap-3 p-5 transition hover:border-opus-accent-2/40"
          >
            <div>
              <p className="flex items-center gap-2 font-arabic text-base font-extrabold text-opus-text">
                <BarChart3 size={18} className="text-opus-accent-2" /> حالة الموقع — Status
              </p>
              <p className="mt-1 font-arabic text-xs text-opus-muted">الزيارات، الزوّار، مسار التحويل، صحة الدفع، والنشاط.</p>
            </div>
            <span className="shrink-0 rounded-xl bg-opus-accent px-4 py-2 font-arabic text-sm font-extrabold text-black">افتح</span>
          </a>
          <a
            href="/dashboard/bots"
            className="opus-card flex items-center justify-between gap-3 p-5 transition hover:border-opus-accent-2/40"
          >
            <div>
              <p className="flex items-center gap-2 font-arabic text-base font-extrabold text-opus-text">
                <Bot size={18} className="text-opus-accent-2" /> إدارة كل البوتات — Bots
              </p>
              <p className="mt-1 font-arabic text-xs text-opus-muted">كل بوتات العملاء + تمديد/إيقاف/تفعيل أيّ بوت.</p>
            </div>
            <span className="shrink-0 rounded-xl bg-opus-accent px-4 py-2 font-arabic text-sm font-extrabold text-black">افتح</span>
          </a>
        </div>
      ) : null}

      <section className="grid gap-4">
        <h2 className="font-arabic text-lg font-extrabold text-opus-text">بوتاتي واشتراكاتي</h2>
        {bots.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-opus-border bg-opus-surface p-10 text-center">
            <p className="font-arabic text-base font-bold text-opus-text">لا توجد اشتراكات بعد</p>
            <p className="mt-2 font-arabic text-sm text-opus-muted">اشترِ منتجاً لتفعيل أول بوت على سيرفرك.</p>
            <a
              href="/pricing"
              className="mt-5 inline-flex rounded-xl bg-opus-accent px-6 py-3 font-arabic text-sm font-extrabold text-black transition hover:opacity-90"
            >
              تصفّح المنتجات
            </a>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {bots.map((bot) => (
              <BotCard key={bot.id} bot={bot} />
            ))}
          </div>
        )}
      </section>

      {payments.length > 0 ? (
        <section className="mt-10 grid gap-4">
          <h2 className="font-arabic text-lg font-extrabold text-opus-text">سجل المدفوعات</h2>
          <div className="opus-card overflow-hidden p-0">
            <table className="w-full text-right">
              <thead className="bg-opus-bg">
                <tr className="font-arabic text-[11px] uppercase tracking-wide text-opus-muted">
                  <th className="px-4 py-3 font-bold">التاريخ</th>
                  <th className="px-4 py-3 font-bold">المبلغ</th>
                  <th className="px-4 py-3 font-bold">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p, i) => (
                  <tr key={i} className="border-t border-opus-border font-arabic text-sm text-opus-text transition-colors hover:bg-white/[0.02]">
                    <td className="px-4 py-3">{fmtDate(p.created_at)}</td>
                    <td className="px-4 py-3 font-english">{(Number(p.amount_cents) / 100).toFixed(2)} {p.currency}</td>
                    <td className="px-4 py-3">{p.status === 'captured' ? 'مكتمل' : p.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {owner && ownerData ? <OwnerPanel stats={ownerData.stats} subscribers={ownerData.subscribers} tokenPool={ownerData.tokenPool} /> : null}
    </DashboardShell>
  );
}
