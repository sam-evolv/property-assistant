'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useAgent } from '@/lib/agent/AgentContext';
import AgentShell from '../_components/AgentShell';
import {
  getTimelineNudges, logPipelineNote, getInitials,
  daysSince, daysFromNow, type PipelineUnit, type DevelopmentSummary,
} from '@/lib/agent/agentPipelineService';
import {
  AlertTriangle, ChevronRight, ChevronDown, ChevronUp,
  Building2, Check
} from 'lucide-react';

type FilterKey = 'all' | 'for_sale' | 'sale_agreed' | 'contracts_issued' | 'signed' | 'sold';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'for_sale', label: 'For Sale' },
  { key: 'sale_agreed', label: 'Sale Agreed' },
  { key: 'contracts_issued', label: 'Contracted' },
  { key: 'signed', label: 'Signed' },
  { key: 'sold', label: 'Sold' },
];

const STATUS_LABELS: Record<string, string> = {
  for_sale: 'For Sale',
  sale_agreed: 'Sale Agreed',
  contracts_issued: 'Contracts Out',
  signed: 'Contracts Signed',
  sold: 'Sold',
};

interface SchemeGroup {
  id: string;
  name: string;
  allUnits: PipelineUnit[];
  filteredUnits: PipelineUnit[];
  sold: number;
  reserved: number;
  available: number;
  total: number;
  percentSold: number;
  activeBuyers: number;
  urgentCount: number;
}

