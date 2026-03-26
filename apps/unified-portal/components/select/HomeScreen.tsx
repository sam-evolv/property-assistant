'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  C, TYPE, RADIUS, SHADOW, EASE, DURATION, KEYFRAMES,
  APP_H, TAB_H, getSkyConfig, getDaysHome,
} from './tokens';

// ─── Props ────────────────────────────────────────────────────────────────────
interface HomeScreenProps {
  purchaserName: string;
  address: string;
  city: string;
  builderName: string;
  handoverDate?: Date;
  solarKw?: number;
  heatPumpActive?: boolean;
  onAI: () => void;
}

// ─── Greeting helper ──────────────────────────────────────────────────────────
function getGreeting(skyName: string): string {
  switch (skyName) {
    case 'dawn':
    case 'morning':
      return 'Good morning';
    case 'afternoon':
      return 'Good afternoon';
    default:
      return 'Good evening';
  }
}

// ─── Reveal helper — staggered opacity + translateY ───────────────────────────
function revealStyle(
  revealed: boolean,
  delay: number,
  y: number = 16,
): React.CSSProperties {
  return {
    opacity: revealed ? 1 : 0,
    transform: revealed ? 'translateY(0)' : `translateY(${y}px)`,
    transition: `all ${DURATION.reveal}ms ${EASE}`,
    transitionDelay: revealed ? `${delay}ms` : '0ms',
  };
}

