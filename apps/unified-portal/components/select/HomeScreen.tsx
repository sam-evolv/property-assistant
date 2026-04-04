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
  handoverDate?: string;
  solarKw?: number;
  heatPumpActive?: boolean;
  onAI: () => void;
}

// ─── Greeting ─────────────────────────────────────────────────────────────────
function getGreeting(name: string): string {
  switch (name) {
    case 'dawn': case 'morning': return 'Good morning';
    case 'afternoon': return 'Good afternoon';
    default: return 'Good evening';
  }
}

// ─── Reveal helper ────────────────────────────────────────────────────────────
function rv(on: boolean, delay: number, y = 16): React.CSSProperties {
  return {
    opacity: on ? 1 : 0,
    transform: on ? 'translateY(0)' : `translateY(${y}px)`,
    transition: `all ${DURATION.reveal}ms ${EASE}`,
    transitionDelay: on ? `${delay}ms` : '0ms',
  };
}

// ─── House SVG ────────────────────────────────────────────────────────────────
function House({ windowGlow }: { windowGlow: number }) {
  return (
    <svg viewBox="0 0 390 440" fill="none" style={{ width: '100%', height: '100%', display: 'block' }}>
      <defs>
        {/* Gold metallic 3-stop */}
        <linearGradient id="hGold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={C.gHi} />
          <stop offset="50%" stopColor={C.g} />
          <stop offset="100%" stopColor={C.gLo} />
        </linearGradient>
        {/* Wall */}
        <linearGradient id="hWall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#13121C" />
          <stop offset="100%" stopColor="#0A0A12" />
        </linearGradient>
        {/* Roof */}
        <linearGradient id="hRoof" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1A1926" />
          <stop offset="100%" stopColor="#0E0D16" />
        </linearGradient>
        {/* Window warm amber */}
        <radialGradient id="hWin" cx="50%" cy="40%" r="70%">
          <stop offset="0%" stopColor={C.gHi} stopOpacity="0.95" />
          <stop offset="55%" stopColor={C.g} stopOpacity="0.65" />
          <stop offset="100%" stopColor={C.gLo} stopOpacity="0.25" />
        </radialGradient>
        {/* Window spill blur */}
        <filter id="hSpill" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="14" />
        </filter>
        {/* Sparkle glow */}
        <filter id="hSpark" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" />
        </filter>
        {/* Ground glow */}
        <radialGradient id="hGround" cx="50%" cy="0%" r="80%">
          <stop offset="0%" stopColor={C.g} stopOpacity="0.12" />
          <stop offset="100%" stopColor={C.g} stopOpacity="0" />
        </radialGradient>
        {/* Star twinkle */}
        <filter id="hStar" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="1" />
        </filter>
        {/* Door */}
        <linearGradient id="hDoor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#16151E" />
          <stop offset="100%" stopColor="#0C0B14" />
        </linearGradient>
        {/* Solar panel face */}
        <linearGradient id="hPanel" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#14162A" />
          <stop offset="100%" stopColor="#0C0E1E" />
        </linearGradient>
        {/* Tree canopy */}
        <radialGradient id="hTree" cx="50%" cy="60%" r="55%">
          <stop offset="0%" stopColor="#101A12" />
          <stop offset="100%" stopColor="#080E0A" />
        </radialGradient>
      </defs>

      {/* ── Star field ── */}
      <g filter="url(#hStar)" opacity={0.6}>
        {[[48,28],[112,18],[165,42],[230,12],[285,35],[340,22],[70,55],[310,58],[195,8],[155,65]].map(([cx,cy],i) => (
          <circle key={i} cx={cx} cy={cy} r={0.8 + (i % 3) * 0.4} fill={C.t1}>
            <animate attributeName="opacity" values="0.2;0.8;0.2" dur={`${2.5 + i * 0.7}s`} repeatCount="indefinite" begin={`${i * 0.4}s`} />
          </circle>
        ))}
      </g>

      {/* ── Trees ── */}
      {/* Left tree */}
      <rect x="58" y="310" width="6" height="60" rx="2" fill="#0E0D14" />
      <ellipse cx="61" cy="295" rx="22" ry="32" fill="url(#hTree)" stroke={C.b1} strokeWidth="0.5" />
      {/* Right tree */}
      <rect x="338" y="318" width="5" height="52" rx="2" fill="#0E0D14" />
      <ellipse cx="340" cy="305" rx="18" ry="26" fill="url(#hTree)" stroke={C.b1} strokeWidth="0.5" />

      {/* ── Ground glow ellipse ── */}
      <ellipse cx="195" cy="380" rx="160" ry="30" fill="url(#hGround)" opacity={windowGlow} />

      {/* ── Ground line ── */}
      <line x1="30" y1="375" x2="360" y2="375" stroke={C.b1} strokeWidth="1" />

      {/* ── Main house body ── */}
      <rect x="100" y="190" width="190" height="185" rx="2" fill="url(#hWall)" stroke={C.b2} strokeWidth="0.5" />

      {/* ── Roof ── */}
      <polygon points="80,193 195,95 310,193" fill="url(#hRoof)" stroke={C.b2} strokeWidth="0.5" strokeLinejoin="round" />
      {/* Ridge cap */}
      <line x1="195" y1="95" x2="195" y2="101" stroke="url(#hGold)" strokeWidth="2.5" strokeLinecap="round" />

      {/* ── Chimney ── */}
      <rect x="252" y="115" width="24" height="78" rx="1" fill="url(#hWall)" stroke={C.b2} strokeWidth="0.5" />
      <rect x="248" y="113" width="32" height="5" rx="1.5" fill={C.s3} stroke={C.b2} strokeWidth="0.5" />
      {/* Smoke wisps */}
      <g opacity={0.18}>
        <ellipse cx="264" cy="100" rx="5" ry="3" fill={C.t2}>
          <animate attributeName="cy" values="100;75;50" dur="6s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.18;0.08;0" dur="6s" repeatCount="indefinite" />
          <animate attributeName="rx" values="5;9;14" dur="6s" repeatCount="indefinite" />
        </ellipse>
        <ellipse cx="262" cy="95" rx="4" ry="2.5" fill={C.t2}>
          <animate attributeName="cy" values="95;68;40" dur="7s" repeatCount="indefinite" begin="2s" />
          <animate attributeName="opacity" values="0.14;0.06;0" dur="7s" repeatCount="indefinite" begin="2s" />
          <animate attributeName="rx" values="4;8;12" dur="7s" repeatCount="indefinite" begin="2s" />
        </ellipse>
      </g>

      {/* ── Solar panels on roof ── */}
      <g>
        {/* Row of 4 panels on right roof slope */}
        {[0,1,2,3].map(i => {
          const x = 210 + i * 22;
          const yOff = -i * 9;
          return (
            <g key={i}>
              <rect x={x} y={148 + yOff} width="18" height="28" rx="1.5"
                fill="url(#hPanel)" stroke={C.b2} strokeWidth="0.5"
                transform={`rotate(${24}, ${x + 9}, ${148 + yOff + 14})`} />
              {/* Grid lines */}
              <line x1={x + 9} y1={148 + yOff} x2={x + 9} y2={148 + yOff + 28}
                stroke={C.b1} strokeWidth="0.3"
                transform={`rotate(${24}, ${x + 9}, ${148 + yOff + 14})`} />
              <line x1={x} y1={148 + yOff + 14} x2={x + 18} y2={148 + yOff + 14}
                stroke={C.b1} strokeWidth="0.3"
                transform={`rotate(${24}, ${x + 9}, ${148 + yOff + 14})`} />
            </g>
          );
        })}
        {/* Solar sparkles */}
        <g filter="url(#hSpark)">
          <circle cx="235" cy="140" r="1.8" fill={C.gHi}>
            <animate attributeName="opacity" values="0;1;0" dur="3.5s" repeatCount="indefinite" begin="0s" />
          </circle>
          <circle cx="258" cy="128" r="1.4" fill={C.gHi}>
            <animate attributeName="opacity" values="0;0.9;0" dur="4.2s" repeatCount="indefinite" begin="1.2s" />
          </circle>
          <circle cx="278" cy="118" r="1.2" fill={C.gHi}>
            <animate attributeName="opacity" values="0;0.8;0" dur="3.8s" repeatCount="indefinite" begin="2.1s" />
          </circle>
        </g>
      </g>

      {/* ── Window light spills ── */}
      <g opacity={windowGlow} filter="url(#hSpill)">
        <ellipse cx="155" cy="260" rx="30" ry="24" fill={C.gFog} />
        <ellipse cx="235" cy="260" rx="30" ry="24" fill={C.gFog} />
        <ellipse cx="195" cy="345" rx="16" ry="32" fill={C.gFog} />
      </g>

      {/* ── Windows (2 main) ── */}
      <g opacity={windowGlow}>
        {/* Left window */}
        <rect x="130" y="228" width="50" height="60" rx="2.5" fill="url(#hWin)" />
        <line x1="155" y1="228" x2="155" y2="288" stroke={C.b3} strokeWidth="1.2" />
        <line x1="130" y1="258" x2="180" y2="258" stroke={C.b3} strokeWidth="1.2" />
        {/* Right window */}
        <rect x="210" y="228" width="50" height="60" rx="2.5" fill="url(#hWin)" />
        <line x1="235" y1="228" x2="235" y2="288" stroke={C.b3} strokeWidth="1.2" />
        <line x1="210" y1="258" x2="260" y2="258" stroke={C.b3} strokeWidth="1.2" />
      </g>
      {/* Window frames (visible when unlit) */}
      <g opacity={1 - windowGlow * 0.7}>
        <rect x="130" y="228" width="50" height="60" rx="2.5" fill="none" stroke={C.b2} strokeWidth="0.7" />
        <rect x="210" y="228" width="50" height="60" rx="2.5" fill="none" stroke={C.b2} strokeWidth="0.7" />
      </g>

      {/* ── Door ── */}
      <rect x="180" y="322" width="30" height="53" rx="2" fill="url(#hDoor)" stroke={C.b2} strokeWidth="0.5" />
      {/* Gold arch */}
      <path d="M180,325 A15,15 0 0,1 210,325" fill="none" stroke="url(#hGold)" strokeWidth="1.2" />
      {/* Fan light glow */}
      <g opacity={windowGlow * 0.55}>
        <path d="M182,325 A13,13 0 0,1 208,325 L182,325 Z" fill="url(#hWin)" />
      </g>
      {/* Handle */}
      <circle cx="204" cy="350" r="2" fill="url(#hGold)" />

      {/* ── Accent sparkles ── */}
      <g filter="url(#hSpark)">
        <circle cx="100" cy="215" r="1.5" fill={C.gHi}>
          <animate attributeName="opacity" values="0;1;0" dur="3s" repeatCount="indefinite" begin="0.5s" />
        </circle>
        <circle cx="300" cy="200" r="1.2" fill={C.gHi}>
          <animate attributeName="opacity" values="0;0.9;0" dur="3.6s" repeatCount="indefinite" begin="1.8s" />
        </circle>
        <circle cx="195" cy="90" r="2" fill={C.gHi}>
          <animate attributeName="opacity" values="0;0.85;0" dur="5s" repeatCount="indefinite" begin="0s" />
        </circle>
      </g>
    </svg>
  );
}

