'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ExternalLink, Loader2, Power, Settings } from 'lucide-react';
import type { PoolBot } from '@/lib/admin-data';
import { botInviteUrl } from '@/lib/bot-invite';

const PRODUCT: Record<string, string> = { ticket: 'التذاكر', voice_rooms: 'الرومات المؤقتة', general: 'السيستم' };

function csrf() {
  const m = document.cookie.match(/(?:^|;\s*)opus_csrf=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : '';
}

/** حالة التوكن المخزّن: متاح (لم يُفعّل)، يعمل، أو معطّل. */
function statusInfo(bot: PoolBot): { label: string; dot: string } {
  if (bot.status === 'disabled') return { label: 'معطّل', dot: 'bg-red-400' };
  if (bot.instanceId) {
    if (bot.instanceStatus === 'active') return { label: 'يعمل الآن', dot: 'bg-emerald-400' };
    if (bot.instanceStatus === 'paused') return { label: 'موقوف', dot: 'bg-amber-400' };
    return { label: 'مفعّل (منتهي)', dot: 'bg-red-400' };
  }
  return { label: 'جاهز — لم يُفعّل', dot: 'bg-opus-muted' };
}

function ActivateForm({ bot, onDone }: { bot: PoolBot; onDone: () => void }) {
  const [guildId, setGuildId] = useState('');
  const [ownerId, setOwnerId] = useState(bot.reservedFor ?? '');
  const [days, setDays] = useState('30');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function run() {
    setBusy(true);
    setErr('');
    try {
      const res = await fetch('/api/owner/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf() },
        body: JSON.stringify({ guildId, ownerId, productType: bot.productType, days: Number(days) }),
      });
      const json = await res.json();
      if (!json.success) setErr(json.error?.message || 'تعذّر التشغيل.');
      else onDone();
    } catch {
      setErr('تعذّر الاتصال.');
    } finally {
      setBusy(false);
    }
  }

  const input = 'w-full rounded-lg border border-opus-border bg-opus-bg px-2.5 py-1.5 font-english text-xs text-opus-text outline-none focus:border-opus-accent-2';

  return (
    <div className="mt-3 grid gap-2 rounded-lg border border-opus-border bg-opus-bg/40 p-3">
      <p className="font-arabic text-[11px] font-bold text-opus-text">تشغيل على سيرفر (بدون انتظار شراء)</p>
      <div className="grid grid-cols-3 gap-2">
        <input value={guildId} onChange={(e) => setGuildId(e.target.value.replace(/\D/g, ''))} placeholder="Server ID" dir="ltr" className={input} />
        <input value={ownerId} onChange={(e) => setOwnerId(e.target.value.replace(/\D/g, ''))} placeholder="Owner ID" dir="ltr" className={input} />
        <input value={days} onChange={(e) => setDays(e.target.value.replace(/\D/g, ''))} placeholder="أيام" dir="ltr" className={input} />
      </div>
      {err ? <p className="font-arabic text-[11px] text-[#f59e0b]">{err}</p> : null}
      <button
        type="button"
        onClick={run}
        disabled={busy || !guildId || !ownerId}
        className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-opus-accent px-3 py-1.5 font-arabic text-xs font-extrabold text-black transition hover:opacity-90 disabled:opacity-50"
      >
        {busy ? <Loader2 className="animate-spin" size={13} /> : <Power size={13} />} تشغيل الآن
      </button>
    </div>
  );
}

export function StoredBotsPanel({ bots }: { bots: PoolBot[] }) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);

  if (bots.length === 0) {
    return (
      <div className="opus-card p-6 text-center">
        <p className="font-arabic text-sm font-bold text-opus-text">لا توكنات مخزّنة بعد</p>
        <p className="mt-1 font-arabic text-xs text-opus-muted">أضف توكنات من لوحة الإدارة لتظهر هنا كبوتات جاهزة.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {bots.map((bot) => {
        const st = statusInfo(bot);
        const running = Boolean(bot.instanceId);
        return (
          <div key={bot.id} className="opus-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-arabic text-sm font-extrabold text-opus-text">{bot.label || PRODUCT[String(bot.productType)] || 'بوت'}</p>
                <p className="font-english text-[11px] text-opus-muted">{PRODUCT[String(bot.productType)] ?? bot.productType}</p>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-opus-border px-2.5 py-1 font-arabic text-[11px] font-bold text-opus-text">
                <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} /> {st.label}
              </span>
            </div>

            {bot.reservedFor ? (
              <p className="mt-2 font-arabic text-[11px] text-opus-muted">
                محجوز لـ <span className="font-english text-opus-text">{bot.reservedFor}</span>
              </p>
            ) : null}
            {running && bot.instanceGuildId ? (
              <p className="mt-2 font-arabic text-[11px] text-opus-muted">
                على سيرفر <span className="font-english text-opus-text">{bot.instanceGuildName || bot.instanceGuildId}</span>
              </p>
            ) : null}

            <div className="mt-3 flex flex-wrap gap-2">
              {bot.applicationId ? (
                <a
                  href={botInviteUrl(bot.applicationId, bot.instanceGuildId ?? undefined)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-opus-border px-3 py-1.5 font-arabic text-xs font-bold text-opus-text transition hover:border-opus-accent"
                >
                  <ExternalLink size={13} /> إضافة لسيرفر
                </a>
              ) : null}

              {running && bot.instanceId && bot.productType === 'general' ? (
                <a
                  href={`/dashboard/bot/${bot.instanceId}/system`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-opus-border px-3 py-1.5 font-arabic text-xs font-bold text-opus-text transition hover:border-opus-accent"
                >
                  <Settings size={13} /> إدارة
                </a>
              ) : null}

              {!running && bot.status !== 'disabled' ? (
                <button
                  type="button"
                  onClick={() => setOpenId(openId === bot.id ? null : bot.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-opus-accent px-3 py-1.5 font-arabic text-xs font-extrabold text-black transition hover:opacity-90"
                >
                  <Power size={13} /> تشغيل
                </button>
              ) : null}
            </div>

            {openId === bot.id && !running ? (
              <ActivateForm
                bot={bot}
                onDone={() => {
                  setOpenId(null);
                  router.refresh();
                }}
              />
            ) : null}

            {!running && bot.status !== 'disabled' ? (
              <p className="mt-2 font-arabic text-[10px] leading-5 text-opus-muted">
                أضف البوت للسيرفر أولاً، ثم اضغط «تشغيل» بنفس آيدي السيرفر ليصبح أونلاين ويشتغل.
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
