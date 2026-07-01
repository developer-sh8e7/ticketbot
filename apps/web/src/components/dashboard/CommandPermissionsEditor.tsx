'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Crown, Loader2, Power, Search, ShieldCheck, UserPlus, Users } from 'lucide-react';

type ApiResponse<T> = { success: true; data: T } | { success: false; error?: { message?: string } };
type CommandInfo = { name: string; label: string; description: string; risk: 'low' | 'medium' | 'high' | 'danger' };
type Role = { id: string; name: string; position: number; color: number; managed: boolean };
type Setting = { commandName: string; enabled: boolean; allowedRoleIds: string[]; allowedUserIds: string[] };

function csrf() {
  const m = document.cookie.match(/(?:^|;\s*)opus_csrf=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : '';
}

const riskClass: Record<CommandInfo['risk'], string> = {
  low: 'border-emerald-400/40 text-emerald-300',
  medium: 'border-opus-accent-2/40 text-opus-accent-2',
  high: 'border-amber-400/50 text-amber-300',
  danger: 'border-red-400/50 text-red-300',
};

const riskLabel: Record<CommandInfo['risk'], string> = {
  low: 'خفيف',
  medium: 'متوسط',
  high: 'حساس',
  danger: 'خطير',
};

function extractIds(input: string) {
  return Array.from(new Set(input.match(/\d{17,20}/g) ?? []));
}

export function CommandPermissionsEditor({ botId }: { botId: string }) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [commands, setCommands] = useState<CommandInfo[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [settings, setSettings] = useState<Record<string, Setting>>({});
  const [activeName, setActiveName] = useState('ban');
  const [roleSearch, setRoleSearch] = useState('');
  const [userInput, setUserInput] = useState('');
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch(`/api/dashboard/bot/${botId}/command-settings`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((j: ApiResponse<{ commands: CommandInfo[]; roles: Role[]; settings: Setting[] }>) => {
        if (!alive) return;
        if (!j.success) {
          setMsg({ kind: 'err', text: j.error?.message || 'تعذّر جلب إعدادات الأوامر.' });
          return;
        }
        setCommands(j.data.commands);
        setRoles(j.data.roles);
        const next = Object.fromEntries(j.data.settings.map((s) => [s.commandName, s]));
        setSettings(next);
        setActiveName(j.data.commands[0]?.name ?? 'ban');
      })
      .catch(() => setMsg({ kind: 'err', text: 'تعذّر الاتصال بإعدادات الأوامر.' }))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [botId]);

  const activeCommand = commands.find((c) => c.name === activeName) ?? commands[0];
  const active = settings[activeName] ?? { commandName: activeName, enabled: true, allowedRoleIds: [], allowedUserIds: [] };

  const filteredRoles = useMemo(() => {
    const q = roleSearch.trim().toLowerCase();
    return q ? roles.filter((r) => r.name.toLowerCase().includes(q) || r.id.includes(q)) : roles;
  }, [roles, roleSearch]);

  function patchActive(patch: Partial<Setting>) {
    setSettings((prev) => ({ ...prev, [activeName]: { ...active, ...patch } }));
  }

  function toggleRole(roleId: string) {
    const exists = active.allowedRoleIds.includes(roleId);
    patchActive({ allowedRoleIds: exists ? active.allowedRoleIds.filter((id) => id !== roleId) : [...active.allowedRoleIds, roleId] });
  }

  function applyUsersFromInput() {
    patchActive({ allowedUserIds: extractIds(userInput) });
  }

  async function save() {
    if (!activeCommand) return;
    setBusy(true);
    setMsg(null);
    const userIds = userInput.trim() ? extractIds(userInput) : active.allowedUserIds;
    try {
      const res = await fetch(`/api/dashboard/bot/${botId}/command-settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf() },
        body: JSON.stringify({ ...active, allowedUserIds: userIds }),
      });
      const j = (await res.json()) as ApiResponse<{ saved: boolean; setting: Setting }>;
      if (j.success) {
        setSettings((prev) => ({ ...prev, [j.data.setting.commandName]: j.data.setting }));
        setUserInput(j.data.setting.allowedUserIds.join('\n'));
        setMsg({ kind: 'ok', text: 'تم حفظ صلاحيات الأمر. البوت يطبّقها خلال أقل من دقيقة.' });
      } else {
        setMsg({ kind: 'err', text: j.error?.message || 'تعذّر الحفظ.' });
      }
    } catch {
      setMsg({ kind: 'err', text: 'تعذّر الاتصال.' });
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    setUserInput(active.allowedUserIds.join('\n'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeName]);

  if (loading) {
    return <div className="opus-card flex items-center justify-center gap-2 p-8 font-arabic text-sm text-opus-muted"><Loader2 className="animate-spin" size={16} /> جاري تحميل مركز الأوامر...</div>;
  }

  if (!activeCommand) return null;

  const customEnabled = active.allowedRoleIds.length > 0 || active.allowedUserIds.length > 0;

  return (
    <div dir="rtl" className="opus-card overflow-hidden p-0">
      <div className="border-b border-opus-border bg-[radial-gradient(circle_at_top_left,rgba(45,206,137,0.12),transparent_35%),var(--color-surface)] p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-opus-accent/40 bg-opus-accent/10 px-3 py-1 font-arabic text-xs font-extrabold text-opus-accent">
              <Crown size={13} /> مركز أوامر السيستم
            </span>
            <h3 className="mt-3 font-arabic text-lg font-extrabold text-opus-text">صلاحيات كل أمر من الداشبورد</h3>
            <p className="mt-1 max-w-2xl font-arabic text-xs leading-6 text-opus-muted">
              اختر من يقدر يستخدم كل أمر: رتب معيّنة أو أشخاص معيّنين. لو ما اخترت أي رتبة/شخص يرجع الأمر لصلاحيات Discord الأصلية.
            </p>
          </div>
          <div className="rounded-2xl border border-amber-400/40 bg-amber-400/5 px-3 py-2 font-arabic text-[11px] leading-5 text-amber-300">
            مهم: الباند/الطرد ما يشتغل على عضو رتبته أعلى أو مساوية لرتبة البوت. ارفع رتبة البوت فوق رتب الإدارة.
          </div>
        </div>
      </div>

      <div className="grid gap-0 lg:grid-cols-[310px_1fr]">
        <aside className="border-b border-opus-border p-4 lg:border-b-0 lg:border-l">
          <div className="grid max-h-[560px] gap-2 overflow-y-auto pr-1">
            {commands.map((cmd) => {
              const selected = cmd.name === activeName;
              const s = settings[cmd.name];
              const locked = s?.enabled === false;
              return (
                <button
                  key={cmd.name}
                  type="button"
                  onClick={() => setActiveName(cmd.name)}
                  className={`rounded-2xl border p-3 text-right transition ${selected ? 'border-opus-accent bg-opus-accent/10' : 'border-opus-border bg-opus-bg/50 hover:border-opus-accent-2/60'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-arabic text-sm font-extrabold text-opus-text">{cmd.label}</span>
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 font-arabic text-[10px] font-bold ${riskClass[cmd.risk]}`}>{riskLabel[cmd.risk]}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 font-arabic text-[11px] leading-5 text-opus-muted">{cmd.description}</p>
                  <p className={`mt-2 font-arabic text-[10px] font-bold ${locked ? 'text-red-300' : s && (s.allowedRoleIds.length || s.allowedUserIds.length) ? 'text-opus-accent-2' : 'text-opus-muted'}`}>
                    {locked ? 'مقفّل' : s && (s.allowedRoleIds.length || s.allowedUserIds.length) ? 'مخصص' : 'افتراضي'}
                  </p>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h4 className="font-arabic text-xl font-extrabold text-opus-text">{activeCommand.label}</h4>
              <p className="mt-1 font-arabic text-sm leading-7 text-opus-muted">{activeCommand.description}</p>
            </div>
            <label className="flex cursor-pointer select-none items-center gap-2.5 rounded-2xl border border-opus-border bg-opus-bg px-3 py-2">
              <Power size={14} className={active.enabled ? 'text-opus-accent-2' : 'text-red-300'} />
              <span className="font-arabic text-xs font-bold text-opus-text">{active.enabled ? 'مفعّل' : 'مقفّل'}</span>
              <span className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-opus-border bg-opus-surface">
                <input type="checkbox" checked={active.enabled} onChange={(e) => patchActive({ enabled: e.target.checked })} className="peer absolute inset-0 z-10 cursor-pointer opacity-0" />
                <span className="absolute right-0.5 h-4 w-4 rounded-full bg-opus-muted transition-all duration-200 peer-checked:right-[1.625rem] peer-checked:bg-opus-accent" />
              </span>
            </label>
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            <div className="rounded-2xl border border-opus-border bg-opus-bg/50 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-2 font-arabic text-sm font-extrabold text-opus-text"><ShieldCheck size={16} className="text-opus-accent-2" /> الرتب المسموحة</p>
                <span className="font-english text-xs text-opus-muted">{active.allowedRoleIds.length}</span>
              </div>
              <div className="relative mt-3">
                <Search size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-opus-muted" />
                <input value={roleSearch} onChange={(e) => setRoleSearch(e.target.value)} placeholder="ابحث عن رتبة..." className="w-full rounded-xl border border-opus-border bg-opus-surface px-3 py-2 pr-9 font-arabic text-sm text-opus-text outline-none focus:border-opus-accent" />
              </div>
              <div className="mt-3 max-h-72 overflow-y-auto rounded-xl border border-opus-border bg-opus-surface/60 p-2">
                {filteredRoles.map((role) => {
                  const selected = active.allowedRoleIds.includes(role.id);
                  return (
                    <button
                      key={role.id}
                      type="button"
                      onClick={() => toggleRole(role.id)}
                      className={`mb-2 flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-right transition last:mb-0 ${selected ? 'border-opus-accent bg-opus-accent/10' : 'border-opus-border bg-opus-bg hover:border-opus-accent-2/60'}`}
                    >
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
              <p className="flex items-center gap-2 font-arabic text-sm font-extrabold text-opus-text"><UserPlus size={16} className="text-opus-accent-2" /> أشخاص مسموحين</p>
              <p className="mt-1 font-arabic text-[11px] leading-5 text-opus-muted">اكتب User ID أو منشن، كل واحد بسطر. مناسب للمالك أو مشرف معيّن بدون رتبة.</p>
              <textarea
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onBlur={applyUsersFromInput}
                dir="ltr"
                rows={8}
                placeholder={'1397364822152315052\n<@123456789012345678>'}
                className="mt-3 w-full resize-y rounded-xl border border-opus-border bg-opus-surface px-3 py-2 font-english text-sm leading-6 text-opus-text outline-none focus:border-opus-accent"
              />
              <div className="mt-3 rounded-xl border border-opus-border bg-opus-surface/60 p-3">
                <p className="flex items-center gap-2 font-arabic text-xs font-bold text-opus-muted"><Users size={14} /> الملخص</p>
                <p className="mt-1 font-arabic text-[11px] leading-5 text-opus-muted">
                  {customEnabled ? 'هذا الأمر صار مخصص: فقط الرتب/الأشخاص المحددين + الأدمن/مالك البوت.' : 'لا يوجد تخصيص: الأمر يستخدم صلاحيات Discord الأصلية.'}
                </p>
              </div>
            </div>
          </div>

          {msg ? <p className={`mt-4 rounded-xl border px-3 py-2 font-arabic text-xs leading-6 ${msg.kind === 'ok' ? 'border-opus-accent-2 text-opus-accent-2' : 'border-[#f59e0b] text-[#f59e0b]'}`}>{msg.text}</p> : null}

          <button type="button" onClick={save} disabled={busy} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-opus-accent px-5 py-3 font-arabic text-sm font-extrabold text-black transition hover:opacity-90 disabled:opacity-60 sm:w-auto">
            {busy ? <Loader2 className="animate-spin" size={15} /> : <Check size={15} />} حفظ إعدادات الأمر
          </button>
        </section>
      </div>
    </div>
  );
}