export default function PipelinePage() {
  const { agent, pipeline, alerts, developments, loading } = useAgent();
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [expandedScheme, setExpandedScheme] = useState<string | null>(null);
  const [showBulkChase, setShowBulkChase] = useState(false);
  const [chaseSuccess, setChaseSuccess] = useState(false);

  const schemes = useMemo((): SchemeGroup[] => {
    const devMap = new Map<string, PipelineUnit[]>();
    for (const unit of pipeline) {
      if (!devMap.has(unit.developmentId)) devMap.set(unit.developmentId, []);
      devMap.get(unit.developmentId)!.push(unit);
    }

    return Array.from(devMap.entries()).map(([devId, allUnits]) => {
      const sold = allUnits.filter(u => u.status === 'sold').length;
      const reserved = allUnits.filter(u => u.status === 'sale_agreed' || u.status === 'signed' || u.status === 'contracts_issued').length;
      const available = allUnits.filter(u => u.status === 'for_sale').length;
      const total = allUnits.length;
      const urgentCount = alerts.filter(a => allUnits.some(u => u.unitId === a.unitId)).length;

      let filteredUnits = allUnits;
      if (activeFilter !== 'all') {
        filteredUnits = allUnits.filter(u => u.status === activeFilter);
      }
      // Sort: non-sold by unit number, sold at bottom
      const nonSold = filteredUnits.filter(p => p.status !== 'sold').sort((a, b) => (parseInt(a.unitNumber) || 0) - (parseInt(b.unitNumber) || 0));
      const soldUnits = filteredUnits.filter(p => p.status === 'sold').sort((a, b) => (parseInt(a.unitNumber) || 0) - (parseInt(b.unitNumber) || 0));
      filteredUnits = [...nonSold, ...soldUnits];

      return {
        id: devId,
        name: allUnits[0]?.developmentName || 'Unknown',
        allUnits,
        filteredUnits,
        sold,
        reserved,
        available,
        total,
        percentSold: total > 0 ? Math.round((sold / total) * 100) : 0,
        activeBuyers: allUnits.filter(u => u.status !== 'for_sale' && u.status !== 'sold').length,
        urgentCount,
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [pipeline, alerts, activeFilter]);

  const overdueContracted = useMemo(() => {
    return pipeline.filter(p => {
      if (p.status !== 'contracts_issued') return false;
      if (!p.contractsIssuedDate) return false;
      const days = daysSince(p.contractsIssuedDate);
      return days !== null && days > 60;
    });
  }, [pipeline]);

  const handleBulkChase = async () => {
    for (const unit of overdueContracted) {
      const dateStr = new Date().toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' });
      await logPipelineNote(unit.unitId, unit.id, `Bulk chase initiated by agent: ${dateStr}`, 'bulk_chase');
    }
    setShowBulkChase(false);
    setChaseSuccess(true);
    setTimeout(() => setChaseSuccess(false), 3000);
  };

  if (loading) {
    return (
      <AgentShell agentName={agent?.displayName?.split(' ')[0]} urgentCount={0}>
        <div style={{ padding: '16px 24px 100px' }}>
          {[1,2,3].map(i => (
            <div key={i} style={{ height: 140, background: '#f3f4f6', borderRadius: 18, marginBottom: 12, animation: 'pulse 1.5s infinite' }} />
          ))}
        </div>
      </AgentShell>
    );
  }

  return (
    <AgentShell agentName={agent?.displayName?.split(' ')[0]} urgentCount={alerts.length}>
      <div style={{ padding: '8px 24px 100px' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0D0D12', letterSpacing: '-0.04em', marginBottom: 14 }}>Sales Pipeline</h1>

        {/* Bulk Chase button */}
        {activeFilter === 'contracts_issued' && overdueContracted.length > 0 && (
          <div
            onClick={() => setShowBulkChase(true)}
            className="agent-tappable"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '12px 16px', borderRadius: 14,
              background: '#FEF2F2', border: '1px solid rgba(239,68,68,0.15)',
              marginBottom: 12, cursor: 'pointer',
            }}
          >
            <AlertTriangle size={15} color="#DC2626" />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#DC2626' }}>
              Chase All Overdue ({overdueContracted.length})
            </span>
          </div>
        )}

        {/* Scheme cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {schemes.map(scheme => (
            <SchemeCard
              key={scheme.id}
              scheme={scheme}
              activeFilter={activeFilter}
              onFilterChange={setActiveFilter}
              expanded={expandedScheme === scheme.id}
              onToggle={() => setExpandedScheme(expandedScheme === scheme.id ? null : scheme.id)}
            />
          ))}
        </div>

        {/* Solicitor Directory link */}
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 20, cursor: 'pointer' }}
          className="agent-tappable"
        >
          <Building2 size={14} color="#D4AF37" />
          <Link href="/agent/solicitors" style={{
            fontSize: 13, fontWeight: 600, color: '#D4AF37', textDecoration: 'none',
            letterSpacing: '-0.01em',
          }}>
            View Solicitor Directory
          </Link>
          <ChevronRight size={12} color="#D4AF37" />
        </div>
      </div>

      {/* Bulk Chase Confirmation Sheet */}
      {showBulkChase && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 60, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={() => setShowBulkChase(false)}>
          <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 500, padding: '20px 20px 32px' }} onClick={e => e.stopPropagation()}>
            <div style={{ width: 40, height: 4, background: '#E0E0DC', borderRadius: 2, margin: '0 auto 16px' }} />
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0D0D12', marginBottom: 4 }}>Chase All Overdue</h3>
            <p style={{ fontSize: 13, color: '#A0A8B0', marginBottom: 16 }}>Log a follow-up note for {overdueContracted.length} overdue units:</p>
            <div style={{ maxHeight: 200, overflowY: 'auto', marginBottom: 20 }}>
              {overdueContracted.map(u => (
                <div key={u.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(0,0,0,0.04)', fontSize: 13 }}>
                  <span style={{ fontWeight: 500, color: '#0D0D12' }}>Unit {u.unitNumber}</span>
                  <span style={{ color: '#A0A8B0', fontSize: 12 }}>{u.purchaserName}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setShowBulkChase(false)} className="agent-tappable" style={{ flex: 1, padding: '13px 0', borderRadius: 14, border: '1px solid rgba(0,0,0,0.08)', background: '#fff', fontSize: 13, fontWeight: 600, color: '#6B7280', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleBulkChase} className="agent-tappable" style={{ flex: 1, padding: '13px 0', borderRadius: 14, border: 'none', background: '#0D0D12', fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer' }}>Confirm Chase</button>
            </div>
          </div>
        </div>
      )}

      {/* Success toast */}
      {chaseSuccess && (
        <div style={{ position: 'fixed', top: 80, left: '50%', transform: 'translateX(-50%)', background: '#059669', color: '#fff', fontSize: 13, fontWeight: 600, padding: '10px 18px', borderRadius: 14, zIndex: 70, display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
          <Check size={15} />
          {overdueContracted.length} units logged for follow-up
        </div>
      )}
    </AgentShell>
  );
}

/* ─── Scheme card with expandable buyer list ─── */

function SchemeCard({ scheme, activeFilter, onFilterChange, expanded, onToggle }: {
  scheme: SchemeGroup;
  activeFilter: FilterKey;
  onFilterChange: (f: FilterKey) => void;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div style={{
      background: '#FFFFFF',
      borderRadius: 18,
      overflow: 'hidden',
      boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05), 0 0 0 0.5px rgba(0,0,0,0.04)',
    }}>
      {/* Card header */}
      <div style={{ padding: '16px 18px' }}>
        {/* Name + % */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.025em', color: '#0D0D12' }}>
              {scheme.name}
            </span>
            {scheme.urgentCount > 0 && (
              <span style={{
                background: '#FEF2F2', border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: 20, padding: '2px 7px', fontSize: 9.5, fontWeight: 700, color: '#DC2626', lineHeight: 1.2,
              }}>
                {scheme.urgentCount}
              </span>
            )}
          </div>
          <span style={{
            background: 'linear-gradient(135deg, #B8960C, #E8C84A)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em',
          }}>
            {scheme.percentSold}%
          </span>
        </div>

        {/* Subtitle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 13, color: '#A0A8B0' }}>Longview Estates &middot; Co. Cork</span>
          <span style={{ fontSize: 13, color: '#A0A8B0' }}>{scheme.sold} of {scheme.total}</span>
        </div>

        {/* Progress bar */}
        <div style={{ height: 3, background: 'rgba(0,0,0,0.05)', borderRadius: 2, overflow: 'hidden', marginBottom: 10 }}>
          <div style={{ height: '100%', width: `${scheme.percentSold}%`, background: 'linear-gradient(90deg, #B8960C, #E8C84A)', borderRadius: 2, transition: 'width 0.3s ease' }} />
        </div>

        {/* Status dots */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <StatusDot color="#10B981" label={`${scheme.sold} Sold`} />
          <StatusDot color="#3B82F6" label={`${scheme.reserved} Reserved`} />
          <StatusDot color="#A0A8B0" label={`${scheme.available} Available`} />
        </div>
      </div>

      {/* Footer: active buyers + View buyers toggle */}
      <div
        className="agent-tappable"
        onClick={onToggle}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 18px', borderTop: '1px solid rgba(0,0,0,0.04)', cursor: 'pointer',
        }}
      >
        <span style={{ fontSize: 13, color: '#A0A8B0' }}>{scheme.activeBuyers} active buyers</span>
        <span style={{
          background: 'linear-gradient(135deg, #B8960C, #E8C84A)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          fontSize: 13, fontWeight: 600, letterSpacing: '-0.01em',
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          {expanded ? 'Hide buyers' : 'View buyers'}
          {expanded ? <ChevronUp size={14} color="#C4A020" /> : <ChevronDown size={14} color="#C4A020" />}
        </span>
      </div>

      {/* Expanded buyer list */}
      {expanded && (
        <div style={{ borderTop: '1px solid rgba(0,0,0,0.04)' }}>
          {/* Filter tabs within scheme */}
          <div style={{ display: 'flex', gap: 0, overflowX: 'auto', padding: '8px 12px', scrollbarWidth: 'none' }}>
            {FILTERS.map(f => (
              <button
                key={f.key}
                onClick={() => onFilterChange(f.key)}
                style={{
                  padding: '6px 12px', borderRadius: 20, border: 'none',
                  fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', cursor: 'pointer',
                  background: activeFilter === f.key ? '#0D0D12' : 'transparent',
                  color: activeFilter === f.key ? '#fff' : '#A0A8B0',
                  transition: 'all 0.15s ease',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Buyer cards */}
          <div style={{ padding: '0 12px 12px' }}>
            {scheme.filteredUnits.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#A0A8B0', fontSize: 13, padding: '20px 0' }}>
                No units match this filter
              </div>
            ) : (
              scheme.filteredUnits.map((unit, i) => (
                <BuyerRow key={unit.id} unit={unit} isLast={i === scheme.filteredUnits.length - 1} />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Buyer row inside a scheme card ─── */

function BuyerRow({ unit, isLast }: { unit: PipelineUnit; isLast: boolean }) {
  const nudges = getTimelineNudges(unit);
  const hasNudge = nudges.length > 0;
  const isSold = unit.status === 'sold';
  const initials = getInitials(unit.purchaserName);

  return (
    <Link href={`/agent/pipeline/${unit.unitId}`} style={{ textDecoration: 'none', display: 'block' }}>
      <div
        className="agent-tappable"
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 6px',
          borderBottom: isLast ? 'none' : '1px solid rgba(0,0,0,0.04)',
          opacity: isSold ? 0.5 : 1,
        }}
      >
        {/* Avatar */}
        {unit.purchaserName ? (
          <div style={{
            width: 34, height: 34, borderRadius: 10, flexShrink: 0,
            background: hasNudge
              ? 'linear-gradient(135deg, #FEF2F2, #FEE2E2)'
              : 'linear-gradient(135deg, #FFFBEB, #FEF3C7)',
            border: hasNudge
              ? '1px solid rgba(239,68,68,0.25)'
              : '1px solid rgba(212,175,55,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ color: hasNudge ? '#B91C1C' : '#92400E', fontSize: 11, fontWeight: 700 }}>{initials}</span>
          </div>
        ) : (
          <div style={{
            width: 34, height: 34, borderRadius: 10, flexShrink: 0,
            background: '#F3F4F6', border: '1px solid rgba(0,0,0,0.04)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ color: '#A0A8B0', fontSize: 11, fontWeight: 600 }}>--</span>
          </div>
        )}

        {/* Name + unit */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: '#0D0D12', letterSpacing: '-0.01em', display: 'block' }}>
            {unit.purchaserName || 'Available'}
          </span>
          <span style={{ fontSize: 11.5, color: '#A0A8B0', marginTop: 1, display: 'block' }}>
            Unit {unit.unitNumber}
          </span>
        </div>

        {/* Status badge */}
        <StatusBadgeMini status={unit.status} />
      </div>
    </Link>
  );
}

/* ─── Helpers ─── */

function StatusDot({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div style={{ width: 5, height: 5, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <span style={{ fontSize: 13, color: '#6B7280' }}>{label}</span>
    </div>
  );
}

function StatusBadgeMini({ status }: { status: string }) {
  const configs: Record<string, { bg: string; color: string; label: string }> = {
    for_sale: { bg: '#F3F4F6', color: '#6B7280', label: 'AVAILABLE' },
    sale_agreed: { bg: '#EFF6FF', color: '#1D4ED8', label: 'RESERVED' },
    contracts_issued: { bg: '#FEF2F2', color: '#B91C1C', label: 'CONTRACTS' },
    signed: { bg: '#F5F3FF', color: '#5B21B6', label: 'EXCHANGED' },
    sold: { bg: '#ECFDF5', color: '#065F46', label: 'CONFIRMED' },
  };
  const c = configs[status] || configs.for_sale;
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, letterSpacing: '0.05em',
      color: c.color, background: c.bg,
      padding: '2px 7px', borderRadius: 10, flexShrink: 0,
    }}>
      {c.label}
    </span>
  );
}
