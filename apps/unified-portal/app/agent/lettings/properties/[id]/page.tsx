'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import AgentShell from '../../../_components/AgentShell';

type FieldSource = 'manual' | 'eircode' | 'google_places' | 'seai_register' | 'lease_pdf_extraction' | null;

type PropertyFields = {
  id: string;
  address: string | null;
  addressLine1: string | null;
  propertyType: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  floorAreaSqm: number | null;
  yearBuilt: number | null;
  berRating: string | null;
  berCertNumber: string | null;
  berExpiryDate: string | null;
  status: string;
  completenessScore: number;
};

type Tenancy = {
  id: string;
  tenantName: string | null;
  tenantEmail: string | null;
  tenantPhone: string | null;
  rentPcm: number | null;
  depositAmount: number | null;
  rentPaymentDay: number | null;
  leaseStart: string | null;
  leaseEnd: string | null;
  leaseType: string | null;
  rtbRegistrationNumber: string | null;
  status: string;
};

type Detail = {
  property: PropertyFields;
  activeTenancy: Tenancy | null;
  tenancyHistory: Array<{ id: string; tenantName: string | null; leaseStart: string | null; leaseEnd: string | null; status: string; rentPcm: number | null }>;
  maintenance: Array<{ status: string }>;
  provenance: Array<{ fieldName: string; source: FieldSource; confidence: number | null }>;
};

type EditableKey = 'propertyType' | 'bedrooms' | 'bathrooms' | 'floorAreaSqm' | 'yearBuilt' | 'berRating' | 'berCertNumber' | 'berExpiryDate';

const LEASE_TYPE_OPTIONS: Array<[string, string]> = [
  ['fixed_term', 'Fixed term'],
  ['periodic', 'Periodic'],
  ['part_4', 'Part 4'],
  ['further_part_4', 'Further Part 4'],
];

const SOURCE_LABEL: Record<NonNullable<Exclude<FieldSource, 'manual'>>, string> = {
  google_places: 'Google Places',
  eircode: 'Eircode lookup',
  seai_register: 'SEAI register',
  lease_pdf_extraction: 'AI extracted from your lease',
};

const PROPERTY_TYPE_OPTIONS: Array<[string, string]> = [
  ['apartment', 'Apartment'],
  ['house_terraced', 'House (terraced)'],
  ['house_semi_detached', 'House (semi-detached)'],
  ['house_detached', 'House (detached)'],
  ['house_end_of_terrace', 'House (end of terrace)'],
  ['duplex', 'Duplex'],
  ['studio', 'Studio'],
  ['bungalow', 'Bungalow'],
  ['other', 'Other'],
];
const BER_OPTIONS: string[] = ['a1','a2','a3','b1','b2','b3','c1','c2','c3','d1','d2','e1','e2','f','g','exempt','pending'];

