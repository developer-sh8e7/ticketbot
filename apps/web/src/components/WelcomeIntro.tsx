'use client';

import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, BriefcaseBusiness, GraduationCap } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { WelcomeScene3D } from '@/components/WelcomeScene3D';

const reveal = {
  hidden: { opacity: 0, y: 24 },
  visible: (delay: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

export function WelcomeIntro() {
  const [open, setOpen] = useState(true);
  const skipRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    skipRef.current?.focus({ preventScroll: true });

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') dismiss();
    }

    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  function dismiss() {
    setOpen(false);
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[100] overflow-x-hidden overflow-y-auto overscroll-contain bg-[#080808] [touch-action:pan-y] [-webkit-overflow-scrolling:touch]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="welcome-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div
            className="pointer-events-none fixed inset-0 opacity-70"
            aria-hidden="true"
            style={{ background: 'radial-gradient(circle at 22% 42%, rgba(255,138,0,0.1), transparent 34%)' }}
          />

          <header dir="rtl" className="pointer-events-none fixed inset-x-0 top-0 z-20 flex items-center justify-between px-5 py-5 sm:px-8">
            <div className="pointer-events-auto">
              <p className="font-english text-sm font-extrabold tracking-[0.16em] text-white">OPUS</p>
              <p className="mt-0.5 font-arabic text-[10px] font-bold text-white/40">نقطة البداية</p>
            </div>
            <button
              ref={skipRef}
              type="button"
              onClick={dismiss}
              className="pointer-events-auto rounded-full border border-white/15 bg-black/30 px-4 py-2 font-arabic text-xs font-bold text-white/65 backdrop-blur transition hover:border-[var(--color-accent)] hover:text-white focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            >
              تخطي المقدمة
            </button>
          </header>

          <div dir="rtl" className="relative mx-auto grid min-h-[100svh] w-full max-w-7xl items-center gap-2 px-5 pb-10 pt-24 sm:px-8 lg:grid-cols-[1.06fr_0.94fr] lg:gap-8 lg:px-12 lg:py-20">
            <div className="order-2 pb-4 lg:order-1 lg:py-16">
              <motion.p custom={0.12} variants={reveal} initial="hidden" animate="visible" className="font-arabic text-sm font-bold text-[var(--color-accent)]">
                خذ نفس… أنت في المكان الصح
              </motion.p>
              <motion.h2
                id="welcome-title"
                custom={0.2}
                variants={reveal}
                initial="hidden"
                animate="visible"
                className="mt-4 max-w-3xl text-balance font-arabic text-4xl font-extrabold leading-[1.25] tracking-tight text-white sm:text-6xl lg:text-7xl"
              >
                فكرتك ما تحتاج حظ. تحتاج أحد يعرف يبنيها.
              </motion.h2>
              <motion.p
                custom={0.3}
                variants={reveal}
                initial="hidden"
                animate="visible"
                className="mt-6 max-w-2xl text-balance font-arabic text-base leading-8 text-white/55 sm:text-lg"
              >
                رائد أعمال وفكرة التطبيق ساكنة في الملاحظات؟ أو طالب جامعي والمشروع بدأ يسابقك؟ اهدأ، وصلت. نرتّب المطلوب ونحوّله إلى مشروع يشتغل ويشرّفك.
              </motion.p>

              <motion.div custom={0.4} variants={reveal} initial="hidden" animate="visible" className="mt-8 grid gap-3 sm:grid-cols-2">
                <article className="rounded-2xl border border-white/12 bg-white/[0.035] p-5 transition hover:border-[var(--color-accent)]/60 hover:bg-white/[0.055]">
                  <BriefcaseBusiness size={22} className="text-[var(--color-accent)]" />
                  <h3 className="mt-4 font-arabic text-lg font-extrabold text-white">أبني فكرة أو مشروع</h3>
                  <p className="mt-2 min-h-12 font-arabic text-sm leading-6 text-white/45">عندي فكرة وأبي أشوفها تشتغل على أرض الواقع.</p>
                  <Link
                    href="/project-request?for=business"
                    onClick={dismiss}
                    className="mt-5 inline-flex touch-manipulation items-center gap-2 rounded-xl bg-[var(--color-accent)] px-4 py-2.5 font-arabic text-sm font-extrabold text-black transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-white"
                  >
                    ابدأ من هنا <ArrowLeft size={15} />
                  </Link>
                </article>

                <article className="rounded-2xl border border-white/12 bg-white/[0.035] p-5 transition hover:border-[var(--color-accent)]/60 hover:bg-white/[0.055]">
                  <GraduationCap size={22} className="text-[var(--color-accent)]" />
                  <h3 className="mt-4 font-arabic text-lg font-extrabold text-white">ألحق مشروعي الجامعي</h3>
                  <p className="mt-2 min-h-12 font-arabic text-sm leading-6 text-white/45">أبيه مرتباً، واضحاً، وجاهزاً للعرض.</p>
                  <Link
                    href="/project-request?for=student"
                    onClick={dismiss}
                    className="mt-5 inline-flex touch-manipulation items-center gap-2 rounded-xl border border-white/20 px-4 py-2.5 font-arabic text-sm font-extrabold text-white transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                  >
                    رتّبها معي <ArrowLeft size={15} />
                  </Link>
                </article>
              </motion.div>

              <motion.button
                custom={0.48}
                variants={reveal}
                initial="hidden"
                animate="visible"
                type="button"
                onClick={dismiss}
                className="mt-6 touch-manipulation py-2 font-arabic text-sm font-bold text-white/40 underline decoration-white/15 underline-offset-4 transition hover:text-white"
              >
                أبي أشوف الموقع أول
              </motion.button>
            </div>

            <motion.div
              className="pointer-events-none order-1 h-[300px] min-h-64 w-full lg:order-2 lg:h-[min(76vh,720px)]"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.9, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
              aria-hidden="true"
            >
              <WelcomeScene3D />
              <div className="-mt-8 flex justify-center gap-2 font-arabic text-[10px] font-bold text-white/35 lg:-mt-12">
                <span>فكرة</span><span>←</span><span>خطة</span><span>←</span><span>مشروع يعمل</span>
              </div>
            </motion.div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