// ─── House SVG illustration ───────────────────────────────────────────────────
// Full architectural illustration with defs, gradients, windows, chimney,
// door, sparkle animations. Window glow opacity passed as prop.
function House({ windowGlow }: { windowGlow: number }) {
  return (
    <svg
      viewBox="0 0 390 420"
      fill="none"
      style={{ width: '100%', height: '100%', display: 'block' }}
    >
      <defs>
        {/* Gold metallic gradient — three-stop */}
        <linearGradient id="goldMetal" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={C.gHi} />
          <stop offset="50%" stopColor={C.g} />
          <stop offset="100%" stopColor={C.gLo} />
        </linearGradient>

        {/* Window warm glow */}
        <radialGradient id="windowWarm" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor={C.gHi} stopOpacity="0.95" />
          <stop offset="60%" stopColor={C.g} stopOpacity="0.7" />
          <stop offset="100%" stopColor={C.gLo} stopOpacity="0.3" />
        </radialGradient>

        {/* Window ambient spill */}
        <radialGradient id="windowSpill" cx="50%" cy="50%" r="100%">
          <stop offset="0%" stopColor={C.g} stopOpacity="0.4" />
          <stop offset="100%" stopColor={C.g} stopOpacity="0" />
        </radialGradient>

        {/* House body fill — dark surface with subtle warm tint */}
        <linearGradient id="houseFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#12111A" />
          <stop offset="100%" stopColor="#0A0A12" />
        </linearGradient>

        {/* Roof gradient */}
        <linearGradient id="roofFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#181722" />
          <stop offset="100%" stopColor="#0E0D16" />
        </linearGradient>

        {/* Door gradient */}
        <linearGradient id="doorFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#16151E" />
          <stop offset="100%" stopColor="#0C0B14" />
        </linearGradient>

        {/* Sparkle glow filter */}
        <filter id="sparkleGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2" />
        </filter>

        {/* Window light spill filter */}
        <filter id="windowBlur" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="12" />
        </filter>
      </defs>

      {/* ── Ground line ── */}
      <line
        x1="40" y1="370" x2="350" y2="370"
        stroke={C.b1}
        strokeWidth="1"
      />

      {/* ── Main house body ── */}
      <rect
        x="95" y="185" width="200" height="185"
        rx="2"
        fill="url(#houseFill)"
        stroke={C.b2}
        strokeWidth="0.5"
      />

      {/* ── Roof ── */}
      <polygon
        points="75,188 195,95 315,188"
        fill="url(#roofFill)"
        stroke={C.b2}
        strokeWidth="0.5"
        strokeLinejoin="round"
      />
      {/* Roof ridge accent */}
      <line
        x1="195" y1="95" x2="195" y2="100"
        stroke="url(#goldMetal)"
        strokeWidth="2"
        strokeLinecap="round"
      />

      {/* ── Chimney ── */}
      <rect
        x="255" y="110" width="26" height="78"
        rx="1"
        fill="url(#houseFill)"
        stroke={C.b2}
        strokeWidth="0.5"
      />
      {/* Chimney cap */}
      <rect
        x="251" y="108" width="34" height="5"
        rx="1.5"
        fill={C.s3}
        stroke={C.b2}
        strokeWidth="0.5"
      />

      {/* ── Extension / garage wing ── */}
      <rect
        x="295" y="240" width="65" height="130"
        rx="2"
        fill="url(#houseFill)"
        stroke={C.b2}
        strokeWidth="0.5"
      />
      {/* Extension roof (flat) */}
      <rect
        x="290" y="236" width="75" height="6"
        rx="1"
        fill="url(#roofFill)"
        stroke={C.b2}
        strokeWidth="0.5"
      />

      {/* ── Window light spills (behind windows, blurred) ── */}
      <g opacity={windowGlow} filter="url(#windowBlur)">
        {/* Upper left */}
        <ellipse cx="152" cy="248" rx="28" ry="22" fill={C.gFog} />
        {/* Upper right */}
        <ellipse cx="238" cy="248" rx="28" ry="22" fill={C.gFog} />
        {/* Lower left */}
        <ellipse cx="152" cy="320" rx="28" ry="22" fill={C.gFog} />
        {/* Lower right */}
        <ellipse cx="238" cy="320" rx="28" ry="22" fill={C.gFog} />
        {/* Extension window */}
        <ellipse cx="327" cy="295" rx="22" ry="18" fill={C.gFog} />
        {/* Door fan light */}
        <ellipse cx="195" cy="335" rx="14" ry="30" fill={C.gFog} />
      </g>

      {/* ── Windows — upper row ── */}
      <g opacity={windowGlow}>
        {/* Upper left window */}
        <rect x="130" y="220" width="44" height="54" rx="2"
          fill="url(#windowWarm)" />
        {/* Cross bars */}
        <line x1="152" y1="220" x2="152" y2="274"
          stroke={C.b3} strokeWidth="1.2" />
        <line x1="130" y1="247" x2="174" y2="247"
          stroke={C.b3} strokeWidth="1.2" />

        {/* Upper right window */}
        <rect x="216" y="220" width="44" height="54" rx="2"
          fill="url(#windowWarm)" />
        <line x1="238" y1="220" x2="238" y2="274"
          stroke={C.b3} strokeWidth="1.2" />
        <line x1="216" y1="247" x2="260" y2="247"
          stroke={C.b3} strokeWidth="1.2" />
      </g>

      {/* ── Windows — lower row ── */}
      <g opacity={windowGlow}>
        {/* Lower left window */}
        <rect x="130" y="292" width="44" height="54" rx="2"
          fill="url(#windowWarm)" />
        <line x1="152" y1="292" x2="152" y2="346"
          stroke={C.b3} strokeWidth="1.2" />
        <line x1="130" y1="319" x2="174" y2="319"
          stroke={C.b3} strokeWidth="1.2" />

        {/* Lower right window */}
        <rect x="216" y="292" width="44" height="54" rx="2"
          fill="url(#windowWarm)" />
        <line x1="238" y1="292" x2="238" y2="346"
          stroke={C.b3} strokeWidth="1.2" />
        <line x1="216" y1="319" x2="260" y2="319"
          stroke={C.b3} strokeWidth="1.2" />
      </g>

      {/* ── Roof window / dormer ── */}
      <g opacity={windowGlow * 0.8}>
        <rect x="178" y="140" width="34" height="38" rx="2"
          fill="url(#windowWarm)" />
        {/* Dormer frame */}
        <polygon
          points="172,142 195,122 218,142"
          fill="url(#roofFill)"
          stroke={C.b2}
          strokeWidth="0.5"
        />
        <line x1="195" y1="140" x2="195" y2="178"
          stroke={C.b3} strokeWidth="1" />
      </g>

      {/* ── Extension window ── */}
      <g opacity={windowGlow}>
        <rect x="309" y="270" width="36" height="48" rx="2"
          fill="url(#windowWarm)" />
        <line x1="327" y1="270" x2="327" y2="318"
          stroke={C.b3} strokeWidth="1.2" />
        <line x1="309" y1="294" x2="345" y2="294"
          stroke={C.b3} strokeWidth="1.2" />
      </g>

      {/* ── Front door ── */}
      <rect x="181" y="320" width="28" height="50" rx="2"
        fill="url(#doorFill)"
        stroke={C.b2}
        strokeWidth="0.5"
      />
      {/* Door handle */}
      <circle cx="203" cy="347" r="2"
        fill="url(#goldMetal)" />
      {/* Fan light above door */}
      <g opacity={windowGlow * 0.6}>
        <path
          d="M181,322 A14,14 0 0,1 209,322"
          fill="url(#windowWarm)"
        />
      </g>

      {/* ── Window frames (unlit outlines) ── */}
      <g opacity={1 - windowGlow * 0.6}>
        <rect x="130" y="220" width="44" height="54" rx="2"
          fill="none" stroke={C.b2} strokeWidth="0.7" />
        <rect x="216" y="220" width="44" height="54" rx="2"
          fill="none" stroke={C.b2} strokeWidth="0.7" />
        <rect x="130" y="292" width="44" height="54" rx="2"
          fill="none" stroke={C.b2} strokeWidth="0.7" />
        <rect x="216" y="292" width="44" height="54" rx="2"
          fill="none" stroke={C.b2} strokeWidth="0.7" />
        <rect x="309" y="270" width="36" height="48" rx="2"
          fill="none" stroke={C.b2} strokeWidth="0.7" />
      </g>

      {/* ── Sparkles — gold accent particles ── */}
      <g filter="url(#sparkleGlow)">
        <circle cx="138" cy="210" r="1.5" fill={C.gHi}>
          <animate attributeName="opacity"
            values="0;1;0" dur="3.2s" repeatCount="indefinite" begin="0s" />
        </circle>
        <circle cx="260" cy="195" r="1.2" fill={C.gHi}>
          <animate attributeName="opacity"
            values="0;1;0" dur="2.8s" repeatCount="indefinite" begin="0.8s" />
        </circle>
        <circle cx="310" cy="260" r="1" fill={C.gHi}>
          <animate attributeName="opacity"
            values="0;1;0" dur="3.6s" repeatCount="indefinite" begin="1.5s" />
        </circle>
        <circle cx="110" cy="310" r="1.4" fill={C.gHi}>
          <animate attributeName="opacity"
            values="0;1;0" dur="4s" repeatCount="indefinite" begin="0.4s" />
        </circle>
        <circle cx="195" cy="92" r="1.8" fill={C.gHi}>
          <animate attributeName="opacity"
            values="0;0.9;0" dur="5s" repeatCount="indefinite" begin="2s" />
        </circle>
        <circle cx="345" cy="230" r="1" fill={C.gHi}>
          <animate attributeName="opacity"
            values="0;0.8;0" dur="3s" repeatCount="indefinite" begin="1.2s" />
        </circle>
        <circle cx="85" cy="180" r="1.2" fill={C.g}>
          <animate attributeName="opacity"
            values="0;0.7;0" dur="4.4s" repeatCount="indefinite" begin="0.6s" />
        </circle>
      </g>

      {/* ── Select badge — gold circle at rooftop ── */}
      <g>
        <circle cx="195" cy="80" r="8"
          fill={C.bg}
          stroke="url(#goldMetal)"
          strokeWidth="1.5"
        >
          <animate attributeName="r" values="8;8.6;8" dur="4s"
            repeatCount="indefinite" />
        </circle>
        <text x="195" y="83.5"
          textAnchor="middle"
          fill="url(#goldMetal)"
          style={{ fontSize: 7, fontWeight: 900, letterSpacing: '0.06em' }}
        >
          S
        </text>
      </g>
    </svg>
  );
}

