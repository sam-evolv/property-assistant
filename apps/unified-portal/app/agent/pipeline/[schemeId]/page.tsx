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
import { usePipelineData, type PipelineBuyer } from '@/lib/agent/use-pipeline-data';
import type { BuyerProfile } from '@/lib/agent/buyer-profiles';

type StageFilter = 'all' | 'reserved' | 'contracts' | 'signed' | 'closed';

const STAGE_FILTERS: { id: StageFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'reserved', label: 'Reserved' },
  { id: 'contracts', label: 'Contracts' },
  { id: 'signed', label: 'Signed' },
  { id: 'closed', label: 'Closed' },
];

function adaptToUIBuyer(b: PipelineBuyer): UIBuyer {
  const status =
    b.status === 'sale_agreed' ? 'reserved' :
    b.status === 'contracts_signed' ? 'exchanged' :
    b.status === 'sold' ? 'confirmed' :
    (b.status as UIBuyer['status']);

  return {
    id: b.id,
    name: b.name,
    initials: b.initials,
    unit: b.unit,
    price: b.price,
    status,
    depositDate: b.depositDate,
    contractsDate: b.contractsIssuedDate,
    signedDate: b.contractsSignedDate,
    closingDate: b.handoverDate,
    daysOverdue: b.daysOverdue,
    isUrgent: b.isUrgent,
    schemeName: b.scheme,
  };
}

function pipelineBuyerToProfile(b: PipelineBuyer): BuyerProfile {
  return {
    id: parseInt(b.id) || 0,
    name: b.name,
    initials: b.initials,
    unit: b.unit,
    scheme: b.scheme,
    type: b.type || 'Unknown',
    beds: b.beds,
    price: b.price,
    status: b.status,
    urgent: b.isUrgent,
    daysSinceIssued: b.daysOverdue || null,

    saleAgreedDate: b.saleAgreedDate,
    depositDate: b.depositDate,
    contractsIssuedDate: b.contractsIssuedDate,
    contractsSignedDate: b.contractsSignedDate,
    handoverDate: b.handoverDate,
    snagDate: b.snagDate,
    estimatedCloseDate: b.estimatedCloseDate,
    kitchenSelected: b.kitchenSelected,

    // Property specs — use data from API or defaults
    sqMetres: getSpecForType(b.type).sqMetres,
    sqFeet: getSpecForType(b.type).sqFeet,
    ber: getSpecForType(b.type).ber,
    floors: getSpecForType(b.type).floors,
    parking: getSpecForType(b.type).parking,
    heating: getSpecForType(b.type).heating,
    orientation: getSpecForType(b.type).orientation,

    // Contact from real data
    phone: b.phone || '—',
    email: b.email || '—',
    address: b.address || '—',

    // Solicitor — these would come from a separate table in production
    solicitorFirm: getSolicitorForScheme(b.scheme).firm,
    solicitorContact: getSolicitorForScheme(b.scheme).contact,
    solicitorPhone: getSolicitorForScheme(b.scheme).phone,
    solicitorEmail: getSolicitorForScheme(b.scheme).email,

    // Mortgage
    lender: null,
    approvalAmount: null,
    mortgageExpiry: b.mortgageExpiry,

    // Intelligence context from communication events
    intelligenceNotes: b.recentComms.map((c) => ({
      date: c.date,
      action: c.type === 'email' ? 'Email sent' : c.type === 'call' ? 'Phone call' : c.summary || 'Activity',
      detail: c.summary || `${c.direction} ${c.type}${c.actor ? ` by ${c.actor}` : ''}`,
    })),
  };
}

function matchesStage(status: string, stage: StageFilter): boolean {
  switch (stage) {
    case 'all': return true;
    case 'reserved': return status === 'reserved' || status === 'pending' || status === 'sale_agreed';
    case 'contracts': return status === 'contracts_out';
    case 'signed': return status === 'exchanged' || status === 'contracts_signed';
    case 'closed': return status === 'confirmed' || status === 'sold';
  }
}

// Fallback property specs by unit type
const SPECS: Record<string, any> = {
  '2-bed T': { sqMetres: 82, sqFeet: 883, ber: 'A2', floors: 2, parking: '1 allocated space', heating: 'Air-to-water heat pump', orientation: 'South-facing' },
  '3-bed T': { sqMetres: 108, sqFeet: 1163, ber: 'A2', floors: 2, parking: '2 allocated spaces', heating: 'Air-to-water heat pump', orientation: 'South-west facing' },
  '3-bed SD': { sqMetres: 115, sqFeet: 1238, ber: 'A2', floors: 2, parking: '2 allocated spaces', heating: 'Air-to-water heat pump', orientation: 'South-facing' },
  '3-bed': { sqMetres: 110, sqFeet: 1184, ber: 'A2', floors: 2, parking: '2 allocated spaces', heating: 'Air-to-water heat pump', orientation: 'South-west facing' },
  '4-bed T': { sqMetres: 135, sqFeet: 1453, ber: 'A2', floors: 2, parking: '2 allocated spaces', heating: 'Air-to-water heat pump', orientation: 'West-facing' },
  '4-bed D': { sqMetres: 148, sqFeet: 1593, ber: 'A1', floors: 2, parking: '2 allocated spaces + driveway', heating: 'Air-to-water heat pump', orientation: 'South-facing' },
};
function getSpecForType(type: string) {
  return SPECS[type] || SPECS['3-bed'];
}

