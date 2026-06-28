'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useInView, useMotionValue, useMotionValueEvent, useSpring } from 'framer-motion';

type AnimatedCounterProps = {
  value: number;
  suffix?: string;
  start?: boolean;
};

export default function AnimatedCounter({ value, suffix = '', start = false }: AnimatedCounterProps) {
  const spanRef = useRef<HTMLSpanElement>(null);
  const isInView = useInView(spanRef, { once: true, margin: '-60px' });
  const motionValue = useMotionValue(0);
  const spring = useSpring(motionValue, { damping: 28, stiffness: 140, mass: 0.75 });
  const finalValue = useMemo(() => `${value}${suffix}`, [value, suffix]);
  const [display, setDisplay] = useState(finalValue);
  const startedRef = useRef(false);
  const doneRef = useRef(false);
  const hasProgressRef = useRef(false);

  useEffect(() => {
    startedRef.current = false;
    doneRef.current = false;
    hasProgressRef.current = false;
    setDisplay(finalValue);
    motionValue.set(0);
  }, [finalValue, motionValue]);

  useEffect(() => {
    const shouldStart = start || isInView;
    if (!shouldStart || startedRef.current || doneRef.current) return undefined;

    startedRef.current = true;
    setDisplay('0');
    motionValue.set(value);

    const noProgressFallback = window.setTimeout(() => {
      if (!hasProgressRef.current && !doneRef.current) {
        doneRef.current = true;
        setDisplay(finalValue);
      }
    }, 800);

    const finalSafetyFallback = window.setTimeout(() => {
      if (!doneRef.current) {
        doneRef.current = true;
        setDisplay(finalValue);
      }
    }, 1800);

    return () => {
      window.clearTimeout(noProgressFallback);
      window.clearTimeout(finalSafetyFallback);
    };
  }, [finalValue, isInView, motionValue, start, value]);

  useMotionValueEvent(spring, 'change', (latest) => {
    if (!startedRef.current || doneRef.current) return;

    const rounded = Math.max(0, Math.round(latest));
    if (rounded > 0) hasProgressRef.current = true;

    if (rounded >= value) {
      doneRef.current = true;
      setDisplay(finalValue);
      return;
    }

    setDisplay(rounded.toString());
  });

  return (
    <span ref={spanRef} dir="ltr" className="inline-block tabular-nums [unicode-bidi:isolate]">
      {display}
    </span>
  );
}
