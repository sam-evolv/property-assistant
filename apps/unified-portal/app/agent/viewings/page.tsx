'use client';

import AgentShell from '../_components/AgentShell';
import StatusBadge from '../_components/StatusBadge';
import { AGENT_STATS } from '@/lib/agent/demo-data';

/* Demo viewing data */
const VIEWINGS = [
  { id: '1', time: '10:00', buyerName: 'Sarah & Michael Kelly', schemeName: 'Riverside Gardens', unit: 'Unit 12', status: 'confirmed' as const, note: 'Second viewing — very interested in 4-bed' },
  { id: '2', time: '11:30', buyerName: 'David Chen', schemeName: 'Meadow View', unit: 'Unit 8', status: 'confirmed' as const },
  { id: '3', time: '14:00', buyerName: 'Aoife Murphy & James Ryan', schemeName: 'Oak Hill Estate', unit: 'Unit 22', status: 'pending' as const, note: 'First-time buyers, mortgage pre-approved' },
  { id: '4', time: '15:30', buyerName: 'Priya Nair', schemeName: 'Harbour View Apartments', unit: 'Unit 3', status: 'confirmed' as const },
  { id: '5', time: '16:30', buyerName: 'Tom & Lisa Walsh', schemeName: 'Willow Brook', unit: 'Unit 15', status: 'pending' as const },
];

const STATS = {
  today: VIEWINGS.length,
  thisWeek: 12,
  confirmed: VIEWINGS.filter((v) => v.status === 'confirmed').length,
};

export default function ViewingsPage() {
  return (
    <AgentShell agentName="Sam" urgentCount={AGENT_STATS.urgent}>
      <div style={{ padding: '8px 24px 100px' }}>
        <h1
          style={{
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: '-0.05em',
            color: '#0D0D12',
            marginBottom: 20,
          }}
        >
          Viewings
        </h1>

        {/* Summary stat strip */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
          <StatCard label="Today" value={STATS.today} />
          <StatCard label="This week" value={STATS.thisWeek} />
          <StatCard label="Confirmed" value={STATS.confirmed} highlight />
        </div>

        {/* Section label */}
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: '#A0A8B0',
            marginBottom: 12,
          }}
        >
          Today&apos;s schedule
        </div>

        {/* Viewing rows */}
        <div
          style={{
            background: '#FFFFFF',
            borderRadius: 18,
            overflow: 'hidden',
            boxShadow:
              '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05), 0 0 0 0.5px rgba(0,0,0,0.04)',
            marginBottom: 24,
          }}
        >
          {VIEWINGS.map((v, i) => (
            <div
              key={v.id}
              className="agent-tappable"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '14px 18px',
                borderBottom:
                  i < VIEWINGS.length - 1
                    ? '1px solid rgba(0,0,0,0.04)'
                    : 'none',
              }}
            >
              {/* Time box */}
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 15,
                  background: '#F5F5F3',
                  border: '0.5px solid rgba(0,0,0,0.06)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    fontSize: 12.5,
                    fontWeight: 700,
                    letterSpacing: '-0.02em',
                    color: '#0D0D12',
                  }}
                >
                  {v.time}
                </span>
              </div>

              {/* Details */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 500,
                    color: '#0D0D12',
                    letterSpacing: '-0.01em',
                    marginBottom: 2,
                  }}
                >
                  {v.buyerName}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: '#A0A8B0',
                    letterSpacing: '0.005em',
                  }}
                >
                  {v.schemeName} &middot; {v.unit}
                </div>
                {v.note && (
                  <div
                    style={{
                      fontSize: 11,
                      color: '#C0C8D4',
                      fontStyle: 'italic',
                      marginTop: 3,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {v.note}
                  </div>
                )}
              </div>

              {/* Status badge */}
              <StatusBadge status={v.status} />
            </div>
          ))}
        </div>

        {/* Add viewing button */}
        <div
          className="agent-tappable"
          style={{
            borderRadius: 16,
            border: '1.5px dashed rgba(0,0,0,0.1)',
            padding: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
          }}
        >
          <svg
            width={16}
            height={16}
            viewBox="0 0 24 24"
            fill="none"
            stroke="#C49B2A"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span
            style={{
              color: '#A0A8B0',
              fontSize: 13,
              fontWeight: 500,
              letterSpacing: '0.01em',
            }}
          >
            Schedule a viewing
          </span>
        </div>
      </div>
    </AgentShell>
  );
}

function StatCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div
      style={{
        flex: 1,
        background: '#FFFFFF',
        borderRadius: 16,
        padding: '14px 12px',
        textAlign: 'center',
        boxShadow:
          '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05), 0 0 0 0.5px rgba(0,0,0,0.04)',
        borderTop: highlight
          ? '2px solid rgba(16,185,129,0.4)'
          : '2px solid transparent',
      }}
    >
      <div
        style={{
          fontSize: 26,
          fontWeight: 700,
          letterSpacing: '-0.05em',
          color: '#0D0D12',
          lineHeight: 1,
          marginBottom: 4,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 500,
          color: '#A0A8B0',
        }}
      >
        {label}
      </div>
    </div>
  );
}
