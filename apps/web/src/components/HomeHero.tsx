'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowDown, ArrowLeft } from 'lucide-react';
import { HeroScene } from '@/components/HeroScene';
import { MagneticButton } from '@/components/fx/MagneticButton';
import { RevealText } from '@/components/fx/RevealText';

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.12, delayChildren: 0.08 } },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.62, ease: [0.22, 1, 0.36, 1] as const } },
};

export function HomeHero() {
  return (
    <section className="relative -mt-28 mx-[calc(50%-50vw)] flex min-h-[100svh] w-screen items-center overflow-hidden px-4 pb-7 pt-24 sm:pb-10 sm:pt-28 md:px-8 lg:px-12 lg:pt-32">
      <div className="mx-auto grid w-full max-w-7xl items-center gap-3 sm:gap-5 lg:grid-cols-[1.04fr_0.96fr] lg:gap-8">
        <motion.div
          variants={container}
          initial={false}
          animate="show"
          dir="rtl"
          className="relative z-10 mx-auto max-w-2xl text-center lg:mx-0 lg:text-right"
        >
          <motion.p variants={item} className="font-arabic text-xs font-bold text-[var(--color-accent)] sm:text-sm">
            Opus — مواقع وتطبيقات وأنظمة رقمية
          </motion.p>

          <h1 className="mt-4 text-balance font-arabic text-[clamp(2.15rem,10.5vw,2.75rem)] font-extrabold leading-[1.24] tracking-tight text-[var(--color-text)] sm:mt-5 md:text-7xl md:leading-tight">
            <RevealText text="فكرتك تستاهل تصير موقع أو تطبيق حقيقي" accentWords={['حقيقي']} delay={0.15} />
          </h1>

          <motion.p
            variants={item}
            className="mx-auto mt-5 max-w-xl text-balance font-arabic text-base leading-7 text-[var(--color-muted)] sm:mt-6 sm:text-lg sm:leading-8 md:text-xl lg:mx-0"
          >
            نرتب فكرتك، نصمم التجربة، ونبني لك موقع أو تطبيق أو نظام رقمي جاهز للاستخدام.
          </motion.p>

          <motion.div
            variants={item}
            className="mx-auto mt-7 flex w-full max-w-sm flex-col items-stretch justify-center gap-2.5 sm:mt-9 sm:max-w-none sm:flex-row sm:items-center lg:mx-0 lg:justify-start"
          >
            <MagneticButton>
              <Link
                href="/project-request"
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-accent)] px-6 py-3 font-arabic text-sm font-extrabold text-[var(--color-text)] shadow-[0_12px_28px_rgba(232,108,0,0.18)] transition hover:-translate-y-0.5 hover:bg-[var(--color-accent-2)] hover:text-white focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-2 focus:ring-offset-[var(--color-bg)] sm:w-auto"
              >
                اطلب موقعك أو تطبيقك <ArrowLeft size={16} />
              </Link>
            </MagneticButton>
            <MagneticButton>
              <a
                href="#packages"
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/70 px-6 py-3 font-arabic text-sm font-bold text-[var(--color-text)] transition hover:-translate-y-0.5 hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-2 focus:ring-offset-[var(--color-bg)] sm:w-auto"
              >
                تصفح الباقات <ArrowDown size={15} />
              </a>
            </MagneticButton>
          </motion.div>
        </motion.div>

        <motion.div
          className="relative w-full"
          initial={false}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          aria-hidden="true"
        >
          <HeroScene />
        </motion.div>
      </div>
    </section>
  );
}
