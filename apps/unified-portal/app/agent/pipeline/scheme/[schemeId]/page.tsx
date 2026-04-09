'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAgent } from '@/lib/agent/AgentContext';
import AgentShell from '../../../_components/AgentShell';
import {
  getTimelineNudges, getInitials, type PipelineUnit,
} from '@/lib/agent/agentPipelineService';
import { ArrowLeft, ChevronRight, Search } from 'lucide-react';

type FilterKey = 'all' | 'for_sale' | 'sale_agreed' | 'contracts_issued' | 'signed' | 'sold';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'for_sale', label: 'For Sale' },
  { key: 'sale_agreed', label: 'Sale Agreed' },
  { key: 'contracts_issued', label: 'Contracted' },
  { key: 'signed', label: 'Signed' },
  { key: 'sold', label: 'Sold' },
];

export default function SchemeDetailPage() {
  const params = useParams();
  const schemeId = params.schemeId as string;
  const { agent, pipeline, alerts, loading } = useAgent();
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const schemeUnits = useMemo(() => {
    return pipeline.filter(u => u.developmentId === schemeId);
  }, [pipeline, schemeId]);

  const schemeName = schemeUnits[0]?.developmentName || 'Scheme';

  const stats = useMemo(() => {
    const sold = schemeUnits.filter(u => u.status === 'sold').length;
    const reserved = schemeUnits.filter(u => u.status === 'sale_agreed' || u.status === 'signed' || u.status === 'contracts_issued').length;
    const available = schemeUnits.filter(u => u.status === 'for_sale').length;
    const total = schemeUnits.length;
    return { sold, reserved, available, total, percentSold: total > 0 ? Math.round((sold / total) * 100) : 0 };
  }, [schemeUnits]);

  const filteredUnits = useMemo(() => {
    let units = schemeUnits;
    if (activeFilter !== 'all') {
      units = units.filter(u => u.status === activeFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      units = units.filter(u =>
        (u.purchaserName || '').toLowerCase().includes(q) ||
        u.unitNumber.toLowerCase().includes(q)
      );
    }
    // Sort: non-sold by unit number, sold at bottom
    const nonSold = units.filter(p => p.status !== 'sold').sort((a, b) => (parseInt(a.unitNumber) || 0) - (parseInt(b.unitNumber) || 0));
    const soldUnits = units.filter(p => p.status === 'sold').sort((a, b) => (parseInt(a.unitNumber) || 0) - (parseInt(b.unitNumber) || 0));
    return [...nonSold, ...soldUnits];
  }, [schemeUnits, activeFilter, searchQuery]);

  const filterCounts = useMemo(() => {
    const counts: Record<FilterKey, number> = { all: schemeUnits.length, for_sale: 0, sale_agreed: 0, contracts_issued: 0, signed: 0, sold: 0 };
    for (const u of schemeUnits) {
      if (u.status in counts) counts[u.status as FilterKey]++;
    }
    return counts;
  }, [schemeUnits]);

  if (loading) {
    return (
      <AgentShell agentName={agent?.displayName?.split(' ')[0]} urgentCount={0}>
        <div style={{ padding: '16px 24px 100px' }}>
          {[1,2,3,4,5].map(i => (
            <div key={i} style={{ height: 60, background: '#f3f4f6', borderRadius: 14, marginBottom: 8, animation: 'pulse 1.5s infinite' }} />
          ))}
        </div>
      </AgentShell>
    );
  }

  return (
    <AgentShell agentName={agent?.displayName?.split(' ')[0]} urgentCount={alerts.length}>
      <div style={{ padding: '8px 24px 100px' }}>
        {/* Back link */}
        <Link
          href="/agent/pipeline"
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            fontSize: 13, color: '#A0A8B0', textDecoration: 'none',
            marginBottom: 12,
          }}
          className="agent-tappable"
        >
          <ArrowLeft size={15} />
          Pipeline
        </Link>

        {/* Scheme header */}
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0D0D12', letterSpacing: '-0.04em', marginBottom: 4 }}>
          {schemeName}
        </h1>

        {/* Stats row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{
            background: 'linear-gradient(135deg, #B8960C, #E8C84A)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            fontSize: 20, fontWeight: 700,
          }}>
            {stats.percentSold}%
          </span>
          <span style={{ fontSize: 13, color: '#A0A8B0' }}>{stats.sold} of {stats.total} sold</span>
        </div>

        {/* Progress bar */}
        <div style={{ height: 4, background: 'rgba(0,0,0,0.05)', borderRadius: 2, overflow: 'hidden', marginBottom: 14 }}>
          <div style={{ height: '100%', width: `${stats.percentSold}%`, background: 'linear-gradient(90deg, #B8960C, #E8C84A)', borderRadius: 2 }} />
        </div>

        {/* Status summary */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18 }}>
          <StatusDot color="#10B981" label={`${stats.sold} Sold`} />
          <StatusDot color="#3B82F6" label={`${stats.reserved} Reserved`} />
          <StatusDot color="#A0A8B0" label={`${stats.available} Available`} />
        </div>

        {/* Search bar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: '#fff', borderRadius: 14,
          border: '1px solid rgba(0,0,0,0.06)',
          padding: '10px 14px', marginBottom: 12,
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        }}>
          <Search size={15} color="#A0A8B0" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search buyers or units..."
            style={{
              border: 'none', outline: 'none', flex: 1,
              fontSize: 13, color: '#0D0D12', background: 'transparent',
              fontFamily: 'inherit',
            }}
          />
        </div>

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: 0, overflowX: 'auto', marginBottom: 14, scrollbarWidth: 'none' }}>
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              style={{
                padding: '7px 14px', borderRadius: 20, border: 'none',
                fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', cursor: 'pointer',
                background: activeFilter === f.key ? '#0D0D12' : 'transparent',
                color: activeFilter === f.key ? '#fff' : '#A0A8B0',
                transition: 'all 0.15s ease',
                fontFamily: 'inherit',
              }}
            >
              {f.label} ({filterCounts[f.key]})
            </button>
          ))}
        </div>

        {/* Buyer list */}
        <div style={{
          background: '#FFFFFF', borderRadius: 18, overflow: 'hidden',
          boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05), 0 0 0 0.5px rgba(0,0,0,0.04)',
        }}>
          {filteredUnits.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#A0A8B0', fontSize: 13, padding: '32px 0' }}>
              No units match this filter
            </div>
          ) : (
            filteredUnits.map((unit, i) => (
              <BuyerRow key={unit.id} unit={unit} isLast={i === filteredUnits.length - 1} />
            ))
          )}
        </div>
      </div>
    </AgentShell>
  );
}

