'use client';

import { useState, useEffect } from 'react';
import { C, TYPE, RADIUS, SHADOW, EASE, DURATION, KEYFRAMES } from './tokens';

interface SystemsScreenProps {
  solarKwNow?: number;
  solarKwhToday?: number;
  solarKwhMonth?: number;
  solarSelfUse?: number;
  heatPumpFlowTemp?: number;
  heatPumpMode?: string;
  heatPumpDhwTemp?: number;
  evChargerStatus?: string;
}

// ─── Reveal helper ────────────────────────────────────────────────────────────
function rv(on: boolean, delay: number, y = 14): React.CSSProperties {
  return {
    opacity: on ? 1 : 0,
    transform: on ? 'translateY(0)' : `translateY(${y}px)`,
    transition: `all ${DURATION.reveal}ms ${EASE}`,
    transitionDelay: on ? `${delay}ms` : '0ms',
  };
}

// ─── Ring (arc) component ─────────────────────────────────────────────────────
function Ring({ pct, color, value, unit, label }: {
  pct: number; color: string; value: string; unit: string; label: string;
}) {
  const r = 34, stroke = 5, circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: 1 }}>
      <svg width={80} height={80} style={{ transform: 'rotate(-90deg)' }}>
        {/* Track */}
        <circle cx={40} cy={40} r={r} fill="none"
          stroke="rgba(255,255,255,0.05)" strokeWidth={stroke} />
        {/* Progress */}
        <circle cx={40} cy={40} r={r} fill="none"
          stroke={color} strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 6px ${color})`, transition: `stroke-dashoffset 1s ${EASE}` }}
        />
        {/* Value */}
        <text x={40} y={40} textAnchor="middle" dominantBaseline="central"
          fill={C.t1} style={{ fontSize: 14, fontWeight: 700, transform: 'rotate(90deg)', transformOrigin: '40px 40px' }}>
          {value}
        </text>
      </svg>
      <span style={{ ...TYPE.caption, color: C.t2 }}>{unit}</span>
      <span style={{ ...TYPE.micro, color: C.t3 }}>{label}</span>
    </div>
  );
}

// ─── Icon paths ───────────────────────────────────────────────────────────────
const IC = {
  solar: '☀️',
  heat: '🔥',
  ev: '⚡',
};

// ─── SystemsScreen ────────────────────────────────────────────────────────────
export default function SystemsScreen({
  solarKwNow = 0, solarKwhToday = 0, solarKwhMonth = 0, solarSelfUse = 0,
  heatPumpFlowTemp = 0, heatPumpMode = 'Heating', heatPumpDhwTemp = 0,
  evChargerStatus = 'Standby',
}: SystemsScreenProps) {
  const [on, setOn] = useState(false);
  useEffect(() => { const id = setTimeout(() => setOn(true), 60); return () => clearTimeout(id); }, []);

  const solarMax = 6.2;
  const solarPct = Math.min((solarKwhToday / solarMax) * 100, 100);

  return (
    <div style={{
      width: '100%', height: '100%', overflowY: 'auto',
      background: C.bg, padding: '0 20px 24px',
      fontFamily: '"Inter", system-ui, sans-serif',
      position: 'relative',
    }}>
      <style dangerouslySetInnerHTML={{ __html: KEYFRAMES }} />

      {/* Gold ambient glow */}
      <div style={{
        position: 'absolute', top: -40, left: '50%', transform: 'translateX(-50%)',
        width: 300, height: 200, borderRadius: '50%',
        background: `radial-gradient(circle, ${C.gFog} 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      {/* Header */}
      <div style={{ paddingTop: 24, marginBottom: 20, position: 'relative' }}>
        <div style={{ ...TYPE.overline, color: C.g, marginBottom: 6, ...rv(on, 0) }}>
          Live Status
        </div>
        <h2 style={{ ...TYPE.heading, color: C.t1, margin: 0, ...rv(on, 100) }}>
          Systems
        </h2>
        <p style={{ ...TYPE.caption, color: C.t2, marginTop: 4, ...rv(on, 180) }}>
          Live status · All normal
        </p>
      </div>

      {/* ── Arc Rings Summary Card ── */}
      <div style={{
        background: C.s2, border: `1px solid ${C.b1}`, borderRadius: RADIUS.xl,
        padding: '24px 12px 16px', marginBottom: 16,
        boxShadow: SHADOW.card,
        ...rv(on, 260),
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start' }}>
          <Ring pct={solarPct} color={C.amb} value={solarKwNow.toFixed(1)} unit="kW" label="Solar" />
          {/* Divider */}
          <div style={{ width: 1, height: 80, background: C.b1, flexShrink: 0, marginTop: 0 }} />
          <Ring pct={82} color={C.blu} value={String(heatPumpFlowTemp)} unit="°C" label="Heat pump" />
          <div style={{ width: 1, height: 80, background: C.b1, flexShrink: 0, marginTop: 0 }} />
          <Ring pct={100} color={C.pur} value="—" unit="" label="EV charger" />
        </div>

        {/* Footer */}
        <div style={{
          borderTop: `1px solid ${C.b1}`, marginTop: 16, paddingTop: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%', background: C.grn,
            animation: `livePulse 2.4s ${EASE} infinite`,
          }} />
          <span style={{ ...TYPE.caption, color: C.t3 }}>
            All systems nominal · Updated just now
          </span>
        </div>
      </div>

      {/* ── System Detail Cards ── */}

      {/* Solar PV */}
      <div style={{
        background: C.s2, border: `1px solid ${C.b1}`, borderRadius: RADIUS.xl,
        padding: 16, marginBottom: 12, boxShadow: SHADOW.card,
        ...rv(on, 400),
      }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
          <div style={{
            width: 40, height: 40, borderRadius: RADIUS.sm,
            background: `${C.amb}15`, border: `1px solid ${C.amb}30`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, marginRight: 12,
          }}>{IC.solar}</div>
          <div style={{ flex: 1 }}>
            <div style={{ ...TYPE.title, color: C.t1 }}>Solar PV</div>
            <div style={{ ...TYPE.caption, color: C.t3 }}>SE Systems · 6.2 kWp</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: C.amb }}>{solarKwNow.toFixed(1)}<span style={{ fontSize: 12, fontWeight: 400 }}>kW</span></div>
            <div style={{ ...TYPE.caption, color: C.t3 }}>generating now</div>
          </div>
        </div>
        {/* Stats row */}
        <div style={{ display: 'flex', borderTop: `1px solid ${C.b1}`, paddingTop: 12 }}>
          {[
            { v: `${solarKwhToday.toFixed(1)}`, u: 'kWh', l: 'today' },
            { v: `${solarKwhMonth.toFixed(0)}`, u: 'kWh', l: 'month' },
            { v: `${solarSelfUse}`, u: '%', l: 'self-use' },
          ].map((s, i) => (
            <div key={i} style={{
              flex: 1, textAlign: 'center',
              borderLeft: i > 0 ? `1px solid ${C.b1}` : 'none',
            }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.t1 }}>{s.v}<span style={{ fontSize: 10, color: C.t2 }}>{s.u}</span></div>
              <div style={{ ...TYPE.caption, color: C.t3, marginTop: 2 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Heat Pump */}
      <div style={{
        background: C.s2, border: `1px solid ${C.b1}`, borderRadius: RADIUS.xl,
        padding: 16, marginBottom: 12, boxShadow: SHADOW.card,
        ...rv(on, 520),
      }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
          <div style={{
            width: 40, height: 40, borderRadius: RADIUS.sm,
            background: `${C.blu}15`, border: `1px solid ${C.blu}30`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, marginRight: 12,
          }}>{IC.heat}</div>
          <div style={{ flex: 1 }}>
            <div style={{ ...TYPE.title, color: C.t1 }}>Heat Pump</div>
            <div style={{ ...TYPE.caption, color: C.t3 }}>Mitsubishi Ecodan 8.5kW</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: C.blu }}>{heatPumpFlowTemp}<span style={{ fontSize: 12, fontWeight: 400 }}>°C</span></div>
            <div style={{ ...TYPE.caption, color: C.t3 }}>flow temp</div>
          </div>
        </div>
        <div style={{ display: 'flex', borderTop: `1px solid ${C.b1}`, paddingTop: 12 }}>
          {[
            { v: '3.8', u: '', l: 'COP' },
            { v: heatPumpMode, u: '', l: 'mode' },
            { v: `${heatPumpDhwTemp}`, u: '°C', l: 'DHW temp' },
          ].map((s, i) => (
            <div key={i} style={{
              flex: 1, textAlign: 'center',
              borderLeft: i > 0 ? `1px solid ${C.b1}` : 'none',
            }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.t1 }}>{s.v}<span style={{ fontSize: 10, color: C.t2 }}>{s.u}</span></div>
              <div style={{ ...TYPE.caption, color: C.t3, marginTop: 2 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* EV Charger */}
      <div style={{
        background: C.s2, border: `1px solid ${C.b1}`, borderRadius: RADIUS.xl,
        padding: 16, marginBottom: 12, boxShadow: SHADOW.card,
        ...rv(on, 640),
      }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
          <div style={{
            width: 40, height: 40, borderRadius: RADIUS.sm,
            background: `${C.pur}15`, border: `1px solid ${C.pur}30`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, marginRight: 12,
          }}>{IC.ev}</div>
          <div style={{ flex: 1 }}>
            <div style={{ ...TYPE.title, color: C.t1 }}>EV Charger</div>
            <div style={{ ...TYPE.caption, color: C.t3 }}>Hypervolt · 7.4 kW</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: C.pur }}>—</div>
            <div style={{ ...TYPE.caption, color: C.t3 }}>standby</div>
          </div>
        </div>
        <div style={{ display: 'flex', borderTop: `1px solid ${C.b1}`, paddingTop: 12 }}>
          {[
            { v: 'On', u: '', l: 'smart charge' },
            { v: 'Solar', u: '', l: 'priority' },
            { v: 'Off-peak', u: '', l: 'schedule' },
          ].map((s, i) => (
            <div key={i} style={{
              flex: 1, textAlign: 'center',
              borderLeft: i > 0 ? `1px solid ${C.b1}` : 'none',
            }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.t1 }}>{s.v}<span style={{ fontSize: 10, color: C.t2 }}>{s.u}</span></div>
              <div style={{ ...TYPE.caption, color: C.t3, marginTop: 2 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
