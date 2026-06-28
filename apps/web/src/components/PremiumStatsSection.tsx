'use client';

import { motion, useInView } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import AnimatedCounter from '@/components/AnimatedCounter';

const stats = [
  { value: 4, suffix: '', label: 'منتجات' },
  { value: 24, suffix: '/7', label: 'دعم عربي' },
] as const;

export function PremiumStatsSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: '-80px 0px -80px 0px' });
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (isInView) setActive(true);
  }, [isInView]);

  return (
    <section
      ref={sectionRef}
      dir="rtl"
      aria-label="Opus Solutions statistics"
      className="mx-[calc(50%-50vw)] w-screen bg-[var(--color-surface)] py-10"
    >
      <div className="mx-auto grid max-w-3xl divide-y divide-[var(--color-border)] px-4 text-center md:grid-cols-2 md:divide-x md:divide-x-reverse md:divide-y-0 md:px-8">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.label}
            className="px-6 py-6"
            initial={{ opacity: 0, y: 16 }}
            animate={active ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
            transition={{ duration: 0.45, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="font-english text-5xl font-extrabold tracking-tight text-[var(--color-accent)] md:text-6xl">
              <AnimatedCounter value={stat.value} suffix={stat.suffix} start={active} />
            </p>
            <p className="mt-3 font-arabic text-sm font-semibold text-[var(--color-muted)] md:text-base">{stat.label}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
