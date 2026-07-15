'use client';

import { Children, type ReactNode } from 'react';
import { motion } from 'framer-motion';

const grid = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

const item = {
  hidden: { opacity: 0, y: 28, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as const } },
};

export function MotionGrid({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      variants={grid}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-80px' }}
    >
      {Children.map(children, (child) => (
        <motion.div
          variants={item}
          whileHover={{ y: -8, rotateX: 1.5, rotateY: -1.5 }}
          transition={{ type: 'spring', stiffness: 260, damping: 22 }}
          style={{ transformPerspective: 900 }}
          className="h-full"
        >
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
}
