'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Coins,
  CreditCard,
  Crown,
  Gift,
  KeyRound,
  Loader2,
  Pause,
  Play,
  Plus,
  Users,
} from 'lucide-react';
import type { AdminStats, AdminSubscriber, TokenPoolRow } from '@/lib/admin-data';

// Real product names so labels are never ambiguous.
const PRODUCTS: { value: string; name: string }[] = [
  { value: 'ticket', name: 'Ticket Bot — التذاكر' },
  { value: 'voice_rooms', name: 'TempRooms Bot — الرومات المؤقتة' },
  { value: 'general', name: 'SystemBot — الإدارة والمودريشن' },
];
const productName = (v: string) => PRODUCTS.find((p) => p.value === v)?.name ?? v;

const statusMeta: Record<string, { label: string; cls: string }> = {
  active: { label: 'نشط', cls: 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10' },
  paused: { label: 'موقوف', cls: 'text-amber-300 border-amber-500/30 bg-amber-500/10' },
  expired: { label: 'منتهي', cls: 'text-red-300 border-red-500/30 bg-red-500/10' },
  cancelled: { label: 'ملغى', cls: 'text-red-300 border-red-500/30 bg-red-500/10' },
};

function csrfToken(): string {
  const m = document.cookie.match(/(?:^|;\s*)opus_csrf=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : '';
}

async function postJson(url: string, body: Record<string, unknown>) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken() },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({ success: false, error: { message: 'استجابة غير صالحة.' } }));
  if (!json.success) throw new Error(json.error?.message || 'فشل الإجراء.');
  return json.data;
}

/* ── Small building blocks (one consistent vocabulary) ───────────────────── */

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="font-arabic text-xs font-bold text-opus-text">{label}</span>
      {children}
      {hint ? <span className="font-arabic text-[11px] leading-5 text-opus-muted">{hint}</span> : null}
    </label>
  );
}

const inputCls =
  'w-full rounded-lg border border-opus-border bg-opus-bg px-3 py-2.5 text-sm text-opus-text outline-none transition focus:border-opus-accent-2';

function PrimaryBtn({ busy, children }: { busy: boolean; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      disabled={busy}
      className="inline-flex items-center justify-center gap-2 rounded-lg bg-opus-accent px-4 py-2.5 font-arabic text-sm font-extrabold text-black transition hover:opacity-90 disabled:opacity-50"
    >
      {busy ? <Loader2 size={15} className="animate-spin" /> : null}
      {children}
    </button>
  );
}

function SectionHeader({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-opus-border bg-opus-bg text-opus-accent-2">
        {icon}
      </span>
      <div>
        <h3 className="font-arabic text-base font-extrabold text-opus-text">{title}</h3>
        <p className="mt-0.5 font-arabic text-xs leading-5 text-opus-muted">{desc}</p>
      </div>
    </div>
  );
}

/* ── Main panel ──────────────────────────────────────────────────────────── */