/* ─── Buyer row ─── */

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
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 18px',
          borderBottom: isLast ? 'none' : '1px solid rgba(0,0,0,0.04)',
          opacity: isSold ? 0.5 : 1,
        }}
      >
        {/* Avatar */}
        {unit.purchaserName ? (
          <div style={{
            width: 40, height: 40, borderRadius: 12, flexShrink: 0,
            background: hasNudge
              ? 'linear-gradient(135deg, #FEF2F2, #FEE2E2)'
              : 'linear-gradient(135deg, #FFFBEB, #FEF3C7)',
            border: hasNudge
              ? '1px solid rgba(239,68,68,0.25)'
              : '1px solid rgba(212,175,55,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ color: hasNudge ? '#B91C1C' : '#92400E', fontSize: 12, fontWeight: 700 }}>{initials}</span>
          </div>
        ) : (
          <div style={{
            width: 40, height: 40, borderRadius: 12, flexShrink: 0,
            background: '#F3F4F6', border: '1px solid rgba(0,0,0,0.04)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ color: '#A0A8B0', fontSize: 12, fontWeight: 600 }}>--</span>
          </div>
        )}

        {/* Name + unit */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: '#0D0D12', letterSpacing: '-0.01em', display: 'block' }}>
            {unit.purchaserName || 'Available'}
          </span>
          <span style={{ fontSize: 12, color: '#A0A8B0', marginTop: 1, display: 'block' }}>
            Unit {unit.unitNumber}
          </span>
        </div>

        {/* Status badge */}
        <StatusBadgeMini status={unit.status} />

        {/* Chevron */}
        <ChevronRight size={14} color="#D0D5DD" />
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
      padding: '3px 8px', borderRadius: 10, flexShrink: 0,
    }}>
      {c.label}
    </span>
  );
}
