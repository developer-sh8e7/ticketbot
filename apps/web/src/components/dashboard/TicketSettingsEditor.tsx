'use client';

/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from 'react';
import { CheckCircle2, ChevronDown, Eye, Image as ImageIcon, Loader2, Palette, Plus, Search, Sparkles, Trash2, Wand2, X } from 'lucide-react';

type ApiResponse<T> = { success: true; data: T } | { success: false; error?: { message?: string } };

type ButtonStyle = 'Primary' | 'Secondary' | 'Success' | 'Danger';
type ControlKey = 'close' | 'add' | 'remove' | 'claim' | 'pin';
type Control = { label: string; style: ButtonStyle; emoji: string };
type Category = { key: string; label: string; description: string; emoji: string; enabled: boolean };

type Channel = { id: string; name: string; parentName?: string | null };
type GuildCategory = { id: string; name: string };
type Role = { id: string; name: string; managed: boolean };
type GuildEmoji = { id: string; name: string; animated: boolean; available: boolean; url: string };

type Settings = {
  panel_channel_id: string | null;
  log_channel_id: string | null;
  transcript_channel_id: string | null;
  ticket_category_id: string | null;
  archive_category_id: string | null;
  support_role_id: string | null;
  panel_message: string;
  embed_color: string;
  banner_url: string | null;
  button_text: string;
  footer_text: string;
  categories?: Category[];
  buttons?: Partial<Record<ControlKey, Partial<Control>>>;
};

const DEFAULT_BUTTONS: Record<ControlKey, Control> = {
  close: { label: 'إغلاق', style: 'Danger', emoji: '' },
  add: { label: 'إضافة', style: 'Success', emoji: '' },
  remove: { label: 'حذف', style: 'Danger', emoji: '' },
  claim: { label: 'استلام', style: 'Primary', emoji: '' },
  pin: { label: 'تثبيت', style: 'Secondary', emoji: '' },
};

const CONTROL_NAMES: Record<ControlKey, string> = {
  close: 'زر إغلاق التذكرة',
  add: 'زر إضافة عضو',
  remove: 'زر حذف عضو',
  claim: 'زر استلام التذكرة',
  pin: 'زر تثبيت التذكرة',
};

const STYLE_NAMES: { value: ButtonStyle; label: string }[] = [
  { value: 'Primary', label: 'أزرق' },
  { value: 'Secondary', label: 'رمادي' },
  { value: 'Success', label: 'أخضر' },
  { value: 'Danger', label: 'أحمر' },
];

const DEFAULT_SETTINGS: Settings = {
  panel_channel_id: null,
  log_channel_id: null,
  transcript_channel_id: null,
  ticket_category_id: null,
  archive_category_id: null,
  support_role_id: null,
  panel_message: '',
  embed_color: '#5865F2',
  banner_url: null,
  button_text: 'اختر تصنيفاً...',
  footer_text: '',
  categories: [{ key: 'default', label: 'عام', description: 'للطلبات العامة', emoji: '', enabled: true }],
  buttons: DEFAULT_BUTTONS,
};

const CATEGORY_PRESETS: Category[] = [
  { key: 'support', label: 'دعم فني', description: 'مساعدة ومتابعة الطلبات', emoji: '🎧', enabled: true },
  { key: 'purchase', label: 'شراء', description: 'شراء المنتجات والخدمات', emoji: '🛒', enabled: true },
  { key: 'complaint', label: 'شكوى', description: 'رفع شكوى أو اعتراض', emoji: '⚠️', enabled: true },
];

const CUSTOM_EMOJI_ID_RE = /^\d{17,20}$/;

