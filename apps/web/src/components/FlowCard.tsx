'use client';

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Check } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * CardFlow — a miniature of the site's living background: blurred emerald/teal
 * blobs drifting on transform-only keyframes. `seed` varies phase, speed and
 * drift direction so no two cards move alike.
 */
export function CardFlow({ seed = 0, intensity = 'soft' }: { seed?: number; intensity?: 'soft' | 'bold' }) {
  const s = seed % 5;
  const flowRef = useRef<HTMLSpanElement>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const element = flowRef.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => setActive(entry.isIntersecting), { rootMargin: '140px' });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <span
      ref={flowRef}
      aria-hidden="true"
      className={`card-flow ${active ? 'is-active' : ''} ${intensity === 'bold' ? 'card-flow-bold' : ''}`}
      style={{ '--fd': `${17 + s * 4}s`, '--fp': `${-s * 3.2}s`, '--fr': s % 2 ? 1 : -1 } as CSSProperties}
    >
      <i className="card-flow-blob card-flow-b1" />
      <i className="card-flow-blob card-flow-b2" />
      <i className="card-flow-blob card-flow-b3" />
    </span>
  );
}

export type AudienceCardVariant = 'solid' | 'glass' | 'tint';

function parseThemeColor(value: string) {
  const color = value.trim();
  const hex = color.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    const number = Number.parseInt(hex[1], 16);
    return [(number >> 16) & 255, (number >> 8) & 255, number & 255] as const;
  }
  const rgb = color.match(/rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/i);
  return rgb ? ([Number(rgb[1]), Number(rgb[2]), Number(rgb[3])] as const) : null;
}

function relativeLuminance(color: readonly number[]) {
  const channels = color.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrastRatio(a: readonly number[], b: readonly number[]) {
  const light = Math.max(relativeLuminance(a), relativeLuminance(b));
  const dark = Math.min(relativeLuminance(a), relativeLuminance(b));
  return (light + 0.05) / (dark + 0.05);
}

/** Selects whichever current theme token has stronger contrast with the solid card. */
function useThemeForeground(backgroundToken = '--flow-teal') {
  const [foreground, setForeground] = useState('var(--color-text)');

  useEffect(() => {
    const update = () => {
      const styles = getComputedStyle(document.documentElement);
      const background = parseThemeColor(styles.getPropertyValue(backgroundToken));
      const text = parseThemeColor(styles.getPropertyValue('--color-text'));
      const surface = parseThemeColor(styles.getPropertyValue('--color-surface'));
      if (!background || !text || !surface) return;
      setForeground(contrastRatio(background, text) >= contrastRatio(background, surface)
        ? 'var(--color-text)'
        : 'var(--color-surface)');
    };

    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme', 'style'] });
    const scheme = window.matchMedia('(prefers-color-scheme: dark)');
    scheme.addEventListener?.('change', update);
    return () => {
      observer.disconnect();
      scheme.removeEventListener?.('change', update);
    };
  }, [backgroundToken]);

  return foreground;
}

type AudienceCardProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  points: readonly string[];
  variant: AudienceCardVariant;
  index: number;
};

/**
 * Expandable audience card: badge chip, bold title, description and a
 * "read more" affordance. Tapping springs the card open and cascades the
 * existing points list into view.
 */
