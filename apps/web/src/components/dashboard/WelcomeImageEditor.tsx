'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ImagePlus, ImageUp, Loader2, Move, UserRound } from 'lucide-react';

type ApiResponse<T> = { success: true; data: T } | { success: false; error?: { message?: string } };
type Avatar = { xPct: number; yPct: number; radiusPct: number };
type TextCfg = { xPct: number; yPct: number; fontSizePct: number; color: string };
type Config = { imageEnabled: boolean; backgroundUrl: string | null; avatar: Avatar; text: TextCfg };

type Drag = 'avatar-move' | 'avatar-resize' | 'text-move' | null;
const MAX_BYTES = 5 * 1024 * 1024;

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
  const [dropActive, setDropActive] = useState(false);
  const [activeHandle, setActiveHandle] = useState<Drag>(null);
  const [imageError, setImageError] = useState<string | null>(null);

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

  useEffect(() => {
    return () => {
      if (fileUrlRef.current) URL.revokeObjectURL(fileUrlRef.current);
    };
  }, []);

  function onPickFile(f?: File) {
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      setMsg({ kind: 'err', text: 'اختر ملف صورة (PNG أو JPEG أو WEBP).' });
      return;
    }
    if (f.size > MAX_BYTES) {
      setMsg({ kind: 'err', text: 'الصورة كبيرة جداً (الحد الأقصى 5 ميجابايت).' });
      return;
    }
    if (fileUrlRef.current) URL.revokeObjectURL(fileUrlRef.current);
    const url = URL.createObjectURL(f);
    fileUrlRef.current = url;
    setFile(f);
    setBgUrl(url);
    setImageError(null);
    setMsg(null);
  }

  function measure() {
    if (containerRef.current) setContainerWidth(containerRef.current.clientWidth);
  }

  function startDrag(kind: Drag, e: React.PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = kind;
    setActiveHandle(kind);
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
      setActiveHandle(null);
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
      const j = (await res.json()) as ApiResponse<{ saved: boolean; backgroundUrl: string | null; avatar: Avatar; text: TextCfg }>;
      if (j.success) {
        setMsg({ kind: 'ok', text: 'تم الحفظ! يطبّقه البوت خلال لحظات.' });
        if (j.data.backgroundUrl) setBgUrl(j.data.backgroundUrl);
        setAvatar(j.data.avatar);
        setText(j.data.text);
        setFile(null);
        if (fileUrlRef.current) {
          URL.revokeObjectURL(fileUrlRef.current);
          fileUrlRef.current = null;
        }
      } else {
        setMsg({ kind: 'err', text: j.error?.message || 'تعذّر الحفظ.' });
      }
    } catch {
      setMsg({ kind: 'err', text: 'تعذّر الاتصال.' });
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="opus-card flex items-center justify-center gap-2 p-8 font-arabic text-sm text-opus-muted">
        <Loader2 className="animate-spin" size={16} /> جاري التحميل...
      </div>
    );
  }

  const fontPx = Math.max(8, text.fontSizePct * containerWidth);
  const diameterPct = avatar.radiusPct * 2 * 100;

  return (
    <div dir="rtl" className="opus-card p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-arabic text-base font-extrabold text-opus-text">صورة الترحيب</h3>
          <p className="mt-1 font-arabic text-xs leading-6 text-opus-muted">
            اسحب صورة العضو والاسم بالماوس فوق الخلفية مباشرة — بدون أرقام أو إحداثيات.
          </p>
        </div>
        <label className="flex cursor-pointer select-none items-center gap-2.5">
          <span className="font-arabic text-xs font-bold text-opus-text">مفعّلة</span>
          <span className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-opus-border bg-opus-bg transition">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="peer absolute inset-0 z-10 cursor-pointer opacity-0" />
            <span className="absolute right-0.5 h-4 w-4 rounded-full bg-opus-muted transition-all duration-200 peer-checked:right-[1.625rem] peer-checked:bg-opus-accent" />
          </span>
        </label>
      </div>

      {!bgUrl ? (
        <label
          onDragOver={(e) => { e.preventDefault(); setDropActive(true); }}
          onDragLeave={() => setDropActive(false)}
          onDrop={(e) => { e.preventDefault(); setDropActive(false); onPickFile(e.dataTransfer.files?.[0]); }}
          className={`mt-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition ${
            dropActive ? 'border-opus-accent bg-opus-accent/5' : 'border-opus-border hover:border-opus-accent-2'
          }`}
        >
          <ImagePlus size={26} className="text-opus-muted" />
          <span className="font-arabic text-sm font-bold text-opus-text">اسحب صورة الخلفية هنا أو اضغط للاختيار</span>
          <span className="font-arabic text-[11px] text-opus-muted">PNG، JPEG أو WEBP — حتى 5 ميجابايت</span>
          <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => onPickFile(e.target.files?.[0])} />
        </label>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-opus-border px-3 py-1.5 font-arabic text-xs font-bold text-opus-text transition hover:border-opus-accent">
              <ImageUp size={13} /> تغيير الخلفية
              <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => onPickFile(e.target.files?.[0])} />
            </label>
            <span className="rounded-full border border-opus-border bg-opus-bg px-2.5 py-1 font-arabic text-[11px] font-bold text-opus-muted">معاينة مباشرة</span>
            <span className="font-arabic text-[11px] text-opus-muted">اسحب الدائرة لمكان الصورة، واسحب طرفها للتحجيم، واسحب الاسم لمكانه</span>
          </div>

          <div
            ref={containerRef}
            className="relative mt-3 min-h-[220px] w-full select-none overflow-hidden rounded-xl border border-opus-border bg-opus-bg"
            style={{ touchAction: 'none' }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={bgUrl} alt="خلفية الترحيب" className="block w-full" draggable={false} onLoad={() => { measure(); setImageError(null); }} onError={() => setImageError('تعذّر عرض الخلفية. أعد رفعها أو جرّب صورة PNG/JPEG أصغر.')} />
            {imageError ? (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-opus-bg/90 p-6 text-center font-arabic text-xs leading-6 text-[#f59e0b]">
                {imageError}
              </div>
            ) : null}

            <div
              onPointerDown={(e) => startDrag('avatar-move', e)}
              className={`absolute flex cursor-move items-center justify-center rounded-full border-2 border-dashed bg-opus-accent/10 backdrop-blur-[1px] transition-colors ${
                activeHandle === 'avatar-move' ? 'border-opus-accent bg-opus-accent/20' : 'border-opus-accent/70'
              }`}
              style={{
                left: `${avatar.xPct * 100}%`,
                top: `${avatar.yPct * 100}%`,
                width: `${diameterPct}%`,
                aspectRatio: '1 / 1',
                transform: 'translate(-50%, -50%)',
              }}
            >
              <UserRound size={18} className="pointer-events-none text-opus-accent opacity-70" />
              <div
                onPointerDown={(e) => startDrag('avatar-resize', e)}
                className="absolute -bottom-1.5 -left-1.5 flex h-5 w-5 cursor-nwse-resize items-center justify-center rounded-full border-2 border-opus-bg bg-opus-accent shadow-[0_2px_8px_rgba(0,0,0,0.4)]"
                title="اسحب للتحجيم"
              />
            </div>

            <div
              onPointerDown={(e) => startDrag('text-move', e)}
              className={`absolute flex cursor-move items-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-1 transition-colors ${
                activeHandle === 'text-move' ? 'bg-black/30' : ''
              }`}
              style={{
                left: `${text.xPct * 100}%`,
                top: `${text.yPct * 100}%`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <Move size={Math.max(10, fontPx * 0.55)} className="pointer-events-none shrink-0 opacity-50" style={{ color: text.color }} />
              <span style={{ fontSize: `${fontPx}px`, color: text.color, textShadow: '0 1px 3px rgba(0,0,0,0.6)' }} className="font-english font-extrabold leading-none">
                اسم العضو
              </span>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
            <label className="grid gap-2">
              <span className="font-arabic text-xs font-bold text-opus-text">حجم خط الاسم</span>
              <input type="range" min={0.02} max={0.15} step={0.005} value={text.fontSizePct} onChange={(e) => setText((t) => ({ ...t, fontSizePct: Number(e.target.value) }))} />
            </label>
            <label className="grid gap-2">
              <span className="font-arabic text-xs font-bold text-opus-text">لون الاسم</span>
              <input type="color" value={text.color} onChange={(e) => setText((t) => ({ ...t, color: e.target.value }))} className="h-9 w-full" />
            </label>
          </div>
        </>
      )}

      {msg ? (
        <p className={`mt-4 rounded-lg border px-3 py-2 font-arabic text-xs leading-6 ${msg.kind === 'ok' ? 'border-opus-accent-2 text-opus-accent-2' : 'border-[#f59e0b] text-[#f59e0b]'}`}>
          {msg.text}
        </p>
      ) : null}

      <button
        type="button"
        onClick={save}
        disabled={busy}
        className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-opus-accent px-5 py-2.5 font-arabic text-sm font-extrabold text-black transition hover:opacity-90 disabled:opacity-60"
      >
        {busy ? <Loader2 className="animate-spin" size={15} /> : <Check size={15} />} حفظ
      </button>
    </div>
  );
}
