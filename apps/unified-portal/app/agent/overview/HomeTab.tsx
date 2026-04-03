'use client';

import {
  BG, CARD, S1, S2, LINE, LINE_B, T1, T2, T3,
  GOLD, GOLD_D,
  GO, GO_L, GO_M,
  FLAG, FLAG_L, FLAG_M,
  WARN, WARN_L,
  INFO,
  SHADOW_CARD, SHADOW_URGENT,
} from '@/lib/agent/design-tokens';
import { SCHEMES, AGENT_STATS, URGENT_TOP5, formatPrice } from '@/lib/agent/demo-data';
import { EmptyState } from '@/components/agent/ui/EmptyState';

/* ------------------------------------------------------------------ */
/*  Static demo data                                                   */
/* ------------------------------------------------------------------ */

const viewings = [
  { time: '10:00', buyer: 'Sarah Doyle', unit: 'Riverside — Unit 12', status: 'confirmed' as const },
  { time: '11:30', buyer: 'New Enquiry', unit: 'Harbour View — Unit 7', status: 'confirmed' as const },
];

/* ------------------------------------------------------------------ */
/*  Shared styles                                                      */
/* ------------------------------------------------------------------ */

const sectionLabel: React.CSSProperties = {
  color: T3,
  fontSize: 11,
  fontWeight: 500,
  margin: '0 0 10px',
};

const cardStyle: React.CSSProperties = {
  background: CARD,
  borderRadius: 16,
  border: `1px solid ${LINE}`,
  boxShadow: SHADOW_CARD,
};

/* ------------------------------------------------------------------ */
/*  Computed data                                                      */
/* ------------------------------------------------------------------ */

const urgentCount = AGENT_STATS.urgent;

