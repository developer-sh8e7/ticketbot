'use client';

import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

export function MotionSection({ children, className = '', id }: { children: ReactNode; className?: string; id?: string }) {
  return (
    <motion.section
      id={id}
      initial={{ opacity: 0, y: 26 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.section>
  );
}
