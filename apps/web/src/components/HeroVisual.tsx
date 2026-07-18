'use client';

import { useRef } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { LayoutDashboard, ShoppingCart, Smartphone } from 'lucide-react';

/*
 * Lightweight interactive version of the supplied browser/phone reference.
 * CSS handles the continuous motion, while Framer Motion adds pointer parallax
 * without the rendering cost and mobile fallbacks of a WebGL scene.
 */
export function HeroVisual() {
  const ref = useRef<HTMLDivElement>(null);
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const smoothX = useSpring(pointerX, { stiffness: 115, damping: 20, mass: 0.45 });
  const smoothY = useSpring(pointerY, { stiffness: 115, damping: 20, mass: 0.45 });

  const rotateY = useTransform(smoothX, [-0.5, 0.5], [7, -7]);
  const rotateX = useTransform(smoothY, [-0.5, 0.5], [-6, 6]);
  const browserX = useTransform(smoothX, [-0.5, 0.5], [-7, 7]);
  const browserY = useTransform(smoothY, [-0.5, 0.5], [-4, 4]);
  const phoneX = useTransform(smoothX, [-0.5, 0.5], [12, -12]);
  const phoneY = useTransform(smoothY, [-0.5, 0.5], [8, -8]);
  const chipsX = useTransform(smoothX, [-0.5, 0.5], [20, -20]);
  const chipsY = useTransform(smoothY, [-0.5, 0.5], [12, -12]);

  const resetPointer = () => {
    pointerX.set(0);
    pointerY.set(0);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'touch') return;
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;

    pointerX.set((event.clientX - rect.left) / rect.width - 0.5);
    pointerY.set((event.clientY - rect.top) / rect.height - 0.5);
  };

  return (
    <div
      ref={ref}
      dir="rtl"
      onPointerMove={handlePointerMove}
      onPointerLeave={resetPointer}
      className="relative mx-auto h-[290px] w-full max-w-[560px] touch-pan-y min-[380px]:h-[320px] sm:h-[440px] lg:h-[520px] [perspective:1100px]"
      aria-hidden="true"
    >
      <div className="hero-glow absolute left-1/2 top-1/2 h-[62%] w-[82%] rounded-full bg-[var(--color-accent)]/10 blur-3xl" />
      <div className="absolute bottom-[8%] left-1/2 h-8 w-[70%] -translate-x-1/2 rounded-[100%] bg-[#8f7c63]/10 blur-xl" />

      <div className="absolute left-1/2 top-1/2 w-[84%] -translate-x-1/2 -translate-y-[56%] sm:w-[82%]">
        <div className="hero-float">
          <motion.div
            style={{ rotateX, rotateY, x: browserX, y: browserY }}
            className="hero-parallax relative overflow-hidden rounded-[1.15rem] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[0_28px_70px_rgba(69,55,36,0.14)] [transform-style:preserve-3d]"
          >
            <div className="hero-shimmer pointer-events-none absolute inset-y-0 z-10 w-1/3 bg-gradient-to-l from-transparent via-white/50 to-transparent" />

            <div className="flex items-center gap-1.5 border-b border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 sm:px-4 sm:py-2.5">
              <span className="hero-blink h-2 w-2 rounded-full bg-[var(--color-accent)] sm:h-2.5 sm:w-2.5" />
              <span className="h-2 w-2 rounded-full bg-[var(--color-border)] sm:h-2.5 sm:w-2.5" />
              <span className="h-2 w-2 rounded-full bg-[var(--color-border)] sm:h-2.5 sm:w-2.5" />
              <span className="mr-2 h-3 flex-1 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] sm:mr-3 sm:h-4" />
            </div>

            <div className="grid grid-cols-[1.16fr_0.84fr] items-center gap-3 p-4 sm:gap-4 sm:p-6">
              <div>
                <span className="hero-bar block h-2.5 w-[85%] rounded-full bg-[var(--color-text)]/70 sm:h-3.5" />
                <span className="hero-bar mt-2 block h-2.5 w-[60%] rounded-full bg-[var(--color-text)]/70 [animation-delay:0.6s] sm:h-3.5" />
                <span className="hero-bar mt-3 block h-2 w-[92%] rounded-full bg-[var(--color-border)] [animation-delay:1.1s] sm:mt-4 sm:h-2.5" />
                <span className="hero-bar mt-1.5 block h-2 w-[70%] rounded-full bg-[var(--color-border)] [animation-delay:1.5s] sm:mt-2 sm:h-2.5" />
                <span className="mt-3 inline-block h-7 w-20 rounded-lg bg-[var(--color-accent)] sm:mt-5 sm:h-9 sm:w-28 sm:rounded-xl" />
              </div>
              <div className="rounded-lg bg-[var(--color-accent)]/10 p-2 sm:rounded-xl sm:p-3">
                <div className="aspect-[4/3] rounded-md bg-[var(--color-accent)]/20 sm:rounded-lg" />
                <span className="mt-2 block h-1.5 w-3/4 rounded-full bg-[var(--color-accent)]/30 sm:h-2" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 px-4 pb-4 sm:gap-3 sm:px-6 sm:pb-6">
              {[0, 1, 2].map((item) => (
                <div key={item} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-2 sm:rounded-xl sm:p-3">
                  <span className="block h-4 w-4 rounded-md bg-[var(--color-accent)]/15 sm:h-6 sm:w-6 sm:rounded-lg" />
                  <span className="mt-1.5 block h-1.5 w-full rounded-full bg-[var(--color-border)] sm:mt-2 sm:h-2" />
                  <span className="mt-1 block h-1.5 w-2/3 rounded-full bg-[var(--color-border)] sm:mt-1.5 sm:h-2" />
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      <div className="absolute bottom-[1%] left-[1%] w-[28%] sm:bottom-[3%] sm:left-[2%] sm:w-[27%]">
        <div className="hero-float-slow">
          <motion.div
            style={{ x: phoneX, y: phoneY }}
            className="hero-parallax overflow-hidden rounded-[1rem] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[0_22px_50px_rgba(69,55,36,0.18)] sm:rounded-[1.4rem]"
          >
            <div className="px-2 pb-2.5 pt-2 sm:px-3 sm:pb-4 sm:pt-3">
              <span className="mx-auto block h-1 w-7 rounded-full bg-[var(--color-border)] sm:h-1.5 sm:w-10" />
              <div className="mt-2 rounded-md bg-[var(--color-accent)]/10 p-1.5 sm:mt-3 sm:rounded-lg sm:p-2">
                <span className="hero-bar block h-1.5 w-3/4 rounded-full bg-[var(--color-accent)]/40 sm:h-2" />
                <span className="hero-bar mt-1 block h-1.5 w-1/2 rounded-full bg-[var(--color-accent)]/25 [animation-delay:0.8s] sm:mt-1.5 sm:h-2" />
              </div>
              <div className="mt-1.5 grid grid-cols-2 gap-1 sm:mt-2 sm:gap-1.5">
                <span className="block aspect-square rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] sm:rounded-lg" />
                <span className="block aspect-square rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] sm:rounded-lg" />
              </div>
              <span className="mt-1.5 block h-5 rounded-md bg-[var(--color-accent)] sm:mt-2.5 sm:h-7 sm:rounded-lg" />
            </div>
          </motion.div>
        </div>
      </div>

      <motion.div
        style={{ x: chipsX, y: chipsY }}
        className="hero-parallax pointer-events-none absolute inset-0"
      >
        <CapabilityChip className="right-[0%] top-[8%]" icon={ShoppingCart} label="متجر الكتروني" />
        <CapabilityChip className="bottom-[18%] right-[-1%] [animation-delay:1.6s]" icon={Smartphone} label="تطبيق جوال" />
        <CapabilityChip className="left-[4%] top-[3%] [animation-delay:0.9s]" icon={LayoutDashboard} label="موقع تعريفي" />
      </motion.div>
    </div>
  );
}

function CapabilityChip({
  className,
  icon: Icon,
  label,
}: {
  className: string;
  icon: React.ComponentType<{ size?: number }>;
  label: string;
}) {
  return (
    <div
      className={`hero-float-sm absolute flex scale-[0.78] items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] py-1.5 pe-3 ps-1.5 shadow-[0_10px_30px_rgba(69,55,36,0.12)] min-[380px]:scale-[0.86] sm:scale-100 sm:gap-2 sm:py-2 sm:pe-4 sm:ps-2 ${className}`}
    >
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-accent)]/10 text-[var(--color-accent)] sm:h-7 sm:w-7">
        <Icon size={13} />
      </span>
      <span className="whitespace-nowrap font-arabic text-[11px] font-extrabold text-[var(--color-text)] sm:text-xs">{label}</span>
    </div>
  );
}
