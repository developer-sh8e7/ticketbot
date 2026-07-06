'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Gavel, KeyRound, Loader2, Power, Search, ShieldCheck, UserPlus, Users } from 'lucide-react';

type ApiResponse<T> = { success: true; data: T } | { success: false; error?: { message?: string } };
type Role = { id: string; name: string; position: number; color: number; managed: boolean };
type JailConfig = { enabled: boolean; allowedRoleIds: string[]; allowedUserIds: string[]; controlChannelId: string; jailRoleId: string; updatedAt: string | null };
type ActiveJail = { id: string; user_id: string; jailed_by_id: string; reason: string | null; started_at: string; expires_at: string };
type Delegate = { user_id: string; granted_by_id: string; created_at: string };
type Audit = { id: number; actor_id: string | null; target_user_id: string | null; action: string; reason: string | null; created_at: string };

function csrf() {
  const m = document.cookie.match(/(?:^|;\s*)opus_csrf=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : '';
}

function extractIds(input: string) {
  return Array.from(new Set(input.match(/\d{17,20}/g) ?? []));
}

function actionLabel(action: string) {
  const labels: Record<string, string> = {
    jail: 'سجن',
    release: 'إطلاق',
    auto_release: 'إطلاق تلقائي',
    delegate_grant: 'تفويض',
    delegate_revoke: 'سحب تفويض',
  };
  return labels[action] ?? action;
}

export function JailSystemEditor({ botId }: { botId: string }) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [roles, setRoles] = useState<Role[]>([]);
  const [config, setConfig] = useState<JailConfig>({ enabled: false, allowedRoleIds: [], allowedUserIds: [], controlChannelId: '', jailRoleId: '', updatedAt: null });
  const [activeJails, setActiveJails] = useState<ActiveJail[]>([]);
  const [delegates, setDelegates] = useState<Delegate[]>([]);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [roleSearch, setRoleSearch] = useState('');
  const [userInput, setUserInput] = useState('');
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  async function load() {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/dashboard/bot/${botId}/jail`, { cache: 'no-store' });
      const j = (await res.json()) as ApiResponse<{ config: JailConfig; roles: Role[]; activeJails: ActiveJail[]; delegates: Delegate[]; audit: Audit[] }>;
      if (!j.success) {
        setMsg({ kind: 'err', text: j.error?.message || 'تعذّر جلب نظام السجن.' });
        return;
      }
      setConfig(j.data.config);
      setUserInput(j.data.config.allowedUserIds.join('\n'));
      setRoles(j.data.roles);
      setActiveJails(j.data.activeJails);
      setDelegates(j.data.delegates);
      setAudit(j.data.audit);
    } catch {
      setMsg({ kind: 'err', text: 'تعذّر الاتصال بنظام السجن.' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botId]);

  const filteredRoles = useMemo(() => {
    const q = roleSearch.trim().toLowerCase();
    return q ? roles.filter((r) => r.name.toLowerCase().includes(q) || r.id.includes(q)) : roles;
  }, [roles, roleSearch]);

  function patch(p: Partial<JailConfig>) {
    setConfig((prev) => ({ ...prev, ...p }));
  }

  function toggleRole(roleId: string) {
    const exists = config.allowedRoleIds.includes(roleId);
    patch({ allowedRoleIds: exists ? config.allowedRoleIds.filter((id) => id !== roleId) : [...config.allowedRoleIds, roleId] });
  }

  async function save() {
    setBusy(true);
    setMsg(null);
    const allowedUserIds = userInput.trim() ? extractIds(userInput) : config.allowedUserIds;
    try {
      const res = await fetch(`/api/dashboard/bot/${botId}/jail`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf() },
        body: JSON.stringify({ enabled: config.enabled, allowedRoleIds: config.allowedRoleIds, allowedUserIds }),
      });
      const j = (await res.json()) as ApiResponse<{ saved: boolean; config: JailConfig }>;
      if (j.success) {
        setConfig(j.data.config);
        setUserInput(j.data.config.allowedUserIds.join('\n'));
        setMsg({ kind: 'ok', text: 'تم حفظ نظام السجن. البوت ينشئ/يحدّث روم سجن-تحكم ورتبة مسجون تلقائياً خلال أقل من دقيقة.' });
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
    return <div className="opus-card flex items-center justify-center gap-2 p-8 font-arabic text-sm text-opus-muted"><Loader2 className="animate-spin" size={16} /> جاري تحميل نظام السجن...</div>;
  }

  return (
    <div dir="rtl" className="opus-card overflow-hidden p-0">
      <div className="border-b border-opus-border bg-[radial-gradient(circle_at_top_left,rgba(239,68,68,0.14),transparent_35%),var(--color-surface)] p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-red-400/40 bg-red-400/10 px-3 py-1 font-arabic text-xs font-extrabold text-red-300">
              <Gavel size={13} /> نظام السجن
            </span>
            <h3 className="mt-3 font-arabic text-lg font-extrabold text-opus-text">إدارة السجن من الداشبورد</h3>
            <p className="mt-1 max-w-2xl font-arabic text-xs leading-6 text-opus-muted">
              فعّل الميزة وحدد الرتب/الأشخاص المسموحين. داخل Discord يظهر روم خاص باسم <span className="font-english">سجن-تحكم</span> وأمر بدون بريفكس: <b>سجن</b>.
            </p>
          </div>
          <label className="flex cursor-pointer select-none items-center gap-2.5 rounded-2xl border border-opus-border bg-opus-bg px-3 py-2">
            <Power size={14} className={config.enabled ? 'text-opus-accent-2' : 'text-red-300'} />
            <span className="font-arabic text-xs font-bold text-opus-text">{config.enabled ? 'مفعّل' : 'متوقف'}</span>
            <span className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-opus-border bg-opus-surface">
              <input type="checkbox" checked={config.enabled} onChange={(e) => patch({ enabled: e.target.checked })} className="peer absolute inset-0 z-10 cursor-pointer opacity-0" />
              <span className="absolute right-0.5 h-4 w-4 rounded-full bg-opus-muted transition-all duration-200 peer-checked:right-[1.625rem] peer-checked:bg-opus-accent" />
            </span>
          </label>
        </div>
      </div>

      <div className="grid gap-5 p-5 sm:p-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-opus-border bg-opus-bg/50 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-2 font-arabic text-sm font-extrabold text-opus-text"><ShieldCheck size={16} className="text-opus-accent-2" /> الرتب المسموحة من الداشبورد</p>
            <span className="font-english text-xs text-opus-muted">{config.allowedRoleIds.length}</span>
          </div>
          <div className="relative mt-3">
            <Search size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-opus-muted" />
            <input value={roleSearch} onChange={(e) => setRoleSearch(e.target.value)} placeholder="ابحث عن رتبة..." className="w-full rounded-xl border border-opus-border bg-opus-surface px-3 py-2 pr-9 font-arabic text-sm text-opus-text outline-none focus:border-opus-accent" />
          </div>
          <div className="mt-3 max-h-72 overflow-y-auto rounded-xl border border-opus-border bg-opus-surface/60 p-2">
            {filteredRoles.map((role) => {
              const selected = config.allowedRoleIds.includes(role.id);
              return (
                <button key={role.id} type="button" onClick={() => toggleRole(role.id)} className={`mb-2 flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-right transition last:mb-0 ${selected ? 'border-opus-accent bg-opus-accent/10' : 'border-opus-border bg-opus-bg hover:border-opus-accent-2/60'}`}>
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: role.color ? `#${role.color.toString(16).padStart(6, '0')}` : '#6b7280' }} />
                    <span className="min-w-0">
                      <span className="block truncate font-arabic text-sm font-bold text-opus-text">{role.name}</span>
                      <span className="font-english text-[10px] text-opus-muted">pos {role.position}{role.managed ? ' · managed' : ''}</span>
                    </span>
                  </span>
                  {selected ? <Check size={15} className="text-opus-accent" /> : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-opus-border bg-opus-bg/50 p-4">
          <p className="flex items-center gap-2 font-arabic text-sm font-extrabold text-opus-text"><UserPlus size={16} className="text-opus-accent-2" /> أشخاص مسموحين من الداشبورد</p>
          <p className="mt-1 font-arabic text-[11px] leading-5 text-opus-muted">اكتب Discord User ID أو منشن. المصرحون يقدرون يفوضون أعضاء إضافيين من روم سجن-تحكم.</p>
          <textarea value={userInput} onChange={(e) => setUserInput(e.target.value)} dir="ltr" rows={8} placeholder={'1397364822152315052\n<@123456789012345678>'} className="mt-3 w-full resize-y rounded-xl border border-opus-border bg-opus-surface px-3 py-2 font-english text-sm leading-6 text-opus-text outline-none focus:border-opus-accent" />
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl border border-opus-border bg-opus-surface/60 p-3"><p className="font-arabic text-xs font-bold text-opus-muted">روم التحكم</p><p className="mt-1 font-english text-[11px] text-opus-text">{config.controlChannelId || 'ينشئه البوت تلقائياً'}</p></div>
            <div className="rounded-xl border border-opus-border bg-opus-surface/60 p-3"><p className="font-arabic text-xs font-bold text-opus-muted">رتبة مسجون</p><p className="mt-1 font-english text-[11px] text-opus-text">{config.jailRoleId || 'ينشئها البوت تلقائياً'}</p></div>
          </div>
        </div>
      </div>

      <div className="grid gap-5 border-t border-opus-border p-5 sm:p-6 xl:grid-cols-3">
        <div className="rounded-2xl border border-opus-border bg-opus-bg/50 p-4">
          <p className="flex items-center gap-2 font-arabic text-sm font-extrabold text-opus-text"><Gavel size={16} className="text-red-300" /> السجناء الحاليون</p>
          <div className="mt-3 space-y-2">
            {activeJails.length ? activeJails.map((j) => <div key={j.id} className="rounded-xl border border-opus-border bg-opus-surface/60 p-3"><p className="font-english text-xs text-opus-text">{j.user_id}</p><p className="mt-1 font-arabic text-[11px] text-opus-muted">ينتهي: {new Date(j.expires_at).toLocaleString('ar')}</p></div>) : <p className="font-arabic text-xs text-opus-muted">لا يوجد سجناء نشطين.</p>}
          </div>
        </div>
        <div className="rounded-2xl border border-opus-border bg-opus-bg/50 p-4">
          <p className="flex items-center gap-2 font-arabic text-sm font-extrabold text-opus-text"><KeyRound size={16} className="text-opus-accent-2" /> التفويضات من Discord</p>
          <div className="mt-3 space-y-2">
            {delegates.length ? delegates.slice(0, 8).map((d) => <div key={d.user_id} className="rounded-xl border border-opus-border bg-opus-surface/60 p-3"><p className="font-english text-xs text-opus-text">{d.user_id}</p><p className="mt-1 font-arabic text-[11px] text-opus-muted">بواسطة {d.granted_by_id}</p></div>) : <p className="font-arabic text-xs text-opus-muted">لا يوجد تفويضات إضافية.</p>}
          </div>
        </div>
        <div className="rounded-2xl border border-opus-border bg-opus-bg/50 p-4">
          <p className="flex items-center gap-2 font-arabic text-sm font-extrabold text-opus-text"><Users size={16} className="text-opus-accent" /> سجل التدقيق</p>
          <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">
            {audit.length ? audit.slice(0, 12).map((a) => <div key={a.id} className="rounded-xl border border-opus-border bg-opus-surface/60 p-3"><p className="font-arabic text-xs font-bold text-opus-text">{actionLabel(a.action)} <span className="font-english text-opus-muted">{a.target_user_id || ''}</span></p><p className="mt-1 font-arabic text-[11px] text-opus-muted">{a.reason || 'بدون سبب'} · {new Date(a.created_at).toLocaleString('ar')}</p></div>) : <p className="font-arabic text-xs text-opus-muted">لا يوجد سجل بعد.</p>}
          </div>
        </div>
      </div>

      {msg ? <p className={`mx-5 mb-4 rounded-xl border px-3 py-2 font-arabic text-xs leading-6 sm:mx-6 ${msg.kind === 'ok' ? 'border-opus-accent-2 text-opus-accent-2' : 'border-[#f59e0b] text-[#f59e0b]'}`}>{msg.text}</p> : null}
      <div className="border-t border-opus-border p-5 sm:p-6">
        <button type="button" onClick={save} disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-opus-accent px-5 py-3 font-arabic text-sm font-extrabold text-black transition hover:opacity-90 disabled:opacity-60 sm:w-auto">
          {busy ? <Loader2 className="animate-spin" size={15} /> : <Check size={15} />} حفظ نظام السجن
        </button>
      </div>
    </div>
  );
}