const actionItems = URGENT_TOP5.map((b) => {
  const firstName = b.name
    .split(' & ')[0]
    .split(' and ')[0];
  const parts = firstName.trim().split(' ');
  const displayName = parts.length >= 2
    ? `${parts[0]} ${parts[parts.length - 1]}`
    : parts[0];
  return {
    name: displayName,
    unit: `${b.scheme} ${b.unit}`,
    days: b.daysSinceIssued ?? 0,
  };
});

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function HomeTab({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div style={{ background: BG, paddingBottom: 32 }}>

      {/* 1 -- Greeting */}
      <div style={{ padding: '20px 20px 0' }}>
        <p style={{ color: T3, fontSize: 12, margin: '0 0 4px' }}>
          {greeting}, Sarah.
        </p>
        <h1 style={{
          color: T1, fontSize: 26, fontWeight: 700,
          letterSpacing: '-0.03em', lineHeight: 1.2, margin: '0 0 2px',
        }}>
          {urgentCount > 0
            ? `${urgentCount} thing${urgentCount > 1 ? 's' : ''} need${urgentCount === 1 ? 's' : ''} your attention.`
            : 'All clear today.'}
        </h1>
        <p style={{ color: T2, fontSize: 13, margin: 0 }}>
          Sherry FitzGerald Cork
        </p>
      </div>

      {/* 2 -- Stat strip */}
      <div style={{ display: 'flex', gap: 8, padding: '16px 20px' }}>
        {/* Sold */}
        <div style={{
          flex: 1,
          background: S1,
          borderRadius: 14,
          border: `1px solid ${LINE}`,
          padding: '14px 10px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.04em', color: T1 }}>
            {AGENT_STATS.totalSold}
          </div>
          <div style={{ color: T3, fontSize: 11, marginTop: 4 }}>Sold</div>
        </div>

        {/* Active */}
        <div style={{
          flex: 1,
          background: S1,
          borderRadius: 14,
          border: `1px solid ${LINE}`,
          padding: '14px 10px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.04em', color: T1 }}>
            {AGENT_STATS.activePipeline}
          </div>
          <div style={{ color: T3, fontSize: 11, marginTop: 4 }}>Active</div>
        </div>

        {/* Urgent */}
        <div style={{
          flex: 1,
          background: FLAG_L,
          borderRadius: 14,
          border: `1px solid ${FLAG_M}`,
          borderTop: `3px solid ${FLAG}`,
          padding: '14px 10px',
          textAlign: 'center',
          boxShadow: SHADOW_URGENT,
        }}>
          <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.04em', color: FLAG }}>
            {AGENT_STATS.urgent}
          </div>
          <div style={{ color: FLAG, fontSize: 11, fontWeight: 600, marginTop: 4 }}>Urgent</div>
        </div>
      </div>

      <div style={{ padding: '0 20px' }}>

        {/* 3 -- Urgent actions */}
        <div style={{ marginBottom: 22 }}>
          {actionItems.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {actionItems.map((item) => (
                <div
                  key={item.name + item.unit}
                  className="interactive"
                  onClick={() => onNavigate('intel')}
                  style={{
                    display: 'flex',
                    borderRadius: 14,
                    overflow: 'hidden',
                    border: `1px solid ${FLAG_M}`,
                    boxShadow: SHADOW_URGENT,
                    cursor: 'pointer',
                  }}
                >
                  {/* Red left strip */}
                  <div style={{
                    width: 44,
                    background: FLAG,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                      <path
                        d="M12 2L1 21h22L12 2z"
                        fill="none"
                        stroke="#FFFFFF"
                        strokeWidth={2}
                        strokeLinejoin="round"
                      />
                      <line x1={12} y1={9} x2={12} y2={13} stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" />
                      <circle cx={12} cy={17} r={1} fill="#FFFFFF" />
                    </svg>
                  </div>

                  {/* Content */}
                  <div style={{
                    flex: 1,
                    background: FLAG_L,
                    padding: '12px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: '#991B1B', fontSize: 13, fontWeight: 600 }}>
                        Contracts overdue — {item.name}
                      </div>
                      <div style={{ color: '#991B1B', fontSize: 12, opacity: 0.6, marginTop: 2 }}>
                        {item.days} days overdue &middot; {item.name} &middot; {item.unit}
                      </div>
                    </div>
                    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={FLAG_M} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9,18 15,12 9,6" />
                    </svg>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={cardStyle}>
              <EmptyState
                icon={
                  <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={GO} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                }
                title="All clear"
                subtitle="No urgent actions. Check back after viewings."
              />
            </div>
          )}
        </div>

        {/* 4 -- Intelligence shortcut card */}
        <div
          className="interactive"
          onClick={() => onNavigate('intel')}
          style={{
            ...cardStyle,
            padding: '16px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            cursor: 'pointer',
            marginBottom: 22,
          }}
        >
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: T1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <polygon points="13,2 3,14 12,14 11,22 21,10 12,10 13,2" fill={GOLD} />
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ color: T1, fontSize: 14, fontWeight: 600 }}>OpenHouse Intelligence</div>
            <div style={{ color: T3, fontSize: 12 }}>Chase contracts &middot; Draft reports &middot; Follow up buyers</div>
          </div>
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={LINE_B} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9,18 15,12 9,6" />
          </svg>
        </div>

        {/* 5 -- Today's viewings */}
        <div style={{ marginBottom: 22 }}>
          <div style={sectionLabel}>Today&apos;s viewings</div>
          {viewings.length > 0 ? (
            <div style={{ ...cardStyle, overflow: 'hidden' }}>
              {viewings.map((v, i) => (
                <div
                  key={v.buyer}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '12px 16px',
                    gap: 12,
                    borderTop: i > 0 ? `1px solid ${S2}` : undefined,
                  }}
                >
                  {/* Time block */}
                  <div style={{
                    width: 46,
                    height: 46,
                    borderRadius: 10,
                    background: S1,
                    border: `1px solid ${LINE}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    color: T1,
                    fontSize: 12,
                    fontWeight: 700,
                  }}>
                    {v.time}
                  </div>

                  {/* Buyer & unit */}
                  <div style={{ flex: 1 }}>
                    <div style={{ color: T1, fontSize: 14, fontWeight: 600 }}>{v.buyer}</div>
                    <div style={{ color: T3, fontSize: 12 }}>{v.unit}</div>
                  </div>

                  {/* Status badge */}
                  {v.status === 'confirmed' ? (
                    <div style={{
                      color: GO,
                      background: GO_L,
                      border: `1px solid ${GO_M}`,
                      fontSize: 10,
                      fontWeight: 600,
                      padding: '3px 8px',
                      borderRadius: 6,
                    }}>
                      Confirmed
                    </div>
                  ) : (
                    <div style={{
                      color: WARN,
                      background: WARN_L,
                      fontSize: 10,
                      fontWeight: 600,
                      padding: '3px 8px',
                      borderRadius: 6,
                    }}>
                      Pending
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div style={cardStyle}>
              <EmptyState
                icon={
                  <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={T3} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <rect x={3} y={4} width={18} height={18} rx={2} ry={2} />
                    <line x1={16} y1={2} x2={16} y2={6} />
                    <line x1={8} y1={2} x2={8} y2={6} />
                    <line x1={3} y1={10} x2={21} y2={10} />
                  </svg>
                }
                title="No viewings today"
                subtitle="Your schedule is clear."
              />
            </div>
          )}
        </div>

        {/* 6 -- Schemes */}
        <div style={{ marginBottom: 16 }}>
          <div style={sectionLabel}>Schemes</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {SCHEMES.map((s) => {
              const soldCount = s.sold + s.contractsSigned;
              const pct = Math.round((soldCount / s.total) * 100);
              return (
                <div
                  key={s.id}
                  className="interactive"
                  style={{
                    ...cardStyle,
                    padding: '16px 18px',
                    cursor: 'pointer',
                  }}
                >
                  {/* Top row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                      <div style={{ color: T1, fontSize: 15, fontWeight: 600 }}>{s.name}</div>
                      <div style={{ color: T3, fontSize: 12 }}>{s.total} units &middot; {formatPrice(s.revenue)} revenue</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: GOLD, fontSize: 22, fontWeight: 700 }}>{pct}%</div>
                      <div style={{ color: T3, fontSize: 10 }}>{soldCount}/{s.total}</div>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div style={{ height: 3, borderRadius: 2, background: S2, marginBottom: 14 }}>
                    <div style={{
                      height: '100%',
                      borderRadius: 2,
                      width: `${pct}%`,
                      background: `linear-gradient(90deg, ${GOLD_D}, ${GOLD})`,
                    }} />
                  </div>

                  {/* Stats row */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    borderTop: `1px solid ${LINE}`,
                    paddingTop: 12,
                    gap: 14,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: GOLD }} />
                      <span style={{ fontSize: 11, color: T2 }}>{s.sold} Sold</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: INFO }} />
                      <span style={{ fontSize: 11, color: T2 }}>{s.reserved} Reserved</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: GO }} />
                      <span style={{ fontSize: 11, color: T2 }}>{s.available} Available</span>
                    </div>
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