const SOLICITORS: Record<string, any> = {
  'Riverside Gardens': { firm: "O'Brien & Partners", contact: "Fiona O'Brien", phone: '021 427 8800', email: 'fiona@obrienpartners.ie' },
  'Meadow View': { firm: 'McCarthy Solicitors', contact: 'David McCarthy', phone: '021 455 1200', email: 'david@mccarthysolicitors.ie' },
  'Oak Hill Estate': { firm: 'Horgan & Associates', contact: 'Claire Horgan', phone: '021 432 6100', email: 'claire@horgan.ie' },
};
function getSolicitorForScheme(scheme: string) {
  return SOLICITORS[scheme] || { firm: '—', contact: '—', phone: '—', email: '—' };
}

export default function SchemeDetailPage() {
  const params = useParams();
  const schemeId = params.schemeId as string;
  const [activeStage, setActiveStage] = useState<StageFilter>('all');
  const [selectedProfile, setSelectedProfile] = useState<BuyerProfile | null>(null);

  // Try to get tenant_id from cookie/session — for now use pipeline data hook
  const pipeline = usePipelineData();

  // Find scheme — try live data first, fall back to demo
  const scheme = pipeline.schemes.find((s) => s.id === schemeId);
  const schemeBuyers = useMemo(() => {
    const buyers = pipeline.buyers.filter((b) => b.schemeId === schemeId);
    return buyers;
  }, [pipeline.buyers, schemeId]);

  const uiBuyers = useMemo(() => schemeBuyers.map(adaptToUIBuyer), [schemeBuyers]);

  const filteredBuyers = useMemo(
    () =>
      uiBuyers
        .filter((b) => matchesStage(b.status, activeStage))
        .sort((a, b) => {
          if (a.isUrgent && !b.isUrgent) return -1;
          if (!a.isUrgent && b.isUrgent) return 1;
          return b.daysOverdue - a.daysOverdue;
        }),
    [uiBuyers, activeStage]
  );

  const stageCounts = useMemo(() => {
    const counts: Record<StageFilter, number> = { all: uiBuyers.length, reserved: 0, contracts: 0, signed: 0, closed: 0 };
    uiBuyers.forEach((b) => {
      if (matchesStage(b.status, 'reserved')) counts.reserved++;
      if (matchesStage(b.status, 'contracts')) counts.contracts++;
      if (matchesStage(b.status, 'signed')) counts.signed++;
      if (matchesStage(b.status, 'closed')) counts.closed++;
    });
    return counts;
  }, [uiBuyers]);

  const handleBuyerTap = (buyerId: string) => {
    // Try real pipeline data first
    const pipelineBuyer = schemeBuyers.find((b) => b.id === buyerId);
    if (pipelineBuyer) {
      if (pipeline.isLive) {
        // Use real data converted to profile
        setSelectedProfile(pipelineBuyerToProfile(pipelineBuyer));
      } else {
        // Demo mode — try enriched profile, fall back to pipeline conversion
        const enriched = getBuyerProfile(parseInt(buyerId));
        setSelectedProfile(enriched || pipelineBuyerToProfile(pipelineBuyer));
      }
    }
  };

  if (pipeline.loading) {
    return (
      <AgentShell agentName="Sam" urgentCount={AGENT_STATS.urgent}>
        <div style={{ padding: '40px 24px', textAlign: 'center', color: '#A0A8B0' }}>
          <p style={{ fontSize: 13, fontWeight: 500 }}>Loading pipeline...</p>
        </div>
      </AgentShell>
    );
  }

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
        {/* Live data indicator */}
        {pipeline.isLive && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
            <div style={{ width: 6, height: 6, borderRadius: 3, background: '#10B981' }} />
            <span style={{ fontSize: 10, color: '#10B981', fontWeight: 600, letterSpacing: '0.02em' }}>LIVE DATA</span>
          </div>
        )}

        {/* Back nav */}
        <Link
          href="/agent/pipeline"
          className="agent-tappable"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none', marginBottom: 16 }}
        >
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <defs>
              <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#B8960C" />
                <stop offset="100%" stopColor="#E8C84A" />
              </linearGradient>
            </defs>
            <polyline points="15,18 9,12 15,6" stroke="url(#goldGrad)" />
          </svg>
          <span style={{ background: 'linear-gradient(135deg, #B8960C, #E8C84A)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', fontSize: 13, fontWeight: 600 }}>
            All Schemes
          </span>
        </Link>

        <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.05em', color: '#0D0D12', marginBottom: 16 }}>
          {scheme.name}
        </h1>

        {/* Stage filter pills */}
        <div
          style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 2, marginBottom: 20 }}
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
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '8px 16px', borderRadius: 22,
                  border: `1px solid ${active ? '#0D0D12' : 'rgba(0,0,0,0.10)'}`,
                  background: active ? '#0D0D12' : 'rgba(255,255,255,0.8)',
                  color: active ? '#fff' : '#6B7280',
                  fontSize: 12.5, fontWeight: active ? 600 : 500,
                  letterSpacing: '-0.01em', whiteSpace: 'nowrap', flexShrink: 0,
                  cursor: 'pointer', transition: 'all 0.15s ease', fontFamily: 'inherit',
                }}
              >
                <span style={{
                  background: active ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.08)',
                  color: active ? 'rgba(255,255,255,0.9)' : '#6B7280',
                  fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 10,
                }}>
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
              <div key={b.id} onClick={() => handleBuyerTap(b.id)}>
                <BuyerCard buyer={b} />
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#A0A8B0' }}>
            <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="#D0D8E0" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 12px' }}>
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
            </svg>
            <p style={{ fontSize: 13, fontWeight: 500 }}>No buyers at this stage</p>
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
