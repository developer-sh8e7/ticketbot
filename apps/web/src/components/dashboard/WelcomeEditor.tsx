'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';

type ApiResponse<T> = { success: true; data: T } | { success: false; error?: { message?: string } };
type Welcome = { enabled: boolean; channelId: string; message: string; pingUser: boolean };

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
  const [busy, setBusy] = useState(false);
  const [w, setW] = useState<Welcome>({ enabled: false, channelId: '', message: '', pingUser: true });
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch(`/api/dashboard/bot/${botId}/welcome`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((j: ApiResponse<{ welcome: Welcome }>) => {
        if (j.success) setW(j.data.welcome);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
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
    return <div className="flex items-center justify-center gap-2 rounded-2xl border border-opus-border bg-opus-surface p-8 font-arabic text-sm text-opus-muted"><Loader2 className="animate-spin" size={16} /> جاري التحميل...</div>;
  }

  const input = 'w-full rounded-lg border border-opus-border bg-opus-bg px-3 py-2 font-arabic text-sm text-opus-text outline-none focus:border-opus-accent';

  return (
    <div dir="rtl" className="rounded-2xl border border-opus-border bg-opus-surface p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-arabic text-base font-extrabold text-opus-text">رسالة الترحيب (Welcome)</h3>
        <label className="flex cursor-pointer items-center gap-2 font-arabic text-sm text-opus-text">
          <input type="checkbox" checked={w.enabled} onChange={(e) => setW((p) => ({ ...p, enabled: e.target.checked }))} className="h-4 w-4 accent-[var(--color-accent)]" />
          مفعّلة
        </label>
      </div>

      <div className="mt-4 grid gap-4">
        <label className="grid gap-1.5">
          <span className="font-arabic text-xs font-bold text-opus-text">روم الترحيب (Channel ID)</span>
          <input value={w.channelId} onChange={(e) => setW((p) => ({ ...p, channelId: e.target.value }))} dir="ltr" placeholder="123456789012345678" className={`${input} font-english`} />
          <span className="font-arabic text-[11px] text-opus-muted">كليك يمين على الروم في ديسكورد ← Copy Channel ID (يلزم تفعيل Developer Mode).</span>
        </label>

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
          <div className="rounded-lg border border-opus-border bg-opus-bg p-3">
            <p className="font-arabic text-[11px] font-bold text-opus-muted">معاينة</p>
            <p dir="auto" className="mt-1 whitespace-pre-wrap font-english text-sm leading-7 text-opus-text">{preview(w.message)}</p>
          </div>
        ) : null}

        <label className="flex cursor-pointer items-center gap-2 font-arabic text-sm text-opus-text">
          <input type="checkbox" checked={w.pingUser} onChange={(e) => setW((p) => ({ ...p, pingUser: e.target.checked }))} className="h-4 w-4 accent-[var(--color-accent)]" />
          منشن العضو خارج الرسالة (تنبيه)
        </label>

        {msg ? <p className={`rounded-lg border px-3 py-2 font-arabic text-xs leading-6 ${msg.kind === 'ok' ? 'border-opus-accent-2 text-opus-accent-2' : 'border-[#f59e0b] text-[#f59e0b]'}`}>{msg.text}</p> : null}

        <button type="button" onClick={save} disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-xl bg-opus-accent px-5 py-2.5 font-arabic text-sm font-extrabold text-black transition hover:opacity-90 disabled:opacity-60">
          {busy ? <Loader2 className="animate-spin" size={15} /> : <Check size={15} />} حفظ
        </button>
      </div>
    </div>
  );
}
