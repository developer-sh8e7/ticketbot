'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';

/**
 * Fast auto-dismissing loader (~1.2s total): counter runs 0→100, then the
 * curtain slides up to reveal the page. No clicks required, no gating.
 */
export function Preloader() {
  const [count, setCount] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    document.documentElement.style.overflow = 'hidden';
    const start = performance.now();
    const DURATION = 850;
    let raf = 0;

    const tick = (now: number) => {
      const progress = Math.min((now - start) / DURATION, 1);
      // ease-out so the counter sprints then settles
      setCount(Math.round((1 - Math.pow(1 - progress, 3)) * 100));
      if (progress < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        setTimeout(() => setDone(true), 120);
      }
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      document.documentElement.style.overflow = '';
    };
  }, []);

  useEffect(() => {
    if (done) document.documentElement.style.overflow = '';
  }, [done]);

  return (
    <AnimatePresence>
      {!done && (
        <motion.div
          exit={{ y: '-100%' }}
          transition={{ duration: 0.7, ease: [0.83, 0, 0.17, 1] }}
          className="fixed inset-0 z-[90] flex flex-col items-center justify-center bg-[var(--color-text)]"
          aria-hidden="true"
        >
          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="font-english text-2xl font-extrabold tracking-[0.3em] text-[var(--color-bg)]"
          >
            OPUS
          </motion.p>
          <div className="mt-6 h-px w-40 overflow-hidden bg-white/15">
            <div
              className="h-full bg-[var(--color-accent)] transition-[width] duration-75 ease-out"
              style={{ width: `${count}%` }}
            />
          </div>
          <p className="mt-4 font-english text-sm font-bold tabular-nums text-white/50">{count}%</p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
