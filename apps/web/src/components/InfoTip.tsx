'use client';

import { Info } from 'lucide-react';
import { useId, useState } from 'react';

/**
 * Accessible info tooltip — a small (i) trigger that reveals a short hint on
 * hover and keyboard focus. Pure B&W, no color. Used on product cards and
 * checkout fields to explain what the customer gets before they buy.
 */
export function InfoTip({ label, text }: { label: string; text: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-label={label}
        aria-describedby={open ? id : undefined}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-[var(--color-border)] text-[var(--color-muted)] transition hover:border-[var(--color-accent)] hover:text-[var(--color-text)] focus-visible:border-[var(--color-accent)] focus-visible:text-[var(--color-text)] focus-visible:outline-none"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        <Info size={12} />
      </button>
      {open ? (
        <span
          id={id}
          role="tooltip"
          dir="rtl"
          className="absolute bottom-full right-1/2 z-30 mb-2 w-56 translate-x-1/2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-right text-xs leading-6 text-[var(--color-text)] shadow-[0_18px_60px_rgba(0,0,0,0.6)]"
        >
          {text}
        </span>
      ) : null}
    </span>
  );
}