const formatDate = (iso: string | null) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IE', { day: '2-digit', month: 'short', year: 'numeric' });
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
  const [openPopover, setOpenPopover] = useState<string | null>(null);
  const [endingTenancy, setEndingTenancy] = useState(false);
  const [addingTenancy, setAddingTenancy] = useState(false);

  useEffect(() => {
    if (!openPopover) return;
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      if (t.closest('[data-popover-trigger]') || t.closest('[data-popover-content]')) return;
      setOpenPopover(null);
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [openPopover]);

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
    { id: 'overview', label: 'Overview', placeholder: '' },
    { id: 'tenancy', label: 'Tenancy', placeholder: 'Active tenancy + history go here (10c)' },
    { id: 'compliance', label: 'Compliance', placeholder: 'Compliance checklist + actions go here (10d)' },
    { id: 'documents', label: 'Documents', placeholder: 'Documents list + upload go here (10d)' },
    { id: 'maintenance', label: 'Maintenance', placeholder: 'Maintenance tickets go here (10e)' },
  ];
  const activePlaceholder = tabs.find((t) => t.id === tab)?.placeholder ?? '';

  const provenanceMap = new Map<string, FieldSource>();
  for (const pv of data.provenance) provenanceMap.set(pv.fieldName, pv.source);

  const refetch = async () => {
    const res = await fetch(`/api/lettings/properties/${params.id}`);
    if (res.ok) setData(await res.json());
  };

  const handlePatchTenancy = async (tenancyId: string, patch: Record<string, unknown>) => {
    const before = data?.activeTenancy;
    setData((prev) => prev?.activeTenancy ? { ...prev, activeTenancy: { ...prev.activeTenancy, ...patch } as Tenancy } : prev);
    const res = await fetch(`/api/lettings/tenancies/${tenancyId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setData((prev) => prev && before ? { ...prev, activeTenancy: before } : prev);
      throw new Error(json?.error || `Save failed (${res.status})`);
    }
    setData((prev) => prev ? { ...prev, activeTenancy: { ...prev.activeTenancy, ...json.updatedTenancy } as Tenancy } : prev);
  };

  const handlePatch = async (patch: Partial<Record<EditableKey, unknown>>) => {
    const before = data.property;
    setData((prev) => prev ? { ...prev, property: { ...prev.property, ...patch } as PropertyFields } : prev);
    const res = await fetch(`/api/lettings/properties/${params.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setData((prev) => prev ? { ...prev, property: before } : prev);
      throw new Error(json?.error || `Save failed (${res.status})`);
    }
    setData((prev) => prev ? {
      ...prev,
      property: { ...prev.property, ...json.updatedProperty, completenessScore: json.completenessScore },
    } : prev);
  };

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
          {tab === 'tenancy' ? (
            <TenancyTab
              activeTenancy={data.activeTenancy}
              history={data.tenancyHistory}
              openPopover={openPopover}
              setOpenPopover={setOpenPopover}
              onEditField={(patch) => {
                if (!data.activeTenancy) return Promise.reject(new Error('No active tenancy'));
                return handlePatchTenancy(data.activeTenancy.id, patch);
              }}
              onEndTenancy={() => setEndingTenancy(true)}
              onAddTenancy={() => setAddingTenancy(true)}
            />
          ) : tab === 'overview' ? (
            <div className="bg-white border border-[#E5E7EB] rounded-xl p-4 mb-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <EditableField fieldKey="propertyType" label="Property type" type="select" options={PROPERTY_TYPE_OPTIONS} value={p.propertyType} formatted={p.propertyType ? PROPERTY_TYPE_LABEL[p.propertyType] ?? p.propertyType : null} source={provenanceMap.get('propertyType') ?? null} openPopover={openPopover} setOpenPopover={setOpenPopover} onSave={(v) => handlePatch({ propertyType: v })} />
                <EditableField fieldKey="bedrooms" label="Bedrooms" type="number" value={p.bedrooms} formatted={p.bedrooms != null ? String(p.bedrooms) : null} source={provenanceMap.get('bedrooms') ?? null} openPopover={openPopover} setOpenPopover={setOpenPopover} onSave={(v) => handlePatch({ bedrooms: v })} />
                <EditableField fieldKey="bathrooms" label="Bathrooms" type="number" value={p.bathrooms} formatted={p.bathrooms != null ? String(p.bathrooms) : null} source={provenanceMap.get('bathrooms') ?? null} openPopover={openPopover} setOpenPopover={setOpenPopover} onSave={(v) => handlePatch({ bathrooms: v })} />
                <EditableField fieldKey="floorAreaSqm" label="Floor area" type="number" step={0.1} value={p.floorAreaSqm} formatted={p.floorAreaSqm != null ? `${p.floorAreaSqm} sqm` : null} source={provenanceMap.get('floorAreaSqm') ?? null} openPopover={openPopover} setOpenPopover={setOpenPopover} onSave={(v) => handlePatch({ floorAreaSqm: v })} />
                <EditableField fieldKey="yearBuilt" label="Year built" type="number" min={1700} max={2030} value={p.yearBuilt} formatted={p.yearBuilt != null ? String(p.yearBuilt) : null} source={provenanceMap.get('yearBuilt') ?? null} openPopover={openPopover} setOpenPopover={setOpenPopover} onSave={(v) => handlePatch({ yearBuilt: v })} />
                <EditableField fieldKey="berRating" label="BER rating" type="select" options={BER_OPTIONS.map((b) => [b, b.toUpperCase()] as [string, string])} value={p.berRating} formatted={p.berRating ? p.berRating.toUpperCase() : null} source={provenanceMap.get('berRating') ?? null} openPopover={openPopover} setOpenPopover={setOpenPopover} onSave={(v) => handlePatch({ berRating: v })} />
                <EditableField fieldKey="berCertNumber" label="BER cert number" type="text" value={p.berCertNumber} formatted={p.berCertNumber} source={provenanceMap.get('berCertNumber') ?? null} openPopover={openPopover} setOpenPopover={setOpenPopover} onSave={(v) => handlePatch({ berCertNumber: v })} />
                <EditableField fieldKey="berExpiryDate" label="BER expiry" type="date" value={p.berExpiryDate} formatted={formatDate(p.berExpiryDate)} source={provenanceMap.get('berExpiryDate') ?? null} openPopover={openPopover} setOpenPopover={setOpenPopover} onSave={(v) => handlePatch({ berExpiryDate: v })} />
              </div>
            </div>
          ) : (
            <p className="text-sm text-[#A0A8B0]">{activePlaceholder}</p>
          )}
        </div>

        {endingTenancy && data.activeTenancy && (
          <EndTenancySheet
            tenancyId={data.activeTenancy.id}
            onClose={() => setEndingTenancy(false)}
            onSuccess={async () => { setEndingTenancy(false); await refetch(); }}
          />
        )}
        {addingTenancy && !data.activeTenancy && (
          <AddTenancySheet
            propertyId={params.id}
            onClose={() => setAddingTenancy(false)}
            onSuccess={async () => { setAddingTenancy(false); await refetch(); }}
          />
        )}
      </div>
    </AgentShell>
  );
}

