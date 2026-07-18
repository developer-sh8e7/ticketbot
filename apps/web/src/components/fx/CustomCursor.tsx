'use client';

import { useEffect, useState } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';

/**
 * Custom cursor: a solid dot that sticks to the pointer plus a trailing ring
 * that springs after it and swells over links/buttons. Desktop pointers only.
 */
export function CustomCursor() {
  const [enabled, setEnabled] = useState(false);
  const [hovering, setHovering] = useState(false);

  const dotX = useMotionValue(-100);
  const dotY = useMotionValue(-100);
  const ringX = useSpring(dotX, { stiffness: 260, damping: 24, mass: 0.5 });
  const ringY = useSpring(dotY, { stiffness: 260, damping: 24, mass: 0.5 });

  useEffect(() => {
    const fine = window.matchMedia('(pointer: fine)').matches;
    if (!fine) return;
    setEnabled(true);
    document.body.classList.add('custom-cursor');

    const move = (event: PointerEvent) => {
      dotX.set(event.clientX);
      dotY.set(event.clientY);
    };
    const over = (event: Event) => {
      const target = event.target as Element | null;
      setHovering(!!target?.closest('a, button, [role="tab"], summary'));
    };

    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerover', over, { passive: true });
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerover', over);
      document.body.classList.remove('custom-cursor');
    };
  }, [dotX, dotY]);

  if (!enabled) return null;

  return (
    <>
      <motion.div
        style={{ x: dotX, y: dotY }}
        className="pointer-events-none fixed left-0 top-0 z-[80] -ml-[3px] -mt-[3px] h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]"
        aria-hidden="true"
      />
      <motion.div
        style={{ x: ringX, y: ringY }}
        animate={{ scale: hovering ? 2 : 1, opacity: hovering ? 0.45 : 0.8 }}
        transition={{ duration: 0.2 }}
        className="pointer-events-none fixed left-0 top-0 z-[80] -ml-4 -mt-4 h-8 w-8 rounded-full border-[1.5px] border-[var(--color-accent)]"
        aria-hidden="true"
      />
    </>
  );
}
