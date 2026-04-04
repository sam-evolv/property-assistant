'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import AgentShell from '../_components/AgentShell';
import SchemeCard from '../_components/SchemeCard';
import StatModal from '../_components/StatModal';
import type { StatModalType, Scheme as UIScheme, Buyer as UIBuyer } from '../_components/types';
import {
  SCHEMES,
  BUYERS,
  AGENT_STATS,
  URGENT_TOP5,
} from '@/lib/agent/demo-data';

/* ─── Adapt demo data → component types ─── */

function adaptBuyers(
  buyers: typeof BUYERS,
  schemeName?: string
): UIBuyer[] {
  return buyers.map((b) => ({
    id: String(b.id),
    name: b.name,
    initials: b.initials,
    unit: b.unit,
    price: b.price,
    status:
      b.status === 'sale_agreed'
        ? 'reserved'
        : b.status === 'contracts_signed'
          ? 'exchanged'
          : b.status === 'sold'
            ? 'confirmed'
            : (b.status as UIBuyer['status']),
    depositDate: b.depositDate,
    contractsDate: b.contractsIssuedDate,
    signedDate: b.contractsSignedDate,
    closingDate: b.handoverDate,
    daysOverdue: b.daysSinceIssued ?? 0,
    isUrgent: b.urgent,
    schemeName: schemeName ?? b.scheme,
  }));
}

function adaptSchemes(): UIScheme[] {
  return SCHEMES.map((s) => {
    const schemeBuyers = BUYERS.filter((b) => b.scheme === s.name);
    const adapted = adaptBuyers(schemeBuyers, s.name);
    const pct = s.total > 0 ? Math.round((s.sold / s.total) * 100) : 0;
    const urgentCount = schemeBuyers.filter((b) => b.urgent).length;

    return {
      id: s.id,
      name: s.name,
      developer: 'Longview Estates',
      location: 'Co. Cork',
      totalUnits: s.total,
      sold: s.sold,
      reserved: s.reserved,
      available: s.available,
      percentSold: pct,
      activeBuyers: schemeBuyers.filter(
        (b) => b.status !== 'sold'
      ).length,
      urgentCount,
      buyers: adapted,
    };
  });
}

export default function HomePage() {
  const [modalType, setModalType] = useState<StatModalType>(null);

  const schemes = useMemo(() => adaptSchemes(), []);
  const urgentBuyers = useMemo(
    () => adaptBuyers(URGENT_TOP5, undefined),
    []
  );
  const allUrgent = useMemo(
    () =>
      adaptBuyers(
        BUYERS.filter((b) => b.urgent),
        undefined
      ).sort((a, b) => b.daysOverdue - a.daysOverdue),
    []
  );

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good morning,' : hour < 18 ? 'Good afternoon,' : 'Good evening,';

  return (
    <AgentShell agentName="Sam" urgentCount={AGENT_STATS.urgent}>
      <div style={{ padding: '2px 24px 100px' }}>
        {/* Greeting */}
        <p
          style={{
            color: '#A0A8B0',
            fontSize: 13,
            fontWeight: 400,
            marginBottom: 4,
            letterSpacing: '0.01em',
          }}
        >
          {greeting}
        </p>
        <h1
          style={{
            color: '#0D0D12',
            fontSize: 32,
            fontWeight: 700,
            letterSpacing: '-0.055em',
            lineHeight: 1.05,
            marginBottom: 4,
          }}
        >
          Sam.
        </h1>
        <p
          style={{
            color: '#B0B8C4',
            fontSize: 13,
            letterSpacing: '0.01em',
            marginBottom: 28,
          }}
        >
          Sherry FitzGerald &middot; {AGENT_STATS.schemesActive} schemes active
        </p>

        {/* Stat rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          <StatRow
            icon="trending"
            label="Units sold"
            value={AGENT_STATS.totalSold}
            color="#10B981"
            onClick={() => setModalType('sold')}
          />
          <StatRow
            icon="users"
            label="Active pipeline"
            value={AGENT_STATS.activePipeline}
            color="#3B82F6"
            onClick={() => setModalType('active')}
          />
          <StatRow
            icon="clock"
            label="Need attention"
            value={AGENT_STATS.urgent}
            color="#EF4444"
            urgent
            onClick={() => setModalType('urgent')}
          />
        </div>


        {/* Requires action section */}
        <SectionLabel>Requires action</SectionLabel>
        <div
          style={{
            background: '#FFFFFF',
            borderRadius: 18,
            overflow: 'hidden',
            boxShadow:
              '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05), 0 0 0 0.5px rgba(0,0,0,0.04)',
            marginBottom: 28,
          }}
        >
          {urgentBuyers.map((b, i) => (
            <div
              key={b.id}
              className="agent-tappable"
              onClick={() => setModalType('urgent')}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '14px 18px',
                position: 'relative',
                borderBottom:
                  i < urgentBuyers.length - 1
                    ? '1px solid rgba(0,0,0,0.04)'
                    : 'none',
              }}
            >
              {/* Left bar */}
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: 2,
                  background: 'rgba(239, 68, 68, 0.3)',
                  borderRadius:
                    i === 0
                      ? '18px 0 0 0'
                      : i === urgentBuyers.length - 1
                        ? '0 0 0 18px'
                        : '0',
                }}
              />
              <div style={{ flex: 1, minWidth: 0, paddingLeft: 6 }}>
                <div
                  style={{
                    fontSize: 13.5,
                    fontWeight: 500,
                    letterSpacing: '-0.01em',
                    color: '#0D0D12',
                  }}
                >
                  {b.name}
                </div>
                <div
                  style={{
                    fontSize: 11.5,
                    color: '#A0A8B0',
                    marginTop: 2,
                  }}
                >
                  {b.schemeName} &middot; {b.unit}
                </div>
              </div>
              <span
                style={{
                  background: '#FEF2F2',
                  border: '1px solid rgba(239,68,68,0.2)',
                  borderRadius: 20,
                  padding: '3px 8px',
                  fontSize: 10,
                  fontWeight: 700,
                  color: '#DC2626',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                {b.daysOverdue}d
              </span>
            </div>
          ))}
        </div>

        {/* Schemes */}
        <SectionLabel>Your schemes</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {schemes.map((s) => (
            <SchemeCard key={s.id} scheme={s} />
          ))}
        </div>
      </div>

      {/* Stat Modal */}
      {modalType && (
        <StatModal
          type={modalType}
          onClose={() => setModalType(null)}
          schemes={schemes}
          totalSold={AGENT_STATS.totalSold}
          totalActive={AGENT_STATS.activePipeline}
          urgentBuyers={allUrgent}
        />
      )}
    </AgentShell>
  );
}

