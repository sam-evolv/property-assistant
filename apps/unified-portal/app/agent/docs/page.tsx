'use client';

import { useState } from 'react';
import AgentShell from '../_components/AgentShell';
import { SCHEMES, AGENT_STATS } from '@/lib/agent/demo-data';

/* Demo doc data */
interface Doc {
  id: string;
  name: string;
  type: 'ber' | 'brochure' | 'form' | 'price_list';
  schemeName: string;
  schemeId: string;
  updatedAt: string;
  size: string;
}

const DOCS: Doc[] = [
  { id: '1', name: 'BER Certificates Pack', type: 'ber', schemeName: 'Riverside Gardens', schemeId: 'riverside', updatedAt: '2 Mar', size: '4.2 MB' },
  { id: '2', name: 'Sales Brochure 2026', type: 'brochure', schemeName: 'Riverside Gardens', schemeId: 'riverside', updatedAt: '28 Feb', size: '12.8 MB' },
  { id: '3', name: 'Booking Form Template', type: 'form', schemeName: 'Riverside Gardens', schemeId: 'riverside', updatedAt: '15 Feb', size: '340 KB' },
  { id: '4', name: 'Price List Q1 2026', type: 'price_list', schemeName: 'Riverside Gardens', schemeId: 'riverside', updatedAt: '1 Jan', size: '180 KB' },
  { id: '5', name: 'BER Certificates', type: 'ber', schemeName: 'Meadow View', schemeId: 'meadow', updatedAt: '10 Mar', size: '3.8 MB' },
  { id: '6', name: 'Particulars & Floorplans', type: 'brochure', schemeName: 'Meadow View', schemeId: 'meadow', updatedAt: '5 Mar', size: '8.4 MB' },
  { id: '7', name: 'Reservation Agreement', type: 'form', schemeName: 'Meadow View', schemeId: 'meadow', updatedAt: '20 Feb', size: '220 KB' },
  { id: '8', name: 'Oak Hill Site Map', type: 'brochure', schemeName: 'Oak Hill Estate', schemeId: 'oak-hill', updatedAt: '12 Jan', size: '6.1 MB' },
  { id: '9', name: 'Price List Update', type: 'price_list', schemeName: 'Oak Hill Estate', schemeId: 'oak-hill', updatedAt: '8 Jan', size: '95 KB' },
  { id: '10', name: 'Harbour View Brochure', type: 'brochure', schemeName: 'Harbour View Apartments', schemeId: 'harbour', updatedAt: '20 Mar', size: '15.2 MB' },
];

const DOC_ICON_CONFIG: Record<string, { bg: string; border: string; color: string }> = {
  ber: { bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.2)', color: '#10B981' },
  brochure: { bg: 'rgba(124,58,237,0.08)', border: 'rgba(124,58,237,0.2)', color: '#7C3AED' },
  form: { bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.2)', color: '#3B82F6' },
  price_list: { bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.2)', color: '#3B82F6' },
};

export default function DocsPage() {
  const [activeScheme, setActiveScheme] = useState<string>('all');

  const schemeNames = ['all', ...SCHEMES.map((s) => s.id)];
  const filteredDocs =
    activeScheme === 'all'
      ? DOCS
      : DOCS.filter((d) => d.schemeId === activeScheme);

  return (
    <AgentShell agentName="Sam" urgentCount={AGENT_STATS.urgent}>
      <div style={{ padding: '8px 24px 100px' }}>
        <h1
          style={{
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: '-0.05em',
            color: '#0D0D12',
            marginBottom: 16,
          }}
        >
          Documents
        </h1>

        {/* Scheme filter chips — flex-wrap, NO scrollbar */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            marginBottom: 20,
          }}
        >
          {schemeNames.map((id) => {
            const active = activeScheme === id;
            const label =
              id === 'all'
                ? 'All'
                : SCHEMES.find((s) => s.id === id)?.name ?? id;
            return (
              <button
                key={id}
                onClick={() => setActiveScheme(id)}
                style={{
                  padding: '7px 14px',
                  borderRadius: 22,
                  border: `0.5px solid ${active ? '#0D0D12' : 'rgba(0,0,0,0.1)'}`,
                  background: active ? '#0D0D12' : 'rgba(255,255,255,0.8)',
                  color: active ? '#fff' : '#6B7280',
                  fontSize: 12,
                  fontWeight: active ? 600 : 500,
                  letterSpacing: '-0.01em',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'all 0.15s ease',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Document rows */}
        <div
          style={{
            background: '#FFFFFF',
            borderRadius: 18,
            overflow: 'hidden',
            boxShadow:
              '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05), 0 0 0 0.5px rgba(0,0,0,0.04)',
          }}
        >
          {filteredDocs.map((doc, i) => {
            const iconCfg = DOC_ICON_CONFIG[doc.type] || DOC_ICON_CONFIG.form;
            return (
              <div
                key={doc.id}
                className="agent-tappable"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '14px 18px',
                  borderBottom:
                    i < filteredDocs.length - 1
                      ? '1px solid rgba(0,0,0,0.04)'
                      : 'none',
                }}
              >
                {/* Icon box */}
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 12,
                    background: iconCfg.bg,
                    border: `1px solid ${iconCfg.border}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <DocIcon type={doc.type} color={iconCfg.color} />
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13.5,
                      fontWeight: 500,
                      color: '#0D0D12',
                      letterSpacing: '-0.01em',
                      marginBottom: 2,
                    }}
                  >
                    {doc.name}
                  </div>
                  <div
                    style={{
                      fontSize: 11.5,
                      color: '#A0A8B0',
                    }}
                  >
                    {doc.schemeName} &middot; {doc.updatedAt} &middot; {doc.size}
                  </div>
                </div>

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <ActionButton icon="share" />
                  <ActionButton icon="download" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AgentShell>
  );
}

function DocIcon({ type, color }: { type: string; color: string }) {
  if (type === 'ber') {
    return (
      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14,2 14,8 20,8" />
        <path d="M9 15l2 2 4-4" />
      </svg>
    );
  }
  if (type === 'brochure') {
    return (
      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <polyline points="21,15 16,10 5,21" />
      </svg>
    );
  }
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14,2 14,8 20,8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="13" y2="17" />
    </svg>
  );
}

function ActionButton({ icon }: { icon: 'share' | 'download' }) {
  return (
    <div
      className="agent-tappable"
      style={{
        width: 32,
        height: 32,
        borderRadius: 10,
        background: '#F5F5F3',
        border: '0.5px solid rgba(0,0,0,0.07)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {icon === 'share' ? (
        <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
          <polyline points="16,6 12,2 8,6" />
          <line x1="12" y1="2" x2="12" y2="15" />
        </svg>
      ) : (
        <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
          <polyline points="7,10 12,15 17,10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      )}
    </div>
  );
}
