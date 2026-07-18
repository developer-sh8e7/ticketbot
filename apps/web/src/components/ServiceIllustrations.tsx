/*
 * Flat vector service illustrations (unDraw-style) with male characters,
 * recolored to the Opus brand palette. Pure inline SVG — no external assets.
 */
import type { ReactElement } from 'react';

const SKIN = '#d9a271';
const HAIR = '#2a2018';
const PANTS = '#3f382e';
const SHIRT = '#0fc98f';
const SHIRT_ALT = '#4a5568';
const PAPER = '#ffffff';
const LINE = '#d2e7e1';
const SOFT = 'rgba(15,201,143,0.10)';
const SOFT2 = 'rgba(15,201,143,0.22)';
const INK_SOFT = 'rgba(7,51,46,0.25)';

export type ServiceIllustrationVariant =
  | 'ecommerce'
  | 'corporate'
  | 'landing'
  | 'mobile'
  | 'graduation'
  | 'uiux';

/** Standing man, drawn around origin (0,0) = feet center. ~56px tall. */
function Man({
  x,
  y,
  shirt = SHIRT,
  flip = false,
  raisedArm = false,
}: {
  x: number;
  y: number;
  shirt?: string;
  flip?: boolean;
  raisedArm?: boolean;
}) {
  return (
    <g transform={`translate(${x} ${y})${flip ? ' scale(-1 1)' : ''}`}>
      {/* shadow */}
      <ellipse cx="0" cy="2" rx="16" ry="3.5" fill={INK_SOFT} opacity="0.35" />
      {/* legs */}
      <rect x="-7.5" y="-24" width="6" height="24" rx="2.6" fill={PANTS} />
      <rect x="1.5" y="-24" width="6" height="24" rx="2.6" fill={PANTS} />
      {/* shoes */}
      <rect x="-9.5" y="-3" width="9" height="4" rx="2" fill={HAIR} />
      <rect x="1" y="-3" width="9" height="4" rx="2" fill={HAIR} />
      {/* torso */}
      <rect x="-9.5" y="-47" width="19" height="25" rx="7" fill={shirt} />
      {/* back arm (behind torso, slightly darker) */}
      <path
        d="M -7 -43 Q -14 -36 -12 -27"
        stroke={shirt}
        strokeWidth="5.4"
        strokeLinecap="round"
        fill="none"
        opacity="0.82"
      />
      <circle cx="-12" cy="-26" r="2.7" fill={SKIN} />
      {/* front arm — pointing forward or raised */}
      {raisedArm ? (
        <>
          <path d="M 7 -43 Q 15 -48 19 -55" stroke={shirt} strokeWidth="5.4" strokeLinecap="round" fill="none" />
          <circle cx="19.6" cy="-56" r="2.7" fill={SKIN} />
        </>
      ) : (
        <>
          <path d="M 7 -43 Q 15 -41 18 -36" stroke={shirt} strokeWidth="5.4" strokeLinecap="round" fill="none" />
          <circle cx="18.6" cy="-35" r="2.7" fill={SKIN} />
        </>
      )}
      {/* neck + head */}
      <rect x="-2.6" y="-52" width="5.2" height="6" fill={SKIN} />
      <circle cx="0" cy="-57" r="7.6" fill={SKIN} />
      {/* short male haircut */}
      <path d="M -7.6 -57 a 7.6 7.6 0 0 1 15.2 0 l 0 -1.4 q -2.2 -5.4 -7.6 -5.4 q -5.4 0 -7.6 5.4 Z" fill={HAIR} />
      <path d="M -7.6 -57.6 q 0 -3.4 2.4 -5.2 q -0.6 2.6 0.4 4.6 Z" fill={HAIR} />
      {/* trimmed beard */}
      <path d="M -6.4 -54.2 q 0.8 4.6 6.4 4.6 q 5.6 0 6.4 -4.6 q -1 6.4 -6.4 6.4 q -5.4 0 -6.4 -6.4 Z" fill={HAIR} opacity="0.85" />
    </g>
  );
}

function EcommerceArt() {
  return (
    <>
      {/* storefront phone */}
      <rect x="36" y="20" width="60" height="104" rx="11" fill={PAPER} stroke={LINE} strokeWidth="2" />
      <rect x="58" y="26" width="16" height="3" rx="1.5" fill={LINE} />
      {[38, 62, 86].map((y) => (
        <g key={y}>
          <rect x="43" y={y} width="46" height="18" rx="4" fill={SOFT} />
          <rect x="47" y={y + 4} width="10" height="10" rx="3" fill={SOFT2} />
          <rect x="61" y={y + 5} width="22" height="3" rx="1.5" fill={INK_SOFT} />
          <rect x="61" y={y + 11} width="14" height="3" rx="1.5" fill={LINE} />
        </g>
      ))}
      <rect x="43" y="108" width="46" height="9" rx="4.5" fill={SHIRT} opacity="0.9" />
      {/* cart */}
      <g stroke={PANTS} strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M 116 92 h 6 l 5 20 h 26 l 6 -16 h -33" />
      </g>
      <rect x="127" y="86" width="9" height="8" rx="2" fill={SHIRT} />
      <rect x="138" y="83" width="9" height="11" rx="2" fill={SOFT2} />
      <circle cx="131" cy="118" r="4" fill="none" stroke={PANTS} strokeWidth="2.4" />
      <circle cx="149" cy="118" r="4" fill="none" stroke={PANTS} strokeWidth="2.4" />
      {/* man pushing the cart */}
      <Man x={176} y={124} flip shirt={SHIRT_ALT} />
    </>
  );
}