/* ─── Helpers ─── */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
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
      {children}
    </div>
  );
}

function StatRow({
  icon,
  label,
  value,
  color,
  urgent,
  onClick,
}: {
  icon: 'trending' | 'users' | 'clock';
  label: string;
  value: number;
  color: string;
  urgent?: boolean;
  onClick: () => void;
}) {
  const iconBg = urgent
    ? 'rgba(239,68,68,0.08)'
    : icon === 'trending'
      ? 'rgba(16,185,129,0.08)'
      : 'rgba(59,130,246,0.08)';
  const iconBorder = urgent
    ? 'rgba(239,68,68,0.15)'
    : icon === 'trending'
      ? 'rgba(16,185,129,0.15)'
      : 'rgba(59,130,246,0.15)';
  const chevronBg = iconBg;
  const chevronBorder = iconBorder;

  return (
    <div
      className="agent-tappable"
      onClick={onClick}
      style={{
        padding: '16px 18px',
        borderRadius: 16,
        background: '#FFFFFF',
        boxShadow:
          '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05), 0 0 0 0.5px rgba(0,0,0,0.04)',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Urgent left bar */}
      {urgent && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 3,
            background: 'linear-gradient(180deg, #EF4444, #DC2626)',
            borderRadius: '3px 0 0 3px',
          }}
        />
      )}

      {/* Icon box */}
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          background: iconBg,
          border: `1px solid ${iconBorder}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          marginLeft: urgent ? 8 : 0,
        }}
      >
        <StatIcon type={icon} color={color} />
      </div>

      {/* Label */}
      <span
        style={{
          flex: 1,
          color: '#6B7280',
          fontSize: 13,
          fontWeight: 500,
        }}
      >
        {label}
      </span>

      {/* Number */}
      <span
        style={{
          color: urgent ? '#EF4444' : '#0D0D12',
          fontSize: 24,
          fontWeight: 700,
          letterSpacing: '-0.05em',
          lineHeight: 1,
        }}
      >
        {value}
      </span>

      {/* Chevron */}
      <div
        style={{
          width: 22,
          height: 22,
          borderRadius: 7,
          background: chevronBg,
          border: `1px solid ${chevronBorder}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <svg
          width={10}
          height={10}
          viewBox="0 0 24 24"
          fill="none"
          stroke={urgent ? 'rgba(239,68,68,0.5)' : `${color}80`}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="9,18 15,12 9,6" />
        </svg>
      </div>
    </div>
  );
}

function StatIcon({
  type,
  color,
}: {
  type: 'trending' | 'users' | 'clock';
  color: string;
}) {
  switch (type) {
    case 'trending':
      return (
        <svg
          width={16}
          height={16}
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="23,6 13.5,15.5 8.5,10.5 1,18" />
          <polyline points="17,6 23,6 23,12" />
        </svg>
      );
    case 'users':
      return (
        <svg
          width={16}
          height={16}
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 00-3-3.87" />
          <path d="M16 3.13a4 4 0 010 7.75" />
        </svg>
      );
    case 'clock':
      return (
        <svg
          width={16}
          height={16}
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <polyline points="12,6 12,12 16,14" />
        </svg>
      );
  }
}
