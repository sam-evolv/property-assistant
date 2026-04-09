'use client';

import { useState, useEffect } from 'react';
import { C, TYPE, RADIUS, EASE, DURATION } from './tokens';

function rv(on: boolean, delay: number, y = 14): React.CSSProperties {
  return {
    opacity: on ? 1 : 0,
    transform: on ? 'translateY(0)' : `translateY(${y}px)`,
    transition: `all ${DURATION.reveal}ms ${EASE}`,
    transitionDelay: on ? `${delay}ms` : '0ms',
  };
}

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

export default function DocsScreen() {
  const [on, setOn] = useState(false);
  useEffect(() => { const id = setTimeout(() => setOn(true), 60); return () => clearTimeout(id); }, []);

  let delayAccum = 250;

  return (
    <div style={{
      width: '100%', height: '100%', overflowY: 'auto',
      background: C.bg, padding: '0 20px 24px',
      fontFamily: '"Inter", system-ui, sans-serif',
    }}>
      {/* Header */}
      <div style={{ paddingTop: 24, marginBottom: 20 }}>
        <div style={{ ...TYPE.overline, color: C.g, marginBottom: 6, ...rv(on, 0) }}>
          Your Documents
        </div>
        <h2 style={{ ...TYPE.heading, color: C.t1, margin: 0, ...rv(on, 100) }}>
          Docs
        </h2>
        <p style={{ ...TYPE.caption, color: C.t2, marginTop: 4, ...rv(on, 180) }}>
          All certificates, warranties & compliance
        </p>
      </div>

      {/* Categories */}
      {CATEGORIES.map((cat, ci) => {
        const catDelay = delayAccum;
        delayAccum += 80;

        return (
          <div key={ci} style={{ marginBottom: 20, ...rv(on, catDelay) }}>
            {/* Category header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%', background: cat.color,
              }} />
              <span style={{ ...TYPE.overline, color: cat.color }}>{cat.label}</span>
              <div style={{ flex: 1, height: 1, background: C.b1 }} />
            </div>

            {/* Doc rows */}
            {cat.docs.map((doc, di) => {
              delayAccum += 50;
              return (
                <div key={di} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '11px 14px', marginBottom: 6,
                  borderRadius: RADIUS.md, background: C.s2,
                  border: `1px solid ${C.b1}`,
                  cursor: 'pointer',
                  transition: `all ${DURATION.fast}ms ${EASE}`,
                  ...rv(on, delayAccum),
                }}>
                  {/* Icon */}
                  <div style={{
                    width: 32, height: 32, borderRadius: RADIUS.sm,
                    background: `${cat.color}15`, border: `1px solid ${cat.color}30`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, flexShrink: 0,
                  }}>📄</div>
                  {/* Name */}
                  <span style={{ ...TYPE.title, color: C.t1, flex: 1 }}>{doc}</span>
                  {/* Download icon */}
                  <span style={{ color: C.t3, fontSize: 14 }}>↓</span>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
