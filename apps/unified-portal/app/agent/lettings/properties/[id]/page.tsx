'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AgentShell from '../../../_components/AgentShell';

type Detail = {
  property: {
    id: string;
    address: string | null;
    addressLine1: string | null;
    propertyType: string | null;
    bedrooms: number | null;
    bathrooms: number | null;
    berRating: string | null;
    status: string;
    completenessScore: number;
  };
  activeTenancy: { rentPcm: number | null } | null;
  maintenance: Array<{ status: string }>;
};

type TabId = 'overview' | 'tenancy' | 'compliance' | 'documents' | 'maintenance';

const PROPERTY_TYPE_LABEL: Record<string, string> = {
  apartment: 'Apartment',
  house_terraced: 'House (terraced)',
  house_semi_detached: 'House (semi-detached)',
  house_detached: 'House (detached)',
  house_end_of_terrace: 'House (end of terrace)',
  duplex: 'Duplex',
  studio: 'Studio',
  bungalow: 'Bungalow',
  other: 'Other',
};

function categorise(s: string | null | undefined): 'tenanted' | 'vacant' | 'off_market' | 'other' {
  const v = (s ?? '').toLowerCase();
  if (v === 'let' || v === 'occupied' || v === 'tenanted') return 'tenanted';
  if (v === 'vacant' || v === 'available' || v === 'empty') return 'vacant';
  if (v === 'off_market') return 'off_market';
  return 'other';
}

const OPEN_MAINT_STATUSES = new Set(['open', 'in_progress', 'awaiting_contractor']);

export default function PropertyDetailPage({ params }: { params: { id: string } }) {
  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>('overview');

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/lettings/properties/${params.id}`)
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || `Fetch failed (${res.status})`);
        return json as Detail;
      })
      .then((json) => { if (!cancelled) { setData(json); setLoading(false); } })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Network error');
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [params.id]);

  if (loading) {
    return (
      <AgentShell>
        <div className="p-4" style={{ fontFamily: "'Inter', sans-serif" }}>
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-4 animate-pulse">
            <div className="h-5 w-2/3 bg-gray-100 rounded mb-2" />
            <div className="h-3 w-1/2 bg-gray-100 rounded mb-3" />
            <div className="h-5 w-20 bg-gray-100 rounded" />
          </div>
          <div className="mt-4 flex gap-4 px-2">
            {[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-6 w-16 bg-gray-100 animate-pulse rounded" />)}
          </div>
        </div>
      </AgentShell>
    );
  }

  if (error || !data) {
    return (
      <AgentShell>
        <div style={{ padding: 32, textAlign: 'center', fontFamily: "'Inter', sans-serif" }}>
          <p style={{ color: '#0D0D12', fontSize: 16, fontWeight: 600, margin: '0 0 12px' }}>Property not found</p>
          <Link href="/agent/lettings/properties" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#6B7280', fontSize: 14, textDecoration: 'none' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
            Back to properties
          </Link>
        </div>
      </AgentShell>
    );
  }

  const p = data.property;
  const cat = categorise(p.status);
  const ringPct = Math.max(0, Math.min(100, p.completenessScore));
  const offset = 2 * Math.PI * 22 * (1 - ringPct / 100);

  const subtitleParts = [
    p.propertyType ? PROPERTY_TYPE_LABEL[p.propertyType] ?? p.propertyType : null,
    p.bedrooms != null ? `${p.bedrooms} bed` : null,
    p.bathrooms != null ? `${p.bathrooms} bath` : null,
  ].filter((s): s is string => s !== null);

  const pillStyle =
    cat === 'tenanted' ? { background: '#FAF3DD', color: '#A47E1B' }
    : cat === 'vacant' ? { background: '#F3F4F6', color: '#6B7280' }
    : cat === 'off_market' ? { background: '#E5E7EB', color: '#4B5563' }
    : { background: '#F3F4F6', color: '#6B7280' };
  const pillLabel =
    cat === 'tenanted' ? 'Tenanted'
    : cat === 'vacant' ? 'Vacant'
    : cat === 'off_market' ? 'Off-market' : 'Other';

  const openMaintenance = data.maintenance.filter((m) => OPEN_MAINT_STATUSES.has(m.status)).length;

  const tabs: Array<{ id: TabId; label: string; placeholder: string }> = [
    { id: 'overview', label: 'Overview', placeholder: 'Property fields go here (10b)' },
    { id: 'tenancy', label: 'Tenancy', placeholder: 'Active tenancy + history go here (10c)' },
    { id: 'compliance', label: 'Compliance', placeholder: 'Compliance checklist + actions go here (10d)' },
    { id: 'documents', label: 'Documents', placeholder: 'Documents list + upload go here (10d)' },
    { id: 'maintenance', label: 'Maintenance', placeholder: 'Maintenance tickets go here (10e)' },
  ];
  const activePlaceholder = tabs.find((t) => t.id === tab)?.placeholder ?? '';

  return (
    <AgentShell>
      <div style={{ minHeight: '100%', background: '#FAFAF8', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif", paddingBottom: 80 }}>
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-4 mt-4 mx-4 mb-4 flex items-start gap-3">
          <Link href="/agent/lettings/properties" aria-label="Back" className="inline-flex items-center justify-center w-9 h-9 rounded-lg -ml-2 flex-shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0D0D12" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold text-[#0D0D12] truncate m-0">{p.address || p.addressLine1 || 'Untitled property'}</h1>
            {subtitleParts.length > 0 && (
              <p className="text-xs text-[#6B7280] mt-1 mb-0">{subtitleParts.join(' · ')}</p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-full" style={pillStyle}>{pillLabel}</span>
              {data.activeTenancy?.rentPcm != null && (
                <span className="text-xs font-medium text-[#0D0D12]">
                  Tenanted · €{Number(data.activeTenancy.rentPcm).toLocaleString()}/m
                </span>
              )}
            </div>
          </div>
          <div className="relative w-14 h-14 flex-shrink-0">
            <svg width="56" height="56" viewBox="0 0 56 56" className="-rotate-90">
              <circle cx="28" cy="28" r="22" fill="none" stroke="#F3F4F6" strokeWidth="4" />
              <circle cx="28" cy="28" r="22" fill="none" stroke="#D4AF37" strokeWidth="4" strokeLinecap="round" strokeDasharray={2 * Math.PI * 22} strokeDashoffset={offset} style={{ transition: 'stroke-dashoffset 250ms' }} />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-[#0D0D12]">{ringPct}</div>
          </div>
        </div>

        <div className="flex gap-4 px-4 overflow-x-auto border-b border-[#E5E7EB] mb-4 [&::-webkit-scrollbar]:hidden">
          {tabs.map((t) => {
            const selected = tab === t.id;
            return (
              <button key={t.id} type="button" onClick={() => setTab(t.id)} className="flex-shrink-0 relative bg-transparent border-0 cursor-pointer" style={{ padding: '14px 0', fontFamily: 'inherit', fontSize: 14, fontWeight: selected ? 600 : 500, color: selected ? '#0D0D12' : '#6B7280' }}>
                {t.label}
                {t.id === 'maintenance' && openMaintenance > 0 && (
                  <span className="ml-1.5 px-1.5 rounded-full text-[10px] font-bold" style={{ background: 'rgba(239,68,68,0.10)', color: '#B91C1C' }}>{openMaintenance}</span>
                )}
                {selected && <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-[#D4AF37]" />}
              </button>
            );
          })}
        </div>

        <div className="px-4">
          <p className="text-sm text-[#A0A8B0]">{activePlaceholder}</p>
        </div>
      </div>
    </AgentShell>
  );
}