export function OwnerPanel({
  stats,
  subscribers,
  tokenPool,
}: {
  stats: AdminStats;
  subscribers: AdminSubscriber[];
  tokenPool: TokenPoolRow[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [extendDays, setExtendDays] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  async function run(key: string, action: () => Promise<unknown>, okText = 'تم تنفيذ الإجراء بنجاح.') {
    setBusy(key);
    setMsg(null);
    try {
      const data = (await action()) as { fulfilledPending?: number; botName?: string } | undefined;
      let text = okText;
      if (data?.botName) text = `تمت إضافة «${data.botName}» للبركة.`;
      if (data?.fulfilledPending) text += ` وفُعّلت ${data.fulfilledPending} طلباً مؤجلاً.`;
      setMsg({ kind: 'ok', text });
      router.refresh();
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'حدث خطأ.' });
    } finally {
      setBusy(null);
    }
  }

  // Available tokens per provisionable product (for the at-a-glance stock row).
  const availByType = new Map<string, number>();
  for (const row of tokenPool) {
    if (row.status === 'available') availByType.set(row.product_type, (availByType.get(row.product_type) ?? 0) + row.count);
  }

  return (
    <section className="mt-14 grid gap-8 border-t border-opus-border pt-10">
      <div className="flex items-center gap-2.5">
        <Crown size={20} className="text-amber-400" />
        <h2 className="font-arabic text-2xl font-extrabold text-opus-text">لوحة الإدارة</h2>
        <span className="rounded-full border border-opus-border px-2.5 py-0.5 font-arabic text-[11px] text-opus-muted">للمالك فقط</span>
      </div>

      {msg ? (
        <div
          className={`flex items-center gap-2 rounded-xl border px-4 py-3 font-arabic text-sm ${
            msg.kind === 'ok' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' : 'border-red-500/30 bg-red-500/10 text-red-200'
          }`}
        >
          {msg.kind === 'ok' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          {msg.text}
        </div>
      ) : null}

      {/* Stats */}
      <div>
        <h3 className="mb-3 font-arabic text-sm font-bold text-opus-muted">نظرة عامة</h3>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat icon={<Users size={16} />} label="الحسابات" value={stats.totalAccounts} />
          <Stat icon={<Bot size={16} />} label="بوتات نشطة" value={stats.activeBots} highlight />
          <Stat icon={<Pause size={16} />} label="منتهية" value={stats.expiredBots} />
          <Stat icon={<Gift size={16} />} label="تجارب" value={stats.trialBots} />
          <Stat icon={<CreditCard size={16} />} label="اشتراكات فعّالة" value={stats.activeSubscriptions} />
          <Stat icon={<Coins size={16} />} label="توكنات متاحة" value={stats.availableTokens} highlight />
          <Stat icon={<CreditCard size={16} />} label="عمليات دفع" value={stats.capturedPayments} />
          <Stat icon={<Coins size={16} />} label="الإيرادات" value={`$${stats.revenueUsd.toFixed(2)}`} highlight />
        </div>
      </div>

      {/* Token stock per product — the answer to "how many bots can I still sell" */}
      <div className="rounded-2xl border border-opus-border bg-opus-surface p-5">
        <SectionHeader icon={<Coins size={18} />} title="مخزون البوتات (التوكنات)" desc="كم بوتاً يمكنك بيعه الآن لكل منتج. لا تدع الرقم يصل صفراً." />
        <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
          {PRODUCTS.map((p) => {
            const n = availByType.get(p.value) ?? 0;
            const low = n === 0;
            const warn = n > 0 && n <= 2;
            return (
              <div
                key={p.value}
                className={`rounded-xl border p-4 ${low ? 'border-red-500/40 bg-red-500/5' : warn ? 'border-amber-500/40 bg-amber-500/5' : 'border-opus-border bg-opus-bg'}`}
              >
                <p className="font-arabic text-xs text-opus-muted">{p.name}</p>
                <p className={`mt-1.5 font-english text-2xl font-extrabold ${low ? 'text-red-300' : warn ? 'text-amber-300' : 'text-opus-text'}`}>
                  {n} <span className="font-arabic text-xs font-normal text-opus-muted">متاح</span>
                </p>
                {low ? <p className="mt-1 font-arabic text-[11px] text-red-300">نفد — أضف توكناً</p> : null}
              </div>
            );
          })}
        </div>
      </div>

      {/* Action cards side by side */}
      <div className="grid items-start gap-5 lg:grid-cols-3">
        <div className="rounded-2xl border border-opus-border bg-opus-surface p-5">
          <SectionHeader
            icon={<KeyRound size={18} />}
            title="إضافة توكن بوت"
            desc="الصق توكن البوت فقط — نتحقق منه ونجلب اسمه ومعرّفه من Discord تلقائياً."
          />
          <AddTokenForm busy={busy === 'add-token'} onSubmit={(b) => run('add-token', () => postJson('/api/owner/tokens', b))} />
        </div>

        <div className="rounded-2xl border border-opus-border bg-opus-surface p-5">
          <SectionHeader icon={<Gift size={18} />} title="منح تجربة مجانية" desc="فعّل بوتاً مجاناً لمدة محددة على سيرفر عميل." />
          <GrantTrialForm busy={busy === 'grant-trial'} onSubmit={(b) => run('grant-trial', () => postJson('/api/owner/trial', b))} />
        </div>

        <div className="rounded-2xl border border-opus-border bg-opus-surface p-5">
          <SectionHeader icon={<CreditCard size={18} />} title="إضافة اشتراك مدفوع" desc="فعّل بوتاً باشتراك مدفوع لمدة محددة على سيرفر عميل." />
          <AddSubscriptionForm busy={busy === 'add-subscription'} onSubmit={(b) => run('add-subscription', () => postJson('/api/owner/subscription', b))} />
        </div>
      </div>

      {/* Subscribers */}
      <div className="rounded-2xl border border-opus-border bg-opus-surface p-5">
        <SectionHeader icon={<Users size={18} />} title={`المشتركون (${subscribers.length})`} desc="كل البوتات المفعّلة. مدّد، أوقف، أو أعد التفعيل." />
        {subscribers.length === 0 ? (
          <p className="mt-5 rounded-xl border border-dashed border-opus-border bg-opus-bg p-6 text-center font-arabic text-sm text-opus-muted">
            لا يوجد مشتركون بعد.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-right">
              <thead>
                <tr className="border-b border-opus-border font-arabic text-[11px] uppercase tracking-wide text-opus-muted">
                  <th className="px-3 py-2.5 font-bold">المنتج</th>
                  <th className="px-3 py-2.5 font-bold">السيرفر</th>
                  <th className="px-3 py-2.5 font-bold">المالك</th>
                  <th className="px-3 py-2.5 font-bold">الحالة</th>
                  <th className="px-3 py-2.5 font-bold">ينتهي</th>
                  <th className="px-3 py-2.5 font-bold">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {subscribers.map((s) => {
                  const st = statusMeta[String(s.status)] ?? { label: s.status ?? '—', cls: 'text-opus-muted border-opus-border' };
                  return (
                    <tr key={s.id} className="border-b border-opus-border/60 font-arabic text-sm text-opus-text">
                      <td className="px-3 py-3">{productName(String(s.product_type))}</td>
                      <td className="px-3 py-3 font-english text-xs text-opus-muted">{s.guild_name || s.guild_id}</td>
                      <td className="px-3 py-3 font-english text-xs text-opus-muted">{s.owner_id}</td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-bold ${st.cls}`}>{st.label}</span>
                      </td>
                      <td className="px-3 py-3 font-english text-xs text-opus-muted">{s.expires_at ? new Date(s.expires_at).toLocaleDateString('en-CA', { timeZone: 'UTC' }) : '∞'}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min={1}
                            placeholder="أيام"
                            value={extendDays[s.id] ?? ''}
                            onChange={(e) => setExtendDays((m) => ({ ...m, [s.id]: e.target.value }))}
                            className="w-14 rounded-lg border border-opus-border bg-opus-bg px-2 py-1 text-center font-english text-xs text-opus-text outline-none focus:border-opus-accent-2"
                            dir="ltr"
                          />
                          <button
                            type="button"
                            disabled={busy === s.id}
                            title="تمديد المدة"
                            onClick={() => run(s.id, () => postJson('/api/owner/bots', { botId: s.id, action: 'extend', days: Number(extendDays[s.id]) }))}
                            className="rounded-lg border border-opus-border px-2.5 py-1.5 text-xs font-bold text-opus-text transition hover:border-opus-accent-2"
                          >
                            تمديد
                          </button>
                          {s.status === 'paused' ? (
                            <button
                              type="button"
                              disabled={busy === s.id}
                              title="تفعيل"
                              onClick={() => run(s.id, () => postJson('/api/owner/bots', { botId: s.id, action: 'activate' }))}
                              className="inline-flex items-center justify-center rounded-lg border border-emerald-500/40 p-1.5 text-emerald-300 transition hover:bg-emerald-500/10"
                            >
                              <Play size={14} />
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={busy === s.id}
                              title="إيقاف"
                              onClick={() => run(s.id, () => postJson('/api/owner/bots', { botId: s.id, action: 'suspend' }))}
                              className="inline-flex items-center justify-center rounded-lg border border-amber-500/40 p-1.5 text-amber-300 transition hover:bg-amber-500/10"
                            >
                              <Pause size={14} />
                            </button>
                          )}
                          {busy === s.id ? <Loader2 size={14} className="animate-spin text-opus-muted" /> : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

function Stat({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className="rounded-xl border border-opus-border bg-opus-surface p-4">
      <div className="flex items-center gap-1.5 text-opus-muted">
        {icon}
        <span className="font-arabic text-xs">{label}</span>
      </div>
      <p className={`mt-2 font-english text-2xl font-extrabold ${highlight ? 'text-opus-accent-2' : 'text-opus-text'}`}>{value}</p>
    </div>
  );
}

function AddTokenForm({ busy, onSubmit }: { busy: boolean; onSubmit: (b: Record<string, unknown>) => void }) {
  const [productType, setProductType] = useState('ticket');
  const [token, setToken] = useState('');
  const [label, setLabel] = useState('');
  const [reservedForDiscordId, setReservedForDiscordId] = useState('');

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ productType, token, label, reservedForDiscordId });
        setToken('');
      }}
      className="mt-5 grid gap-3.5"
    >
      <Field label="لأي منتج؟">
        <select value={productType} onChange={(e) => setProductType(e.target.value)} className={inputCls}>
          {PRODUCTS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="توكن البوت" hint="من Discord Developer Portal → تطبيقك → Bot → Reset Token. نكتشف الاسم والمعرّف تلقائياً.">
        <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="MTA5..." dir="ltr" type="password" className={`${inputCls} font-english`} />
      </Field>
      <Field label="وسم (اختياري)" hint="اتركه فارغاً لاستخدام اسم البوت تلقائياً.">
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="مثال: بوت احتياطي #3" className={inputCls} />
      </Field>
      <Field label="محجوز لزبون (اختياري)" hint="آيدي Discord للزبون. لو عبّأته، هذا التوكن يُربط بهذا الزبون فقط عند شرائه — ولا يدخل البركة العامة.">
        <input value={reservedForDiscordId} onChange={(e) => setReservedForDiscordId(e.target.value)} placeholder="مثال: 959896496113844254" dir="ltr" className={`${inputCls} font-english`} />
      </Field>
      <PrimaryBtn busy={busy}>
        <Plus size={15} /> إضافة للبركة
      </PrimaryBtn>
    </form>
  );
}

function GrantTrialForm({ busy, onSubmit }: { busy: boolean; onSubmit: (b: Record<string, unknown>) => void }) {
  const [guildId, setGuildId] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [productType, setProductType] = useState('ticket');
  const [days, setDays] = useState('7');

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ guildId, ownerId, productType, days: Number(days) });
      }}
      className="mt-5 grid gap-3.5"
    >
      <Field label="المنتج">
        <select value={productType} onChange={(e) => setProductType(e.target.value)} className={inputCls}>
          {PRODUCTS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.name}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="معرّف السيرفر">
          <input value={guildId} onChange={(e) => setGuildId(e.target.value.replace(/\D/g, ''))} placeholder="Server ID" dir="ltr" className={`${inputCls} font-english`} />
        </Field>
        <Field label="مدة التجربة">
          <input value={days} onChange={(e) => setDays(e.target.value.replace(/\D/g, ''))} placeholder="أيام" dir="ltr" className={`${inputCls} font-english`} />
        </Field>
      </div>
      <Field label="Discord ID لصاحب السيرفر">
        <input value={ownerId} onChange={(e) => setOwnerId(e.target.value.replace(/\D/g, ''))} placeholder="Owner Discord ID" dir="ltr" className={`${inputCls} font-english`} />
      </Field>
      <PrimaryBtn busy={busy}>
        <Gift size={15} /> منح التجربة
      </PrimaryBtn>
    </form>
  );
}

function AddSubscriptionForm({ busy, onSubmit }: { busy: boolean; onSubmit: (b: Record<string, unknown>) => void }) {
  const [guildId, setGuildId] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [productType, setProductType] = useState('ticket');
  const [days, setDays] = useState('30');

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ guildId, ownerId, productType, days: Number(days) });
      }}
      className="mt-5 grid gap-3.5"
    >
      <Field label="المنتج">
        <select value={productType} onChange={(e) => setProductType(e.target.value)} className={inputCls}>
          {PRODUCTS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.name}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="معرّف السيرفر">
          <input value={guildId} onChange={(e) => setGuildId(e.target.value.replace(/\D/g, ''))} placeholder="Server ID" dir="ltr" className={`${inputCls} font-english`} />
        </Field>
        <Field label="مدة الاشتراك">
          <input value={days} onChange={(e) => setDays(e.target.value.replace(/\D/g, ''))} placeholder="أيام" dir="ltr" className={`${inputCls} font-english`} />
        </Field>
      </div>
      <Field label="Discord ID لصاحب السيرفر">
        <input value={ownerId} onChange={(e) => setOwnerId(e.target.value.replace(/\D/g, ''))} placeholder="Owner Discord ID" dir="ltr" className={`${inputCls} font-english`} />
      </Field>
      <PrimaryBtn busy={busy}>
        <CreditCard size={15} /> إضافة الاشتراك
      </PrimaryBtn>
    </form>
  );
}
