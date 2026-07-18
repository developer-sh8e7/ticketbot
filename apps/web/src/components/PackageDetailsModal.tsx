'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  Award,
  Check,
  Handshake,
  Headphones,
  Sparkles,
  X,
} from 'lucide-react';
import { RiyalIcon } from '@/components/RiyalIcon';

interface PackageDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  origin?: { x: number; y: number };
  package?: {
    id: string;
    name: string;
    category?: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    description: string;
    features: string[];
    price: number;
    originalPrice: number;
    discount: number;
    deliveryTime: string;
    quality: string;
    support: string;
  };
}

const easeOut = [0.16, 1, 0.3, 1] as const;

export function PackageDetailsModal({ isOpen, onClose, package: pkg, origin }: PackageDetailsModalProps) {
  const [mounted, setMounted] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement as HTMLElement | null;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
      if (event.key !== 'Tab') return;

      const dialog = closeRef.current?.closest('[role="dialog"]');
      const focusable = dialog?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])');
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    const focusTimer = window.setTimeout(() => closeRef.current?.focus(), 520);

    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      previousFocus?.focus?.();
    };
  }, [isOpen]);

  if (!mounted) return null;

  const launchOrigin = origin ?? { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const closedClip = `circle(0px at ${launchOrigin.x}px ${launchOrigin.y}px)`;
  const openClip = `circle(160vmax at ${launchOrigin.x}px ${launchOrigin.y}px)`;
  const launchOffset = {
    x: (launchOrigin.x - window.innerWidth / 2) * 0.2,
    y: (launchOrigin.y - window.innerHeight / 2) * 0.2,
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && pkg ? (
        <motion.div
          key={pkg.id}
          initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
          animate={{ opacity: 1, backdropFilter: 'blur(24px)' }}
          exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
          transition={{ duration: 0.56, ease: easeOut }}
          className="package-experience fixed inset-0 z-[95] overflow-hidden bg-[rgba(4,35,32,0.28)]"
          onClick={() => onCloseRef.current()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="package-modal-title"
        >
          <motion.div
            className="package-experience-reveal absolute inset-0"
            initial={{ clipPath: closedClip }}
            animate={{ clipPath: openClip }}
            exit={{ clipPath: closedClip }}
            transition={{ duration: 0.92, ease: easeOut }}
            aria-hidden="true"
          />

          <motion.div
            className="package-launch-ring absolute h-24 w-24 rounded-full border border-white/80"
            style={{ left: launchOrigin.x - 48, top: launchOrigin.y - 48 }}
            initial={{ scale: 0.08, rotate: 0, opacity: 0.95, filter: 'blur(0px)' }}
            animate={{ scale: 24, rotate: 270, opacity: 0, filter: 'blur(12px)' }}
            exit={{ scale: 0.08, rotate: 540, opacity: 0 }}
            transition={{ duration: 0.9, ease: easeOut }}
            aria-hidden="true"
          />

          <div className="package-modal-aurora" aria-hidden="true" />
          <div className="package-speed-lines" aria-hidden="true" />

          <button
            ref={closeRef}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onCloseRef.current();
            }}
            className="fixed left-4 top-4 z-30 inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/70 bg-white/[0.65] text-[var(--color-text)] shadow-[0_12px_40px_rgba(4,51,44,0.14)] backdrop-blur-xl transition hover:rotate-90 hover:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-2)] sm:left-7 sm:top-7"
            aria-label="إغلاق تفاصيل الباقة"
          >
            <X size={22} />
          </button>

          <motion.div
            initial={{
              opacity: 0,
              x: launchOffset.x,
              y: launchOffset.y,
              scale: 0.68,
              rotate: -10,
              filter: 'blur(24px)',
            }}
            animate={{ opacity: 1, x: 0, y: 0, scale: 1, rotate: 0, filter: 'blur(0px)' }}
            exit={{
              opacity: 0,
              x: launchOffset.x * 0.45,
              y: launchOffset.y * 0.45,
              scale: 0.78,
              rotate: 8,
              filter: 'blur(18px)',
            }}
            transition={{ duration: 0.82, delay: 0.12, ease: easeOut }}
            className="relative z-10 h-full overflow-y-auto overscroll-contain"
            data-lenis-prevent
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mx-auto grid min-h-[100dvh] w-full max-w-7xl gap-7 px-4 pb-12 pt-24 sm:px-8 sm:pb-16 sm:pt-28 lg:grid-cols-[0.86fr_1.14fr] lg:items-center lg:gap-12 lg:px-12">
              <motion.aside
                initial={{ opacity: 0, y: 34 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.46, duration: 0.62, ease: easeOut }}
                className="relative overflow-hidden rounded-[2rem] border border-white/75 bg-white/[0.54] p-5 shadow-[0_30px_90px_rgba(4,51,44,0.12)] backdrop-blur-2xl sm:p-8 lg:sticky lg:top-24"
              >
                <div className="absolute -left-20 -top-24 h-64 w-64 rounded-full bg-[var(--aurora-ice)]/60 blur-3xl" aria-hidden="true" />
                <div className="absolute -bottom-24 -right-16 h-64 w-64 rounded-full bg-[var(--aurora-lime)]/[0.45] blur-3xl" aria-hidden="true" />

                <div className="relative">
                  <div className="flex items-center justify-between gap-4">
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/[0.55] px-3 py-1.5 font-arabic text-xs font-extrabold text-[var(--color-accent-2)] backdrop-blur">
                      <Sparkles size={14} />
                      {pkg.category ?? 'باقة رقمية'}
                    </div>
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/75 bg-[var(--color-accent)]/[0.14] text-[var(--color-text)] shadow-[0_12px_34px_rgba(15,201,143,0.18)]">
                      <pkg.icon size={26} />
                    </div>
                  </div>

                  <h2 id="package-modal-title" className="mt-7 text-balance font-arabic text-4xl font-extrabold leading-tight text-[var(--color-text)] sm:text-5xl lg:text-6xl">
                    {pkg.name}
                  </h2>
                  <p className="mt-5 font-arabic text-base leading-8 text-[var(--color-muted)] sm:text-lg">{pkg.description}</p>

                  <div className="mt-8 border-y border-[var(--color-text)]/10 py-6">
                    <p className="font-arabic text-xs font-bold text-[var(--color-muted)]">السعر بعد الخصم</p>
                    <div className="mt-2 flex flex-wrap items-end gap-3">
                      <span className="inline-flex items-center gap-1 font-arabic text-4xl font-extrabold text-[var(--color-text)] sm:text-5xl">
                        <RiyalIcon size={38} />
                        <span>{pkg.price.toLocaleString('ar-SA')}</span>
                      </span>
                      {pkg.originalPrice > pkg.price ? (
                        <span className="mb-1 inline-flex items-center gap-1 font-arabic text-base text-[var(--color-muted)] line-through">
                          <RiyalIcon size={17} />
                          <span>{pkg.originalPrice.toLocaleString('ar-SA')}</span>
                        </span>
                      ) : null}
                      {pkg.discount > 0 ? (
                        <span className="mb-1 rounded-full bg-[var(--aurora-lime)] px-3 py-1 font-arabic text-xs font-extrabold text-[var(--color-on-accent)]">
                          وفر {pkg.discount}%
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-3 font-arabic text-xs leading-6 text-[var(--color-muted)]">يشمل التصميم والبرمجة والتسليم بدون رسوم مخفية</p>
                  </div>

                  <a
                    href="/project-request"
                    onClick={() => onCloseRef.current()}
                    className="mt-7 inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-[var(--color-text)] px-7 py-3.5 font-arabic text-base font-extrabold text-white shadow-[0_18px_44px_rgba(4,51,44,0.2)] transition hover:-translate-y-1 hover:bg-[var(--color-accent-2)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-2)] focus:ring-offset-2"
                  >
                    ابدأ مشروعك
                    <ArrowLeft size={19} />
                  </a>
                </div>
              </motion.aside>

              <main className="pb-6">
                <motion.div
                  initial={{ opacity: 0, y: 28 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.56, duration: 0.58, ease: easeOut }}
                  className="grid gap-3 sm:grid-cols-3"
                >
                  <DetailCard icon={Handshake} title="مدة التسليم" value={pkg.deliveryTime} />
                  <DetailCard icon={Award} title="الجودة" value={pkg.quality} />
                  <DetailCard icon={Headphones} title="الدعم الفني" value={pkg.support} />
                </motion.div>

                <motion.section
                  initial={{ opacity: 0, y: 34 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.64, duration: 0.64, ease: easeOut }}
                  className="mt-4 rounded-[2rem] border border-white/75 bg-white/[0.52] p-5 shadow-[0_26px_80px_rgba(14,138,163,0.1)] backdrop-blur-2xl sm:p-8"
                >
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <p className="font-arabic text-xs font-extrabold text-[var(--color-accent-2)]">كل شيء واضح من البداية</p>
                      <h3 className="mt-2 font-arabic text-2xl font-extrabold text-[var(--color-text)] sm:text-3xl">وش تشمل الباقة؟</h3>
                    </div>
                    <span className="font-english text-5xl font-extrabold text-[var(--color-accent)]/[0.18]">{String(pkg.features.length).padStart(2, '0')}</span>
                  </div>

                  <ul className="mt-7 grid gap-3 sm:grid-cols-2">
                    {pkg.features.map((feature, index) => (
                      <motion.li
                        key={feature}
                        initial={{ opacity: 0, y: 14, filter: 'blur(5px)' }}
                        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                        transition={{ delay: 0.7 + index * 0.035, duration: 0.42, ease: easeOut }}
                        className="flex min-h-16 items-start gap-3 rounded-2xl border border-white/70 bg-white/[0.46] p-3.5 font-arabic text-sm leading-7 text-[var(--color-text)] backdrop-blur"
                      >
                        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)] text-[var(--color-on-accent)] shadow-[0_6px_18px_rgba(15,201,143,0.22)]">
                          <Check size={15} strokeWidth={3} />
                        </span>
                        <span>{feature}</span>
                      </motion.li>
                    ))}
                  </ul>
                </motion.section>
              </main>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}

function DetailCard({ icon: Icon, title, value }: { icon: React.ComponentType<{ size?: number }>; title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/75 bg-white/[0.52] p-4 shadow-[0_18px_48px_rgba(4,51,44,0.08)] backdrop-blur-xl">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-accent)]/[0.14] text-[var(--color-accent-2)]">
        <Icon size={19} />
      </div>
      <p className="mt-4 font-arabic text-xs font-bold text-[var(--color-muted)]">{title}</p>
      <p className="mt-1 font-arabic text-sm font-extrabold leading-6 text-[var(--color-text)]">{value}</p>
    </div>
  );
}
