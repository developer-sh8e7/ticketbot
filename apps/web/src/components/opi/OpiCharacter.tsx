'use client';

import type { RefObject } from 'react';
import styles from './opi.module.css';

type Props = {
  mode: 'idle' | 'thinking';
  waving: boolean;
  headRef: RefObject<SVGGElement | null>;
  pupilsRef: RefObject<SVGGElement | null>;
};

/**
 * Opi — the orange cube robot mascot (inline SVG, no assets).
 * Head tilt + eye tracking are driven imperatively via headRef/pupilsRef
 * from OpiWidget (rAF-throttled mousemove) to avoid re-renders.
 */
export function OpiCharacter({ mode, waving, headRef, pupilsRef }: Props) {
  const thinking = mode === 'thinking';
  return (
    <svg
      viewBox="0 0 120 132"
      width="86"
      height="95"
      aria-hidden="true"
      className={thinking ? styles.thinkingBody : styles.bob}
    >
      <defs>
        <linearGradient id="opiBody" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffa03d" />
          <stop offset="1" stopColor="#ff7a00" />
        </linearGradient>
      </defs>

      <g className={styles.sway}>
        {/* shadow */}
        <ellipse cx="60" cy="127" rx="26" ry="4" fill="#000" opacity="0.35" />

        {/* legs */}
        <rect x="44" y="106" width="12" height="16" rx="4" fill="url(#opiBody)" />
        <rect x="64" y="106" width="12" height="16" rx="4" fill="url(#opiBody)" />

        {/* arms — the "right" arm (viewer's right) waves */}
        <rect x="22" y="76" width="10" height="26" rx="5" fill="url(#opiBody)" />
        <rect x="88" y="76" width="10" height="26" rx="5" fill="url(#opiBody)" className={waving ? styles.waveArm : undefined} />

        {/* body */}
        <rect x="34" y="72" width="52" height="36" rx="10" fill="url(#opiBody)" />
        <rect x="48" y="80" width="24" height="14" rx="4" fill="#101012" />
        <circle cx="54" cy="87" r="2" fill="#ff8a00" className={thinking ? styles.thinkingAntenna : undefined} />
        <circle cx="61" cy="87" r="2" fill="#ffb866" />
        <circle cx="68" cy="87" r="2" fill="#ff8a00" />

        {/* head */}
        <g ref={headRef} className={styles.head}>
          {/* antenna */}
          <rect x="58" y="10" width="4" height="12" rx="2" fill="url(#opiBody)" />
          <circle cx="60" cy="8" r="5" fill="#ff8a00" className={thinking ? styles.thinkingAntenna : undefined} />

          <rect x="28" y="20" width="64" height="52" rx="12" fill="url(#opiBody)" />
          {/* face screen */}
          <rect x="36" y="29" width="48" height="34" rx="8" fill="#101012" />
          {/* eyes (blink via CSS, gaze via pupilsRef transform) */}
          <g ref={pupilsRef} transform={thinking ? 'translate(0 -2)' : undefined}>
            <rect x="46" y="37" width="7" height="13" rx="3.5" fill="#ff8a00" className={styles.eye} />
            <rect x="67" y="37" width="7" height="13" rx="3.5" fill="#ff8a00" className={styles.eye} />
          </g>
          {/* mouth */}
          {thinking ? (
            <circle cx="60" cy="57" r="2.6" fill="none" stroke="#ff8a00" strokeWidth="2" />
          ) : (
            <path d="M52 55 Q60 61 68 55" fill="none" stroke="#ff8a00" strokeWidth="2.4" strokeLinecap="round" />
          )}
        </g>
      </g>
    </svg>
  );
}
