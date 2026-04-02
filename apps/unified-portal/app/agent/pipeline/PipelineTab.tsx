'use client';

import { useState } from 'react';
import {
  BG, CARD, S1, S2, S3, LINE, LINE_B,
  T1, T2, T3, T4,
  GOLD, GOLD_D, GOLD_L, GOLD_M,
  GO, GO_L, GO_M,
  FLAG, FLAG_L, FLAG_M,
  WARN, WARN_L,
  INFO, INFO_L, INFO_M,
  VIO, VIO_L, VIO_M,
  STATUS_STYLES,
} from '@/lib/agent/design-tokens';

type View = 'buyers' | 'stages' | 'schemes';

interface Buyer {
  id: number;
  ini: string;
  name: string;
  unit: string;
  dev: string;
  score: number;
  aip: boolean;
  status: string;
  last: string;
  budget: string;
  dep: string | null;
  cdate: string | null;
  signed: string | null;
  closing: string | null;
  urgent: boolean;
  notes: string;
}

const BUYERS: Buyer[] = [
  { id: 1, ini: 'CR', name: 'Conor Ryan', unit: 'Coppice A1', dev: 'The Coppice', score: 92, aip: true, status: 'contracts_out', last: '2d ago', budget: '420,000', dep: '14 Jan', cdate: '22 Jan', signed: null, closing: null, urgent: true, notes: 'Solicitor 3 days late.' },
  { id: 2, ini: 'DW', name: 'Deirdre Walsh', unit: 'Coppice A2', dev: 'The Coppice', score: 78, aip: true, status: 'reserved', last: 'Yesterday', budget: '380,000', dep: '18 Jan', cdate: null, signed: null, closing: null, urgent: false, notes: 'Happy with A2.' },
  { id: 3, ini: 'JM', name: 'James McCarthy', unit: 'Coppice A3', dev: 'The Coppice', score: 95, aip: true, status: 'exchanged', last: '4d ago', budget: '500,000', dep: '10 Jan', cdate: '19 Jan', signed: '25 Jan', closing: '15 Apr', urgent: false, notes: 'On track.' },
  { id: 4, ini: 'RD', name: 'R & K Donovan', unit: '14 Fernwood', dev: 'Standalone', score: 88, aip: true, status: 'contracts_out', last: 'Today', budget: '560,000', dep: '16 Jan', cdate: '23 Jan', signed: null, closing: null, urgent: true, notes: 'Solicitor slow.' },
  { id: 5, ini: 'MB', name: 'Mark Brennan', unit: 'Coppice A5', dev: 'The Coppice', score: 61, aip: false, status: 'reserved', last: 'Today', budget: '420,000', dep: '20 Jan', cdate: null, signed: null, closing: null, urgent: true, notes: 'Needs AIP.' },
  { id: 6, ini: 'SD', name: 'Sarah Doyle', unit: 'Unassigned', dev: '\u2014', score: 44, aip: false, status: 'enquiry', last: 'Today', budget: '300,000', dep: null, cdate: null, signed: null, closing: null, urgent: false, notes: '2 beds under 300k.' },
];

const TOGGLE_ITEMS: { key: View; label: string }[] = [
  { key: 'buyers', label: 'By Buyer' },
  { key: 'stages', label: 'By Stage' },
  { key: 'schemes', label: 'By Scheme' },
];

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
      <span style={{ color: T4, fontWeight: 600, fontSize: 9, textTransform: 'uppercase' }}>{label}</span>
      {value}
    </span>
  );
}

function TimelineDots({ buyer }: { buyer: Buyer }) {
  const steps = [
    { label: 'Deposit', date: buyer.dep },
    { label: 'Contracts', date: buyer.cdate },
    { label: 'Signed', date: buyer.signed },
    { label: 'Closing', date: buyer.closing },
  ];
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0, padding: '8px 0 4px', width: '100%' }}>
      {steps.map((step, i) => {
        const done = !!step.date;
        return (
          <div key={step.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
            {/* connector line */}
            {i > 0 && (
              <div
                style={{
                  position: 'absolute',
                  top: 5,
                  right: '50%',
                  width: '100%',
                  height: 2,
                  background: steps[i - 1]?.date ? GO_M : S2,
                  zIndex: 0,
                }}
              />
            )}
            {/* dot */}
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                background: done ? GO : S2,
                border: done ? `2px solid ${GO}` : `2px solid ${S3}`,
                zIndex: 1,
                position: 'relative',
              }}
            />
            <span style={{ fontSize: 9, color: T4, marginTop: 3, fontWeight: 600, textTransform: 'uppercase' }}>{step.label}</span>
            <span style={{ fontSize: 9, color: done ? T2 : T4, fontWeight: done ? 600 : 400 }}>{step.date || '\u2014'}</span>
          </div>
        );
      })}
    </div>
  );
}

