'use client';

import type { RefObject } from 'react';
import styles from './opi.module.css';

export type OpiMood = 'idle' | 'thinking' | 'happy' | 'sleeping';

type Props = {
  mood: OpiMood;
  waving: boolean;
  headRef: RefObject<SVGGElement | null>;
  pupilsRef: RefObject<SVGGElement | null>;
};

/**
 * Opi v2 — the mint cube robot mascot (inline SVG, no assets).
 * Moods: idle (bob/blink/gaze), thinking (fast bob, foot tap, antenna pulse),
 * happy (cheering arms, arc eyes, cheeks, sparkles), sleeping (breathing, Zzz).
 * Head tilt + eye tracking are driven imperatively via headRef/pupilsRef.
 */
export function OpiCharacter({ mood, waving, headRef, pupilsRef }: Props) {
  const thinking = mood === 'thinking';
  const happy = mood === 'happy';
  const sleeping = mood === 'sleeping';

  return (
    <svg
      viewBox="0 0 140 150"
      width="96"
      height="103"
      aria-hidden="true"
      className={`${styles.svg} ${sleeping ? styles.breathe : thinking ? styles.bobFast : styles.bob}`}
    >
      <defs>
        <linearGradient id="opiBody" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#73e7c4" />
          <stop offset="0.55" stopColor="#0fc98f" />
          <stop offset="1" stopColor="#0e8aa3" />
        </linearGradient>
        <radialGradient id="opiOrb" cx="0.35" cy="0.35" r="1">
          <stop offset="0" stopColor="#d9f7f3" />
          <stop offset="0.5" stopColor="#38b6c9" />
          <stop offset="1" stopColor="#0e8aa3" />
        </radialGradient>
        <linearGradient id="opiScreen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1a1a1f" />
          <stop offset="1" stopColor="#0c0c0f" />
        </linearGradient>
      </defs>

      {/* ground shadow (pulses in sync with the bob) */}
      <ellipse className={styles.shadow} cx="70" cy="144" rx="30" ry="4.5" fill="#000" opacity="0.4" />

      <g className={styles.sway}>
        {/* legs & feet — left foot taps while thinking */}
        <g className={thinking ? styles.footTap : undefined}>
          <rect x="50" y="120" width="13" height="14" rx="5" fill="url(#opiBody)" />
          <rect x="46" y="130" width="21" height="8" rx="4" fill="#0e8aa3" />
        </g>
        <rect x="77" y="120" width="13" height="14" rx="5" fill="url(#opiBody)" />
        <rect x="73" y="130" width="21" height="8" rx="4" fill="#0e8aa3" />

        {/* arms — right one waves, both cheer when happy */}
        <g className={happy ? styles.armHappyL : undefined}>
          <rect x="26" y="86" width="11" height="30" rx="5.5" fill="url(#opiBody)" />
          <circle cx="31.5" cy="116" r="7" fill="#73e7c4" />
        </g>
        <g className={waving ? styles.waveArm : happy ? styles.armHappyR : undefined}>
          <rect x="103" y="86" width="11" height="30" rx="5.5" fill="url(#opiBody)" />
          <circle cx="108.5" cy="116" r="7" fill="#73e7c4" />
        </g>

        {/* body with chest screen + equalizer heartbeat */}
        <rect x="40" y="82" width="60" height="42" rx="12" fill="url(#opiBody)" />
        <rect x="52" y="90" width="36" height="20" rx="6" fill="url(#opiScreen)" stroke="#2a2a2e" strokeWidth="1" />
        <g className={thinking ? styles.eqFast : undefined}>
          <rect className={styles.eq1} x="60" y="94" width="4" height="12" rx="2" fill="#0fc98f" />
          <rect className={styles.eq2} x="68" y="94" width="4" height="12" rx="2" fill="#73e7c4" />
          <rect className={styles.eq3} x="76" y="94" width="4" height="12" rx="2" fill="#0fc98f" />
        </g>

        {/* head */}
        <g ref={headRef} className={styles.head}>
          {/* antenna with glowing orb + expanding halo */}
          <rect x="68" y="12" width="4" height="14" rx="2" fill="url(#opiBody)" />
          <circle className={styles.orbHalo} cx="70" cy="9" r="9" fill="#0fc98f" />
          <circle className={thinking ? styles.orbThinking : styles.orb} cx="70" cy="9" r="5.5" fill="url(#opiOrb)" />

          {/* ear pods */}
          <rect x="24" y="42" width="8" height="18" rx="4" fill="#0e8aa3" />
          <rect x="108" y="42" width="8" height="18" rx="4" fill="#0e8aa3" />

          <rect x="30" y="26" width="80" height="52" rx="14" fill="url(#opiBody)" />
          <rect x="36" y="30" width="68" height="8" rx="4" fill="#ffffff" opacity="0.16" />

          {/* face screen + scanline shimmer */}
          <rect x="40" y="36" width="60" height="36" rx="10" fill="url(#opiScreen)" stroke="#2a2a2e" strokeWidth="1" />
          <rect className={styles.scanline} x="42" y="38" width="56" height="3" rx="1.5" fill="#0fc98f" />

          {/* eyes — gaze group is translated imperatively */}
          <g ref={pupilsRef} transform={thinking ? 'translate(0 -2)' : undefined}>
            {sleeping ? (
              <>
                <path d="M52 52 q5 3 10 0" stroke="#0fc98f" strokeWidth="2.4" strokeLinecap="round" fill="none" />
                <path d="M78 52 q5 3 10 0" stroke="#0fc98f" strokeWidth="2.4" strokeLinecap="round" fill="none" />
              </>
            ) : happy ? (
              <>
                <path d="M52 53 q5 -8 10 0" stroke="#73e7c4" strokeWidth="3" strokeLinecap="round" fill="none" />
                <path d="M78 53 q5 -8 10 0" stroke="#73e7c4" strokeWidth="3" strokeLinecap="round" fill="none" />
              </>
            ) : (
              <>
                <rect className={styles.eye} x="53" y="45" width="8" height="15" rx="4" fill="#0fc98f" />
                <rect className={styles.eye} x="79" y="45" width="8" height="15" rx="4" fill="#0fc98f" />
              </>
            )}
          </g>

          {/* cheeks when happy */}
          {happy ? (
            <>
              <ellipse cx="48" cy="61" rx="4.5" ry="2.6" fill="#0fc98f" opacity="0.35" />
              <ellipse cx="92" cy="61" rx="4.5" ry="2.6" fill="#0fc98f" opacity="0.35" />
            </>
          ) : null}

          {/* mouth per mood */}
          {thinking ? (
            <circle cx="70" cy="64" r="2.8" fill="none" stroke="#0fc98f" strokeWidth="2" />
          ) : happy ? (
            <path d="M62 61 q8 9 16 0 z" fill="#0fc98f" opacity="0.9" />
          ) : sleeping ? (
            <path d="M64 64 q6 3 12 0" stroke="#0fc98f" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.7" />
          ) : (
            <path d="M61 62 Q70 69 79 62" fill="none" stroke="#0fc98f" strokeWidth="2.6" strokeLinecap="round" />
          )}
        </g>

        {/* Zzz while sleeping */}
        {sleeping ? (
          <g fill="#73e7c4" fontFamily="monospace" fontWeight="bold">
            <text className={styles.z1} x="104" y="30" fontSize="12">z</text>
            <text className={styles.z2} x="114" y="20" fontSize="9">z</text>
            <text className={styles.z3} x="122" y="12" fontSize="7">z</text>
          </g>
        ) : null}
      </g>

      {/* sparkles while waving or celebrating */}
      {waving || happy ? (
        <g fill="#d9f7f3">
          <path className={styles.spark1} d="M18 40 l2.2 5 5 2.2 -5 2.2 -2.2 5 -2.2 -5 -5 -2.2 5 -2.2 z" />
          <path className={styles.spark2} d="M120 34 l1.8 4 4 1.8 -4 1.8 -1.8 4 -1.8 -4 -4 -1.8 4 -1.8 z" />
          <path className={styles.spark3} d="M126 78 l1.5 3.4 3.4 1.5 -3.4 1.5 -1.5 3.4 -1.5 -3.4 -3.4 -1.5 3.4 -1.5 z" />
        </g>
      ) : null}
    </svg>
  );
}