function CorporateArt() {
  return (
    <>
      {/* globe */}
      <circle cx="74" cy="56" r="30" fill={SOFT} />
      <circle cx="74" cy="56" r="30" fill="none" stroke={SHIRT} strokeWidth="2" opacity="0.75" />
      <ellipse cx="74" cy="56" rx="13" ry="30" fill="none" stroke={SHIRT} strokeWidth="1.6" opacity="0.55" />
      <path d="M 44 56 h 60 M 48.5 42 h 51 M 48.5 70 h 51" stroke={SHIRT} strokeWidth="1.6" opacity="0.55" fill="none" />
      {/* landmasses */}
      <path d="M 62 44 q 8 -6 14 0 q -2 8 -10 6 q -6 -1 -4 -6 Z" fill={SOFT2} />
      <path d="M 80 62 q 9 -2 10 6 q -6 6 -12 1 q -2 -5 2 -7 Z" fill={SOFT2} />
      {/* orbit dot */}
      <circle cx="103" cy="34" r="3.4" fill={SHIRT} />
      {/* man presenting the globe */}
      <Man x={148} y={124} flip raisedArm />
    </>
  );
}

function LandingArt() {
  return (
    <>
      {/* landing page frame */}
      <rect x="30" y="24" width="98" height="92" rx="9" fill={PAPER} stroke={LINE} strokeWidth="2" />
      <circle cx="40" cy="33" r="2.2" fill={SHIRT} />
      <circle cx="47" cy="33" r="2.2" fill={LINE} />
      <circle cx="54" cy="33" r="2.2" fill={LINE} />
      <path d="M 30 40 h 98" stroke={LINE} strokeWidth="2" />
      {/* hero copy + CTA */}
      <rect x="40" y="50" width="50" height="5" rx="2.5" fill={INK_SOFT} />
      <rect x="40" y="60" width="36" height="4" rx="2" fill={LINE} />
      <rect x="40" y="71" width="26" height="9" rx="4.5" fill={SHIRT} />
      {/* hero image block */}
      <rect x="96" y="50" width="24" height="30" rx="4" fill={SOFT} />
      <path d="M 99 74 l 6 -7 l 5 4 l 6 -8 v 11 a 3 3 0 0 1 -3 3 h -11 Z" fill={SOFT2} />
      <circle cx="103" cy="58" r="2.6" fill={SOFT2} />
      {/* conversion bars */}
      <rect x="40" y="90" width="10" height="16" rx="2" fill={SOFT2} />
      <rect x="55" y="96" width="10" height="10" rx="2" fill={SOFT} />
      <rect x="70" y="86" width="10" height="20" rx="2" fill={SHIRT} opacity="0.85" />
      {/* man pointing at the page */}
      <Man x={166} y={124} flip shirt={SHIRT} />
    </>
  );
}

function MobileArt() {
  return (
    <>
      {/* big phone */}
      <rect x="88" y="14" width="56" height="112" rx="13" fill={PAPER} stroke={LINE} strokeWidth="2" />
      <rect x="108" y="20" width="16" height="3.4" rx="1.7" fill={LINE} />
      <rect x="95" y="30" width="42" height="26" rx="5" fill={SOFT} />
      <circle cx="106" cy="43" r="6" fill={SOFT2} />
      <rect x="116" y="38" width="16" height="3.4" rx="1.7" fill={INK_SOFT} />
      <rect x="116" y="45" width="11" height="3.4" rx="1.7" fill={LINE} />
      <rect x="95" y="62" width="20" height="18" rx="4" fill={SOFT2} />
      <rect x="119" y="62" width="18" height="18" rx="4" fill={SOFT} />
      <rect x="95" y="86" width="42" height="5" rx="2.5" fill={LINE} />
      <rect x="95" y="96" width="30" height="5" rx="2.5" fill={LINE} />
      <rect x="95" y="108" width="42" height="10" rx="5" fill={SHIRT} opacity="0.9" />
      {/* floating notification chip */}
      <rect x="148" y="34" width="34" height="14" rx="7" fill={PAPER} stroke={LINE} strokeWidth="1.6" />
      <circle cx="156" cy="41" r="3.4" fill={SHIRT} />
      <rect x="162" y="39.5" width="14" height="3" rx="1.5" fill={LINE} />
      {/* man showing the app */}
      <Man x={56} y={124} shirt={SHIRT_ALT} raisedArm />
    </>
  );
}

