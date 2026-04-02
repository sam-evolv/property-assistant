'use client';

import {
  BG, CARD, S1, S2, LINE, T1, T2, T3, T4,
  GOLD, GOLD_D, GOLD_L, GOLD_M,
  GO, GO_L, GO_M,
  FLAG, FLAG_L, FLAG_M,
  WARN, WARN_L,
  INFO, INFO_L,
} from '@/lib/agent/design-tokens';

/* ------------------------------------------------------------------ */
/*  Static demo data                                                   */
/* ------------------------------------------------------------------ */

const stats = [
  { value: '49', label: 'Sold', color: GOLD_D, bg: GOLD_L },
  { value: '7', label: 'Active', color: INFO, bg: INFO_L },
  { value: '2', label: 'Urgent', color: FLAG, bg: FLAG_L },
];

const actionItems = [
  { name: 'Conor Ryan', unit: 'Coppice A1' },
  { name: 'Mark Brennan', unit: 'Coppice A5' },
];

const viewings = [
  { time: '10:00', buyer: 'Sarah Doyle', unit: 'Coppice — A4', status: 'confirmed' as const },
  { time: '11:30', buyer: 'New Enquiry', unit: '7 Orchard Close', status: 'confirmed' as const },
];

const schemes = [
  { name: 'The Coppice', dev: 'Cairn Homes', loc: 'Ballincollig', total: 48, sold: 31, res: 9, avail: 8, comp: 'Q3 2025' },
  { name: 'Harbour View', dev: 'Evara Homes', loc: 'Blackrock', total: 24, sold: 18, res: 4, avail: 2, comp: 'Q1 2025' },
];

/* ------------------------------------------------------------------ */
/*  Shared styles                                                      */
/* ------------------------------------------------------------------ */

const sectionLabel: React.CSSProperties = {
  color: T4,
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  marginBottom: 10,
};

