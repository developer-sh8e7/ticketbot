'use client';

import { useEffect, useState } from 'react';
import { Check, Crown, Loader2, RefreshCw, ServerCog } from 'lucide-react';

export type AdminGuild = { id: string; name: string; iconUrl: string | null; owner: boolean };
type ApiResponse<T> = { success: true; data: T } | { success: false; error?: { message?: string } };

function initials(name: string) {
  return name.trim().slice(0, 2).toUpperCase();
}

export function ServerSelect({
  value,
  onSelect,
}: {
  value: string;
  onSelect: (guildId: string, guildName: string) => void;
}) {
  const [state, setState] = useState<'loading' | 'ready' | 'relink' | 'error'>('loading');
  const [guilds, setGuilds] = useState<AdminGuild[]>([]);

  async function load() {
    setState('loading');
    try {
      const res = await fetch('/api/dashboard/guilds', { cache: 'no-store' });
      const json = (await res.json()) as ApiResponse<{ guilds: AdminGuild[] }>;
      if (!json.success) {
        setState(json.error?.message === 'NEEDS_RELINK' ? 'relink' : 'error');
        return;
      }
      setGuilds(json.data.guilds);
      setState('ready');
    } catch {
      setState('error');
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (state === 'loading') {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl border border-opus-border bg-opus-bg py-8 text-sm text-opus-muted">
        <Loader2 className="animate-spin" size={18} /> جاري تحميل سيرفراتك...
      </div>
    );
  }

  if (state === 'relink') {
    return (
      <div className="rounded-xl border border-opus-border bg-opus-bg p-5 text-center">
        <p className="font-arabic text-sm font-bold text-opus-text">نحتاج إذن عرض سيرفراتك</p>
        <p className="mt-2 text-xs leading-6 text-opus-muted">
          سجّل دخولك عبر Discord مرة أخرى للسماح لنا بعرض السيرفرات التي تملك فيها صلاحية إدارة.
        </p>
        <a
          href="/api/auth/discord"
          className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-[#5865F2] px-5 py-2.5 font-arabic text-sm font-extrabold text-white transition hover:opacity-90"
        >
          ربط Discord من جديد
        </a>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-opus-border bg-opus-bg p-5 text-center">
        <p className="font-arabic text-sm text-opus-muted">تعذّر تحميل السيرفرات.</p>
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-2 rounded-lg border border-opus-border px-4 py-2 font-arabic text-sm font-bold text-opus-text transition hover:border-opus-accent-2"
        >
          <RefreshCw size={14} /> إعادة المحاولة
        </button>
      </div>
    );
  }

  if (guilds.length === 0) {
    return (
      <div className="rounded-xl border border-opus-border bg-opus-bg p-6 text-center">
        <ServerCog size={32} className="mx-auto text-opus-muted/60" />
        <p className="mt-3 font-arabic text-sm font-bold text-opus-text">لا توجد سيرفرات تملك فيها صلاحية إدارة</p>
        <p className="mt-1 text-xs leading-6 text-opus-muted">
          لتفعيل البوت، يجب أن تكون <span className="font-bold text-opus-text">Administrator</span> في السيرفر.
        </p>
      </div>
    );
  }

  return (
    <div className="grid max-h-72 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
      {guilds.map((g) => {
        const selected = g.id === value;
        return (
          <button
            key={g.id}
            type="button"
            onClick={() => onSelect(g.id, g.name)}
            className={`group flex items-center gap-3 rounded-xl border p-3 text-right transition ${
              selected ? 'border-opus-accent-2 bg-opus-accent-2/10' : 'border-opus-border bg-opus-bg hover:border-opus-accent-2/60'
            }`}
          >
            {g.iconUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={g.iconUrl} alt="" width={44} height={44} className="h-11 w-11 shrink-0 rounded-2xl object-cover" />
            ) : (
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-opus-border bg-opus-surface font-english text-sm font-bold text-opus-text">
                {initials(g.name)}
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className="truncate font-arabic text-sm font-bold text-opus-text">{g.name}</span>
                {g.owner ? <Crown size={13} className="shrink-0 text-amber-400" /> : null}
              </span>
              <span className="font-english text-[11px] text-opus-muted">{g.id}</span>
            </span>
            {selected ? (
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-opus-accent-2 text-black">
                <Check size={14} />
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
