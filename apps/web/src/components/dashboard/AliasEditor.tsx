'use client';

import { useEffect, useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';

type ApiResponse<T> = { success: true; data: T } | { success: false; error?: { message?: string } };
type Alias = { id: string; alias: string; commandName: string };

function csrf() {
  const m = document.cookie.match(/(?:^|;\s*)opus_csrf=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : '';
}

const COMMANDS: { value: string; label: string }[] = [
  { value: 'ban', label: 'حظر — /ban' },
  { value: 'kick', label: 'طرد — /kick' },
  { value: 'timeout', label: 'إسكات مؤقت — /timeout' },
  { value: 'warn', label: 'تحذير — /warn' },
  { value: 'clear', label: 'مسح رسائل — /clear' },
  { value: 'unban', label: 'إلغاء حظر — /unban' },
  { value: 'slowmode', label: 'وضع بطيء — /slowmode' },
  { value: 'lock', label: 'قفل الروم — /lock' },
  { value: 'unlock', label: 'فتح الروم — /unlock' },
  { value: 'nuke', label: 'تفجير الروم — /nuke' },
  { value: 'role', label: 'إعطاء/سحب رول — /role' },
  { value: 'hide', label: 'إخفاء الروم — /hide' },
  { value: 'show', label: 'إظهار الروم — /show' },
];
const commandLabel = (v: string) => COMMANDS.find((c) => c.value === v)?.label ?? v;

export function AliasEditor({ botId }: { botId: string }) {
  const [loading, setLoading] = useState(true);
  const [aliases, setAliases] = useState<Alias[]>([]);
  const [alias, setAlias] = useState('');
  const [commandName, setCommandName] = useState('ban');
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  function load() {
    fetch(`/api/dashboard/bot/${botId}/aliases`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((j: ApiResponse<{ aliases: Alias[] }>) => {
        if (j.success) setAliases(j.data.aliases);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(load, [botId]);

  async function add() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/dashboard/bot/${botId}/aliases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf() },
        body: JSON.stringify({ alias: alias.trim(), commandName }),
      });
      const j = (await res.json()) as ApiResponse<{ saved: boolean }>;
      if (j.success) {
        setAlias('');
        setMsg({ kind: 'ok', text: 'تمت الإضافة!' });
        load();
      } else {
        setMsg({ kind: 'err', text: j.error?.message || 'تعذّرت الإضافة.' });
      }
    } catch {
      setMsg({ kind: 'err', text: 'تعذّر الاتصال.' });
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusyId(id);
    setMsg(null);
    try {
      const res = await fetch(`/api/dashboard/bot/${botId}/aliases`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf() },
        body: JSON.stringify({ id }),
      });
      const j = (await res.json()) as ApiResponse<{ deleted: boolean }>;
      if (j.success) setAliases((p) => p.filter((a) => a.id !== id));
      else setMsg({ kind: 'err', text: j.error?.message || 'تعذّر الحذف.' });
    } catch {
      setMsg({ kind: 'err', text: 'تعذّر الاتصال.' });
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center gap-2 rounded-2xl border border-opus-border bg-opus-surface p-8 font-arabic text-sm text-opus-muted"><Loader2 className="animate-spin" size={16} /> جاري التحميل...</div>;
  }

  const input = 'w-full rounded-lg border border-opus-border bg-opus-bg px-3 py-2 font-arabic text-sm text-opus-text outline-none focus:border-opus-accent';

  return (
    <div dir="rtl" className="rounded-2xl border border-opus-border bg-opus-surface p-5">
      <h3 className="font-arabic text-base font-extrabold text-opus-text">اختصارات الأوامر</h3>
      <p className="mt-1 font-arabic text-xs text-opus-muted">
        علّم كلمة عربية خاصة بسيرفرك تنفّذ أمراً جاهزاً. مثال: اكتب &quot;باند&quot; كاختصار لأمر /ban، وبعدها أي رسالة تبدأ بـ <span className="font-english">باند @شخص سبب الحظر</span> تنفّذ الحظر مباشرة (لمن عنده صلاحية أصلاً).
      </p>

      {aliases.length > 0 ? (
        <div className="mt-4 grid gap-2">
          {aliases.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-3 rounded-lg border border-opus-border bg-opus-bg px-3 py-2">
              <div className="font-arabic text-sm text-opus-text">
                <span className="font-english font-bold text-opus-accent-2">{a.alias}</span>
                <span className="mx-2 text-opus-muted">←</span>
                {commandLabel(a.commandName)}
              </div>
              <button
                type="button"
                onClick={() => remove(a.id)}
                disabled={busyId === a.id}
                className="inline-flex items-center justify-center rounded-lg border border-opus-border p-1.5 text-opus-muted transition hover:border-red-500/60 hover:text-red-300"
                title="حذف"
              >
                {busyId === a.id ? <Loader2 className="animate-spin" size={14} /> : <Trash2 size={14} />}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-lg border border-dashed border-opus-border bg-opus-bg p-4 text-center font-arabic text-xs text-opus-muted">لا اختصارات بعد.</p>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className="grid gap-1.5">
          <span className="font-arabic text-xs font-bold text-opus-text">الكلمة (اختصار)</span>
          <input value={alias} onChange={(e) => setAlias(e.target.value)} dir="ltr" placeholder="باند" className={`${input} font-english`} />
        </label>
        <label className="grid gap-1.5">
          <span className="font-arabic text-xs font-bold text-opus-text">الأمر</span>
          <select value={commandName} onChange={(e) => setCommandName(e.target.value)} className={input}>
            {COMMANDS.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={add}
          disabled={busy || !alias.trim()}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-opus-accent px-5 py-2.5 font-arabic text-sm font-extrabold text-black transition hover:opacity-90 disabled:opacity-60"
        >
          {busy ? <Loader2 className="animate-spin" size={15} /> : <Plus size={15} />} إضافة
        </button>
      </div>

      {msg ? <p className={`mt-3 rounded-lg border px-3 py-2 font-arabic text-xs leading-6 ${msg.kind === 'ok' ? 'border-opus-accent-2 text-opus-accent-2' : 'border-[#f59e0b] text-[#f59e0b]'}`}>{msg.text}</p> : null}
    </div>
  );
}
