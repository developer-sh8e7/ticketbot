'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowDown, ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
import { WelcomeScene3D } from '@/components/WelcomeScene3D';

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.12, delayChildren: 0.08 } },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.62, ease: [0.22, 1, 0.36, 1] as const } },
};

export function HomeHero() {
  const [showScene, setShowScene] = useState(false);

  useEffect(() => {
    const revealScene = () => setShowScene(true);
    window.addEventListener('opus-welcome-closed', revealScene);
    return () => window.removeEventListener('opus-welcome-closed', revealScene);
  }, []);

  return (
    <section className="relative -mt-28 mx-[calc(50%-50vw)] flex min-h-screen w-screen items-center overflow-hidden px-4 pb-12 pt-32 md:px-8 lg:px-12">
      <div className="mx-auto grid w-full max-w-7xl items-center gap-8 lg:grid-cols-[1.04fr_0.96fr]">
        <motion.div variants={container} initial="hidden" animate="show" dir="rtl" className="relative z-10 text-center lg:text-right">
          <motion.p variants={item} className="font-arabic text-sm font-bold text-[var(--color-accent)]">
            من الفكرة إلى مشروع جاهز
          </motion.p>

          <motion.h1 variants={item} className="mt-5 text-balance font-arabic text-5xl font-extrabold leading-tight tracking-tight text-[var(--color-text)] md:text-7xl">
            فكرتك تستاهل تصير مشروع حقيقي
          </motion.h1>

          <motion.p variants={item} className="mt-6 max-w-2xl text-balance font-arabic text-lg leading-8 text-[var(--color-muted)] md:text-xl">
            نرتّب الفكرة معك، نصمم التجربة، ونبني مشروعاً يعمل بوضوح من البداية حتى التسليم.
          </motion.p>

          <motion.div variants={item} className="mt-9 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
            <Link href="/project-request" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--color-accent)] px-6 py-3 font-arabic text-sm font-extrabold text-black transition hover:-translate-y-0.5 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]">
              ابدأ مشروعك <ArrowLeft size={16} />
            </Link>
            <a href="#process" className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] px-6 py-3 font-arabic text-sm font-bold text-[var(--color-text)] transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]">
              شوف كيف نشتغل <ArrowDown size={15} />
            </a>
          </motion.div>
        </motion.div>

        <motion.div
          className="pointer-events-none relative h-[360px] w-full sm:h-[440px] lg:h-[620px]"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={showScene ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          aria-hidden="true"
        >
          {showScene ? <WelcomeScene3D variant="home" /> : null}
          <div className="absolute inset-x-0 bottom-5 flex justify-center gap-2 font-arabic text-[10px] font-bold text-[var(--color-muted)]">
            <span>فكرة</span><span>←</span><span>تصميم</span><span>←</span><span>إطلاق</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
