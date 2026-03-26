'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  C, TYPE, RADIUS, SHADOW, EASE, DURATION, KEYFRAMES,
  APP_H, getSkyConfig, getDaysHome,
} from './tokens';

interface WelcomeScreenProps {
  purchaserName: string;
  address: string;
  handoverDate?: Date;
  onEnter: () => void;
}

export default function WelcomeScreen({
  purchaserName,
  address,
  handoverDate,
  onEnter,
}: WelcomeScreenProps) {
  const [phase, setPhase] = useState<'dark' | 'reveal' | 'ready'>('dark');
  const sky = useMemo(() => getSkyConfig(), []);
  const daysHome = useMemo(() => getDaysHome(handoverDate), [handoverDate]);
  const firstName = purchaserName.split(' ')[0];

  // Orchestrate the reveal sequence
  useEffect(() => {
    const t1 = setTimeout(() => setPhase('reveal'), 300);
    const t2 = setTimeout(() => setPhase('ready'), 300 + DURATION.welcome);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const revealed = phase !== 'dark';
  const ready = phase === 'ready';

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        minHeight: '100vh',
        maxHeight: APP_H,
        background: sky.bg,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        fontFamily: '"Inter", system-ui, sans-serif',
      }}
    >
      {/* Inject keyframes */}
      <style dangerouslySetInnerHTML={{ __html: KEYFRAMES }} />

      {/* ── Ambient orbs ── */}
      {[
        { top: '18%', left: '20%', size: 260, anim: 'orb0', dur: 12 },
        { top: '55%', left: '75%', size: 200, anim: 'orb1', dur: 14 },
        { top: '72%', left: '35%', size: 180, anim: 'orb2', dur: 16 },
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
            transition: `opacity ${DURATION.welcome}ms ${EASE}`,
            animation: `${orb.anim} ${orb.dur}s ${EASE} infinite alternate`,
            pointerEvents: 'none',
          }}
        />
      ))}

      {/* ── Star field (opacity driven by sky) ── */}
      {sky.starsOpacity > 0.1 && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            opacity: revealed ? sky.starsOpacity : 0,
            transition: `opacity ${DURATION.welcome}ms ${EASE}`,
            background: `
              radial-gradient(1px 1px at 15% 12%, ${C.t1} 50%, transparent 100%),
              radial-gradient(1px 1px at 42% 28%, ${C.t1} 50%, transparent 100%),
              radial-gradient(1px 1px at 68% 8%, ${C.t1} 50%, transparent 100%),
              radial-gradient(1px 1px at 85% 35%, ${C.t1} 50%, transparent 100%),
              radial-gradient(1px 1px at 25% 55%, ${C.t1} 50%, transparent 100%),
              radial-gradient(1px 1px at 55% 48%, ${C.t1} 50%, transparent 100%),
              radial-gradient(1px 1px at 78% 62%, ${C.t1} 50%, transparent 100%),
              radial-gradient(1px 1px at 10% 75%, ${C.t1} 50%, transparent 100%),
              radial-gradient(1px 1px at 92% 82%, ${C.t1} 50%, transparent 100%)
            `,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* ── Window glow (house silhouette placeholder) ── */}
      <div
        style={{
          position: 'absolute',
          top: '22%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 120,
          height: 80,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 8,
          opacity: revealed ? sky.windowGlowBase : 0,
          transition: `opacity ${DURATION.welcome}ms ${EASE}`,
          pointerEvents: 'none',
        }}
      >
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              borderRadius: 3,
              background: `linear-gradient(180deg, ${C.gHi}, ${C.g})`,
              opacity: 0.7 + (i % 2) * 0.15,
              boxShadow: SHADOW.goldGlow,
            }}
          />
        ))}
      </div>

      {/* ── Horizon glow ── */}
      {sky.horizonGlow !== 'none' && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 120,
            background: `linear-gradient(0deg, ${sky.horizonGlow}, transparent)`,
            opacity: revealed ? 1 : 0,
            transition: `opacity ${DURATION.welcome}ms ${EASE}`,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* ── Content ── */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          padding: '0 28px 60px',
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}
      >
        {/* Overline */}
        <div
          style={{
            ...TYPE.overline,
            color: C.g,
            opacity: revealed ? 1 : 0,
            transform: revealed ? 'translateY(0)' : 'translateY(12px)',
            transition: `all ${DURATION.reveal}ms ${EASE}`,
            transitionDelay: revealed ? '200ms' : '0ms',
          }}
        >
          Welcome Home
        </div>

        {/* Hero name */}
        <h1
          style={{
            ...TYPE.hero,
            color: C.t1,
            margin: 0,
            opacity: revealed ? 1 : 0,
            transform: revealed ? 'translateY(0)' : 'translateY(20px)',
            transition: `all ${DURATION.reveal}ms ${EASE}`,
            transitionDelay: revealed ? '400ms' : '0ms',
          }}
        >
          {firstName}.
        </h1>

        {/* Address */}
        <p
          style={{
            ...TYPE.body,
            color: C.t2,
            margin: 0,
            opacity: revealed ? 1 : 0,
            transform: revealed ? 'translateY(0)' : 'translateY(14px)',
            transition: `all ${DURATION.reveal}ms ${EASE}`,
            transitionDelay: revealed ? '600ms' : '0ms',
          }}
        >
          {address}
        </p>

        {/* Day counter pill */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            alignSelf: 'flex-start',
            gap: 6,
            padding: '6px 14px',
            borderRadius: RADIUS.pill,
            background: C.glMid,
            border: `1px solid ${C.gB}`,
            opacity: ready ? 1 : 0,
            transform: ready ? 'translateY(0)' : 'translateY(10px)',
            transition: `all ${DURATION.base}ms ${EASE}`,
            transitionDelay: ready ? '100ms' : '0ms',
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: C.grn,
              animation: `livePulse 2.4s ${EASE} infinite`,
            }}
          />
          <span style={{ ...TYPE.caption, color: C.t2 }}>
            Day {daysHome}
          </span>
        </div>

        {/* Enter button */}
        <button
          onClick={onEnter}
          style={{
            marginTop: 12,
            padding: '14px 0',
            width: '100%',
            border: `1px solid ${C.gB2}`,
            borderRadius: RADIUS.md,
            background: `linear-gradient(180deg, ${C.s3}, ${C.s2})`,
            color: C.g,
            cursor: 'pointer',
            opacity: ready ? 1 : 0,
            transform: ready ? 'translateY(0)' : 'translateY(12px)',
            transition: `all ${DURATION.base}ms ${EASE}`,
            transitionDelay: ready ? '300ms' : '0ms',
            boxShadow: SHADOW.goldGlow,
            ...TYPE.title,
            letterSpacing: '0.08em',
            textTransform: 'uppercase' as const,
          }}
        >
          Enter Your Home
        </button>
      </div>
    </div>
  );
}
