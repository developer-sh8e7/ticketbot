'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Check, Handshake, Award, Headphones } from 'lucide-react';
import { RiyalIcon } from '@/components/RiyalIcon';

interface PackageDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  package?: {
    id: string;
    name: string;
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

export function PackageDetailsModal({ isOpen, onClose, package: pkg }: PackageDetailsModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && pkg ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-labelledby="package-modal-title"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 28 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 28 }}
            transition={{ type: 'spring', damping: 27, stiffness: 300 }}
            className="relative max-h-[calc(100dvh-0.75rem)] w-full max-w-2xl overflow-y-auto rounded-t-3xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[0_28px_90px_rgba(45,40,32,0.25)] sm:max-h-[90vh] sm:rounded-3xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="relative flex items-center gap-3 border-b border-[var(--color-border)] bg-gradient-to-l from-[var(--color-accent)]/10 to-transparent px-4 py-4 pe-14 sm:gap-4 sm:px-6 sm:py-5 sm:pe-16">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--color-accent)]/15 text-[var(--color-accent)] sm:h-14 sm:w-14 sm:rounded-2xl">
                <pkg.icon size={24} />
              </div>
              <div className="min-w-0 flex-1">
                <h2 id="package-modal-title" className="font-arabic text-lg font-extrabold text-[var(--color-text)] sm:text-xl">
                  {pkg.name}
                </h2>
                <p className="mt-1 line-clamp-2 font-arabic text-xs leading-6 text-[var(--color-muted)] sm:text-sm">{pkg.description}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                autoFocus
                className="absolute left-3 top-3 inline-flex h-10 w-10 items-center justify-center rounded-xl text-[var(--color-muted)] transition hover:bg-[var(--color-bg)] hover:text-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] sm:left-4 sm:top-4"
                aria-label="إغلاق"
              >
                <X size={20} />
              </button>
            </div>

            <div className="border-b border-[var(--color-border)] px-4 py-4 sm:px-6 sm:py-5">
              <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
                <span className="inline-flex items-center gap-1 font-arabic text-3xl font-extrabold text-[var(--color-accent)]">
                  <RiyalIcon size={30} />
                  <span>{pkg.price.toLocaleString()}</span>
                </span>
                <span className="rounded-full bg-[var(--color-accent)]/10 px-3 py-1 font-arabic text-sm font-bold text-[var(--color-accent)]">
                  خصم {pkg.discount}%
                </span>
                <span className="inline-flex items-center gap-1 font-arabic text-base text-[var(--color-muted)] line-through sm:mr-auto sm:text-lg">
                  <RiyalIcon size={18} />
                  <span>{pkg.originalPrice.toLocaleString()}</span>
                </span>
              </div>
              <p className="mt-2 font-arabic text-xs leading-6 text-[var(--color-muted)] sm:text-sm">السعر بعد الخصم ويشمل التصميم والبرمجة والتسليم</p>
            </div>

            <div className="grid gap-3 px-4 py-4 sm:grid-cols-3 sm:px-6 sm:py-5">
              <DetailCard icon={Handshake} title="مدة التسليم" value={pkg.deliveryTime} />
              <DetailCard icon={Award} title="الجودة" value={pkg.quality} />
              <DetailCard icon={Headphones} title="الدعم الفني" value={pkg.support} />
            </div>

            <div className="border-t border-[var(--color-border)] px-4 py-4 sm:px-6 sm:py-5">
              <h3 className="mb-4 font-arabic text-base font-extrabold text-[var(--color-text)]">وش تشمل الباقة؟</h3>
              <ul className="grid gap-3 sm:grid-cols-2">
                {pkg.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3 font-arabic text-sm leading-6 text-[var(--color-text)]">
                    <Check size={18} className="mt-0.5 shrink-0 text-[var(--color-accent)]" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="sticky bottom-0 border-t border-[var(--color-border)] bg-[var(--color-surface)]/95 px-4 py-4 backdrop-blur sm:px-6 sm:py-5">
              <a
                href="/project-request"
                onClick={onClose}
                className="block w-full rounded-xl bg-[var(--color-accent)] px-6 py-3.5 text-center font-arabic text-base font-extrabold text-[var(--color-text)] transition hover:bg-[var(--color-accent-2)] hover:text-white focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-2"
              >
                ابدأ مشروعك الآن
              </a>
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
    <div className="flex items-start gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3.5 sm:p-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <p className="font-arabic text-xs font-medium text-[var(--color-muted)]">{title}</p>
        <p className="mt-0.5 font-arabic text-sm font-bold leading-6 text-[var(--color-text)]">{value}</p>
      </div>
    </div>
  );
}
