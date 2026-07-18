'use client';

import { useEffect } from 'react';
import Lenis from 'lenis';

declare global {
  interface Window {
    __lenis?: Lenis;
  }
}

/**
 * Lenis inertia scrolling — the single biggest "award site" feel factor.
 * Touch devices keep native scrolling (Lenis default), so mobile is unaffected.
 */
export function SmoothScroll() {
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.1,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    });
    window.__lenis = lenis;

    let raf = 0;
    const loop = (time: number) => {
      lenis.raf(time);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
      delete window.__lenis;
    };
  }, []);

  return null;
}

/** Scroll helper that goes through Lenis when active, with native fallback. */
export function scrollToSection(id: string) {
  const target = document.getElementById(id);
  if (!target) return;
  if (window.__lenis) {
    window.__lenis.scrollTo(target, { offset: -80 });
  } else {
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
