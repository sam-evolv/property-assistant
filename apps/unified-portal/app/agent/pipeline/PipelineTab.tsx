'use client';

import { useState } from 'react';
import { Users, ChevronDown } from 'lucide-react';
import {
  BG, CARD, S1, S2, S3, LINE, LINE_B,
  T1, T2, T3, T4,
  GOLD, GOLD_D, GOLD_L, GOLD_M,
  GO, GO_L, GO_M,
  FLAG, FLAG_L, FLAG_M,
  INFO, INFO_L, INFO_M,
  VIO, VIO_L,
  SHADOW_CARD, SHADOW_URGENT,
  STATUS_STYLES,
} from '@/lib/agent/design-tokens';
import { BUYERS as REAL_BUYERS, SCHEMES, formatPrice, type Buyer as RealBuyer } from '@/lib/agent/demo-data';
import { EmptyState } from '@/components/agent/ui/EmptyState';

type View = 'buyers' | 'stages' | 'schemes';

/* ------------------------------------------------------------------ */
/*  Adapt real buyer data to the card format                           */
/* ------------------------------------------------------------------ */

interface Buyer {
  id: number;
  ini: string;
  name: string;
  unit: string;
  dev: string;
  status: string;
  budget: string;
  dep: string | null;
  cdate: string | null;
  signed: string | null;
  closing: string | null;
  urgent: boolean;
  notes: string;
  daysSinceIssued: number | null;
}

function formatDateShort(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

function adaptBuyer(b: RealBuyer): Buyer {
  const priceK = `${Math.round(b.price / 1000)},000`;
  let notes = '';
  if (b.status === 'contracts_out' && b.daysSinceIssued) {
    notes = `Contracts issued ${b.daysSinceIssued} days ago.`;
  } else if (b.status === 'contracts_signed' && b.kitchenSelected === false) {
    notes = 'Kitchen not yet selected.';
  } else if (b.status === 'contracts_signed' && b.kitchenSelected === true) {
    notes = 'Kitchen selected.';
  } else if (b.status === 'sale_agreed') {
    notes = 'Awaiting contracts.';
  } else if (b.status === 'sold' && b.handoverDate) {
    notes = `Handed over ${formatDateShort(b.handoverDate)}.`;
  }

  return {
    id: b.id,
    ini: b.initials,
    name: b.name,
    unit: `${b.unit} (${b.type})`,
    dev: b.scheme,
    status: b.status,
    budget: priceK,
    dep: formatDateShort(b.depositDate),
    cdate: formatDateShort(b.contractsIssuedDate),
    signed: formatDateShort(b.contractsSignedDate),
    closing: formatDateShort(b.handoverDate),
    urgent: b.urgent,
    notes,
    daysSinceIssued: b.daysSinceIssued,
  };
}

const BUYERS: Buyer[] = REAL_BUYERS.map(adaptBuyer);

const TOGGLE_ITEMS: { key: View; label: string }[] = [
  { key: 'buyers', label: 'By Buyer' },
  { key: 'stages', label: 'By Stage' },
  { key: 'schemes', label: 'By Scheme' },
];

/* ------------------------------------------------------------------ */
/*  Helper: parse days overdue from buyer                              */
/* ------------------------------------------------------------------ */

function getDaysOverdue(buyer: Buyer): number {
  if (buyer.daysSinceIssued && buyer.daysSinceIssued > 0) return buyer.daysSinceIssued;
  const match = buyer.notes.match(/(\d+)\s*days/);
  return match ? parseInt(match[1], 10) : 0;
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function StatusBadge({ status, small }: { status: string; small?: boolean }) {
  const s = STATUS_STYLES[status] || { label: status, color: T3, bg: S1, border: LINE };
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: small ? '2px 7px' : '3px 10px',
        borderRadius: 20,
        background: s.bg,
        border: `1px solid ${s.border}`,
        fontSize: small ? 9 : 10,
        fontWeight: 700,
        color: s.color,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        lineHeight: 1.4,
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
      {s.label}
    </span>
  );
}

function Avatar({ ini, size = 44 }: { ini: string; size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.27,
        background: GOLD_L,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.3,
        fontWeight: 700,
        color: GOLD_D,
        flexShrink: 0,
        letterSpacing: '0.02em',
      }}
    >
      {ini}
    </div>
  );
}

