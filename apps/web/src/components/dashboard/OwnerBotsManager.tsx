'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Loader2, Pause, Play, Plus, Settings } from 'lucide-react';
import type { AdminSubscriber } from '@/lib/admin-data';

type Filter = 'all' | 'active' | 'expiring' | 'expired' | 'paused';

function csrf() {
  const m = document.cookie.match(/(?:^|;\s*)opus_csrf=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : '';
}

const PRODUCT: Record<string, string> = { ticket: 'التذاكر', voice_rooms: 'الرومات المؤقتة', general: 'السيستم' };
const STATUS: Record<string, { label: string; dot: string }> = {
  active: { label: 'نشط', dot: 'bg-emerald-400' },
  paused: { label: 'موقوف', dot: 'bg-amber-400' },
  expired: { label: 'منتهي', dot: 'bg-red-400' },
  cancelled: { label: 'ملغى', dot: 'bg-red-400' },
  rejected: { label: 'مرفوض', dot: 'bg-red-400' },
};

function daysLeft(expires: string | null): number | null {
  if (!expires) return null;
  return Math.ceil((new Date(expires).getTime() - Date.now()) / 86_400_000);
}
function fmt(d: string | null) {
  // Deterministic UTC format — avoids server/client timezone & ICU hydration mismatch.
  if (!d) return '—';
  const x = new Date(d);
  return `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, '0')}-${String(x.getUTCDate()).padStart(2, '0')}`;
}

export function OwnerBotsManager({ bots }: { bots: AdminSubscriber[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [days, setDays] = useState<Record<string, string>>({});
  const [err, setErr] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return bots.filter((b) => {
      const left = daysLeft(b.expires_at);
      if (filter === 'active' && b.status !== 'active') return false;
      if (filter === 'paused' && b.status !== 'paused') return false;
      if (filter === 'expired' && b.status !== 'expired' && b.status !== 'cancelled') return false;
      if (filter === 'expiring' && !(b.status === 'active' && left !== null && left <= 7)) return false;
      if (q) {
        const hay = `${b.bot_name ?? ''} ${b.guild_name ?? ''} ${b.guild_id ?? ''} ${b.owner_id ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [bots, filter, query]);

  async function act(botId: string, action: 'extend' | 'suspend' | 'activate') {
    setBusy(botId + action);
    setErr('');
    try {
      const body: Record<string, unknown> = { botId, action };
      if (action === 'extend') body.days = Number(days[botId] || '30');
      const res = await fetch('/api/owner/bots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf() },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.success) setErr(json.error?.message || 'تعذّر تنفيذ الإجراء.');
      else router.refresh();
    } catch {
      setErr('تعذّر الاتصال.');
    } finally {
      setBusy(null);
    }
  }

  const tabs: { id: Filter; label: string }[] = [
    { id: 'all', label: 'الكل' },
    { id: 'active', label: 'نشط' },
    { id: 'expiring', label: 'قرب الانتهاء' },
    { id: 'expired', label: 'منتهي' },
    { id: 'paused', label: 'موقوف' },
  ];

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setFilter(t.id)}
              className={`rounded-xl px-3.5 py-2 font-arabic text-xs font-bold transition ${filter === t.id ? 'bg-opus-accent text-black' : 'border border-opus-border text-opus-text hover:border-opus-accent-2/50'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="بحث: اسم، سيرفر، آيدي مالك..."
          className="w-full max-w-xs rounded-xl border border-opus-border bg-opus-surface px-3 py-2 font-arabic text-sm text-opus-text outline-none transition focus:border-opus-accent-2 sm:w-64"
        />
      </div>

      {err ? <p className="rounded-xl border border-[#f59e0b] px-4 py-2 font-arabic text-sm text-[#f59e0b]">{err}</p> : null}

      <div className="grid gap-4 md:grid-cols-2">
        {filtered.map((b) => {
          const left = daysLeft(b.expires_at);
          const meta = STATUS[String(b.status)] ?? { label: b.status ?? '—', dot: 'bg-gray-400' };
          const name = b.bot_name || PRODUCT[String(b.product_type)] || 'بوت';
          return (
            <div key={b.id} className="opus-card overflow-hidden p-0 transition hover:border-opus-accent-2/40">
              <div className="h-16 w-full bg-opus-bg" style={b.bot_banner_url ? { backgroundImage: `url(${b.bot_banner_url})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined} />
              <div className="px-5 pb-5">
                <div className="-mt-7 flex items-end justify-between">
                  <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border-4 border-opus-surface bg-opus-bg">
                    {b.bot_avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={b.bot_avatar_url} alt={name} className="h-full w-full object-cover" />
                    ) : (
                      <span className="font-arabic text-lg font-extrabold text-opus-muted">{name.slice(0, 1)}</span>
                    )}
                  </div>
                  <span className="mb-1 inline-flex items-center gap-1.5 rounded-full border border-opus-border bg-opus-surface px-2.5 py-1 font-arabic text-[11px] font-bold text-opus-text">
                    <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} /> {meta.label}
                  </span>
                </div>

                <p className="mt-2 font-arabic text-base font-extrabold text-opus-text">{name}</p>
                <p className="font-english text-[11px] text-opus-muted">{PRODUCT[String(b.product_type)] ?? b.product_type} · {b.guild_name || b.guild_id}</p>

                <div className="mt-3 grid grid-cols-2 gap-2 font-arabic text-[11px] text-opus-muted">
                  <span>المالك: <span className="font-english text-opus-text">{b.owner_id}</span></span>
                  <span>ينتهي: <span className="text-opus-text">{fmt(b.expires_at)}</span></span>
                  <span>المتبقي: <span className="text-opus-text">{left === null ? 'غير محدود' : left > 0 ? `${left} يوم` : 'منتهي'}</span></span>
                  <span>الباقة: <span className="text-opus-text">{b.plan_type === 'trial' ? 'تجريبية' : 'مدفوعة'}</span></span>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    value={days[b.id] ?? '30'}
                    onChange={(e) => setDays((p) => ({ ...p, [b.id]: e.target.value }))}
                    className="w-16 rounded-lg border border-opus-border bg-opus-bg px-2 py-1.5 text-center font-english text-sm text-opus-text outline-none focus:border-opus-accent"
                  />
                  <button
                    type="button"
                    onClick={() => act(b.id, 'extend')}
                    disabled={busy === b.id + 'extend'}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-opus-accent px-3 py-1.5 font-arabic text-xs font-extrabold text-black transition hover:opacity-90 disabled:opacity-60"
                  >
                    {busy === b.id + 'extend' ? <Loader2 className="animate-spin" size={13} /> : <Plus size={13} />} تمديد
                  </button>
                  {b.status === 'active' ? (
                    <button type="button" onClick={() => act(b.id, 'suspend')} disabled={busy === b.id + 'suspend'} className="inline-flex items-center gap-1.5 rounded-lg border border-opus-border px-3 py-1.5 font-arabic text-xs font-bold text-opus-text transition hover:border-amber-500/60">
                      {busy === b.id + 'suspend' ? <Loader2 className="animate-spin" size={13} /> : <Pause size={13} />} إيقاف
                    </button>
                  ) : (
                    <button type="button" onClick={() => act(b.id, 'activate')} disabled={busy === b.id + 'activate'} className="inline-flex items-center gap-1.5 rounded-lg border border-opus-border px-3 py-1.5 font-arabic text-xs font-bold text-opus-text transition hover:border-emerald-500/60">
                      {busy === b.id + 'activate' ? <Loader2 className="animate-spin" size={13} /> : <Play size={13} />} تفعيل
                    </button>
                  )}
                </div>

                {b.product_type === 'general' ? (
                  <a
                    href={`/dashboard/bot/${b.id}/system`}
                    className="mt-2 inline-flex items-center gap-1.5 font-arabic text-xs font-bold text-opus-muted transition hover:text-opus-accent-2"
                  >
                    <Settings size={13} /> الدخول كمالك — تعديل إعدادات هذا البوت
                  </a>
                ) : null}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 ? <p className="col-span-full py-8 text-center font-arabic text-sm text-opus-muted">لا بوتات بهذا الفلتر.</p> : null}
      </div>
    </div>
  );
}