function GraduationArt() {
  return (
    <>
      {/* presentation board */}
      <rect x="118" y="26" width="72" height="52" rx="7" fill={PAPER} stroke={LINE} strokeWidth="2" />
      <rect x="126" y="36" width="34" height="4.4" rx="2.2" fill={INK_SOFT} />
      <rect x="126" y="46" width="48" height="3.6" rx="1.8" fill={LINE} />
      <rect x="126" y="54" width="42" height="3.6" rx="1.8" fill={LINE} />
      <rect x="126" y="63" width="22" height="8" rx="4" fill={SOFT2} />
      <path d="M 152 90 l 2 -12 M 172 90 l -2 -12" stroke={LINE} strokeWidth="2.4" strokeLinecap="round" />
      {/* confetti */}
      <circle cx="46" cy="28" r="2.6" fill={SOFT2} />
      <circle cx="96" cy="18" r="2.2" fill={SHIRT} />
      <rect x="66" y="14" width="5" height="5" rx="1.4" fill={SOFT2} transform="rotate(18 68.5 16.5)" />
      <rect x="30" y="52" width="5" height="5" rx="1.4" fill={SOFT} transform="rotate(-14 32.5 54.5)" />
      {/* graduate */}
      <Man x={72} y={124} shirt={SHIRT} raisedArm />
      {/* mortarboard cap on his head */}
      <g transform="translate(72 124)">
        <path d="M -12 -66 L 0 -71.5 L 12 -66 L 0 -60.5 Z" fill={HAIR} />
        <rect x="-6.4" y="-63.4" width="12.8" height="3.6" rx="1.4" fill={HAIR} />
        <path d="M 12 -66 v 7" stroke={SHIRT} strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="12" cy="-57.5" r="2" fill={SHIRT} />
        {/* diploma in raised hand */}
        <rect x="15.5" y="-60.5" width="13" height="6" rx="3" fill={PAPER} stroke={LINE} strokeWidth="1.4" transform="rotate(-24 22 -57.5)" />
        <rect x="20.5" y="-60" width="3" height="5" fill={SHIRT} transform="rotate(-24 22 -57.5)" />
      </g>
    </>
  );
}

function UiuxArt() {
  return (
    <>
      {/* monitor with wireframe */}
      <rect x="34" y="26" width="84" height="58" rx="7" fill={PAPER} stroke={LINE} strokeWidth="2" />
      <rect x="40" y="33" width="20" height="44" rx="4" fill={SOFT} />
      <rect x="43" y="38" width="14" height="3.4" rx="1.7" fill={SOFT2} />
      <rect x="43" y="45" width="14" height="3.4" rx="1.7" fill={SOFT2} />
      <rect x="43" y="52" width="14" height="3.4" rx="1.7" fill={SOFT2} />
      <rect x="65" y="33" width="47" height="12" rx="4" fill={SOFT2} />
      <rect x="65" y="49" width="22" height="28" rx="4" fill={SOFT} />
      <rect x="90" y="49" width="22" height="12" rx="4" fill={SOFT} />
      <rect x="90" y="65" width="22" height="12" rx="4" fill={SHIRT} opacity="0.8" />
      {/* stand + desk */}
      <path d="M 72 84 h 8 l 2 8 h -12 Z" fill={LINE} />
      <path d="M 22 94 h 130" stroke={LINE} strokeWidth="3" strokeLinecap="round" />
      <path d="M 34 94 v 30 M 140 94 v 30" stroke={LINE} strokeWidth="2.6" strokeLinecap="round" />
      {/* cursor accent */}
      <path d="M 100 56 l 8 3 l -3.4 1.6 l 1.8 3.8 l -2.4 1.1 l -1.8 -3.8 l -2.6 2.4 Z" fill={SHIRT} />
      {/* designer presenting the screen */}
      <Man x={176} y={124} flip shirt={SHIRT_ALT} raisedArm />
    </>
  );
}

const ART: Record<ServiceIllustrationVariant, () => ReactElement> = {
  ecommerce: EcommerceArt,
  corporate: CorporateArt,
  landing: LandingArt,
  mobile: MobileArt,
  graduation: GraduationArt,
  uiux: UiuxArt,
};

export function ServiceIllustration({ variant, className }: { variant: ServiceIllustrationVariant; className?: string }) {
  const Art = ART[variant];
  return (
    <svg viewBox="0 0 220 140" role="img" aria-hidden="true" className={className}>
      <ellipse className="service-illustration-backdrop" cx="110" cy="76" rx="98" ry="58" fill={SOFT} opacity="0.55" />
      <g className="service-illustration-art">
        <Art />
      </g>
    </svg>
  );
}