function Pill({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        padding: '3px 8px',
        borderRadius: 8,
        background: S1,
        border: `1px solid ${LINE}`,
        fontSize: 10,
        fontWeight: 500,
        color: color || T2,
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ color: T4, fontWeight: 600, fontSize: 9 }}>{label}</span>
      {value}
    </span>
  );
}

function TimelineTrack({ buyer }: { buyer: Buyer }) {
  const steps = [
    { label: 'Deposit', date: buyer.dep },
    { label: 'Contracts', date: buyer.cdate },
    { label: 'Signed', date: buyer.signed },
    { label: 'Closing', date: buyer.closing },
  ];
  return (
    <div style={{ padding: '8px 0 4px', width: '100%' }}>
      {/* Track row: nodes + connectors */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '0 12px', marginBottom: 6 }}>
        {steps.map((step, i) => {
          const done = !!step.date;
          const prevDone = i > 0 && !!steps[i - 1].date;
          // A connector is completed only if both source and destination nodes are done
          const connectorDone = done && prevDone;
          return (
            <div key={step.label} style={{ display: 'contents' }}>
              {i > 0 && (
                <div
                  style={{
                    flex: 1,
                    height: 2,
                    background: connectorDone
                      ? GO
                      : `repeating-linear-gradient(90deg, transparent 0px, transparent 4px, ${LINE_B} 4px, ${LINE_B} 7px)`,
                  }}
                />
              )}
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: done ? GO : 'transparent',
                  border: done ? 'none' : `2px solid ${LINE_B}`,
                  boxShadow: done ? `0 0 0 3px ${GO_L}` : 'none',
                  flexShrink: 0,
                }}
              />
            </div>
          );
        })}
      </div>
      {/* Labels row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 2px' }}>
        {steps.map((step) => {
          const done = !!step.date;
          return (
            <div key={step.label} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: T4, fontWeight: 600 }}>{step.label}</div>
              <div style={{ fontSize: 9, color: done ? T2 : T4, fontWeight: done ? 600 : 400 }}>
                {step.date || '\u2014'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BuyerCard({ buyer }: { buyer: Buyer }) {
  const isUrgent = buyer.urgent;
  const daysOverdue = getDaysOverdue(buyer);
  return (
    <div
      style={{
        background: CARD,
        borderRadius: 16,
        border: `1px solid ${isUrgent ? FLAG_M : LINE}`,
        boxShadow: isUrgent ? SHADOW_URGENT : SHADOW_CARD,
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Avatar ini={buyer.ini} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: isUrgent ? FLAG : T1, lineHeight: 1.3 }}>
            {buyer.name}
          </div>
          <div style={{ fontSize: 12, color: T3 }}>
            {buyer.unit} &middot; {buyer.dev}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <StatusBadge status={buyer.status} />
          {buyer.urgent && daysOverdue > 0 && (
            <span
              style={{
                padding: '2px 8px',
                borderRadius: 20,
                background: FLAG_L,
                border: `1px solid ${FLAG_M}`,
                color: FLAG,
                fontSize: 10,
                fontWeight: 700,
                whiteSpace: 'nowrap',
                letterSpacing: '0.02em',
              }}
            >
              {daysOverdue}d overdue
            </span>
          )}
        </div>
      </div>

      {/* Timeline */}
      <TimelineTrack buyer={buyer} />

      {/* Info pills */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        <Pill label="Price" value={`\u20AC${buyer.budget}`} />
      </div>

      {/* Notes */}
      {buyer.notes && (
        <div style={{ fontSize: 11, color: T3, fontStyle: 'italic', lineHeight: 1.4 }}>{buyer.notes}</div>
      )}
    </div>
  );
}

