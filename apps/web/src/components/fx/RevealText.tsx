'use client';

import { motion } from 'framer-motion';

/**
 * Awwwards-style headline reveal: each word rises in with a soft blur and a
 * stagger. No clip masks — Arabic descenders and trailing words must never
 * be cut off on any screen size. Accent words get the brand color.
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
    <span className={`whitespace-normal overflow-visible ${className ?? ''}`} aria-label={text}>
      {words.map((word, i) => (
        <span key={`${word}-${i}`} className="inline-block align-baseline">
          <motion.span
            initial={{ y: '0.55em', opacity: 0, filter: 'blur(6px)' }}
            whileInView={{ y: '0em', opacity: 1, filter: 'blur(0px)' }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.7, delay: delay + i * 0.07, ease: [0.22, 1, 0.36, 1] }}
            className={`inline-block will-change-transform ${accentWords.includes(word) ? 'text-[var(--color-accent)]' : ''}`}
          >
            {word}
          </motion.span>
          {i < words.length - 1 ? ' ' : null}
        </span>
      ))}
    </span>
  );
}