function BuyerCard({ buyer }: { buyer: Buyer }) {
  const isUrgent = buyer.urgent;
  return (
    <div
      style={{
        background: CARD,
        borderRadius: 16,
        border: `1px solid ${isUrgent ? FLAG_M : LINE}`,
        boxShadow: isUrgent
          ? `0 1px 3px rgba(191,55,40,0.12), 0 0 0 1px ${FLAG_M}`
          : '0 1px 3px rgba(0,0,0,0.04)',
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
          <div style={{ fontSize: 14, fontWeight: 600, color: isUrgent ? FLAG : T1, lineHeight: 1.3 }}>{buyer.name}</div>
          <div style={{ fontSize: 12, color: T3 }}>{buyer.unit} &middot; {buyer.dev}</div>
        </div>
        <StatusBadge status={buyer.status} />
      </div>

      {/* Timeline */}
      <TimelineDots buyer={buyer} />

      {/* Info pills */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        <Pill label="Budget" value={`\u20AC${buyer.budget}`} />
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 3,
            padding: '3px 8px',
            borderRadius: 8,
            background: buyer.aip ? GO_L : FLAG_L,
            border: `1px solid ${buyer.aip ? GO_M : FLAG_M}`,
            fontSize: 10,
            fontWeight: 600,
            color: buyer.aip ? GO : FLAG,
          }}
        >
          AIP {buyer.aip ? 'Yes' : 'No'}
        </span>
        <Pill label="Score" value={`${buyer.score}`} />
        <Pill label="Last" value={buyer.last} />
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
  { key: 'deposit', label: 'Deposit', color: INFO, bg: INFO_L, statuses: ['reserved', 'enquiry'] },
  { key: 'contracts_issued', label: 'Contracts Issued', color: GOLD_D, bg: GOLD_L, statuses: ['contracts_out'] },
  { key: 'contracts_signed', label: 'Contracts Signed', color: VIO, bg: VIO_L, statuses: ['exchanged'] },
  { key: 'closed', label: 'Closed', color: GO, bg: GO_L, statuses: ['sold', 'closing'] },
];

function ByStageView() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {STAGE_GROUPS.map((group) => {
        const buyers = BUYERS.filter((b) => group.statuses.includes(b.status));
        return (
          <div key={group.key}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: group.color }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: T1, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
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
            </div>
            {/* Card */}
            <div
              style={{
                background: CARD,
                borderRadius: 14,
                border: `1px solid ${LINE}`,
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                overflow: 'hidden',
              }}
            >
              {buyers.length === 0 ? (
                <div style={{ padding: 16, fontSize: 12, color: T4, textAlign: 'center' }}>No buyers in this stage</div>
              ) : (
                buyers.map((b, i) => (
                  <div
                    key={b.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 14px',
                      borderBottom: i < buyers.length - 1 ? `1px solid ${LINE}` : 'none',
                    }}
                  >
                    <Avatar ini={b.ini} size={32} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: T1 }}>{b.name}</div>
                      <div style={{ fontSize: 11, color: T3 }}>{b.unit}</div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: T1, whiteSpace: 'nowrap' }}>\u20AC{b.budget}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---- By Scheme View ---- */
function BySchemeView() {
  const schemes = Array.from(new Set(BUYERS.map((b) => b.dev)));
  const stageColors = [
    { key: 'deposit', label: 'Deposit', color: INFO, statuses: ['reserved', 'enquiry'] },
    { key: 'contracts', label: 'Contracts', color: GOLD_D, statuses: ['contracts_out'] },
    { key: 'signed', label: 'Signed', color: VIO, statuses: ['exchanged'] },
    { key: 'closed', label: 'Closed', color: GO, statuses: ['sold', 'closing'] },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {schemes.map((scheme) => {
        const schemeBuyers = BUYERS.filter((b) => b.dev === scheme);
        const total = schemeBuyers.length;
        const counts = stageColors.map((s) => ({
          ...s,
          count: schemeBuyers.filter((b) => s.statuses.includes(b.status)).length,
        }));
        const pct = total > 0 ? Math.round((counts.filter((c) => c.key === 'closed')[0].count / total) * 100) : 0;

        return (
          <div
            key={scheme}
            style={{
              background: CARD,
              borderRadius: 14,
              border: `1px solid ${LINE}`,
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div style={{ padding: '14px 14px 10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: T1 }}>{scheme}</div>
                  <div style={{ fontSize: 11, color: T3 }}>{total} buyer{total !== 1 ? 's' : ''}</div>
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, color: T1 }}>{pct}%</div>
              </div>

              {/* Stacked bar */}
              <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', background: S1 }}>
                {counts.map((c) =>
                  c.count > 0 ? (
                    <div
                      key={c.key}
                      style={{
                        width: `${(c.count / total) * 100}%`,
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
            {schemeBuyers.map((b, i) => (
              <div
                key={b.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 14px',
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
                  {b.unit}
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

  const urgentBuyers = BUYERS.filter((b) => b.urgent);
  const normalBuyers = BUYERS.filter((b) => !b.urgent);

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
            fontSize: 10,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
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

        {/* Toggle bar */}
        <div
          style={{
            display: 'flex',
            background: S1,
            borderRadius: 12,
            padding: 3,
            border: `1px solid ${LINE}`,
            gap: 2,
          }}
        >
          {TOGGLE_ITEMS.map((item) => {
            const active = view === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setView(item.key)}
                style={{
                  flex: 1,
                  fontSize: 11,
                  padding: '8px 4px',
                  borderRadius: 10,
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: active ? 600 : 400,
                  color: active ? T1 : T3,
                  background: active ? CARD : 'transparent',
                  boxShadow: active ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '16px 16px 48px' }}>
        {view === 'buyers' && (
          <>
            {/* Needs Attention */}
            {urgentBuyers.length > 0 && (
              <>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: FLAG,
                    marginBottom: 8,
                  }}
                >
                  Needs Attention
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                  {urgentBuyers.map((b) => (
                    <BuyerCard key={b.id} buyer={b} />
                  ))}
                </div>
              </>
            )}

            {/* All Buyers */}
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: T4,
                marginBottom: 8,
              }}
            >
              All Buyers
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
      </div>
    </div>
  );
}