export function AudienceCard({ icon: Icon, title, description, points, variant, index }: AudienceCardProps) {
  const [open, setOpen] = useState(false);
  const themeForeground = useThemeForeground();

  return (
    <motion.article
      layout
      dir="rtl"
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ layout: { type: 'spring', stiffness: 230, damping: 27 }, duration: 0.55, delay: index * 0.09 }}
      className={`flow-card flow-card-${variant} ${open ? 'is-open' : ''}`}
      style={{ '--flow-card-fg': themeForeground } as CSSProperties}
    >
      <CardFlow seed={index * 2 + 1} intensity={variant === 'solid' ? 'bold' : 'soft'} />
      <span className="flow-card-sweep" aria-hidden="true" />

      <motion.button
        layout="position"
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        whileTap={{ scale: 0.985 }}
        className="flow-card-trigger"
      >
        <span className="flow-card-chip">
          <Icon size={20} />
        </span>
        <strong className="flow-card-title font-arabic">{title}</strong>
        <span className="flow-card-desc font-arabic">{description}</span>
        <span className="flow-card-more font-arabic">
          {open ? 'أغلق' : 'اقرأ المزيد'}
          <motion.span
            animate={{ rotate: open ? -90 : 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 22 }}
            className="flow-card-more-arrow"
          >
            <ArrowLeft size={15} />
          </motion.span>
        </span>
      </motion.button>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.ul
            key="points"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto', transition: { height: { type: 'spring', stiffness: 230, damping: 28 }, opacity: { duration: 0.3, delay: 0.08 } } }}
            exit={{ opacity: 0, height: 0, transition: { duration: 0.28 } }}
            className="flow-card-points"
          >
            {points.map((point, pointIndex) => (
              <motion.li
                key={point}
                initial={{ opacity: 0, x: 18 }}
                animate={{ opacity: 1, x: 0, transition: { delay: 0.14 + pointIndex * 0.08, duration: 0.38, ease: [0.22, 1, 0.36, 1] } }}
                exit={{ opacity: 0, transition: { duration: 0.15 } }}
                className="flow-card-point font-arabic"
              >
                <span className="flow-card-point-check">
                  <Check size={11} strokeWidth={3.2} />
                </span>
                <span>{point}</span>
              </motion.li>
            ))}
          </motion.ul>
        ) : null}
      </AnimatePresence>
    </motion.article>
  );
}

type SolutionCardProps = {
  label: string;
  description: string;
  visual: ReactNode;
  variant: AudienceCardVariant;
  index: number;
  onExplore: () => void;
};

/** Mobile-first solution card with an intentional two-step reveal before navigation. */
export function SolutionCard({ label, description, visual, variant, index, onExplore }: SolutionCardProps) {
  const [open, setOpen] = useState(false);
  const themeForeground = useThemeForeground();

  return (
    <motion.article
      layout
      dir="rtl"
      initial={{ opacity: 0, y: 30, rotateX: -4 }}
      whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      whileHover={{ y: -6, rotateX: -1.2, rotateY: index % 2 === 0 ? 1.2 : -1.2 }}
      transition={{
        layout: { type: 'spring', stiffness: 230, damping: 27 },
        duration: 0.52,
        delay: index * 0.07,
        ease: [0.22, 1, 0.36, 1],
      }}
      className={`solution-flow-card flow-card-${variant} ${open ? 'is-open' : ''}`}
      style={{ '--flow-card-fg': themeForeground, transformPerspective: 1100 } as CSSProperties}
    >
      <CardFlow seed={index + 7} intensity={variant === 'solid' ? 'bold' : 'soft'} />
      <span className="flow-card-sweep" aria-hidden="true" />

      <motion.button
        layout="position"
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        whileTap={{ scale: 0.985 }}
        className="solution-flow-trigger"
      >
        <span className="solution-flow-tag font-arabic">حلول تناسب احتياجك</span>
        <span className="solution-flow-visual">{visual}</span>
        <strong className="solution-flow-title font-arabic">{label}</strong>
        <span className="solution-flow-desc font-arabic">{description}</span>
        <span className="solution-flow-more font-arabic">
          {open ? 'أغلق' : 'اقرأ المزيد'}
          <motion.span animate={{ rotate: open ? -90 : 0 }} transition={{ type: 'spring', stiffness: 300, damping: 22 }}>
            <ArrowLeft size={15} />
          </motion.span>
        </span>
      </motion.button>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="action"
            initial={{ opacity: 0, height: 0, rotateX: -55 }}
            animate={{ opacity: 1, height: 'auto', rotateX: 0 }}
            exit={{ opacity: 0, height: 0, rotateX: -35 }}
            transition={{ type: 'spring', stiffness: 220, damping: 26 }}
            className="solution-flow-action-wrap"
          >
            <button type="button" onClick={onExplore} className="solution-flow-action font-arabic">
              عرض الباقة والسعر
              <ArrowLeft size={15} />
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.article>
  );
}
