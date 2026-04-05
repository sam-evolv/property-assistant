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

// ─── Docs data ────────────────────────────────────────────────────────────────
const CATEGORIES = [
  {
    label: 'Energy', color: C.amb,
    docs: ['BER Certificate — A2', 'Air Tightness Test Certificate', 'Heat Pump Commissioning Report'],
  },
  {
    label: 'Compliance', color: C.blu,
    docs: ['BCAR Certificate of Compliance', 'Planning Permission', "Structural Engineer's Report"],
  },
  {
    label: 'Warranty & Legal', color: C.grn,
    docs: ['HomeBond Structural Warranty', 'Kitchen Appliance Warranties', 'Window & Door Warranty'],
  },
  {
    label: 'Electrical', color: C.pur,
    docs: ['Electrical Completion Certificate'],
  },
];

// ─── Warranty data ────────────────────────────────────────────────────────────
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

export default function DocsWarrantyScreen() {
  const [on, setOn] = useState(false);
  const [tab, setTab] = useState<'docs' | 'warranty'>('docs');
  useEffect(() => { const id = setTimeout(() => setOn(true), 60); return () => clearTimeout(id); }, []);

  // Reset reveal on tab switch
  useEffect(() => { setOn(false); const id = setTimeout(() => setOn(true), 60); return () => clearTimeout(id); }, [tab]);

  let delayAccum = 250;

  return (
    <div style={{
      width: '100%', height: '100%', overflowY: 'auto',
      background: C.bg, padding: '0 20px 24px',
      fontFamily: '"Inter", system-ui, sans-serif',
    }}>
      {/* Header */}
      <div style={{ paddingTop: 24, marginBottom: 16 }}>
        <div style={{ ...TYPE.overline, color: C.g, marginBottom: 6 }}>
          Your Home
        </div>
        <h2 style={{ ...TYPE.heading, color: C.t1, margin: 0 }}>
          Docs & Warranty
        </h2>
      </div>

      {/* ── Toggle pills ── */}
      <div style={{
        display: 'flex', gap: 0, marginBottom: 20,
        background: C.s2, borderRadius: RADIUS.pill,
        border: `1px solid ${C.b1}`, padding: 3,
      }}>
        {(['docs', 'warranty'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: '8px 0',
            borderRadius: RADIUS.pill - 2,
            background: tab === t ? C.s4 : 'transparent',
            border: tab === t ? `1px solid ${C.gB}` : '1px solid transparent',
            color: tab === t ? C.g : C.t3,
            cursor: 'pointer',
            ...TYPE.title,
            fontSize: 12,
            letterSpacing: '0.04em',
            transition: `all ${DURATION.fast}ms ${EASE}`,
          }}>
            {t === 'docs' ? 'Documents' : 'Warranties'}
          </button>
        ))}
      </div>

      {/* ── Docs view ── */}
      {tab === 'docs' && (
        <>
          <p style={{ ...TYPE.caption, color: C.t2, marginBottom: 16, ...rv(on, 180) }}>
            All certificates, warranties & compliance
          </p>
          {CATEGORIES.map((cat, ci) => {
            const catDelay = delayAccum;
            delayAccum += 80;
            return (
              <div key={ci} style={{ marginBottom: 20, ...rv(on, catDelay) }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: cat.color }} />
                  <span style={{ ...TYPE.overline, color: cat.color }}>{cat.label}</span>
                  <div style={{ flex: 1, height: 1, background: C.b1 }} />
                </div>
                {cat.docs.map((doc, di) => {
                  delayAccum += 50;
                  return (
                    <div key={di} style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '11px 14px', marginBottom: 6,
                      borderRadius: RADIUS.md, background: C.s2,
                      border: `1px solid ${C.b1}`, cursor: 'pointer',
                      transition: `all ${DURATION.fast}ms ${EASE}`,
                      ...rv(on, delayAccum),
                    }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: RADIUS.sm,
                        background: `${cat.color}15`, border: `1px solid ${cat.color}30`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 14, flexShrink: 0,
                      }}>📄</div>
                      <span style={{ ...TYPE.title, color: C.t1, flex: 1 }}>{doc}</span>
                      <span style={{ color: C.t3, fontSize: 14 }}>↓</span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </>
      )}

      {/* ── Warranty view ── */}
      {tab === 'warranty' && (
        <>
          {/* Summary row */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 20, ...rv(on, 250) }}>
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

          {/* Warranty list */}
          {WARRANTIES.map((w, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 14px', marginBottom: 8,
              borderRadius: RADIUS.md, background: C.s2,
              border: `1px solid ${C.b1}`,
              ...rv(on, 340 + i * 70),
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: RADIUS.sm,
                background: `${C.grn}15`, border: `1px solid ${C.grn}30`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, flexShrink: 0,
              }}>✓</div>
              <div style={{ flex: 1 }}>
                <div style={{ ...TYPE.title, color: C.t1 }}>{w.name}</div>
                <div style={{ ...TYPE.caption, color: C.t3, marginTop: 2 }}>{w.provider}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ ...TYPE.caption, color: C.grn, fontWeight: 700 }}>Active</div>
                <div style={{ ...TYPE.caption, color: C.t3, marginTop: 2 }}>{w.year}</div>
              </div>
            </div>
          ))}

          {/* Aftercare card */}
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
        </>
      )}
    </div>
  );
}