const card: React.CSSProperties = {
  background: CARD,
  borderRadius: 16,
  border: `1px solid ${LINE}`,
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function HomeTab({ onNavigate }: { onNavigate: (tab: string) => void }) {
  return (
    <div style={{ background: BG, paddingBottom: 32 }}>
      <div style={{ padding: '56px 16px 0' }}>

        {/* 1 — Greeting */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ color: T4, fontSize: 11 }}>Thursday, 26 March 2025</div>
          <div style={{ color: T1, fontSize: 26, fontWeight: 700, letterSpacing: '-0.03em' }}>
            Good morning, Sarah.
          </div>
          <div style={{ color: T3, fontSize: 13 }}>
            Sherry FitzGerald Cork &middot; 2 schemes active
          </div>
        </div>

        {/* 2 — Stats row */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
          {stats.map((s) => (
            <div
              key={s.label}
              style={{
                flex: 1,
                background: CARD,
                borderRadius: 14,
                padding: '14px 10px',
                textAlign: 'center',
                border: `1px solid ${LINE}`,
              }}
            >
              <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.04em', color: s.color, background: s.bg, borderRadius: 8, display: 'inline-block', padding: '2px 0', width: '100%' }}>
                {s.value}
              </div>
              <div style={{ color: T3, fontSize: 10, fontWeight: 500, marginTop: 5 }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* 3 — Intelligence CTA */}
        <div
          onClick={() => onNavigate('intel')}
          style={{
            ...card,
            padding: '16px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            cursor: 'pointer',
            marginBottom: 22,
          }}
        >
          {/* Zap icon */}
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 12,
              background: T1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <polygon points="13,2 3,14 12,14 11,22 21,10 12,10 13,2" fill={GOLD} />
            </svg>
          </div>

          {/* Text */}
          <div style={{ flex: 1 }}>
            <div style={{ color: T1, fontSize: 14, fontWeight: 600 }}>OpenHouse Intelligence</div>
            <div style={{ color: T3, fontSize: 12 }}>What do you need done today?</div>
          </div>

          {/* Arrow */}
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={T4} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <line x1={5} y1={12} x2={19} y2={12} />
            <polyline points="12,5 19,12 12,19" />
          </svg>
        </div>

        {/* 4 — Requires Action */}
        <div style={{ marginBottom: 22 }}>
          <div style={sectionLabel}>Requires Action</div>
          <div style={{ ...card, overflow: 'hidden' }}>
            {actionItems.map((item, i) => (
              <div
                key={item.name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '14px 16px',
                  gap: 12,
                  borderTop: i > 0 ? `1px solid ${LINE}` : undefined,
                }}
              >
                {/* Red dot */}
                <div
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: FLAG,
                    flexShrink: 0,
                  }}
                />

                {/* Text */}
                <div style={{ flex: 1 }}>
                  <div style={{ color: FLAG, fontSize: 13, fontWeight: 600 }}>
                    Contracts overdue — {item.name}
                  </div>
                  <div style={{ color: 'rgba(191,55,40,0.5)', fontSize: 11 }}>{item.unit}</div>
                </div>

                {/* Chevron */}
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={FLAG_M} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9,18 15,12 9,6" />
                </svg>
              </div>
            ))}
          </div>
        </div>

        {/* 5 — Today's Viewings */}
        <div style={{ marginBottom: 22 }}>
          <div style={sectionLabel}>Today&apos;s Viewings</div>
          <div style={{ ...card, overflow: 'hidden' }}>
            {viewings.map((v, i) => (
              <div
                key={v.buyer}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '12px 16px',
                  gap: 12,
                  borderTop: i > 0 ? `1px solid ${LINE}` : undefined,
                }}
              >
                {/* Time box */}
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 10,
                    background: S1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    color: T2,
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  {v.time}
                </div>

                {/* Name & unit */}
                <div style={{ flex: 1 }}>
                  <div style={{ color: T1, fontSize: 13, fontWeight: 600 }}>{v.buyer}</div>
                  <div style={{ color: T3, fontSize: 11 }}>{v.unit}</div>
                </div>

                {/* Status badge */}
                {v.status === 'confirmed' ? (
                  <div
                    style={{
                      color: GO,
                      background: GO_L,
                      border: `1px solid ${GO_M}`,
                      fontSize: 9,
                      fontWeight: 700,
                      padding: '3px 8px',
                      borderRadius: 6,
                      letterSpacing: '0.04em',
                    }}
                  >
                    CONFIRMED
                  </div>
                ) : (
                  <div
                    style={{
                      color: WARN,
                      background: WARN_L,
                      fontSize: 9,
                      fontWeight: 700,
                      padding: '3px 8px',
                      borderRadius: 6,
                      letterSpacing: '0.04em',
                    }}
                  >
                    PENDING
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 6 — Schemes */}
        <div style={{ marginBottom: 16 }}>
          <div style={sectionLabel}>Schemes</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {schemes.map((s) => {
              const pct = Math.round((s.sold / s.total) * 100);
              return (
                <div
                  key={s.name}
                  style={{
                    ...card,
                    padding: 16,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  }}
                >
                  {/* Top row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                      <div style={{ color: T1, fontSize: 14, fontWeight: 600 }}>{s.name}</div>
                      <div style={{ color: T3, fontSize: 11 }}>{s.dev} &middot; {s.loc}</div>
                    </div>
                    <div style={{ color: GOLD_D, fontSize: 22, fontWeight: 700 }}>{pct}%</div>
                  </div>

                  {/* Progress bar */}
                  <div style={{ height: 3, borderRadius: 2, background: S2, marginBottom: 14 }}>
                    <div
                      style={{
                        height: '100%',
                        borderRadius: 2,
                        width: `${pct}%`,
                        background: `linear-gradient(90deg, ${GOLD_D}, ${GOLD})`,
                      }}
                    />
                  </div>

                  {/* Bottom stats */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      borderTop: `1px solid ${LINE}`,
                      paddingTop: 12,
                      gap: 14,
                    }}
                  >
                    {/* Sold */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: GOLD_D }} />
                      <span style={{ fontSize: 11, color: T2 }}>{s.sold} Sold</span>
                    </div>
                    {/* Reserved */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: INFO }} />
                      <span style={{ fontSize: 11, color: T2 }}>{s.res} Reserved</span>
                    </div>
                    {/* Available */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: GO }} />
                      <span style={{ fontSize: 11, color: T2 }}>{s.avail} Available</span>
                    </div>
                    {/* Completion */}
                    <div style={{ marginLeft: 'auto', fontSize: 11, color: T4 }}>{s.comp}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
