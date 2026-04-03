'use client';

import {
  BG, CARD, S1, LINE,
  T1, T2, T3, T4,
  GOLD_D, GOLD_L,
  GO, GO_L, GO_M,
  INFO, INFO_L,
  FLAG,
  SHADOW_CARD,
} from '@/lib/agent/design-tokens';

/* ------------------------------------------------------------------ */
/*  Static demo data                                                   */
/* ------------------------------------------------------------------ */

const stats = [
  { v: '49', l: 'Sold' },
  { v: '11', l: 'Active' },
  { v: '\u20AC28M', l: 'Portfolio' },
];

const INTEGRATION_GROUPS = [
  {
    label: 'Property portals',
    items: [
      { label: 'Daft.ie', connected: true },
      { label: 'MyHome.ie', connected: true },
    ],
  },
  {
    label: 'Communication',
    items: [
      { label: 'Gmail', connected: true },
      { label: 'Google Drive', connected: true },
      { label: 'WhatsApp Business', connected: true },
    ],
  },
  {
    label: 'Documents & CRM',
    items: [
      { label: 'DocuSign', connected: false },
      { label: 'Outlook', connected: false },
    ],
  },
];

const settingsItems = [
  'Notification preferences',
  'Display & accessibility',
  'Help & support',
  'Rate OpenHouse Agent',
];

/* ------------------------------------------------------------------ */
/*  Shared styles                                                      */
/* ------------------------------------------------------------------ */

const sectionLabel: React.CSSProperties = {
  color: T3,
  fontSize: 11,
  fontWeight: 500,
  marginBottom: 8,
  paddingLeft: 2,
};

const card: React.CSSProperties = {
  background: CARD,
  borderRadius: 16,
  border: `1px solid ${LINE}`,
  boxShadow: SHADOW_CARD,
};

/* ------------------------------------------------------------------ */
/*  Icons (inline SVG)                                                 */
/* ------------------------------------------------------------------ */

function CheckIcon({ color }: { color: string }) {
  return (
    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20,6 9,17 4,12" />
    </svg>
  );
}

function PlusIcon({ color }: { color: string }) {
  return (
    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <line x1={12} y1={5} x2={12} y2={19} />
      <line x1={5} y1={12} x2={19} y2={12} />
    </svg>
  );
}

function GearIcon({ color }: { color: string }) {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx={12} cy={12} r={3} />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function ChevronRightIcon({ color }: { color: string }) {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9,18 15,12 9,6" />
    </svg>
  );
}

function LogoutIcon({ color }: { color: string }) {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16,17 21,12 16,7" />
      <line x1={21} y1={12} x2={9} y2={12} />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ProfileTab() {
  return (
    <div style={{ background: BG, minHeight: '100vh', paddingBottom: 32 }}>
      {/* Header */}
      <div
        style={{
          background: CARD,
          padding: '52px 20px 16px',
          borderBottom: `1px solid ${LINE}`,
        }}
      >
        <div style={{ color: T1, fontSize: 24, fontWeight: 700, letterSpacing: '-0.03em' }}>
          Profile
        </div>
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        {/* ---- Agent Card ---- */}
        <div style={{ ...card, padding: 20, marginBottom: 24 }}>
          {/* Top section */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {/* Avatar */}
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 16,
                background: GOLD_L,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 19,
                fontWeight: 700,
                color: GOLD_D,
                flexShrink: 0,
              }}
            >
              SC
            </div>
            <div>
              <div style={{ color: T1, fontSize: 18, fontWeight: 700 }}>Sarah Collins</div>
              <div style={{ color: T3, fontSize: 12, marginTop: 2 }}>Sherry FitzGerald Cork</div>
              <div style={{ color: T2, fontSize: 11, fontWeight: 600, marginTop: 3 }}>
                Senior Sales Agent
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div
            style={{
              display: 'flex',
              borderTop: `1px solid ${LINE}`,
              marginTop: 18,
              paddingTop: 4,
            }}
          >
            {stats.map((s, i) => (
              <div
                key={s.l}
                style={{
                  flex: 1,
                  textAlign: 'center',
                  borderRight: i < stats.length - 1 ? `1.5px solid ${LINE}` : 'none',
                  padding: '16px 12px',
                }}
              >
                <div style={{ color: GOLD_D, fontSize: 20, fontWeight: 700 }}>{s.v}</div>
                <div
                  style={{
                    color: T3,
                    fontSize: 10,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    marginTop: 2,
                  }}
                >
                  {s.l}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ---- Integrations Section ---- */}
        <div style={sectionLabel}>Integrations</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
          {INTEGRATION_GROUPS.map((group) => (
            <div key={group.label}>
              <div
                style={{
                  color: T3,
                  fontSize: 11,
                  fontWeight: 500,
                  marginBottom: 6,
                  paddingLeft: 2,
                }}
              >
                {group.label}
              </div>
              <div style={{ ...card, overflow: 'hidden' }}>
                {group.items.map((item, i) => (
                  <div
                    key={item.label}
                    className="interactive"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '11px 14px',
                      gap: 12,
                      borderTop: i > 0 ? `1px solid ${LINE}` : undefined,
                      cursor: 'pointer',
                    }}
                  >
                    {/* Icon */}
                    <div
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 8,
                        background: item.connected ? GO_L : S1,
                        border: `1px solid ${item.connected ? GO_M : LINE}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {item.connected ? <CheckIcon color={GO} /> : <PlusIcon color={T3} />}
                    </div>

                    {/* Name */}
                    <div style={{ flex: 1, color: T1, fontSize: 13, fontWeight: 500 }}>
                      {item.label}
                    </div>

                    {/* Status pill */}
                    <div
                      style={{
                        padding: '3px 10px',
                        borderRadius: 20,
                        fontSize: 10,
                        fontWeight: 700,
                        background: item.connected ? GO_L : INFO_L,
                        color: item.connected ? GO : INFO,
                      }}
                    >
                      {item.connected ? 'Live' : 'Connect'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* ---- Settings Section ---- */}
        <div style={sectionLabel}>Settings</div>
        <div style={{ ...card, overflow: 'hidden', marginBottom: 24 }}>
          {settingsItems.map((item, i) => (
            <div
              key={item}
              className="interactive"
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '12px 14px',
                gap: 12,
                borderTop: i > 0 ? `1px solid ${LINE}` : undefined,
                cursor: 'pointer',
              }}
            >
              {/* Gear icon */}
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  background: S1,
                  border: `1px solid ${LINE}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <GearIcon color={T3} />
              </div>

              {/* Text */}
              <div style={{ flex: 1, color: T1, fontSize: 13, fontWeight: 500 }}>
                {item}
              </div>

              {/* Chevron */}
              <ChevronRightIcon color={T4} />
            </div>
          ))}
        </div>

        {/* ---- Sign Out Button ---- */}
        <button
          className="interactive"
          style={{
            width: '100%',
            padding: '14px 0',
            borderRadius: 16,
            background: 'transparent',
            border: `1px solid ${LINE}`,
            color: FLAG,
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <LogoutIcon color={FLAG} />
          Sign Out
        </button>
      </div>
    </div>
  );
}