// ─── HomeScreen ───────────────────────────────────────────────────────────────
export default function HomeScreen({
  purchaserName,
  address,
  city,
  builderName,
  handoverDate,
  solarKw,
  heatPumpActive,
  onAI,
}: HomeScreenProps) {
  const sky = useMemo(() => getSkyConfig(), []);
  const daysHome = useMemo(() => getDaysHome(handoverDate), [handoverDate]);
  const firstName = purchaserName.split(' ')[0];
  const greeting = getGreeting(sky.name);

  // ── Reveal state (staggered mount animation) ──
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setRevealed(true), 80);
    return () => clearTimeout(id);
  }, []);

  // ── Window glow: rAF-driven 0→1 over DURATION.window ms ──
  const [windowGlow, setWindowGlow] = useState(sky.windowGlowBase);
  const startRef = useRef<number | null>(null);

  const animate = useCallback((ts: number) => {
    if (startRef.current === null) startRef.current = ts;
    const elapsed = ts - startRef.current;
    const progress = Math.min(elapsed / DURATION.window, 1);
    // Ease-out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    const value = sky.windowGlowBase + (1 - sky.windowGlowBase) * eased;
    setWindowGlow(value);
    if (progress < 1) requestAnimationFrame(animate);
  }, [sky.windowGlowBase]);

  useEffect(() => {
    const id = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(id);
  }, [animate]);

  // ── Address display: extract street name for the "Rise." gold line ──
  const streetName = address.split(',')[0].trim();
  // Pull last word for the gold-gradient accent (e.g. "Rise", "Park", "Drive")
  const addressWords = streetName.split(' ');
  const lastWord = addressWords.pop() || '';
  const addressPrefix = addressWords.join(' ');

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        minHeight: '100vh',
        maxHeight: APP_H,
        background: sky.bg,
        overflow: 'hidden',
        fontFamily: '"Inter", system-ui, sans-serif',
      }}
    >
      {/* Inject keyframes */}
      <style dangerouslySetInnerHTML={{ __html: KEYFRAMES }} />

      {/* ── Ambient breathing orbs ── */}
      {[
        { top: '12%', left: '15%', size: 280, anim: 'orb0', dur: 12 },
        { top: '48%', left: '78%', size: 220, anim: 'orb1', dur: 14 },
        { top: '68%', left: '30%', size: 190, anim: 'orb2', dur: 16 },
      ].map((orb, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            top: orb.top,
            left: orb.left,
            width: orb.size,
            height: orb.size,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${sky.orbColor} 0%, transparent 70%)`,
            opacity: revealed ? 1 : 0,
            transition: `opacity ${DURATION.window}ms ${EASE}`,
            animation: `${orb.anim} ${orb.dur}s ${EASE} infinite alternate`,
            pointerEvents: 'none',
          }}
        />
      ))}

      {/* ── Star field ── */}
      {sky.starsOpacity > 0.08 && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            opacity: revealed ? sky.starsOpacity : 0,
            transition: `opacity ${DURATION.window}ms ${EASE}`,
            background: `
              radial-gradient(1px 1px at 12% 8%, ${C.t1} 50%, transparent 100%),
              radial-gradient(1px 1px at 38% 22%, ${C.t1} 50%, transparent 100%),
              radial-gradient(1px 1px at 64% 6%, ${C.t1} 50%, transparent 100%),
              radial-gradient(1px 1px at 82% 30%, ${C.t1} 50%, transparent 100%),
              radial-gradient(1px 1px at 22% 48%, ${C.t1} 50%, transparent 100%),
              radial-gradient(1px 1px at 50% 14%, ${C.t1} 50%, transparent 100%),
              radial-gradient(1px 1px at 75% 42%, ${C.t1} 50%, transparent 100%),
              radial-gradient(1.2px 1.2px at 8% 34%, ${C.t1} 40%, transparent 100%),
              radial-gradient(0.8px 0.8px at 90% 18%, ${C.t1} 50%, transparent 100%),
              radial-gradient(1px 1px at 55% 38%, ${C.t1} 50%, transparent 100%)
            `,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* ── Horizon glow ── */}
      {sky.horizonGlow !== 'none' && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 140,
            background: `linear-gradient(0deg, ${sky.horizonGlow}, transparent)`,
            opacity: revealed ? 1 : 0,
            transition: `opacity ${DURATION.window}ms ${EASE}`,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* ── House SVG — top 62% of screen, full bleed ── */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '62%',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          pointerEvents: 'none',
          opacity: revealed ? 1 : 0,
          transform: revealed ? 'translateY(0)' : 'translateY(8px)',
          transition: `all ${DURATION.window}ms ${EASE}`,
        }}
      >
        <House windowGlow={windowGlow} />
      </div>

      {/* ── Content — anchored to bottom ── */}
      <div
        style={{
          position: 'absolute',
          bottom: TAB_H + 16,
          left: 0,
          right: 0,
          padding: '0 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          zIndex: 2,
        }}
      >
        {/* Gold overline greeting */}
        <div style={{
          ...TYPE.overline,
          color: C.g,
          ...revealStyle(revealed, 200),
        }}>
          {greeting}, {firstName}
        </div>

        {/* Address — display type with gold gradient last word */}
        <div style={{
          ...TYPE.display,
          color: C.t1,
          margin: 0,
          ...revealStyle(revealed, 350, 20),
        }}>
          {addressPrefix}{' '}
          <span
            style={{
              background: `linear-gradient(180deg, ${C.gHi}, ${C.g}, ${C.gLo})`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            {lastWord}.
          </span>
        </div>

        {/* City + Builder */}
        <div style={{
          ...TYPE.body,
          color: C.t2,
          margin: 0,
          ...revealStyle(revealed, 480),
        }}>
          {city} · Built by {builderName}
        </div>

        {/* Day counter line */}
        <div style={{
          ...TYPE.caption,
          color: C.t3,
          ...revealStyle(revealed, 580),
        }}>
          Day {daysHome} in your new home
        </div>

        {/* ── Status pills row ── */}
        <div
          style={{
            display: 'flex',
            gap: 8,
            marginTop: 6,
            ...revealStyle(revealed, 680),
          }}
        >
          {/* Solar kW pill */}
          {solarKw !== undefined && (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 12px',
              borderRadius: RADIUS.pill,
              background: C.glMid,
              border: `1px solid ${C.gB}`,
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: C.amb,
                animation: `livePulse 2.4s ${EASE} infinite`,
              }} />
              <span style={{ ...TYPE.caption, color: C.t2 }}>
                {solarKw.toFixed(1)} kW
              </span>
            </div>
          )}

          {/* Heat pump pill */}
          {heatPumpActive !== undefined && (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 12px',
              borderRadius: RADIUS.pill,
              background: C.glMid,
              border: `1px solid ${C.gB}`,
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: heatPumpActive ? C.grn : C.t3,
                animation: heatPumpActive
                  ? `livePulse 2.4s ${EASE} infinite`
                  : 'none',
              }} />
              <span style={{ ...TYPE.caption, color: C.t2 }}>
                Heat Pump {heatPumpActive ? 'Active' : 'Idle'}
              </span>
            </div>
          )}
        </div>

        {/* ── AI CTA button ── */}
        <button
          onClick={onAI}
          style={{
            marginTop: 8,
            padding: '13px 0',
            width: '100%',
            border: `1px solid ${C.gB2}`,
            borderRadius: RADIUS.md,
            background: `linear-gradient(180deg, ${C.s3}, ${C.s2})`,
            color: C.g,
            cursor: 'pointer',
            boxShadow: SHADOW.goldGlow,
            ...TYPE.title,
            letterSpacing: '0.08em',
            textTransform: 'uppercase' as const,
            ...revealStyle(revealed, 800, 12),
          }}
        >
          Ask Your Home
        </button>
      </div>
    </div>
  );
}
