'use client';

import { Children, type ReactNode, useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

const grid = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

const item = {
  hidden: { opacity: 0, y: 24, scale: 0.985 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const } },
};

export function MotionGrid({
  children,
  className = '',
  itemClassName = '',
}: {
  children: ReactNode;
  className?: string;
  itemClassName?: string;
}) {
  const prefersReducedMotion = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  const reduceMotion = mounted && Boolean(prefersReducedMotion);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <motion.div
      className={className}
      variants={grid}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-60px' }}
    >
      {Children.map(children, (child) => (
        <motion.div
          variants={item}
          whileHover={reduceMotion ? undefined : { y: -6, rotateX: 1.2, rotateY: -1.2 }}
          whileTap={reduceMotion ? undefined : { scale: 0.985 }}
          transition={{ type: 'spring', stiffness: 260, damping: 22 }}
          style={reduceMotion ? undefined : { transformPerspective: 900 }}
          className={`h-full ${itemClassName}`}
        >
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
}
