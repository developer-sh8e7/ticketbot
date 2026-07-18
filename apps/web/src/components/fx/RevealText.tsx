'use client';

import { motion } from 'framer-motion';

/**
 * Awwwards-style headline reveal: each word slides up out of its own clip
 * mask with a stagger. Pass plain text; accent words get the brand color.
 */
export function RevealText({
  text,
  accentWords = [],
  delay = 0,
  className,
}: {
  text: string;
  accentWords?: string[];
  delay?: number;
  className?: string;
}) {
  const words = text.split(' ');

  return (
    <span className={className} aria-label={text}>
      {words.map((word, i) => (
        <span key={`${word}-${i}`} className="inline-block overflow-hidden pb-[0.12em] -mb-[0.12em] align-baseline">
          <motion.span
            initial={{ y: '115%', rotate: 4, opacity: 0 }}
            whileInView={{ y: '0%', rotate: 0, opacity: 1 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.7, delay: delay + i * 0.07, ease: [0.22, 1, 0.36, 1] }}
            className={`inline-block will-change-transform ${accentWords.includes(word) ? 'text-[var(--color-accent)]' : ''}`}
          >
            {word}
          </motion.span>
          {i < words.length - 1 ? ' ' : null}
        </span>
      ))}
    </span>
  );
}
