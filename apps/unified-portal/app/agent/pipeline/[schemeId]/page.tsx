'use client';

import { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import AgentShell from '../../_components/AgentShell';
import BuyerCard from '../../_components/BuyerCard';
import BuyerProfileSheet from '../../_components/BuyerProfileSheet';
import type { Buyer as UIBuyer } from '../../_components/types';
import { SCHEMES, BUYERS, AGENT_STATS } from '@/lib/agent/demo-data';
import { getBuyerProfile } from '@/lib/agent/buyer-profiles';
import type { BuyerProfile } from '@/lib/agent/buyer-profiles';

type StageFilter = 'all' | 'reserved' | 'contracts' | 'signed' | 'closed';

const STAGE_FILTERS: { id: StageFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'reserved', label: 'Reserved' },
  { id: 'contracts', label: 'Contracts' },
  { id: 'signed', label: 'Signed' },
  { id: 'closed', label: 'Closed' },
];

function adaptBuyer(b: (typeof BUYERS)[number]): UIBuyer & { rawId: number } {
  return {
    id: String(b.id),
    rawId: b.id,
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
    schemeName: b.scheme,
  };
}

function matchesStage(buyer: UIBuyer, stage: StageFilter): boolean {
  switch (stage) {
    case 'all':
      return true;
    case 'reserved':
      return buyer.status === 'reserved' || buyer.status === 'pending';
    case 'contracts':
      return buyer.status === 'contracts_out';
    case 'signed':
      return buyer.status === 'exchanged';
    case 'closed':
      return buyer.status === 'confirmed';
  }
}

export default function SchemeDetailPage() {
  const params = useParams();
  const schemeId = params.schemeId as string;
  const [activeStage, setActiveStage] = useState<StageFilter>('all');
  const [selectedProfile, setSelectedProfile] = useState<BuyerProfile | null>(null);

  const scheme = SCHEMES.find((s) => s.id === schemeId);
  const schemeBuyers = useMemo(
    () =>
      BUYERS.filter(
        (b) => b.scheme === scheme?.name
      ).map(adaptBuyer),
    [scheme?.name]
  );

  const filteredBuyers = useMemo(
    () =>
      schemeBuyers
        .filter((b) => matchesStage(b, activeStage))
        .sort((a, b) => {
          if (a.isUrgent && !b.isUrgent) return -1;
          if (!a.isUrgent && b.isUrgent) return 1;
          return b.daysOverdue - a.daysOverdue;
        }),
    [schemeBuyers, activeStage]
  );

  const stageCounts = useMemo(() => {
    const counts: Record<StageFilter, number> = {
      all: schemeBuyers.length,
      reserved: 0,
      contracts: 0,
      signed: 0,
      closed: 0,
    };
    schemeBuyers.forEach((b) => {
      if (matchesStage(b, 'reserved')) counts.reserved++;
      if (matchesStage(b, 'contracts')) counts.contracts++;
      if (matchesStage(b, 'signed')) counts.signed++;
      if (matchesStage(b, 'closed')) counts.closed++;
    });
    return counts;
  }, [schemeBuyers]);

  const handleBuyerTap = (rawId: number) => {
    const profile = getBuyerProfile(rawId);
    if (profile) setSelectedProfile(profile);
  };

  if (!scheme) {
    return (
      <AgentShell agentName="Sam" urgentCount={AGENT_STATS.urgent}>
        <div style={{ padding: '40px 24px', textAlign: 'center', color: '#A0A8B0' }}>
          Scheme not found
        </div>
      </AgentShell>
    );
  }

  return (
    <AgentShell agentName="Sam" urgentCount={AGENT_STATS.urgent}>
      <div style={{ padding: '8px 24px 100px' }}>
        {/* Back nav */}
        <Link
          href="/agent/pipeline"
          className="agent-tappable"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            textDecoration: 'none',
            marginBottom: 16,
          }}
        >
          <svg
            width={14}
            height={14}
            viewBox="0 0 24 24"
            fill="none"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <defs>
              <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#B8960C" />
                <stop offset="100%" stopColor="#E8C84A" />
              </linearGradient>
            </defs>
            <polyline points="15,18 9,12 15,6" stroke="url(#goldGrad)" />
          </svg>
          <span
            style={{
              background: 'linear-gradient(135deg, #B8960C, #E8C84A)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            All Schemes
          </span>
        </Link>

        {/* Scheme title */}
        <h1
          style={{
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: '-0.05em',
            color: '#0D0D12',
            marginBottom: 16,
          }}
        >
          {scheme.name}
        </h1>

        {/* Stage filter pills */}
        <div
          style={{
            display: 'flex',
            gap: 8,
            overflowX: 'auto',
            scrollbarWidth: 'none',
            paddingBottom: 2,
            marginBottom: 20,
          }}
          className="[&::-webkit-scrollbar]:hidden"
        >
          {STAGE_FILTERS.map((stage) => {
            const active = activeStage === stage.id;
            const count = stageCounts[stage.id];
            return (
              <button
                key={stage.id}
                onClick={() => setActiveStage(stage.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 16px',
                  borderRadius: 22,
                  border: `1px solid ${active ? '#0D0D12' : 'rgba(0,0,0,0.10)'}`,
                  background: active ? '#0D0D12' : 'rgba(255,255,255,0.8)',
                  color: active ? '#fff' : '#6B7280',
                  fontSize: 12.5,
                  fontWeight: active ? 600 : 500,
                  letterSpacing: '-0.01em',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  fontFamily: 'inherit',
                }}
              >
                <span
                  style={{
                    background: active
                      ? 'rgba(255,255,255,0.2)'
                      : 'rgba(0,0,0,0.08)',
                    color: active ? 'rgba(255,255,255,0.9)' : '#6B7280',
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '1px 6px',
                    borderRadius: 10,
                  }}
                >
                  {count}
                </span>
                {stage.label}
              </button>
            );
          })}
        </div>

        {/* Buyer cards */}
        {filteredBuyers.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filteredBuyers.map((b) => (
              <div key={b.id} onClick={() => handleBuyerTap(b.rawId)}>
                <BuyerCard buyer={b} />
              </div>
            ))}
          </div>
        ) : (
          <div
            style={{
              textAlign: 'center',
              padding: '40px 20px',
              color: '#A0A8B0',
            }}
          >
            <svg
              width={32}
              height={32}
              viewBox="0 0 24 24"
              fill="none"
              stroke="#D0D8E0"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ margin: '0 auto 12px' }}
            >
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
              <circle cx="9" cy="7" r="4" />
            </svg>
            <p style={{ fontSize: 13, fontWeight: 500 }}>
              No buyers at this stage
            </p>
          </div>
        )}
      </div>

      {/* Buyer Profile Sheet */}
      {selectedProfile && (
        <BuyerProfileSheet
          profile={selectedProfile}
          onClose={() => setSelectedProfile(null)}
        />
      )}
    </AgentShell>
  );
}
