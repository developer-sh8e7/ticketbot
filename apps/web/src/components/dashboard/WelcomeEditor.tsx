'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Hash, Loader2, Search } from 'lucide-react';

type ApiResponse<T> = { success: true; data: T } | { success: false; error?: { message?: string } };
type Welcome = { enabled: boolean; channelId: string; message: string; pingUser: boolean };
type WelcomeChannel = { id: string; name: string; type: number; parentName: string | null };

function csrf() {
  const m = document.cookie.match(/(?:^|;\s*)opus_csrf=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : '';
}

const TOKENS: { token: string; desc: string }[] = [
  { token: '@user-new', desc: 'منشن العضو الجديد' },
  { token: '@owner', desc: 'منشن مالك السيرفر' },
  { token: '{server}', desc: 'اسم السيرفر' },
  { token: '{count}', desc: 'عدد الأعضاء' },
  { token: '{user}', desc: 'اسم العضو' },
];

function preview(msg: string) {
  return msg
    .replace(/@user-new/g, '@عضو_جديد')
    .replace(/@owner/g, '@المالك')
    .replace(/\{server\}/g, 'سيرفرك')
    .replace(/\{count\}/g, '١٢٣')
    .replace(/\{user\}/g, 'Ahmed');
}

export function WelcomeEditor({ botId }: { botId: string }) {
  const [loading, setLoading] = useState(true);
  const [channelsLoading, setChannelsLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [w, setW] = useState<Welcome>({ enabled: false, channelId: '', message: '', pingUser: true });
  const [channels, setChannels] = useState<WelcomeChannel[]>([]);
  const [channelError, setChannelError] = useState<string | null>(null);
  const [channelSearch, setChannelSearch] = useState('');
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setChannelsLoading(true);
      setChannelError(null);

      const welcomeReq = fetch(`/api/dashboard/bot/${botId}/welcome`, { cache: 'no-store' }).then((r) => r.json() as Promise<ApiResponse<{ welcome: Welcome }>>);
      const channelsReq = fetch(`/api/dashboard/bot/${botId}/channels`, { cache: 'no-store' }).then((r) => r.json() as Promise<ApiResponse<{ channels: WelcomeChannel[] }>>);
      const [welcomeResult, channelsResult] = await Promise.allSettled([welcomeReq, channelsReq]);
      if (!alive) return;

      if (welcomeResult.status === 'fulfilled') {
        const result = welcomeResult.value;
        if (result.success) setW(result.data.welcome);
        else setMsg({ kind: 'err', text: result.error?.message || 'تعذّر جلب إعدادات الترحيب.' });
      } else {
        setMsg({ kind: 'err', text: 'تعذّر الاتصال بإعدادات الترحيب.' });
      }

      if (channelsResult.status === 'fulfilled') {
        const result = channelsResult.value;
        if (result.success) setChannels(result.data.channels);
        else setChannelError(result.error?.message || 'تعذّر جلب رومات السيرفر.');
      } else {
        setChannelError('تعذّر الاتصال لجلب رومات السيرفر.');
      }

      setLoading(false);
      setChannelsLoading(false);
    }

    load().catch(() => {
      if (!alive) return;
      setLoading(false);
      setChannelsLoading(false);
      setMsg({ kind: 'err', text: 'تعذّر تحميل إعدادات الترحيب.' });
    });

    return () => {
      alive = false;
    };
  }, [botId]);

  function insert(token: string) {
    const ta = taRef.current;
    if (!ta) {
      setW((p) => ({ ...p, message: `${p.message}${token}` }));
      return;
    }
    const start = ta.selectionStart ?? w.message.length;
    const end = ta.selectionEnd ?? w.message.length;
    const next = w.message.slice(0, start) + token + w.message.slice(end);
    setW((p) => ({ ...p, message: next }));
    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = ta.selectionEnd = start + token.length;
    });
  }

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/dashboard/bot/${botId}/welcome`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf() },
        body: JSON.stringify(w),
      });
      const j = (await res.json()) as ApiResponse<{ saved: boolean }>;
      setMsg(j.success ? { kind: 'ok', text: 'تم الحفظ! يطبّقه البوت خلال لحظات.' } : { kind: 'err', text: j.error?.message || 'تعذّر الحفظ.' });
    } catch {
      setMsg({ kind: 'err', text: 'تعذّر الاتصال.' });
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="opus-card flex items-center justify-center gap-2 p-8 font-arabic text-sm text-opus-muted"><Loader2 className="animate-spin" size={16} /> جاري التحميل...</div>;
  }

  const input = 'w-full rounded-lg border border-opus-border bg-opus-bg px-3 py-2 font-arabic text-sm text-opus-text outline-none focus:border-opus-accent';
  const selectedChannel = channels.find((c) => c.id === w.channelId) || null;
  const q = channelSearch.trim().toLowerCase();
  const filteredChannels = q ? channels.filter((c) => `${c.name} ${c.parentName ?? ''}`.toLowerCase().includes(q)) : channels;

  return (
    <div dir="rtl" className="opus-card p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-arabic text-base font-extrabold text-opus-text">رسالة الترحيب (Welcome)</h3>
          <p className="mt-1 font-arabic text-xs text-opus-muted">اختر الروم من السيرفر واكتب الرسالة — بدون نسخ Channel ID.</p>
        </div>
        <label className="flex cursor-pointer select-none items-center gap-2.5">
          <span className="font-arabic text-xs font-bold text-opus-text">مفعّلة</span>
          <span className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-opus-border bg-opus-bg">
            <input type="checkbox" checked={w.enabled} onChange={(e) => setW((p) => ({ ...p, enabled: e.target.checked }))} className="peer absolute inset-0 z-10 cursor-pointer opacity-0" />
            <span className="absolute right-0.5 h-4 w-4 rounded-full bg-opus-muted transition-all duration-200 peer-checked:right-[1.625rem] peer-checked:bg-opus-accent" />
          </span>
        </label>
      </div>

      <div className="mt-4 grid gap-4">
        <div className="grid gap-2">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <span className="font-arabic text-xs font-bold text-opus-text">روم الترحيب</span>
              <p className="mt-1 font-arabic text-[11px] text-opus-muted">الرومات النصية تظهر مباشرة من السيرفر الذي دخل فيه البوت.</p>
            </div>
            {selectedChannel ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-opus-accent-2/50 bg-opus-accent-2/10 px-2.5 py-1 font-arabic text-[11px] font-bold text-opus-accent-2">
                <Hash size={12} /> {selectedChannel.name}
              </span>
            ) : null}
          </div>

          {channelsLoading ? (
            <div className="rounded-xl border border-opus-border bg-opus-bg p-4 text-center font-arabic text-xs text-opus-muted">
              <Loader2 className="mx-auto mb-2 animate-spin" size={16} /> جاري جلب الرومات من Discord...
            </div>
          ) : channelError ? (
            <div className="rounded-xl border border-[#f59e0b]/60 bg-[#f59e0b]/5 p-4 font-arabic text-xs leading-6 text-[#f59e0b]">
              {channelError}
              {w.channelId ? <p className="mt-1 font-english text-[11px] text-opus-muted">الروم المحفوظ حالياً: {w.channelId}</p> : null}
            </div>
          ) : (
            <>
              <div className="relative">
                <Search size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-opus-muted" />
                <input
                  value={channelSearch}
                  onChange={(e) => setChannelSearch(e.target.value)}
                  placeholder="ابحث باسم الروم..."
                  className={`${input} pr-9`}
                />
              </div>

              <div className="max-h-60 overflow-y-auto rounded-xl border border-opus-border bg-opus-bg p-2">
                {filteredChannels.length > 0 ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {filteredChannels.map((ch) => {
                      const selected = ch.id === w.channelId;
                      return (
                        <button
                          key={ch.id}
                          type="button"
                          onClick={() => setW((p) => ({ ...p, channelId: ch.id }))}
                          aria-pressed={selected}
                          className={`group flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-right transition ${
                            selected ? 'border-opus-accent bg-opus-accent/10 shadow-[0_0_0_1px_rgba(221,255,0,0.15)]' : 'border-opus-border bg-opus-surface/60 hover:border-opus-accent-2/70 hover:bg-opus-surface'
                          }`}
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${selected ? 'bg-opus-accent text-black' : 'bg-opus-bg text-opus-muted group-hover:text-opus-accent-2'}`}>
                              <Hash size={15} />
                            </span>
                            <span className="min-w-0">
                              <span dir="auto" className="block truncate font-arabic text-sm font-extrabold text-opus-text">{ch.name}</span>
                              <span className="block truncate font-arabic text-[10px] text-opus-muted">{ch.parentName || 'روم نصي'}</span>
                            </span>
                          </span>
                          {selected ? <Check size={15} className="shrink-0 text-opus-accent" /> : null}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="rounded-lg border border-dashed border-opus-border p-4 text-center font-arabic text-xs text-opus-muted">ما لقينا روم مطابق للبحث.</p>
                )}
              </div>

              {w.channelId && !selectedChannel ? (
                <p className="rounded-lg border border-[#f59e0b]/50 bg-[#f59e0b]/5 px-3 py-2 font-arabic text-[11px] leading-5 text-[#f59e0b]">
                  الروم المحفوظ غير ظاهر بالقائمة. تأكد أن البوت يقدر يشوفه أو اختر روم جديد.
                </p>
              ) : null}
            </>
          )}
        </div>

        <div className="grid gap-1.5">
          <span className="font-arabic text-xs font-bold text-opus-text">المتغيّرات (اضغط لإدراجها)</span>
          <div className="flex flex-wrap gap-2">
            {TOKENS.map((t) => (
              <button key={t.token} type="button" onClick={() => insert(t.token)} title={t.desc} className="rounded-lg border border-opus-border px-2.5 py-1 font-english text-xs text-opus-text transition hover:border-opus-accent hover:bg-opus-accent hover:text-black">
                {t.token}
              </button>
            ))}
          </div>
        </div>

        <label className="grid gap-1.5">
          <span className="font-arabic text-xs font-bold text-opus-text">نص الرسالة</span>
          <textarea
            ref={taRef}
            value={w.message}
            onChange={(e) => setW((p) => ({ ...p, message: e.target.value }))}
            rows={5}
            dir="auto"
            placeholder={'*hey :* **@user-new**\nWelcome to {server}\n*by :* **@owner**'}
            className={`${input} resize-y font-english leading-7`}
          />
        </label>

        {w.message ? (
          <div className="rounded-xl border border-opus-border bg-opus-bg p-3">
            <p className="font-arabic text-[11px] font-bold text-opus-muted">معاينة الرسالة</p>
            <p dir="auto" className="mt-1 whitespace-pre-wrap font-english text-sm leading-7 text-opus-text">{preview(w.message)}</p>
          </div>
        ) : null}

        <label className="flex cursor-pointer items-center gap-2 font-arabic text-sm text-opus-text">
          <input type="checkbox" checked={w.pingUser} onChange={(e) => setW((p) => ({ ...p, pingUser: e.target.checked }))} className="h-4 w-4 accent-[var(--color-accent)]" />
          منشن العضو خارج الرسالة (تنبيه)
        </label>

        {msg ? <p className={`rounded-lg border px-3 py-2 font-arabic text-xs leading-6 ${msg.kind === 'ok' ? 'border-opus-accent-2 text-opus-accent-2' : 'border-[#f59e0b] text-[#f59e0b]'}`}>{msg.text}</p> : null}

        <button type="button" onClick={save} disabled={busy || (w.enabled && !w.channelId)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-opus-accent px-5 py-2.5 font-arabic text-sm font-extrabold text-black transition hover:opacity-90 disabled:opacity-60">
          {busy ? <Loader2 className="animate-spin" size={15} /> : <Check size={15} />} حفظ
        </button>
      </div>
    </div>
  );
}
