import type { ReactNode } from 'react';

type BannerVariant =
  | 'student' | 'general' | 'business'
  | 'plan' | 'build' | 'launch'
  | 'scope' | 'experience' | 'delivery' | 'support'
  | 'ticket' | 'voice_rooms' | 'broadcast' | 'humanguard' | 'bot';

const art: Record<BannerVariant, ReactNode> = {
  student: <><path d="M44 74 112 22l68 52 68-52 68 52" /><path d="M112 22v52m68-52v52m68-52v52" /><circle cx="112" cy="22" r="5" className="banner-accent" /></>,
  general: <><rect x="52" y="18" width="116" height="62" rx="8" /><rect x="184" y="30" width="72" height="50" rx="8" /><rect x="272" y="12" width="76" height="68" rx="8" /><path d="M52 36h116m132-24v68" /></>,
  business: <><path d="M54 78h292" /><rect x="76" y="56" width="44" height="22" rx="4" /><rect x="150" y="40" width="44" height="38" rx="4" /><rect x="224" y="24" width="44" height="54" rx="4" /><rect x="298" y="10" width="44" height="68" rx="4" className="banner-accent-soft" /></>,
  plan: <><path d="M38 62c54 0 52-34 106-34s58 38 110 38 58-40 108-40" /><circle cx="38" cy="62" r="6" /><circle cx="144" cy="28" r="6" className="banner-accent" /><circle cx="254" cy="66" r="6" /><circle cx="362" cy="26" r="6" /></>,
  build: <><path d="M42 18h316v62H42zM42 38h316M124 18v62M276 18v62" /><rect x="140" y="49" width="120" height="18" rx="4" className="banner-accent-soft" /></>,
  launch: <><path d="M200 78V26m0 0-25 24m25-24 25 24" className="banner-accent" /><path d="M116 78a84 84 0 0 1 168 0M148 78a52 52 0 0 1 104 0" /></>,
  scope: <><rect x="66" y="18" width="268" height="62" rx="8" /><path d="M92 38h126M92 56h182M92 70h94" /><circle cx="310" cy="36" r="7" className="banner-accent" /></>,
  experience: <><rect x="54" y="15" width="292" height="66" rx="9" /><path d="M54 34h292M78 52h72v16H78zm92 0h72v16h-72zm92 0h60v16h-60z" /><circle cx="72" cy="25" r="3" className="banner-accent" /></>,
  delivery: <><path d="M62 64h184V24H62zM246 42h44l34 22v0h-78z" /><circle cx="116" cy="70" r="10" /><circle cx="282" cy="70" r="10" className="banner-accent" /></>,
  support: <><path d="M130 64a70 70 0 0 1 140 0M146 64v16h28V54h-28zm80-10v26h28V64h-28z" /><path d="M174 80c12 8 40 8 52 0" className="banner-accent" /></>,
  ticket: <><path d="M64 24h272v48H64c12-12 12-36 0-48Z" /><path d="M132 24v48m136-48v48" strokeDasharray="6 7" /><circle cx="200" cy="48" r="10" className="banner-accent" /></>,
  voice_rooms: <><path d="M48 50h30l12-24 20 46 18-38 20 30 18-18 22 12 20-38 22 56 18-34 20 20 16-12h58" className="banner-accent" /></>,
  broadcast: <><path d="M92 58h46l84 26V12l-84 28H92z" /><path d="M250 30c24 12 24 24 0 36m24-52c48 22 48 48 0 70" className="banner-accent" /></>,
  humanguard: <><path d="m200 10 94 28v20c0 30-40 42-94 48-54-6-94-18-94-48V38z" /><path d="m168 54 22 20 44-42" className="banner-accent" /></>,
  bot: <><rect x="102" y="20" width="196" height="62" rx="16" /><path d="M200 20V8m-52 46h104" /><circle cx="154" cy="48" r="7" className="banner-accent" /><circle cx="246" cy="48" r="7" className="banner-accent" /></>,
};

export function GeometricBanner({ variant, label, className = '' }: { variant: BannerVariant; label?: string; className?: string }) {
  return (
    <div className={`relative h-[76px] overflow-hidden border-b border-white/[0.035] bg-white/[0.018] text-white/10 ${className}`} aria-hidden="true">
      <svg viewBox="0 0 400 96" preserveAspectRatio="none" className="absolute inset-0 h-full w-full fill-none stroke-current [stroke-width:1.2]">
        {art[variant]}
      </svg>
      <div className="absolute inset-0 bg-gradient-to-l from-[var(--color-accent)]/[0.035] via-transparent to-transparent" />
      {label ? <span className="absolute left-4 top-2 font-english text-5xl font-extrabold leading-none text-white/[0.035]">{label}</span> : null}
    </div>
  );
}
