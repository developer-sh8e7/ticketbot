'use client';

import { useEffect, useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';

type ApiResponse<T> = { success: true; data: T } | { success: false; error?: { message?: string } };

type ButtonStyle = 'Primary' | 'Secondary' | 'Success' | 'Danger';
type ControlKey = 'close' | 'add' | 'remove' | 'claim' | 'pin';
type Control = { label: string; style: ButtonStyle };
type Category = { key: string; label: string; description: string; emoji: string; enabled: boolean };

type Channel = { id: string; name: string; parentName?: string | null };
type GuildCategory = { id: string; name: string };
type Role = { id: string; name: string; managed: boolean };

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
  buttons?: Partial<Record<ControlKey, Control>>;
};

const DEFAULT_BUTTONS: Record<ControlKey, Control> = {
  close: { label: 'إغلاق', style: 'Danger' },
  add: { label: 'إضافة', style: 'Success' },
  remove: { label: 'حذف', style: 'Danger' },
  claim: { label: 'استلام', style: 'Primary' },
  pin: { label: 'تثبيت', style: 'Secondary' },
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

function csrf() {
  const m = document.cookie.match(/(?:^|;\s*)opus_csrf=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : '';
}

function newCategoryKey(existing: Category[]): string {
  let n = existing.length + 1;
  while (existing.some((c) => c.key === `cat_${n}`)) n += 1;
  return `cat_${n}`;
}

export function TicketSettingsEditor({ botId }: { botId: string }) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [s, setS] = useState<Settings>(DEFAULT_SETTINGS);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [guildCategories, setGuildCategories] = useState<GuildCategory[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [guildError, setGuildError] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/dashboard/bot/${botId}/ticket-settings`, { cache: 'no-store' })
      .then((r) => r.json() as Promise<ApiResponse<{ settings: Settings | null; channels: Channel[] | null; categories: GuildCategory[] | null; roles: Role[] | null }>>)
      .then((res) => {
        if (!alive) return;
        if (res.success) {
          if (res.data.settings) {
            setS({
              ...DEFAULT_SETTINGS,
              ...res.data.settings,
              categories: res.data.settings.categories?.length ? res.data.settings.categories : DEFAULT_SETTINGS.categories,
              buttons: { ...DEFAULT_BUTTONS, ...(res.data.settings.buttons || {}) },
            });
          }
          if (res.data.channels) setChannels(res.data.channels);
          if (res.data.categories) setGuildCategories(res.data.categories);
          if (res.data.roles) setRoles(res.data.roles.filter((r) => !r.managed));
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
    setS((p) => ({ ...p, buttons: { ...DEFAULT_BUTTONS, ...(p.buttons || {}), [key]: { ...DEFAULT_BUTTONS[key], ...(p.buttons?.[key] || {}), ...patch } } }));
  }

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/dashboard/bot/${botId}/ticket-settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf() },
        body: JSON.stringify({ ...s, banner_url: s.banner_url || '', categories: (s.categories || []).filter((c) => c.label.trim()) }),
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

  const input = 'w-full rounded-lg border border-opus-border bg-opus-bg px-3 py-2 font-arabic text-sm text-opus-text outline-none focus:border-opus-accent';
  const label = 'font-arabic text-xs font-bold text-opus-text';
  const hint = 'mt-1 font-arabic text-[11px] text-opus-muted';
  const buttons = { ...DEFAULT_BUTTONS, ...(s.buttons || {}) };

  const channelSelect = (value: string | null, onChange: (v: string | null) => void) => (
    <select value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} className={input}>
      <option value="">— تلقائي (ينشئه البوت) —</option>
      {channels.map((c) => (
        <option key={c.id} value={c.id}>#{c.name}{c.parentName ? ` — ${c.parentName}` : ''}</option>
      ))}
    </select>
  );

  return (
    <div dir="rtl" className="grid gap-5">
      {/* البنل */}
      <div className="opus-card p-5 sm:p-6">
        <h3 className="font-arabic text-base font-extrabold text-opus-text">شكل البنل</h3>
        <p className={hint}>صورة البنل، الرسالة، واللون — التغييرات تنعكس على رسالة البنل في السيرفر.</p>

        <div className="mt-4 grid gap-4">
          <div>
            <span className={label}>صورة البنل (رابط https)</span>
            <input value={s.banner_url ?? ''} onChange={(e) => setS((p) => ({ ...p, banner_url: e.target.value || null }))} placeholder="https://i.imgur.com/example.png" dir="ltr" className={`${input} mt-2 font-english`} />
            {s.banner_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.banner_url} alt="معاينة صورة البنل" className="mt-3 max-h-48 w-full rounded-xl border border-opus-border object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            ) : null}
          </div>

          <div>
            <span className={label}>رسالة البنل</span>
            <p className={hint}>نص يظهر فوق قائمة فتح التذاكر.</p>
            <textarea value={s.panel_message} onChange={(e) => setS((p) => ({ ...p, panel_message: e.target.value }))} rows={3} maxLength={800} placeholder="مرحباً! اختر نوع طلبك من القائمة لفتح تذكرة." className={`${input} mt-2 resize-y`} />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <span className={label}>لون الإيمبد</span>
              <div className="mt-2 flex items-center gap-2">
                <input type="color" value={s.embed_color} onChange={(e) => setS((p) => ({ ...p, embed_color: e.target.value }))} className="h-9 w-12 cursor-pointer rounded-lg border border-opus-border bg-opus-bg" />
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
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-arabic text-base font-extrabold text-opus-text">تصنيفات البنل (خيارات القائمة)</h3>
            <p className={hint}>كل تصنيف يظهر كخيار في قائمة البنل — الاسم، الوصف، والإيموجي.</p>
          </div>
          <button
            type="button"
            onClick={() => setS((p) => ({ ...p, categories: [...(p.categories || []), { key: newCategoryKey(p.categories || []), label: '', description: '', emoji: '', enabled: true }] }))}
            disabled={(s.categories || []).length >= 25}
            className="inline-flex items-center gap-1.5 rounded-lg border border-opus-border px-3 py-1.5 font-arabic text-xs font-bold text-opus-text transition hover:border-opus-accent disabled:opacity-40"
          >
            <Plus size={13} /> إضافة تصنيف
          </button>
        </div>

        <div className="mt-4 grid gap-3">
          {(s.categories || []).map((c, i) => (
            <div key={c.key} className="grid gap-2 rounded-xl border border-opus-border bg-opus-bg/45 p-3 sm:grid-cols-[auto_5rem_1fr_1.5fr_auto] sm:items-center">
              <label className="flex cursor-pointer items-center gap-1.5" title="مفعّل">
                <input type="checkbox" checked={c.enabled} onChange={(e) => setCategory(i, { enabled: e.target.checked })} className="h-4 w-4 accent-[var(--color-accent,#ddff00)]" />
                <span className="font-arabic text-[11px] text-opus-muted sm:hidden">مفعّل</span>
              </label>
              <input value={c.emoji} onChange={(e) => setCategory(i, { emoji: e.target.value })} placeholder="🎫" maxLength={64} className={`${input} text-center`} title="إيموجي (أو ID إيموجي مخصص)" />
              <input value={c.label} onChange={(e) => setCategory(i, { label: e.target.value })} placeholder="اسم التصنيف" maxLength={80} className={input} />
              <input value={c.description} onChange={(e) => setCategory(i, { description: e.target.value })} placeholder="وصف قصير للتصنيف" maxLength={100} className={input} />
              <button
                type="button"
                onClick={() => setS((p) => ({ ...p, categories: (p.categories || []).filter((_, idx) => idx !== i) }))}
                disabled={(s.categories || []).length <= 1}
                className="inline-flex items-center justify-center rounded-lg border border-opus-border p-2 text-opus-muted transition hover:border-red-500/60 hover:text-red-400 disabled:opacity-30"
                title="حذف التصنيف"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* أزرار التذكرة */}
      <div className="opus-card p-5 sm:p-6">
        <h3 className="font-arabic text-base font-extrabold text-opus-text">أزرار التحكم داخل التذكرة</h3>
        <p className={hint}>نص ولون كل زر يظهر داخل التذكرة المفتوحة.</p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {(Object.keys(CONTROL_NAMES) as ControlKey[]).map((key) => (
            <div key={key} className="rounded-xl border border-opus-border bg-opus-bg/45 p-3">
              <span className={label}>{CONTROL_NAMES[key]}</span>
              <div className="mt-2 flex gap-2">
                <input value={buttons[key].label} onChange={(e) => setButton(key, { label: e.target.value })} maxLength={80} className={input} />
                <select value={buttons[key].style} onChange={(e) => setButton(key, { style: e.target.value as ButtonStyle })} className={`${input} w-28 shrink-0`}>
                  {STYLE_NAMES.map((st) => (
                    <option key={st.value} value={st.value}>{st.label}</option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* الرومات والرتب */}
      <div className="opus-card p-5 sm:p-6">
        <h3 className="font-arabic text-base font-extrabold text-opus-text">الرومات والرتب</h3>
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

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-xl bg-opus-accent px-6 py-2.5 font-arabic text-sm font-extrabold text-black transition hover:opacity-90 disabled:opacity-50"
        >
          {busy ? <Loader2 className="animate-spin" size={15} /> : null} حفظ الإعدادات
        </button>
        {msg ? (
          <span className={`font-arabic text-xs font-bold ${msg.kind === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}>{msg.text}</span>
        ) : null}
      </div>
    </div>
  );
}
