'use client';

import { useState } from 'react';
import {
  BG, CARD, S1, S2, LINE, T1, T2, T3, T4,
  GOLD, GOLD_D, GOLD_L,
  GO, GO_L,
  WARN, WARN_L,
  INFO, INFO_L,
} from '@/lib/agent/design-tokens';

/* ------------------------------------------------------------------ */
/*  Static demo data                                                   */
/* ------------------------------------------------------------------ */

type View = 'Files' | 'Viewings' | 'Analytics';

const documents = [
  { name: 'The Coppice — Brochure', scheme: 'The Coppice', views: 23, date: '12 Jan' },
  { name: 'A1 Booking Form — Ryan', scheme: 'The Coppice', views: 2, date: '14 Jan' },
  { name: '14 Fernwood — Sale Particulars', scheme: 'Standalone', views: 8, date: '18 Jan' },
  { name: 'Harbour View — Price List', scheme: 'Harbour View', views: 14, date: '8 Jan' },
  { name: 'BER Certificate — Unit A3', scheme: 'The Coppice', views: 0, date: '10 Jan' },
];

const filters = ['All', 'The Coppice', 'Harbour View', 'Standalone'];

const todayViewings = [
  { time: '10:00', buyer: 'Sarah Doyle', unit: 'Coppice — A4', status: 'confirmed' as const },
  { time: '11:30', buyer: 'New Enquiry', unit: '7 Orchard Close', status: 'confirmed' as const },
];

const tomorrowViewings = [
  { time: '14:00', buyer: 'Deirdre Walsh', unit: 'Coppice Showhouse', status: 'confirmed' as const },
  { time: '15:30', buyer: 'Mark Brennan', unit: 'Coppice — A5', status: 'pending' as const },
];

const analyticsStats = [
  { v: '49', l: 'Units Sold', color: GOLD_D, bg: GOLD_L },
  { v: '31', l: 'Sale Agreed', color: INFO, bg: INFO_L },
  { v: '5', l: 'Contracts Out', color: WARN, bg: WARN_L },
  { v: '10', l: 'Available', color: GO, bg: GO_L },
];

