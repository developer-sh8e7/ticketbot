'use client';

import { motion, useScroll, useSpring } from 'framer-motion';

/** Thin brand-colored progress bar pinned above the navbar. */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 28, mass: 0.4 });

  return (
    <motion.div
      style={{ scaleX }}
      className="fixed inset-x-0 top-0 z-[60] h-1 origin-right bg-gradient-to-l from-[var(--color-accent)] to-[var(--color-accent-2)]"
      aria-hidden="true"
    />
  );
}
