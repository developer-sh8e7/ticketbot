'use client';

import { useState } from 'react';
import { Check, Image as ImageIcon, Loader2, Pencil } from 'lucide-react';

type Profile = { username: string; avatarUrl: string | null; bannerUrl: string | null };
type ApiResponse<T> = { success: true; data: T } | { success: false; error?: { message?: string } };

function csrf() {
  const m = document.cookie.match(/(?:^|;\s*)opus_csrf=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : '';
}

function readAsDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('read failed'));
    r.readAsDataURL(file);
  });
}

/** Customer-facing editor for the bot's name, avatar and banner ONLY. */
export function BotProfileEditor({ botId }: { botId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState<string>('');
  const [banner, setBanner] = useState<string>('');
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  async function openEditor() {
    setOpen(true);
    if (profile) return;
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/dashboard/bot/${botId}/profile`, { cache: 'no-store' });
      const json = (await res.json()) as ApiResponse<{ profile: Profile }>;
      if (json.success) {
        setProfile(json.data.profile);
        setName(json.data.profile.username);
      } else {
        setMsg({ kind: 'err', text: json.error?.message || 'تعذّر جلب البروفايل.' });
      }
    } catch {
      setMsg({ kind: 'err', text: 'تعذّر الاتصال.' });
    } finally {
      setLoading(false);
    }
  }

  async function pick(setter: (v: string) => void, file?: File) {
    if (!file) return;
    try {
      setter(await readAsDataUri(file));
    } catch {
      setMsg({ kind: 'err', text: 'تعذّر قراءة الصورة.' });
    }
  }

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/dashboard/bot/${botId}/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf() },
        body: JSON.stringify({ name, avatar, banner }),
      });
      const json = (await res.json()) as ApiResponse<{ profile: Profile }>;
      if (json.success) {
        setProfile(json.data.profile);
        setName(json.data.profile.username);
        setAvatar('');
        setBanner('');
        setMsg({ kind: 'ok', text: 'تم تحديث البروفايل! قد يستغرق ظهوره دقائق في Discord.' });
      } else {
        setMsg({ kind: 'err', text: json.error?.message || 'تعذّر الحفظ.' });
      }
    } catch {
      setMsg({ kind: 'err', text: 'تعذّر الاتصال.' });
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={openEditor}
        className="mt-3 inline-flex items-center gap-2 rounded-xl border border-opus-border px-4 py-2 font-arabic text-sm font-bold text-opus-text transition hover:border-opus-accent"
      >
        <Pencil size={14} /> تعديل بروفايل البوت
      </button>
    );
  }

  const fileInput =
    'block w-full text-xs text-opus-muted file:mr-3 file:rounded-lg file:border-0 file:bg-opus-accent file:px-3 file:py-1.5 file:font-arabic file:text-xs file:font-bold file:text-black';

  return (
    <div className="mt-4 rounded-xl border border-opus-border bg-opus-bg/40 p-4">
      <p className="font-arabic text-sm font-extrabold text-opus-text">تعديل بروفايل البوت</p>
      <p className="mt-1 font-arabic text-[11px] leading-5 text-opus-muted">تقدر تغيّر الاسم والصورة والبنر فقط.</p>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-6 text-opus-muted">
          <Loader2 className="animate-spin" size={16} /> جاري التحميل...
        </div>
      ) : (
        <div className="mt-4 grid gap-4">
          <label className="grid gap-1.5">
            <span className="font-arabic text-xs font-bold text-opus-text">اسم البوت</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={32}
              className="w-full rounded-lg border border-opus-border bg-opus-surface px-3 py-2 font-arabic text-sm text-opus-text outline-none focus:border-opus-accent"
              placeholder="اسم البوت"
            />
          </label>

          <label className="grid gap-1.5">
            <span className="flex items-center gap-1.5 font-arabic text-xs font-bold text-opus-text">
              <ImageIcon size={13} /> الصورة (Avatar)
            </span>
            <input type="file" accept="image/*" onChange={(e) => pick(setAvatar, e.target.files?.[0])} className={fileInput} />
          </label>

          <label className="grid gap-1.5">
            <span className="flex items-center gap-1.5 font-arabic text-xs font-bold text-opus-text">
              <ImageIcon size={13} /> البنر (Banner)
            </span>
            <input type="file" accept="image/*" onChange={(e) => pick(setBanner, e.target.files?.[0])} className={fileInput} />
          </label>

          {msg ? (
            <p className={`rounded-lg border px-3 py-2 font-arabic text-xs leading-6 ${msg.kind === 'ok' ? 'border-opus-accent-2 text-opus-accent-2' : 'border-[#f59e0b] text-[#f59e0b]'}`}>
              {msg.text}
            </p>
          ) : null}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={save}
              disabled={busy}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-opus-accent px-4 py-2 font-arabic text-sm font-extrabold text-black transition hover:opacity-90 disabled:opacity-60"
            >
              {busy ? <Loader2 className="animate-spin" size={15} /> : <Check size={15} />} حفظ
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg border border-opus-border px-4 py-2 font-arabic text-sm font-bold text-opus-muted transition hover:text-opus-text"
            >
              إغلاق
            </button>
          </div>
          <p className="font-arabic text-[10px] leading-5 text-opus-muted">ملاحظة: Discord يسمح بتغيير الاسم مرتين فقط بالساعة.</p>
        </div>
      )}
    </div>
  );
}
