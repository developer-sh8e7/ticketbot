'use client';

import { useEffect, useState } from 'react';
import { scrollToSection } from '@/components/fx/SmoothScroll';

export type SectionNavItem = { id: string; label: string };

/*
 * Fixed side navigator for the one-page home: a line per section on the
 * left edge, the active one grows and turns accent. Hover reveals the
 * label; click smooth-scrolls to the section. Hidden below lg.
 */
export function SectionNav({ items }: { items: SectionNavItem[] }) {
  const [activeId, setActiveId] = useState(items[0]?.id ?? '');

  useEffect(() => {
    const sections = items
      .map(({ id }) => document.getElementById(id))
      .filter((el): el is HTMLElement => !!el);
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      { rootMargin: '-35% 0px -45% 0px', threshold: [0, 0.2, 0.5] }
    );

    sections.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [items]);

  const scrollTo = scrollToSection;

  return (
    <nav
      dir="ltr"
      aria-label="أقسام الصفحة"
      className="fixed left-5 top-1/2 z-40 hidden -translate-y-1/2 flex-col gap-1 lg:flex"
    >
      {items.map(({ id, label }) => {
        const isActive = activeId === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => scrollTo(id)}
            aria-label={label}
            aria-current={isActive ? 'true' : undefined}
            className="group flex items-center gap-3 py-2"
          >
            <span
              className={`block h-[3px] rounded-full transition-all duration-300 ${
                isActive
                  ? 'w-9 bg-[var(--color-accent)]'
                  : 'w-5 bg-[var(--color-text)]/20 group-hover:w-7 group-hover:bg-[var(--color-accent)]/60'
              }`}
            />
            <span
              dir="rtl"
              className={`pointer-events-none select-none whitespace-nowrap rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 font-arabic text-xs font-extrabold text-[var(--color-text)] shadow-[0_8px_25px_rgba(45,40,32,0.12)] transition-all duration-200 ${
                isActive
                  ? 'translate-x-0 opacity-100'
                  : '-translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-100'
              }`}
            >
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