// ─── Badge (gold circle with S) ───────────────────────────────────────────────
function Badge({ size = 28 }: { size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: `linear-gradient(135deg, ${C.gHi}, ${C.g}, ${C.gLo})`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: SHADOW.goldGlow,
      flexShrink: 0,
    }}>
      <span style={{ ...TYPE.micro, color: C.bg, fontSize: size * 0.38 }}>S</span>
    </div>
  );
}

// ─── HomeScreen ───────────────────────────────────────────────────────────────
export default function HomeScreen({
  purchaserName, address, city, builderName,
  handoverDate, solarKw, heatPumpActive, onAI,
}: HomeScreenProps) {
  const sky = useMemo(() => getSkyConfig(), []);
  const daysHome = useMemo(
    () => getDaysHome(handoverDate ? new Date(handoverDate) : undefined),
    [handoverDate],
  );
  const firstName = purchaserName.split(' ')[0];
  const greeting = getGreeting(sky.name);

  // Reveal
  const [on, setOn] = useState(false);
  useEffect(() => { const id = setTimeout(() => setOn(true), 80); return () => clearTimeout(id); }, []);

  // Window glow: rAF 0→1 over DURATION.window with ease-out
  const [windowGlow, setWindowGlow] = useState(sky.windowGlowBase);
  const startRef = useRef<number | null>(null);
  const animate = useCallback((ts: number) => {
    if (startRef.current === null) startRef.current = ts;
    const p = Math.min((ts - startRef.current) / DURATION.window, 1);
    const eased = 1 - Math.pow(1 - p, 2.4);
    setWindowGlow(sky.windowGlowBase + (1 - sky.windowGlowBase) * eased);
    if (p < 1) requestAnimationFrame(animate);
  }, [sky.windowGlowBase]);
  useEffect(() => { const id = requestAnimationFrame(animate); return () => cancelAnimationFrame(id); }, [animate]);

  // Address split
  const lines = address.split(',');
  const line1 = lines[0]?.trim() || address;
  const words = line1.split(' ');
  const lastWord = words.pop() || '';
  const prefix = words.join(' ');

  return (
    <div style={{
      position: 'relative', width: '100%', height: '100%',
      background: sky.bg, overflow: 'hidden',
      fontFamily: '"Inter", system-ui, sans-serif',
    }}>
      <style dangerouslySetInnerHTML={{ __html: KEYFRAMES }} />

      {/* ── Ambient orbs ── */}
      {[
        { top: '52%', left: '20%', size: 260, anim: 'orb0', dur: 12 },
        { top: '10%', left: '58%', size: 220, anim: 'orb1', dur: 14 },
        { top: '88%', left: '48%', size: 190, anim: 'orb2', dur: 16 },
      ].map((o, i) => (
        <div key={i} style={{
          position: 'absolute', top: o.top, left: o.left,
          width: o.size, height: o.size, borderRadius: '50%',
          background: `radial-gradient(circle, ${sky.orbColor} 0%, transparent 70%)`,
          opacity: on ? 1 : 0, transition: `opacity ${DURATION.window}ms ${EASE}`,
          animation: `${o.anim} ${o.dur}s ${EASE} infinite alternate`,
          pointerEvents: 'none',
        }} />
      ))}

      {/* ── House zone — top 62% ── */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '62%',
        overflow: 'hidden', pointerEvents: 'none',
        opacity: on ? 1 : 0, transform: on ? 'translateY(0)' : 'translateY(6px)',
        transition: `all ${DURATION.window}ms ${EASE}`,
      }}>
        {/* Hero photo */}
        <img
          src="/select-hero.png"
          alt=""
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: 'cover', objectPosition: "center 55%",
          }}
        />
        {/* Dark tint overlay — keeps photo subtle and preserves dark aesthetic */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'rgba(4, 4, 10, 0.62)',
        }} />
        {/* Subtle gold warmth gradient from bottom */}
        <div style={{
          position: 'absolute', inset: 0,
          background: `linear-gradient(to top, ${C.bg} 0%, rgba(4,4,10,0.3) 45%, transparent 100%)`,
        }} />
        {/* SVG house sits on top of photo */}
        <House windowGlow={windowGlow} />
        {/* Bottom vignette — blend into app background */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 120,
          background: `linear-gradient(0deg, ${C.bg} 0%, transparent 100%)`,
        }} />
      </div>

      {/* ── Content — anchored to bottom ── */}
      <div style={{
        position: 'absolute', bottom: 20, left: 0, right: 0,
        padding: '0 24px', display: 'flex', flexDirection: 'column', gap: 8,
        zIndex: 2,
      }}>
        {/* Gold overline greeting */}
        <div style={{ ...TYPE.overline, color: C.g, ...rv(on, 200) }}>
          {greeting}, {firstName}
        </div>

        {/* Address line 1 */}
        <div style={{ ...TYPE.display, color: C.t1, margin: 0, ...rv(on, 320, 20) }}>
          {prefix}
        </div>
        {/* Street name with gold gradient */}
        <div style={{
          ...TYPE.display, margin: 0, ...rv(on, 400, 20),
          background: `linear-gradient(180deg, ${C.gHi}, ${C.g}, ${C.gLo})`,
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}>
          {lastWord}.
        </div>

        {/* Day · city · builder */}
        <div style={{
          fontSize: 11.5, color: C.t2, margin: 0, ...rv(on, 500),
        }}>
          Day {daysHome} · {city} · {builderName}
        </div>

        {/* Status pills */}
        <div style={{ display: 'flex', gap: 8, marginTop: 4, ...rv(on, 620) }}>
          {solarKw !== undefined && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '5px 12px', borderRadius: RADIUS.pill,
              background: C.glMid, border: `1px solid ${C.gB}`,
              backdropFilter: 'blur(12px)',
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%', background: C.grn,
                animation: `livePulse 2.4s ${EASE} infinite`,
              }} />
              <span style={{ ...TYPE.caption, color: C.t2 }}>{solarKw.toFixed(1)} kW</span>
            </div>
          )}
          {heatPumpActive !== undefined && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '5px 12px', borderRadius: RADIUS.pill,
              background: C.glMid, border: `1px solid ${C.gB}`,
              backdropFilter: 'blur(12px)',
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: heatPumpActive ? C.blu : C.t3,
                animation: heatPumpActive ? `livePulse 2.4s ${EASE} infinite` : 'none',
              }} />
              <span style={{ ...TYPE.caption, color: C.t2 }}>
                Heat Pump {heatPumpActive ? 'Active' : 'Idle'}
              </span>
            </div>
          )}
        </div>

        {/* AI CTA */}
        <button onClick={onAI} style={{
          marginTop: 6, padding: '13px 18px', width: '100%',
          border: `1px solid ${C.gB}`, borderRadius: RADIUS.md,
          background: C.glDark, backdropFilter: 'blur(16px)',
          color: C.t1, cursor: 'pointer', boxShadow: SHADOW.card,
          display: 'flex', alignItems: 'center', gap: 12,
          ...rv(on, 740, 12),
        }}>
          <Badge size={26} />
          <span style={{ ...TYPE.title, flex: 1, textAlign: 'left' }}>Ask Your Home</span>
          <span style={{ color: C.t3, fontSize: 16 }}>›</span>
        </button>
      </div>
    </div>
  );
}
