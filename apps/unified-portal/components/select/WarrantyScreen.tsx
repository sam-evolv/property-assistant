'use client';

import { useState, useEffect } from 'react';
import { C, TYPE, RADIUS, SHADOW, EASE, DURATION } from './tokens';

function rv(on: boolean, delay: number, y = 14): React.CSSProperties {
  return {
    opacity: on ? 1 : 0,
    transform: on ? 'translateY(0)' : `translateY(${y}px)`,
    transition: `all ${DURATION.reveal}ms ${EASE}`,
    transitionDelay: on ? `${delay}ms` : '0ms',
  };
}

const SUMMARY = [
  { value: '10yr', label: 'HomeBond', color: C.g },
  { value: '20yr', label: 'Roofing', color: C.grn },
  { value: '7', label: 'Active', color: C.blu },
];

const WARRANTIES = [
  { name: 'HomeBond structural', provider: 'HomeBond', year: 2034 },
  { name: 'Flat roofing', provider: 'Sika Liquid Plastics', year: 2044 },
  { name: 'Heating & plumbing', provider: 'Cronin Plumbing', year: 2026 },
  { name: 'Kitchen appliances', provider: 'Neff / Sigma Homes', year: 2027 },
  { name: 'Windows & doors', provider: 'Munster Joinery', year: 2029 },
  { name: 'Solar PV system', provider: 'SE Systems', year: 2034 },
  { name: 'Heat pump', provider: 'Mitsubishi', year: 2034 },
];

export default function WarrantyScreen() {
  const [on, setOn] = useState(false);
  useEffect(() => { const id = setTimeout(() => setOn(true), 60); return () => clearTimeout(id); }, []);

  return (
    <div style={{
      width: '100%', height: '100%', overflowY: 'auto',
      background: C.bg, padding: '0 20px 24px',
      fontFamily: '"Inter", system-ui, sans-serif',
    }}>
      {/* Header */}
      <div style={{ paddingTop: 24, marginBottom: 20 }}>
        <div style={{ ...TYPE.overline, color: C.g, marginBottom: 6, ...rv(on, 0) }}>
          Protection
        </div>
        <h2 style={{ ...TYPE.heading, color: C.t1, margin: 0, ...rv(on, 100) }}>
          Warranty
        </h2>
        <p style={{ ...TYPE.caption, color: C.t2, marginTop: 4, ...rv(on, 180) }}>
          All active warranties and cover
        </p>
      </div>

      {/* ── Summary row ── */}
      <div style={{
        display: 'flex', gap: 10, marginBottom: 20,
        ...rv(on, 250),
      }}>
        {SUMMARY.map((s, i) => (
          <div key={i} style={{
            flex: 1, padding: '14px 10px', textAlign: 'center',
            borderRadius: RADIUS.xl, background: C.s2,
            border: `1px solid ${C.b1}`, boxShadow: SHADOW.card,
          }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ ...TYPE.caption, color: C.t3, marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Warranty list ── */}
      {WARRANTIES.map((w, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 14px', marginBottom: 8,
          borderRadius: RADIUS.md, background: C.s2,
          border: `1px solid ${C.b1}`,
          ...rv(on, 340 + i * 70),
        }}>
          {/* Green check icon */}
          <div style={{
            width: 32, height: 32, borderRadius: RADIUS.sm,
            background: `${C.grn}15`, border: `1px solid ${C.grn}30`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, flexShrink: 0,
          }}>✓</div>
          {/* Name + provider */}
          <div style={{ flex: 1 }}>
            <div style={{ ...TYPE.title, color: C.t1 }}>{w.name}</div>
            <div style={{ ...TYPE.caption, color: C.t3, marginTop: 2 }}>{w.provider}</div>
          </div>
          {/* Status + year */}
          <div style={{ textAlign: 'right' }}>
            <div style={{ ...TYPE.caption, color: C.grn, fontWeight: 700 }}>Active</div>
            <div style={{ ...TYPE.caption, color: C.t3, marginTop: 2 }}>{w.year}</div>
          </div>
        </div>
      ))}

      {/* ── Aftercare contact card ── */}
      <div style={{
        marginTop: 20, padding: 16, borderRadius: RADIUS.xl,
        background: C.s2, border: `1px solid ${C.gB}`,
        boxShadow: SHADOW.card,
        ...rv(on, 340 + WARRANTIES.length * 70 + 80),
      }}>
        <div style={{ ...TYPE.overline, color: C.g, marginBottom: 8 }}>Aftercare</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ ...TYPE.title, color: C.t1, fontSize: 15 }}>Sigma Homes</div>
            <div style={{ ...TYPE.caption, color: C.t3, marginTop: 2 }}>Mon–Fri 8am–5pm</div>
          </div>
          <button style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', borderRadius: RADIUS.pill,
            background: 'transparent', border: `1px solid ${C.gB}`,
            color: C.g, cursor: 'pointer',
            ...TYPE.title, fontSize: 12,
          }}>
            📞 021 436 5866
          </button>
        </div>
      </div>
    </div>
  );
}