function csrf() {
  const m = document.cookie.match(/(?:^|;\s*)opus_csrf=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : '';
}

function newCategoryKey(existing: Category[]): string {
  let n = existing.length + 1;
  while (existing.some((c) => c.key === `cat_${n}`)) n += 1;
  return `cat_${n}`;
}

function normalizeButtons(buttons?: Settings['buttons']): Record<ControlKey, Control> {
  const merged = {} as Record<ControlKey, Control>;
  (Object.keys(DEFAULT_BUTTONS) as ControlKey[]).forEach((key) => {
    merged[key] = { ...DEFAULT_BUTTONS[key], ...(buttons?.[key] || {}) };
  });
  return merged;
}

function buttonStyleClass(style: ButtonStyle): string {
  switch (style) {
    case 'Primary':
      return 'border-[#5865f2]/45 bg-[#5865f2]/20 text-[#b8c0ff]';
    case 'Success':
      return 'border-emerald-400/45 bg-emerald-400/15 text-emerald-300';
    case 'Danger':
      return 'border-red-400/45 bg-red-400/15 text-red-300';
    default:
      return 'border-opus-border bg-opus-bg/80 text-opus-text';
  }
}

function EmojiFace({ value, emojis, className = 'h-8 w-8' }: { value: string; emojis: GuildEmoji[]; className?: string }) {
  const selected = emojis.find((emoji) => emoji.id === value);
  if (selected) {
    return <img src={selected.url} alt={selected.name} className={`${className} rounded-lg object-contain`} title={`:${selected.name}:`} />;
  }
  if (value) {
    return <span className={`inline-flex ${className} items-center justify-center rounded-lg text-lg`}>{value}</span>;
  }
  return <span className={`inline-flex ${className} items-center justify-center rounded-lg text-opus-muted`}>—</span>;
}

function EmojiPicker({
  value,
  onChange,
  emojis,
  inputClass,
  compact = false,
}: {
  value: string;
  onChange: (value: string) => void;
  emojis: GuildEmoji[];
  inputClass: string;
  compact?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const selected = emojis.find((emoji) => emoji.id === value);
  const filtered = emojis
    .filter((emoji) => emoji.name.toLowerCase().includes(query.trim().toLowerCase()) || emoji.id.includes(query.trim()))
    .slice(0, 96);

  return (
    <div className="rounded-xl border border-opus-border bg-opus-surface/50 p-2">
      <div className="flex items-center gap-2">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-opus-border bg-opus-bg">
          <EmojiFace value={value} emojis={emojis} className="h-7 w-7" />
        </div>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="🎫 أو ID / Unicode"
          dir="ltr"
          maxLength={64}
          className={`${inputClass} font-english`}
          title="تقدر تختار من السيرفر أو تكتب إيموجي عادي"
        />
        {value ? (
          <button
            type="button"
            onClick={() => onChange('')}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-opus-border text-opus-muted transition hover:border-red-500/60 hover:text-red-400"
            title="مسح الإيموجي"
          >
            <X size={14} />
          </button>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="mt-2 flex w-full cursor-pointer select-none items-center justify-between rounded-lg border border-opus-border/70 bg-opus-bg/60 px-3 py-2 font-arabic text-[11px] font-bold text-opus-muted transition hover:border-opus-accent hover:text-opus-text"
      >
        <span>{selected ? `مختار: :${selected.name}:` : `اختيار من إيموجيات السيرفر (${emojis.length})`}</span>
        <ChevronDown size={14} className={`transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open ? (
        <div className="mt-2 rounded-xl border border-opus-border bg-opus-bg/80 p-2">
          <div className="relative">
            <Search className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-opus-muted" size={13} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="بحث باسم الإيموجي..."
              className={`${inputClass} pr-8`}
            />
          </div>
          {emojis.length ? (
            <div className={`mt-2 grid ${compact ? 'max-h-32' : 'max-h-44'} grid-cols-7 gap-1.5 overflow-y-auto rounded-lg p-1 sm:grid-cols-8`}>
              {filtered.map((emoji) => (
                <button
                  key={emoji.id}
                  type="button"
                  onClick={() => {
                    onChange(emoji.id);
                    setOpen(false);
                  }}
                  disabled={!emoji.available}
                  className={`grid h-9 place-items-center rounded-lg border transition ${value === emoji.id ? 'border-opus-accent bg-opus-accent/15' : 'border-opus-border bg-opus-surface/70 hover:border-opus-accent/70'} disabled:cursor-not-allowed disabled:opacity-35`}
                  title={`:${emoji.name}:`}
                >
                  <img src={emoji.url} alt={emoji.name} loading="lazy" className="h-6 w-6 object-contain" />
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-2 rounded-lg border border-dashed border-opus-border p-3 font-arabic text-[11px] leading-5 text-opus-muted">
              ما قدرنا نقرأ إيموجيات السيرفر. تقدر تكتب إيموجي عادي أو ID يدويًا، وتأكد أن البوت داخل السيرفر.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function PanelPreview({ settings, emojis }: { settings: Settings; emojis: GuildEmoji[] }) {
  const categories = (settings.categories || []).filter((category) => category.enabled && category.label.trim()).slice(0, 6);
  const buttons = normalizeButtons(settings.buttons);
  const previewMessage = settings.panel_message.trim() || 'مرحباً! اختر نوع طلبك من القائمة لفتح تذكرة، وسيتم خدمتك بأسرع وقت.';

  return (
    <div className="sticky top-24 overflow-hidden rounded-3xl border border-opus-border bg-[radial-gradient(circle_at_top,rgba(255,138,0,0.12),transparent_38%),var(--color-surface)] shadow-[0_20px_80px_rgba(0,0,0,0.35)]">
      <div className="border-b border-opus-border/80 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-opus-accent/40 bg-opus-accent/10 px-2.5 py-1 font-arabic text-[11px] font-extrabold text-opus-accent">
              <Eye size={12} /> معاينة مباشرة
            </span>
            <h4 className="mt-2 font-arabic text-sm font-extrabold text-opus-text">كيف بيظهر البنل للعميل</h4>
          </div>
          <div className="h-10 w-10 rounded-2xl border border-opus-border" style={{ background: settings.embed_color || '#5865F2' }} />
        </div>
      </div>

      <div className="p-4">
        {settings.banner_url ? (
          <img src={settings.banner_url} alt="Panel preview" className="max-h-44 w-full rounded-2xl border border-opus-border object-cover" />
        ) : (
          <div className="grid h-36 place-items-center rounded-2xl border border-dashed border-opus-border bg-opus-bg/70">
            <div className="text-center">
              <ImageIcon className="mx-auto text-opus-accent" size={24} />
              <p className="mt-2 font-arabic text-xs text-opus-muted">أضف صورة بنل احترافية</p>
            </div>
          </div>
        )}

        <div className="mt-4 rounded-2xl border border-opus-border bg-opus-bg/65 p-4" style={{ borderRightColor: settings.embed_color || '#5865F2', borderRightWidth: 4 }}>
          <p className="whitespace-pre-wrap font-arabic text-sm leading-7 text-opus-text">{previewMessage}</p>
          {settings.footer_text ? <p className="mt-3 border-t border-opus-border pt-2 font-arabic text-[11px] text-opus-muted">{settings.footer_text}</p> : null}
        </div>

        <div className="mt-3 rounded-2xl border border-opus-border bg-opus-bg/80 p-3">
          <div className="flex items-center justify-between rounded-xl border border-opus-border bg-opus-surface px-3 py-2 font-arabic text-sm font-bold text-opus-text">
            <span>{settings.button_text || 'اختر تصنيفاً...'}</span>
            <ChevronDown size={15} className="text-opus-muted" />
          </div>
          <div className="mt-2 grid gap-2">
            {categories.length ? categories.map((category) => (
              <div key={category.key} className="flex items-center gap-2 rounded-xl border border-opus-border/70 bg-opus-surface/65 p-2">
                <EmojiFace value={category.emoji || ''} emojis={emojis} className="h-8 w-8" />
                <div className="min-w-0">
                  <p className="truncate font-arabic text-xs font-extrabold text-opus-text">{category.label}</p>
                  <p className="truncate font-arabic text-[11px] text-opus-muted">{category.description || 'بدون وصف'}</p>
                </div>
              </div>
            )) : (
              <p className="rounded-xl border border-dashed border-opus-border p-3 text-center font-arabic text-xs text-opus-muted">فعّل تصنيف واحد على الأقل لظهور القائمة.</p>
            )}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          {(Object.keys(CONTROL_NAMES) as ControlKey[]).map((key) => (
            <div key={key} className={`flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2 font-arabic text-[11px] font-extrabold ${buttonStyleClass(buttons[key].style)}`}>
              <EmojiFace value={buttons[key].emoji || ''} emojis={emojis} className="h-5 w-5" />
              <span className="truncate">{buttons[key].label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function TicketSettingsEditor({ botId }: { botId: string }) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [s, setS] = useState<Settings>(DEFAULT_SETTINGS);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [guildCategories, setGuildCategories] = useState<GuildCategory[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [emojis, setEmojis] = useState<GuildEmoji[]>([]);
  const [guildError, setGuildError] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/dashboard/bot/${botId}/ticket-settings`, { cache: 'no-store' })
      .then((r) => r.json() as Promise<ApiResponse<{ settings: Settings | null; channels: Channel[] | null; categories: GuildCategory[] | null; roles: Role[] | null; emojis: GuildEmoji[] | null }>>)
      .then((res) => {
        if (!alive) return;
        if (res.success) {
          if (res.data.settings) {
            setS({
              ...DEFAULT_SETTINGS,
              ...res.data.settings,
              categories: res.data.settings.categories?.length ? res.data.settings.categories : DEFAULT_SETTINGS.categories,
              buttons: normalizeButtons(res.data.settings.buttons),
            });
          }
          if (res.data.channels) setChannels(res.data.channels);
          if (res.data.categories) setGuildCategories(res.data.categories);
          if (res.data.roles) setRoles(res.data.roles.filter((r) => !r.managed));
          if (res.data.emojis) setEmojis(res.data.emojis);
          if (!res.data.channels) setGuildError('ما قدرنا نقرأ رومات السيرفر — تأكد أن البوت داخل السيرفر. تقدر تحفظ باقي الإعدادات عادي.');
        } else {
          setMsg({ kind: 'err', text: res.error?.message || 'تعذّر جلب الإعدادات.' });
        }
        setLoading(false);
      })
      .catch(() => {
        if (!alive) return;
        setLoading(false);
        setMsg({ kind: 'err', text: 'تعذّر الاتصال.' });
      });
    return () => {
      alive = false;
    };
  }, [botId]);

  function setCategory(i: number, patch: Partial<Category>) {
    setS((p) => ({ ...p, categories: (p.categories || []).map((c, idx) => (idx === i ? { ...c, ...patch } : c)) }));
  }

  function setButton(key: ControlKey, patch: Partial<Control>) {
    setS((p) => ({
      ...p,
      buttons: {
        ...normalizeButtons(p.buttons),
        [key]: { ...normalizeButtons(p.buttons)[key], ...patch },
      },
    }));
  }

  function addPresetCategories() {
    setS((p) => {
      const current = p.categories || [];
      const next = [...current];
      for (const preset of CATEGORY_PRESETS) {
        if (next.length >= 25) break;
        if (!next.some((category) => category.key === preset.key)) next.push(preset);
      }
      return { ...p, categories: next };
    });
  }

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const cleanButtons = normalizeButtons(s.buttons);
      const res = await fetch(`/api/dashboard/bot/${botId}/ticket-settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf() },
        body: JSON.stringify({
          ...s,
          banner_url: s.banner_url || '',
          categories: (s.categories || []).filter((c) => c.label.trim()),
          buttons: cleanButtons,
        }),
      });
      const j = (await res.json()) as ApiResponse<{ updated: boolean }>;
      setMsg(j.success ? { kind: 'ok', text: 'تم الحفظ! البوت يطبّق الإعدادات ويحدّث البنل خلال دقيقة.' } : { kind: 'err', text: j.error?.message || 'تعذّر الحفظ — تأكد من صحة الحقول.' });
    } catch {
      setMsg({ kind: 'err', text: 'تعذّر الاتصال.' });
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="opus-card flex items-center justify-center gap-2 p-8 font-arabic text-sm text-opus-muted"><Loader2 className="animate-spin" size={16} /> جاري التحميل...</div>;
  }

  const input = 'w-full rounded-lg border border-opus-border bg-opus-bg px-3 py-2 font-arabic text-sm text-opus-text outline-none transition focus:border-opus-accent';
  const label = 'font-arabic text-xs font-bold text-opus-text';
  const hint = 'mt-1 font-arabic text-[11px] text-opus-muted';
  const buttons = normalizeButtons(s.buttons);
  const activeCategories = (s.categories || []).filter((category) => category.enabled && category.label.trim()).length;

  const channelSelect = (value: string | null, onChange: (v: string | null) => void) => (
    <select value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} className={input}>
      <option value="">— تلقائي (ينشئه البوت) —</option>
      {channels.map((c) => (
        <option key={c.id} value={c.id}>#{c.name}{c.parentName ? ` — ${c.parentName}` : ''}</option>
      ))}
    </select>
  );

  return (
    <div dir="rtl" className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="grid gap-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-opus-border bg-opus-surface/70 p-4">
            <div className="flex items-center gap-2 text-opus-accent"><Sparkles size={16} /><span className="font-arabic text-xs font-extrabold">التصنيفات المفعلة</span></div>
            <p className="mt-2 font-english text-2xl font-black text-opus-text">{activeCategories}<span className="text-sm text-opus-muted">/{(s.categories || []).length}</span></p>
          </div>
          <div className="rounded-2xl border border-opus-border bg-opus-surface/70 p-4">
            <div className="flex items-center gap-2 text-opus-accent"><Wand2 size={16} /><span className="font-arabic text-xs font-extrabold">إيموجيات السيرفر</span></div>
            <p className="mt-2 font-english text-2xl font-black text-opus-text">{emojis.length}</p>
          </div>
          <div className="rounded-2xl border border-opus-border bg-opus-surface/70 p-4">
            <div className="flex items-center gap-2 text-opus-accent"><CheckCircle2 size={16} /><span className="font-arabic text-xs font-extrabold">الحفظ المباشر</span></div>
            <p className="mt-2 font-arabic text-sm font-extrabold text-opus-text">تحديث تلقائي للبنل</p>
          </div>
        </div>

        {/* البنل */}
        <div className="opus-card overflow-hidden p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-arabic text-lg font-extrabold text-opus-text">شكل البنل</h3>
              <p className={hint}>صورة البنل، الرسالة، اللون، ونص القائمة — مع معاينة مباشرة على اليمين.</p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-opus-accent/40 bg-opus-accent/10 px-3 py-1 font-arabic text-[11px] font-bold text-opus-accent">
              <Palette size={12} /> Design Studio
            </span>
          </div>

          <div className="mt-4 grid gap-4">
            <div>
              <span className={label}>صورة البنل (رابط https)</span>
              <input value={s.banner_url ?? ''} onChange={(e) => setS((p) => ({ ...p, banner_url: e.target.value || null }))} placeholder="https://i.imgur.com/example.png" dir="ltr" className={`${input} mt-2 font-english`} />
              <p className={hint}>أفضل مقاس: 1600×500 أو 1200×400 بصيغة PNG/JPG.</p>
            </div>

            <div>
              <span className={label}>رسالة البنل</span>
              <p className={hint}>نص يظهر فوق قائمة فتح التذاكر.</p>
              <textarea value={s.panel_message} onChange={(e) => setS((p) => ({ ...p, panel_message: e.target.value }))} rows={4} maxLength={800} placeholder="مرحباً! اختر نوع طلبك من القائمة لفتح تذكرة." className={`${input} mt-2 resize-y leading-7`} />
              <p className="mt-1 text-left font-english text-[11px] text-opus-muted">{s.panel_message.length}/800</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <span className={label}>لون الإيمبد</span>
                <div className="mt-2 flex items-center gap-2">
                  <input type="color" value={s.embed_color} onChange={(e) => setS((p) => ({ ...p, embed_color: e.target.value }))} className="h-10 w-12 cursor-pointer rounded-lg border border-opus-border bg-opus-bg" />
                  <input value={s.embed_color} onChange={(e) => setS((p) => ({ ...p, embed_color: e.target.value }))} dir="ltr" className={`${input} font-english`} />
                </div>
              </div>
              <div>
                <span className={label}>نص قائمة فتح التذكرة</span>
                <input value={s.button_text} onChange={(e) => setS((p) => ({ ...p, button_text: e.target.value }))} maxLength={80} placeholder="اختر تصنيفاً..." className={`${input} mt-2`} />
              </div>
              <div>
                <span className={label}>نص الفوتر</span>
                <input value={s.footer_text} onChange={(e) => setS((p) => ({ ...p, footer_text: e.target.value }))} maxLength={160} placeholder="Ticket Bot" className={`${input} mt-2`} />
              </div>
            </div>
          </div>
        </div>

        {/* تصنيفات البنل */}
        <div className="opus-card p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-arabic text-lg font-extrabold text-opus-text">تصنيفات البنل</h3>
              <p className={hint}>كل تصنيف يظهر كخيار في قائمة البنل — اختر الإيموجي من إيموجيات السيرفر بدل نسخ ID.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={addPresetCategories}
                disabled={(s.categories || []).length >= 25}
                className="inline-flex items-center gap-1.5 rounded-lg border border-opus-border px-3 py-1.5 font-arabic text-xs font-bold text-opus-text transition hover:border-opus-accent disabled:opacity-40"
              >
                <Wand2 size={13} /> قوالب جاهزة
              </button>
              <button
                type="button"
                onClick={() => setS((p) => ({ ...p, categories: [...(p.categories || []), { key: newCategoryKey(p.categories || []), label: '', description: '', emoji: '', enabled: true }] }))}
                disabled={(s.categories || []).length >= 25}
                className="inline-flex items-center gap-1.5 rounded-lg border border-opus-border px-3 py-1.5 font-arabic text-xs font-bold text-opus-text transition hover:border-opus-accent disabled:opacity-40"
              >
                <Plus size={13} /> إضافة تصنيف
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-3">
            {(s.categories || []).map((c, i) => (
              <div key={c.key} className="rounded-2xl border border-opus-border bg-opus-bg/45 p-3">
                <div className="grid gap-3 lg:grid-cols-[auto_220px_minmax(0,1fr)_minmax(0,1.2fr)_auto] lg:items-start">
                  <label className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-opus-border bg-opus-surface/60 px-3 py-2" title="مفعّل">
                    <input type="checkbox" checked={c.enabled} onChange={(e) => setCategory(i, { enabled: e.target.checked })} className="h-4 w-4 accent-[var(--color-accent,#ff8a00)]" />
                    <span className="font-arabic text-[11px] text-opus-muted">مفعّل</span>
                  </label>
                  <EmojiPicker value={c.emoji || ''} onChange={(value) => setCategory(i, { emoji: value })} emojis={emojis} inputClass={input} compact />
                  <div>
                    <span className="mb-1 block font-arabic text-[11px] font-bold text-opus-muted">اسم التصنيف</span>
                    <input value={c.label} onChange={(e) => setCategory(i, { label: e.target.value })} placeholder="اسم التصنيف" maxLength={80} className={input} />
                  </div>
                  <div>
                    <span className="mb-1 block font-arabic text-[11px] font-bold text-opus-muted">الوصف</span>
                    <input value={c.description} onChange={(e) => setCategory(i, { description: e.target.value })} placeholder="وصف قصير للتصنيف" maxLength={100} className={input} />
                  </div>
                  <button
                    type="button"
                    onClick={() => setS((p) => ({ ...p, categories: (p.categories || []).filter((_, idx) => idx !== i) }))}
                    disabled={(s.categories || []).length <= 1}
                    className="inline-flex h-10 items-center justify-center rounded-lg border border-opus-border px-3 text-opus-muted transition hover:border-red-500/60 hover:text-red-400 disabled:opacity-30"
                    title="حذف التصنيف"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                {CUSTOM_EMOJI_ID_RE.test(c.emoji || '') ? (
                  <p className="mt-2 font-arabic text-[11px] text-emerald-400">تم اختيار إيموجي مخصص من السيرفر، وسيُحفظ كـ ID آمن للبوت.</p>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        {/* أزرار التذكرة */}
        <div className="opus-card p-5 sm:p-6">
          <h3 className="font-arabic text-lg font-extrabold text-opus-text">أزرار التحكم داخل التذكرة</h3>
          <p className={hint}>نص، لون، وإيموجي كل زر يظهر داخل التذكرة المفتوحة.</p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {(Object.keys(CONTROL_NAMES) as ControlKey[]).map((key) => (
              <div key={key} className="rounded-2xl border border-opus-border bg-opus-bg/45 p-3">
                <span className={label}>{CONTROL_NAMES[key]}</span>
                <div className="mt-2 grid gap-2">
                  <EmojiPicker value={buttons[key].emoji || ''} onChange={(value) => setButton(key, { emoji: value })} emojis={emojis} inputClass={input} compact />
                  <div className="flex gap-2">
                    <input value={buttons[key].label} onChange={(e) => setButton(key, { label: e.target.value })} maxLength={80} className={input} />
                    <select value={buttons[key].style} onChange={(e) => setButton(key, { style: e.target.value as ButtonStyle })} className={`${input} w-28 shrink-0`}>
                      {STYLE_NAMES.map((st) => (
                        <option key={st.value} value={st.value}>{st.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* الرومات والرتب */}
        <div className="opus-card p-5 sm:p-6">
          <h3 className="font-arabic text-lg font-extrabold text-opus-text">الرومات والرتب</h3>
          <p className={hint}>اتركها «تلقائي» والبوت ينشئها بنفسه، أو اختر رومات ورتب موجودة.</p>

          {guildError ? (
            <div className="mt-3 rounded-xl border border-[#f59e0b]/60 bg-[#f59e0b]/5 p-3 font-arabic text-xs leading-6 text-[#f59e0b]">{guildError}</div>
          ) : null}

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <span className={label}>روم البنل</span>
              <div className="mt-2">{channelSelect(s.panel_channel_id, (v) => setS((p) => ({ ...p, panel_channel_id: v })))}</div>
            </div>
            <div>
              <span className={label}>روم اللوق</span>
              <div className="mt-2">{channelSelect(s.log_channel_id, (v) => setS((p) => ({ ...p, log_channel_id: v })))}</div>
            </div>
            <div>
              <span className={label}>روم التوثيق (Transcripts)</span>
              <div className="mt-2">{channelSelect(s.transcript_channel_id, (v) => setS((p) => ({ ...p, transcript_channel_id: v })))}</div>
            </div>
            <div>
              <span className={label}>رتبة الدعم</span>
              <select value={s.support_role_id ?? ''} onChange={(e) => setS((p) => ({ ...p, support_role_id: e.target.value || null }))} className={`${input} mt-2`}>
                <option value="">— بدون —</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>@{r.name}</option>
                ))}
              </select>
            </div>
            <div>
              <span className={label}>كاتقوري التذاكر المفتوحة</span>
              <select value={s.ticket_category_id ?? ''} onChange={(e) => setS((p) => ({ ...p, ticket_category_id: e.target.value || null }))} className={`${input} mt-2`}>
                <option value="">— تلقائي (ينشئه البوت) —</option>
                {guildCategories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <span className={label}>كاتقوري الأرشيف</span>
              <select value={s.archive_category_id ?? ''} onChange={(e) => setS((p) => ({ ...p, archive_category_id: e.target.value || null }))} className={`${input} mt-2`}>
                <option value="">— تلقائي (ينشئه البوت) —</option>
                {guildCategories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="sticky bottom-4 z-20 rounded-2xl border border-opus-border bg-opus-surface/95 p-3 shadow-[0_15px_50px_rgba(0,0,0,0.35)] backdrop-blur">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={save}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-xl bg-opus-accent px-6 py-2.5 font-arabic text-sm font-extrabold text-black transition hover:opacity-90 disabled:opacity-50"
            >
              {busy ? <Loader2 className="animate-spin" size={15} /> : null} حفظ وتحديث البنل
            </button>
            {msg ? (
              <span className={`font-arabic text-xs font-bold ${msg.kind === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}>{msg.text}</span>
            ) : <span className="font-arabic text-xs text-opus-muted">أي تعديل تحفظه هنا ينعكس على البوت تلقائيًا.</span>}
          </div>
        </div>
      </div>

      <aside className="hidden lg:block">
        <PanelPreview settings={s} emojis={emojis} />
      </aside>
    </div>
  );
}
