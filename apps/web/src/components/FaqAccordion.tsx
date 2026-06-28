'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { faq } from '@/lib/site-content';

export function FaqAccordion() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div dir="rtl" className="divide-y divide-[var(--color-border)]">
      {faq.map(([question, answer], i) => {
        const isOpen = open === i;
        return (
          <div key={question} className="py-1">
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : i)}
              className="flex w-full items-center justify-between gap-4 py-5 text-start focus:outline-none"
              aria-expanded={isOpen}
            >
              <span className="font-arabic text-base font-extrabold text-[var(--color-text)]">{question}</span>
              <Plus
                size={20}
                className={`shrink-0 text-[var(--color-accent)] transition-transform duration-200 ${isOpen ? 'rotate-45' : ''}`}
              />
            </button>
            <AnimatePresence initial={false}>
              {isOpen ? (
                <motion.div
                  key="answer"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <p className="pb-5 text-sm leading-8 text-[var(--color-muted)]">{answer}</p>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