const barData = [
  { month: 'Sep', value: 3 },
  { month: 'Oct', value: 5 },
  { month: 'Nov', value: 4 },
  { month: 'Dec', value: 7 },
  { month: 'Jan', value: 9 },
  { month: 'Feb', value: 6 },
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

export default function DocsTab() {
  const [view, setView] = useState<View>('Files');
  const [activeFilter, setActiveFilter] = useState('All');

  const views: View[] = ['Files', 'Viewings', 'Analytics'];

  const filteredDocs =
    activeFilter === 'All'
      ? documents
      : documents.filter((d) => d.scheme === activeFilter);

  const maxBar = Math.max(...barData.map((b) => b.value));

  return (
    <div style={{ background: BG, paddingBottom: 32 }}>
      {/* Header */}
      <div
        style={{
          background: CARD,
          padding: '52px 20px 16px',
          borderBottom: `1px solid ${LINE}`,
        }}
      >
        <div style={sectionLabel}>Archive</div>
        <div style={{ color: T1, fontSize: 24, fontWeight: 700, letterSpacing: '-0.03em' }}>
          Documents
        </div>
      </div>

      {/* Toggle */}
      <div style={{ padding: '12px 16px 0' }}>
        <div
          style={{
            display: 'flex',
            background: S1,
            borderRadius: 12,
            padding: 3,
            marginBottom: 16,
          }}
        >
          {views.map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                flex: 1,
                padding: '8px 0',
                borderRadius: 10,
                border: 'none',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600,
                background: view === v ? CARD : 'transparent',
                color: view === v ? T1 : T3,
                boxShadow: view === v ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: '0 16px' }}>
        {/* ---- Files View ---- */}
        {view === 'Files' && (
          <>
            {/* Filter chips */}
            <div
              style={{
                display: 'flex',
                gap: 8,
                overflowX: 'auto',
                marginBottom: 14,
                paddingBottom: 2,
              }}
            >
              {filters.map((f) => {
                const active = f === activeFilter;
                return (
                  <button
                    key={f}
                    onClick={() => setActiveFilter(f)}
                    style={{
                      padding: '5px 13px',
                      borderRadius: 20,
                      fontSize: 11,
                      fontWeight: 600,
                      border: active ? 'none' : `1px solid ${LINE}`,
                      background: active ? T1 : CARD,
                      color: active ? '#FFFFFF' : T2,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}
                  >
                    {f}
                  </button>
                );
              })}
            </div>

            {/* Document list */}
            <div style={{ ...card, overflow: 'hidden' }}>
              {filteredDocs.map((doc, i) => (
                <div
                  key={doc.name}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '12px 14px',
                    gap: 12,
                    borderTop: i > 0 ? `1px solid ${LINE}` : undefined,
                  }}
                >
                  {/* File icon */}
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 9,
                      background: INFO_L,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={INFO} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14,2 14,8 20,8" />
                      <line x1={16} y1={13} x2={8} y2={13} />
                      <line x1={16} y1={17} x2={8} y2={17} />
                      <polyline points="10,9 9,9 8,9" />
                    </svg>
                  </div>

                  {/* Text */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: T1, fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {doc.name}
                    </div>
                    <div style={{ color: T3, fontSize: 11 }}>
                      {doc.scheme} &middot; {doc.views} views &middot; {doc.date}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    {/* Share */}
                    <button
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 8,
                        background: S1,
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={T3} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <circle cx={18} cy={5} r={3} />
                        <circle cx={6} cy={12} r={3} />
                        <circle cx={18} cy={19} r={3} />
                        <line x1={8.59} y1={13.51} x2={15.42} y2={17.49} />
                        <line x1={15.41} y1={6.51} x2={8.59} y2={10.49} />
                      </svg>
                    </button>
                    {/* Download */}
                    <button
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 8,
                        background: S1,
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={T3} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7,10 12,15 17,10" />
                        <line x1={12} y1={15} x2={12} y2={3} />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ---- Viewings View ---- */}
        {view === 'Viewings' && (
          <>
            {/* Today */}
            <div style={{ marginBottom: 18 }}>
              <div style={sectionLabel}>Today</div>
              <div style={{ ...card, overflow: 'hidden' }}>
                {todayViewings.map((v, i) => (
                  <div
                    key={v.buyer}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '12px 14px',
                      gap: 12,
                      borderTop: i > 0 ? `1px solid ${LINE}` : undefined,
                    }}
                  >
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
                    <div style={{ flex: 1 }}>
                      <div style={{ color: T1, fontSize: 13, fontWeight: 600 }}>{v.buyer}</div>
                      <div style={{ color: T3, fontSize: 11 }}>{v.unit}</div>
                    </div>
                    <ViewingBadge status={v.status} />
                  </div>
                ))}
              </div>
            </div>

            {/* Tomorrow */}
            <div style={{ marginBottom: 18 }}>
              <div style={sectionLabel}>Tomorrow</div>
              <div style={{ ...card, overflow: 'hidden' }}>
                {tomorrowViewings.map((v, i) => (
                  <div
                    key={v.buyer}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '12px 14px',
                      gap: 12,
                      borderTop: i > 0 ? `1px solid ${LINE}` : undefined,
                    }}
                  >
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
                    <div style={{ flex: 1 }}>
                      <div style={{ color: T1, fontSize: 13, fontWeight: 600 }}>{v.buyer}</div>
                      <div style={{ color: T3, fontSize: 11 }}>{v.unit}</div>
                    </div>
                    <ViewingBadge status={v.status} />
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ---- Analytics View ---- */}
        {view === 'Analytics' && (
          <>
            {/* 2x2 stat grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 10,
                marginBottom: 18,
              }}
            >
              {analyticsStats.map((s) => (
                <div
                  key={s.l}
                  style={{
                    background: s.bg,
                    borderRadius: 14,
                    padding: 16,
                  }}
                >
                  <div style={{ color: s.color, fontSize: 26, fontWeight: 700, letterSpacing: '-0.03em' }}>
                    {s.v}
                  </div>
                  <div style={{ color: s.color, fontSize: 12, fontWeight: 600, marginTop: 2 }}>
                    {s.l}
                  </div>
                </div>
              ))}
            </div>

            {/* Bar chart */}
            <div style={sectionLabel}>Units Sold — Monthly</div>
            <div style={{ ...card, padding: 16 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-end',
                  gap: 10,
                  height: 120,
                }}
              >
                {barData.map((b) => {
                  const heightPct = (b.value / maxBar) * 100;
                  const isJan = b.month === 'Jan';
                  return (
                    <div
                      key={b.month}
                      style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 6,
                        height: '100%',
                        justifyContent: 'flex-end',
                      }}
                    >
                      <div style={{ color: T2, fontSize: 10, fontWeight: 600 }}>{b.value}</div>
                      <div
                        style={{
                          width: '100%',
                          height: `${heightPct}%`,
                          borderRadius: 6,
                          background: isJan ? GOLD : S2,
                        }}
                      />
                      <div style={{ color: T3, fontSize: 10 }}>{b.month}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-component                                                      */
/* ------------------------------------------------------------------ */

function ViewingBadge({ status }: { status: 'confirmed' | 'pending' }) {
  const isConfirmed = status === 'confirmed';
  return (
    <div
      style={{
        color: isConfirmed ? GO : WARN,
        background: isConfirmed ? GO_L : WARN_L,
        fontSize: 9,
        fontWeight: 700,
        padding: '3px 8px',
        borderRadius: 6,
        letterSpacing: '0.04em',
      }}
    >
      {isConfirmed ? 'CONFIRMED' : 'PENDING'}
    </div>
  );
}
