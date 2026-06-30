'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ImageUp, Loader2 } from 'lucide-react';

type ApiResponse<T> = { success: true; data: T } | { success: false; error?: { message?: string } };
type Avatar = { xPct: number; yPct: number; radiusPct: number };
type TextCfg = { xPct: number; yPct: number; fontSizePct: number; color: string };
type Config = { imageEnabled: boolean; backgroundUrl: string | null; avatar: Avatar; text: TextCfg };

type Drag = 'avatar-move' | 'avatar-resize' | 'text-move' | null;

function csrf() {
  const m = document.cookie.match(/(?:^|;\s*)opus_csrf=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : '';
}

export function WelcomeImageEditor({ botId }: { botId: string }) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [bgUrl, setBgUrl] = useState<string | null>(null);
  const [avatar, setAvatar] = useState<Avatar>({ xPct: 0.5, yPct: 0.5, radiusPct: 0.18 });
  const [text, setText] = useState<TextCfg>({ xPct: 0.5, yPct: 0.85, fontSizePct: 0.06, color: '#ffffff' });
  const [file, setFile] = useState<File | null>(null);
  const [containerWidth, setContainerWidth] = useState(600);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag>(null);
  const fileUrlRef = useRef<string | null>(null);

  useEffect(() => {
    fetch(`/api/dashboard/bot/${botId}/welcome-image`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((j: ApiResponse<Config>) => {
        if (j.success) {
          setEnabled(j.data.imageEnabled);
          setBgUrl(j.data.backgroundUrl);
          setAvatar(j.data.avatar);
          setText(j.data.text);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [botId]);

  function onPickFile(f?: File) {
    if (!f) return;
    if (fileUrlRef.current) URL.revokeObjectURL(fileUrlRef.current);
    const url = URL.createObjectURL(f);
    fileUrlRef.current = url;
    setFile(f);
    setBgUrl(url);
  }

  function measure() {
    if (containerRef.current) setContainerWidth(containerRef.current.clientWidth);
  }

  function startDrag(kind: Drag, e: React.PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = kind;
  }

  useEffect(() => {
    function move(e: PointerEvent) {
      const kind = dragRef.current;
      const box = containerRef.current;
      if (!kind || !box) return;
      const rect = box.getBoundingClientRect();
      const relX = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
      const relY = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));

      if (kind === 'avatar-move') {
        setAvatar((a) => ({ ...a, xPct: relX, yPct: relY }));
      } else if (kind === 'text-move') {
        setText((t) => ({ ...t, xPct: relX, yPct: relY }));
      } else if (kind === 'avatar-resize') {
        setAvatar((a) => {
          const dx = relX - a.xPct;
          const dy = (relY - a.yPct) * (rect.height / rect.width); // نسبة للعرض عشان الدائرة تضل دائرة
          const radius = Math.min(0.45, Math.max(0.03, Math.hypot(dx, dy)));
          return { ...a, radiusPct: radius };
        });
      }
    }
    function up() {
      dragRef.current = null;
    }
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, []);

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const form = new FormData();
      form.set('enabled', String(enabled));
      form.set('avatarX', String(avatar.xPct));
      form.set('avatarY', String(avatar.yPct));
      form.set('avatarRadius', String(avatar.radiusPct));
      form.set('textX', String(text.xPct));
      form.set('textY', String(text.yPct));
      form.set('textSize', String(text.fontSizePct));
      form.set('textColor', text.color);
      if (file) form.set('image', file);

      const res = await fetch(`/api/dashboard/bot/${botId}/welcome-image`, {
        method: 'POST',
        headers: { 'x-csrf-token': csrf() },
        body: form,
      });
      const j = (await res.json()) as ApiResponse<{ saved: boolean }>;
      setMsg(j.success ? { kind: 'ok', text: 'تم الحفظ! يطبّقه البوت خلال لحظات.' } : { kind: 'err', text: j.error?.message || 'تعذّر الحفظ.' });
      if (j.success) setFile(null);
    } catch {
      setMsg({ kind: 'err', text: 'تعذّر الاتصال.' });
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center gap-2 rounded-2xl border border-opus-border bg-opus-surface p-8 font-arabic text-sm text-opus-muted"><Loader2 className="animate-spin" size={16} /> جاري التحميل...</div>;
  }

  const fontPx = Math.max(8, text.fontSizePct * containerWidth);
  const diameterPct = avatar.radiusPct * 2 * 100;

  return (
    <div dir="rtl" className="rounded-2xl border border-opus-border bg-opus-surface p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-arabic text-base font-extrabold text-opus-text">صورة الترحيب</h3>
        <label className="flex cursor-pointer items-center gap-2 font-arabic text-sm text-opus-text">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="h-4 w-4 accent-[var(--color-accent)]" />
          مفعّلة
        </label>
      </div>
      <p className="mt-1 font-arabic text-xs text-opus-muted">ارفع صورة الخلفية، ثم اسحب الدائرة فوق مكان صورة العضو الجديد (اسحب من الطرف لتكبير/تصغير الحجم)، واسحب الاسم لمكانه.</p>

      <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-opus-border px-3 py-2 font-arabic text-xs font-bold text-opus-text transition hover:border-opus-accent">
        <ImageUp size={14} /> {bgUrl ? 'تغيير صورة الخلفية' : 'رفع صورة الخلفية'}
        <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => onPickFile(e.target.files?.[0])} />
      </label>

      {bgUrl ? (
        <div
          ref={containerRef}
          className="relative mt-4 w-full select-none overflow-hidden rounded-xl border border-opus-border bg-opus-bg"
          style={{ touchAction: 'none' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={bgUrl} alt="خلفية الترحيب" className="block w-full" draggable={false} onLoad={measure} />

          <div
            onPointerDown={(e) => startDrag('avatar-move', e)}
            className="absolute cursor-move rounded-full border-2 border-dashed border-opus-accent bg-opus-accent/10"
            style={{
              left: `${avatar.xPct * 100}%`,
              top: `${avatar.yPct * 100}%`,
              width: `${diameterPct}%`,
              aspectRatio: '1 / 1',
              transform: 'translate(-50%, -50%)',
            }}
          >
            <div
              onPointerDown={(e) => startDrag('avatar-resize', e)}
              className="absolute -bottom-1.5 -left-1.5 h-4 w-4 cursor-nwse-resize rounded-full border-2 border-black/40 bg-opus-accent"
              title="اسحب للتحجيم"
            />
          </div>

          <div
            onPointerDown={(e) => startDrag('text-move', e)}
            className="absolute cursor-move whitespace-nowrap rounded px-1.5 py-0.5 font-english font-extrabold"
            style={{
              left: `${text.xPct * 100}%`,
              top: `${text.yPct * 100}%`,
              transform: 'translate(-50%, -50%)',
              fontSize: `${fontPx}px`,
              color: text.color,
              textShadow: '0 1px 3px rgba(0,0,0,0.6)',
            }}
          >
            اسم العضو
          </div>
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <label className="grid gap-1.5">
          <span className="font-arabic text-xs font-bold text-opus-text">حجم خط الاسم</span>
          <input type="range" min={0.02} max={0.15} step={0.005} value={text.fontSizePct} onChange={(e) => setText((t) => ({ ...t, fontSizePct: Number(e.target.value) }))} />
        </label>
        <label className="grid gap-1.5">
          <span className="font-arabic text-xs font-bold text-opus-text">لون الاسم</span>
          <input type="color" value={text.color} onChange={(e) => setText((t) => ({ ...t, color: e.target.value }))} className="h-9 w-full rounded-lg border border-opus-border bg-opus-bg" />
        </label>
      </div>

      {msg ? <p className={`mt-4 rounded-lg border px-3 py-2 font-arabic text-xs leading-6 ${msg.kind === 'ok' ? 'border-opus-accent-2 text-opus-accent-2' : 'border-[#f59e0b] text-[#f59e0b]'}`}>{msg.text}</p> : null}

      <button type="button" onClick={save} disabled={busy} className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-opus-accent px-5 py-2.5 font-arabic text-sm font-extrabold text-black transition hover:opacity-90 disabled:opacity-60">
        {busy ? <Loader2 className="animate-spin" size={15} /> : <Check size={15} />} حفظ
      </button>
    </div>
  );
}