function TenancyTab({ activeTenancy, history, openPopover, setOpenPopover, onEditField, onEndTenancy, onAddTenancy }: {
  activeTenancy: Tenancy | null;
  history: Array<{ id: string; tenantName: string | null; leaseStart: string | null; leaseEnd: string | null; status: string; rentPcm: number | null }>;
  openPopover: string | null;
  setOpenPopover: (next: string | null) => void;
  onEditField: (patch: Record<string, unknown>) => Promise<void>;
  onEndTenancy: () => void;
  onAddTenancy: () => void;
}) {
  const past = history.filter((t) => t.status !== 'active');
  const t = activeTenancy;
  return (
    <>
      {t ? (
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-4 mb-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="text-[11px] font-semibold tracking-wider uppercase text-[#9EA8B5]">Active tenancy</div>
              <div className="text-base font-semibold text-[#0D0D12] mt-0.5">{t.tenantName ?? 'Unnamed tenant'}</div>
            </div>
            <button type="button" onClick={onEndTenancy} className="inline-flex items-center gap-1.5 text-xs text-[#6B7280] bg-transparent border-0 cursor-pointer">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
              End tenancy
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <EditableField fieldKey="t_tenantName" label="Tenant name" type="text" value={t.tenantName} formatted={t.tenantName} source={null} openPopover={openPopover} setOpenPopover={setOpenPopover} onSave={(v) => onEditField({ tenantName: v })} />
            <EditableField fieldKey="t_tenantEmail" label="Tenant email" type="text" value={t.tenantEmail} formatted={t.tenantEmail} source={null} openPopover={openPopover} setOpenPopover={setOpenPopover} onSave={(v) => onEditField({ tenantEmail: v })} />
            <EditableField fieldKey="t_tenantPhone" label="Tenant phone" type="text" value={t.tenantPhone} formatted={t.tenantPhone} source={null} openPopover={openPopover} setOpenPopover={setOpenPopover} onSave={(v) => onEditField({ tenantPhone: v })} />
            <EditableField fieldKey="t_rentPcm" label="Monthly rent" type="number" value={t.rentPcm} formatted={t.rentPcm != null ? `€${Number(t.rentPcm).toLocaleString()}/m` : null} source={null} openPopover={openPopover} setOpenPopover={setOpenPopover} onSave={(v) => onEditField({ rentPcm: v })} />
            <EditableField fieldKey="t_depositAmount" label="Deposit" type="number" value={t.depositAmount} formatted={t.depositAmount != null ? `€${Number(t.depositAmount).toLocaleString()}` : null} source={null} openPopover={openPopover} setOpenPopover={setOpenPopover} onSave={(v) => onEditField({ depositAmount: v })} />
            <EditableField fieldKey="t_rentPaymentDay" label="Rent payment day" type="number" min={1} max={31} value={t.rentPaymentDay} formatted={t.rentPaymentDay != null ? String(t.rentPaymentDay) : null} source={null} openPopover={openPopover} setOpenPopover={setOpenPopover} onSave={(v) => onEditField({ rentPaymentDay: v })} />
            <EditableField fieldKey="t_leaseStart" label="Lease start" type="date" value={t.leaseStart} formatted={formatDate(t.leaseStart)} source={null} openPopover={openPopover} setOpenPopover={setOpenPopover} onSave={(v) => onEditField({ leaseStartDate: v })} />
            <EditableField fieldKey="t_leaseEnd" label="Lease end" type="date" value={t.leaseEnd} formatted={formatDate(t.leaseEnd)} source={null} openPopover={openPopover} setOpenPopover={setOpenPopover} onSave={(v) => onEditField({ leaseEndDate: v })} />
            <EditableField fieldKey="t_leaseType" label="Lease type" type="select" options={LEASE_TYPE_OPTIONS} value={t.leaseType} formatted={t.leaseType ? (LEASE_TYPE_OPTIONS.find(([v]) => v === t.leaseType)?.[1] ?? t.leaseType) : null} source={null} openPopover={openPopover} setOpenPopover={setOpenPopover} onSave={(v) => onEditField({ leaseType: v })} />
            <EditableField fieldKey="t_rtb" label="RTB registration number" type="text" value={t.rtbRegistrationNumber} formatted={t.rtbRegistrationNumber} source={null} openPopover={openPopover} setOpenPopover={setOpenPopover} onSave={(v) => onEditField({ rtbRegistrationNumber: v })} />
          </div>
        </div>
      ) : (
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-6 mb-4 text-center">
          <h3 className="text-base font-semibold text-[#0D0D12] m-0 mb-2">No active tenancy</h3>
          <p className="text-[13px] text-[#6B7280] m-0 mb-4">When a new tenant moves in, add the tenancy here so you can track rent, lease dates, and RTB.</p>
          <button type="button" onClick={onAddTenancy} className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold text-[#0D0D12] border-0 cursor-pointer" style={{ background: 'linear-gradient(135deg, #D4AF37, #C49B2A)', boxShadow: '0 1px 2px rgba(0,0,0,0.06), 0 6px 18px rgba(196,155,42,0.32)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0D0D12" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            Add new tenancy
          </button>
        </div>
      )}

      <div className="flex items-center mb-2">
        <span className="text-[11px] font-semibold tracking-wider uppercase text-[#9EA8B5]">Tenancy history</span>
        {past.length > 0 && <span className="ml-2 text-[11px] text-[#A0A8B0]">({past.length})</span>}
      </div>
      {past.length === 0 ? (
        <p className="text-center text-xs text-[#A0A8B0] py-4">No previous tenancies</p>
      ) : (
        <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
          {past.map((h, i) => (
            <div key={h.id} className="flex items-center gap-3 p-3" style={{ borderTop: i === 0 ? 'none' : '0.5px solid #E5E7EB' }}>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-[#0D0D12] truncate">{h.tenantName ?? 'Unnamed tenant'}</div>
                <div className="text-xs text-[#6B7280] truncate">{formatDate(h.leaseStart) ?? '—'} → {formatDate(h.leaseEnd) ?? '—'}</div>
              </div>
              {h.rentPcm != null && <div className="text-xs font-medium text-[#0D0D12]">€{Number(h.rentPcm).toLocaleString()}/m</div>}
              <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-full" style={{ background: '#F3F4F6', color: '#6B7280' }}>
                {h.status === 'ended' ? 'Ended' : h.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function SheetShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-white rounded-t-2xl sm:rounded-2xl p-4 sm:p-6" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-[#0D0D12] m-0">{title}</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="w-8 h-8 inline-flex items-center justify-center rounded-lg bg-transparent border-0 cursor-pointer">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function EndTenancySheet({ tenancyId, onClose, onSuccess }: { tenancyId: string; onClose: () => void; onSuccess: () => Promise<void> }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const submit = async () => {
    setSubmitting(true);
    setErrMsg(null);
    try {
      const res = await fetch(`/api/lettings/tenancies/${tenancyId}/end`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leaseEndDate: date }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `Failed (${res.status})`);
      await onSuccess();
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : 'Failed to end tenancy');
      setSubmitting(false);
    }
  };

  return (
    <SheetShell title="End tenancy" onClose={onClose}>
      <label className="block text-[12px] font-medium text-[#6B7280] mb-1">Last day of tenancy</label>
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-10 w-full border border-[#E5E7EB] rounded-lg px-3 text-sm text-[#0D0D12] bg-white focus:outline-none focus:border-[#D4AF37]" />
      <p className="text-[12px] text-[#6B7280] mt-2 mb-4">Setting an end date marks the tenancy as ended. The property will become Vacant.</p>
      {errMsg && <div className="text-xs text-red-600 mb-3">{errMsg}</div>}
      <div className="flex gap-2">
        <button type="button" onClick={onClose} className="flex-1 h-11 rounded-lg border border-[#E5E7EB] bg-white text-sm font-medium text-[#6B7280] cursor-pointer">Cancel</button>
        <button type="button" onClick={submit} disabled={submitting} className="flex-1 h-11 rounded-lg border-0 text-sm font-semibold text-[#0D0D12] cursor-pointer" style={{ background: 'linear-gradient(135deg, #D4AF37, #C49B2A)', opacity: submitting ? 0.5 : 1 }}>
          {submitting ? 'Ending…' : 'End tenancy'}
        </button>
      </div>
    </SheetShell>
  );
}

function AddTenancySheet({ propertyId, onClose, onSuccess }: { propertyId: string; onClose: () => void; onSuccess: () => Promise<void> }) {
  const [tenantName, setTenantName] = useState('');
  const [rentPcm, setRentPcm] = useState('');
  const [leaseStartDate, setLeaseStartDate] = useState('');
  const [leaseEndDate, setLeaseEndDate] = useState('');
  const [leaseType, setLeaseType] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [rtb, setRtb] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const ready = tenantName.trim() && rentPcm && leaseStartDate;

  const submit = async () => {
    setSubmitting(true);
    setErrMsg(null);
    const body: Record<string, unknown> = {
      lettingPropertyId: propertyId,
      tenantName: tenantName.trim(),
      rentPcm: Number(rentPcm),
      leaseStartDate,
    };
    if (leaseEndDate) body.leaseEndDate = leaseEndDate;
    if (leaseType) body.leaseType = leaseType;
    if (depositAmount) body.depositAmount = Number(depositAmount);
    if (rtb.trim()) body.rtbRegistrationNumber = rtb.trim();
    try {
      const res = await fetch('/api/lettings/tenancies', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `Failed (${res.status})`);
      await onSuccess();
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : 'Failed to add tenancy');
      setSubmitting(false);
    }
  };

  const inputCls = "h-10 w-full border border-[#E5E7EB] rounded-lg px-3 text-sm text-[#0D0D12] bg-white focus:outline-none focus:border-[#D4AF37]";
  const labelCls = "block text-[12px] font-medium text-[#6B7280] mb-1";

  return (
    <SheetShell title="Add new tenancy" onClose={onClose}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2"><label className={labelCls}>Tenant name <span className="text-red-500">*</span></label><input type="text" placeholder="e.g. Mary Murphy" value={tenantName} onChange={(e) => setTenantName(e.target.value)} className={inputCls} /></div>
        <div><label className={labelCls}>Monthly rent <span className="text-red-500">*</span></label><input type="number" value={rentPcm} onChange={(e) => setRentPcm(e.target.value)} className={inputCls} /></div>
        <div><label className={labelCls}>Deposit</label><input type="number" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} className={inputCls} /></div>
        <div><label className={labelCls}>Lease start <span className="text-red-500">*</span></label><input type="date" value={leaseStartDate} onChange={(e) => setLeaseStartDate(e.target.value)} className={inputCls} /></div>
        <div><label className={labelCls}>Lease end</label><input type="date" value={leaseEndDate} onChange={(e) => setLeaseEndDate(e.target.value)} className={inputCls} /></div>
        <div><label className={labelCls}>Lease type</label><select value={leaseType} onChange={(e) => setLeaseType(e.target.value)} className={inputCls}><option value="">—</option>{LEASE_TYPE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
        <div><label className={labelCls}>RTB registration</label><input type="text" value={rtb} onChange={(e) => setRtb(e.target.value)} className={inputCls} /></div>
      </div>
      {errMsg && <div className="text-xs text-red-600 mt-3">{errMsg}</div>}
      <div className="flex gap-2 mt-4">
        <button type="button" onClick={onClose} className="flex-1 h-11 rounded-lg border border-[#E5E7EB] bg-white text-sm font-medium text-[#6B7280] cursor-pointer">Cancel</button>
        <button type="button" onClick={submit} disabled={!ready || submitting} className="flex-1 h-11 rounded-lg border-0 text-sm font-semibold text-[#0D0D12] cursor-pointer" style={{ background: 'linear-gradient(135deg, #D4AF37, #C49B2A)', opacity: !ready || submitting ? 0.5 : 1, pointerEvents: !ready || submitting ? 'none' : 'auto' }}>
          {submitting ? 'Adding…' : 'Add tenancy'}
        </button>
      </div>
    </SheetShell>
  );
}

function EditableField({
  fieldKey, label, type, value, formatted, options, step, min, max, source, openPopover, setOpenPopover, onSave,
}: {
  fieldKey: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select';
  value: string | number | null;
  formatted: string | null;
  options?: Array<[string, string]>;
  step?: number;
  min?: number;
  max?: number;
  source: FieldSource;
  openPopover: string | null;
  setOpenPopover: (next: string | null) => void;
  onSave: (next: string | number | null) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const start = () => { setDraft(value == null ? '' : String(value)); setErrMsg(null); setEditing(true); };
  const cancel = () => { setEditing(false); setErrMsg(null); };
  const commit = async () => {
    if (saving) return;
    let parsed: string | number | null = draft === '' ? null : draft;
    if (type === 'number' && draft !== '') {
      const n = Number(draft);
      if (!Number.isFinite(n)) { setErrMsg('Not a number'); return; }
      parsed = n;
    }
    setSaving(true);
    setErrMsg(null);
    try { await onSave(parsed); setEditing(false); }
    catch (e) { setErrMsg(e instanceof Error ? e.message : 'Save failed'); }
    finally { setSaving(false); }
  };

  if (!editing) {
    return (
      <button type="button" onClick={start} className="text-left bg-transparent border-0 p-0 cursor-pointer">
        <div className="flex items-center mb-1">
          <span className="text-[11px] font-semibold tracking-wider uppercase text-[#9EA8B5]">{label}</span>
          {source && source !== 'manual' && <SourceIcon source={source} fieldName={fieldKey} openPopover={openPopover} setOpenPopover={setOpenPopover} />}
        </div>
        <div className="text-[15px] font-medium" style={{ color: formatted ? '#0D0D12' : '#A0A8B0' }}>
          {formatted ?? '—'}
        </div>
      </button>
    );
  }

  return (
    <div>
      <div className="text-[11px] font-semibold tracking-wider uppercase text-[#9EA8B5] mb-1">{label}</div>
      <div className="flex items-center gap-2">
        {type === 'select' ? (
          <select autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') cancel(); }} className="h-10 flex-1 min-w-0 border border-[#D4AF37] rounded-lg px-3 text-sm text-[#0D0D12] bg-white focus:outline-none">
            <option value="">—</option>
            {options?.map(([v, lbl]) => <option key={v} value={v}>{lbl}</option>)}
          </select>
        ) : (
          <input autoFocus type={type} step={step} min={min} max={max} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel(); }} className="h-10 flex-1 min-w-0 border border-[#D4AF37] rounded-lg px-3 text-sm text-[#0D0D12] bg-white focus:outline-none" />
        )}
        <button type="button" onClick={commit} disabled={saving} aria-label="Save" className="inline-flex items-center justify-center w-8 h-8 rounded-lg" style={{ background: '#D4AF37', opacity: saving ? 0.5 : 1 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
        </button>
        <button type="button" onClick={cancel} aria-label="Cancel" className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-[#E5E7EB] bg-white">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>
      </div>
      {errMsg && <div className="text-[11px] text-red-600 mt-1">{errMsg}</div>}
    </div>
  );
}

function SourceIcon({ source, fieldName, openPopover, setOpenPopover }: {
  source: FieldSource; fieldName: string; openPopover: string | null; setOpenPopover: (next: string | null) => void;
}) {
  if (!source || source === 'manual') return null;
  const isOpen = openPopover === fieldName;
  const stroke = source === 'lease_pdf_extraction' ? '#D4AF37' : '#6B7280';
  const friendly = SOURCE_LABEL[source];
  return (
    <span className="relative inline-flex ml-1.5">
      <button type="button" data-popover-trigger onClick={(e) => { e.stopPropagation(); setOpenPopover(isOpen ? null : fieldName); }} className="inline-flex items-center justify-center w-4 h-4 rounded hover:bg-gray-100" aria-label={`Source: ${friendly}`}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {source === 'google_places' && <><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></>}
          {source === 'eircode' && <><line x1="4" y1="9" x2="20" y2="9" /><line x1="4" y1="15" x2="20" y2="15" /><line x1="10" y1="3" x2="8" y2="21" /><line x1="16" y1="3" x2="14" y2="21" /></>}
          {source === 'seai_register' && <><rect x="4" y="2" width="16" height="20" rx="2" /><line x1="9" y1="6" x2="15" y2="6" /><line x1="9" y1="10" x2="15" y2="10" /><line x1="9" y1="14" x2="11" y2="14" /></>}
          {source === 'lease_pdf_extraction' && <path d="M12 3l1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3z" />}
        </svg>
      </button>
      {isOpen && (
        <div data-popover-content className="absolute z-50 mt-1 left-0 top-full w-56 bg-[#0D0D12] text-white rounded-lg shadow-lg p-3 text-xs">
          <div className="font-medium mb-0.5">{friendly}</div>
          <div className="text-[#A0A8B0]">Filled automatically from this source. Edit to override.</div>
        </div>
      )}
    </span>
  );
}