/* ---- By Stage View ---- */
const STAGE_GROUPS: { key: string; label: string; color: string; bg: string; statuses: string[] }[] = [
  { key: 'sale_agreed', label: 'Sale agreed', color: GOLD_D, bg: GOLD_L, statuses: ['sale_agreed'] },
  { key: 'contracts_out', label: 'Contracts out', color: FLAG, bg: FLAG_L, statuses: ['contracts_out'] },
  { key: 'contracts_signed', label: 'Contracts signed', color: VIO, bg: VIO_L, statuses: ['contracts_signed'] },
  { key: 'sold', label: 'Sold', color: GO, bg: GO_L, statuses: ['sold'] },
];

function ByStageView() {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggleCollapse = (key: string) => {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {STAGE_GROUPS.map((group) => {
        const buyers = BUYERS.filter((b) => group.statuses.includes(b.status));
        const isCollapsed = !!collapsed[group.key];
        return (
          <div key={group.key}>
            {/* Header */}
            <button
              className="interactive"
              onClick={() => toggleCollapse(group.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 8,
                padding: 0,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'inherit',
                width: '100%',
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: group.color, flexShrink: 0 }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: T1, flex: 1, textAlign: 'left' }}>
                {group.label}
              </span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: group.color,
                  background: group.bg,
                  padding: '2px 8px',
                  borderRadius: 10,
                }}
              >
                {buyers.length}
              </span>
              <ChevronDown
                size={14}
                color={T3}
                style={{
                  transition: 'transform 0.2s ease',
                  transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                  flexShrink: 0,
                }}
              />
            </button>
            {/* Content with smooth collapse */}
            <div
              style={{
                overflow: 'hidden',
                maxHeight: isCollapsed ? 0 : 2000,
                transition: 'max-height 0.3s ease',
              }}
            >
              <div
                style={{
                  background: CARD,
                  borderRadius: 16,
                  border: `1px solid ${LINE}`,
                  boxShadow: SHADOW_CARD,
                  overflow: 'hidden',
                }}
              >
                {buyers.length === 0 ? (
                  <div style={{ padding: 16, fontSize: 12, color: T4, textAlign: 'center' }}>
                    No buyers in this stage
                  </div>
                ) : (
                  buyers.map((b, i) => (
                    <div
                      key={b.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '10px 16px',
                        borderBottom: i < buyers.length - 1 ? `1px solid ${LINE}` : 'none',
                      }}
                    >
                      <Avatar ini={b.ini} size={32} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: T1 }}>{b.name}</div>
                        <div style={{ fontSize: 11, color: T3 }}>{b.unit}</div>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: T1, whiteSpace: 'nowrap' }}>
                        {'\u20AC'}{b.budget}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---- By Scheme View ---- */
function BySchemeView() {
  const stageColors = [
    { key: 'sale_agreed', label: 'Sale Agreed', color: GOLD_D, statuses: ['sale_agreed'] },
    { key: 'contracts_out', label: 'Contracts Out', color: FLAG, statuses: ['contracts_out'] },
    { key: 'contracts_signed', label: 'Signed', color: VIO, statuses: ['contracts_signed'] },
    { key: 'sold', label: 'Sold', color: GO, statuses: ['sold'] },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {SCHEMES.map((scheme) => {
        const schemeBuyers = BUYERS.filter((b) => b.dev === scheme.name);
        const totalBuyers = schemeBuyers.length;
        const counts = stageColors.map((s) => ({
          ...s,
          count: schemeBuyers.filter((b) => s.statuses.includes(b.status)).length,
        }));
        const soldPct = Math.round(((scheme.sold + scheme.contractsSigned) / scheme.total) * 100);

        return (
          <div
            key={scheme.id}
            style={{
              background: CARD,
              borderRadius: 16,
              border: `1px solid ${LINE}`,
              boxShadow: SHADOW_CARD,
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div style={{ padding: '14px 16px 10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: T1 }}>{scheme.name}</div>
                  <div style={{ fontSize: 11, color: T3 }}>
                    {scheme.total} units &middot; {formatPrice(scheme.revenue)} revenue
                  </div>
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, color: T1 }}>{soldPct}%</div>
              </div>

              {/* Stacked bar */}
              <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', background: S1 }}>
                {counts.map((c) =>
                  c.count > 0 ? (
                    <div
                      key={c.key}
                      style={{
                        width: `${totalBuyers > 0 ? (c.count / totalBuyers) * 100 : 0}%`,
                        background: c.color,
                      }}
                    />
                  ) : null,
                )}
              </div>

              {/* Legend */}
              <div style={{ display: 'flex', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
                {counts.map((c) => (
                  <span key={c.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 9, color: T3 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.color }} />
                    {c.label} ({c.count})
                  </span>
                ))}
              </div>
            </div>

            {/* Buyer rows */}
            {schemeBuyers.map((b) => (
              <div
                key={b.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 16px',
                  borderTop: `1px solid ${LINE}`,
                }}
              >
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    color: INFO,
                    background: INFO_L,
                    border: `1px solid ${INFO_M}`,
                    padding: '2px 6px',
                    borderRadius: 6,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {b.unit.split(' (')[0]}
                </span>
                <span style={{ flex: 1, fontSize: 12, fontWeight: 500, color: T1 }}>{b.name}</span>
                <StatusBadge status={b.status} small />
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

/* ---- Main Component ---- */
export default function PipelineTab() {
  const [view, setView] = useState<View>('buyers');

  // Sort urgent buyers by days since issued (descending)
  const urgentBuyers = BUYERS
    .filter((b) => b.urgent)
    .sort((a, b) => {
      const aDays = getDaysOverdue(a);
      const bDays = getDaysOverdue(b);
      return bDays - aDays;
    });
  const normalBuyers = BUYERS.filter((b) => !b.urgent);

  const hasBuyers = BUYERS.length > 0;

  return (
    <div style={{ minHeight: '100vh', background: BG }}>
      {/* Header */}
      <div
        style={{
          background: CARD,
          padding: '52px 20px 16px',
          borderBottom: `1px solid ${LINE}`,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: '0.02em',
            color: T4,
            marginBottom: 2,
          }}
        >
          Pipeline
        </div>
        <div
          style={{
            fontSize: 24,
            fontWeight: 700,
            letterSpacing: '-0.025em',
            color: T1,
            marginBottom: 14,
          }}
        >
          Sales Pipeline
        </div>
      </div>

      {/* Segmented control — outside header, with breathing room */}
      <div
        style={{
          display: 'flex',
          background: S2,
          borderRadius: 12,
          padding: 4,
          gap: 2,
          margin: '0 20px 16px',
          border: `1px solid ${LINE}`,
          marginTop: 16,
        }}
      >
        {TOGGLE_ITEMS.map((item) => {
          const active = view === item.key;
          return (
            <button
              key={item.key}
              className="interactive"
              onClick={() => setView(item.key)}
              style={{
                flex: 1,
                padding: '10px 6px',
                borderRadius: 10,
                background: active ? CARD : 'transparent',
                color: active ? T1 : T2,
                fontSize: 12,
                fontWeight: active ? 600 : 400,
                boxShadow: active ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                border: 'none',
                fontFamily: 'inherit',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div style={{ padding: '0 16px 48px' }}>
        {!hasBuyers ? (
          <EmptyState
            icon={<Users size={24} color={T3} />}
            title="No buyers yet"
            subtitle="Buyers will appear here as they enter your sales pipeline."
          />
        ) : (
          <>
            {view === 'buyers' && (
              <>
                {/* Needs attention */}
                {urgentBuyers.length > 0 && (
                  <>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 500,
                        letterSpacing: '0.02em',
                        color: FLAG,
                        marginBottom: 8,
                      }}
                    >
                      Needs attention ({urgentBuyers.length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                      {urgentBuyers.map((b) => (
                        <BuyerCard key={b.id} buyer={b} />
                      ))}
                    </div>
                  </>
                )}

                {/* All buyers */}
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 500,
                    letterSpacing: '0.02em',
                    color: T4,
                    marginBottom: 8,
                  }}
                >
                  All buyers ({normalBuyers.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {normalBuyers.map((b) => (
                    <BuyerCard key={b.id} buyer={b} />
                  ))}
                </div>
              </>
            )}

            {view === 'stages' && <ByStageView />}
            {view === 'schemes' && <BySchemeView />}
          </>
        )}
      </div>
    </div>
  );
}
