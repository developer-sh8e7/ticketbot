'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Bot, CalendarDays, LayoutDashboard, PanelsTopLeft } from 'lucide-react';

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.08 },
  },
};

const item = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as const } },
};

export function HomeHero() {
  return (
    <section className="relative -mt-28 mx-[calc(50%-50vw)] flex min-h-screen w-screen items-center justify-center overflow-hidden px-4 pt-28 text-center">
      <div className="hero-orb left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" aria-hidden="true" />

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="relative z-10 mx-auto flex max-w-4xl flex-col items-center"
      >
        <motion.h1
          variants={item}
          className="mt-7 text-balance font-arabic text-5xl font-extrabold leading-tight tracking-tight text-[var(--color-text)] md:text-7xl"
        >
          نحوّل فكرتك إلى موقع أو نظام يعمل
        </motion.h1>

        <motion.p
          variants={item}
          className="mt-6 max-w-2xl text-balance font-arabic text-lg leading-8 text-[var(--color-muted)] md:text-xl"
        >
          مواقع، أنظمة حجوزات، لوحات تحكم، أدوات داخلية وبوتات Discord — من الفكرة إلى مشروع جاهز للاستخدام
        </motion.p>

        <motion.div variants={item} className="mt-7 flex flex-wrap justify-center gap-2">
          {[[PanelsTopLeft, 'مواقع'], [CalendarDays, 'أنظمة حجوزات'], [LayoutDashboard, 'لوحات تحكم'], [Bot, 'بوتات Discord']].map(([Icon, label]) => {
            const ServiceIcon = Icon as typeof Bot;
            return <span key={label as string} className="inline-flex items-center gap-2 rounded-full border border-opus-border bg-opus-surface/70 px-3 py-2 font-arabic text-xs font-bold text-opus-muted"><ServiceIcon size={14} className="text-opus-accent" />{label as string}</span>;
          })}
        </motion.div>

        <motion.div variants={item} className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/project-request"
            className="inline-flex min-w-36 items-center justify-center rounded-xl bg-[var(--color-accent)] px-6 py-3 font-arabic text-sm font-extrabold text-black transition hover:-translate-y-0.5 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
          >
            اطلب مشروعك
          </Link>
          <Link
            href="/bots"
            className="inline-flex min-w-36 items-center justify-center rounded-xl border border-[var(--color-border)] px-6 py-3 font-arabic text-sm font-extrabold text-[var(--color-text)] transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
          >
            Bots
          </Link>
        </motion.div>
      </motion.div>
    </section>
  );
}
