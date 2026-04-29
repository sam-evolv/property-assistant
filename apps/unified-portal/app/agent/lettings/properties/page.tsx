'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import AgentShell from '../../_components/AgentShell';

type ActiveTenancy = { tenantName: string | null; rentPcm: number | null; leaseEnd: string | null };
type Property = {
  id: string;
  address: string;
  addressLine1: string | null;
  city: string | null;
  eircode: string | null;
  status: string;
  completenessScore: number;
  activeTenancy: ActiveTenancy | null;
};
type ListResponse = {
  properties: Property[];
  totalCount: number;
  tenantedCount: number;
  monthlyRentRoll: number;
};
type Category = 'all' | 'tenanted' | 'vacant' | 'off_market' | 'other';

// Live DB status values come in many shapes (Sessions 5-8 introduced new ones
// while older rows still use the originals). Collapse to four UI buckets.
// Session 14c — pick the most readable label for a property row at iPhone
// width. Prefers address_line_1 when it's a real street address (not an
// apartment/unit prefix), appending city for context. Falls back to the
// first one or two comma-separated segments of the full address, which
// strips eircode + county tail so the row doesn't truncate mid-name.
function bestRowLabel(p: Property): string {
  const al1 = (p.addressLine1 ?? '').trim();
  if (al1 && !/^apt\s/i.test(al1) && !/^unit\s/i.test(al1)) {
    const city = (p.city ?? '').trim();
    if (city && !al1.toLowerCase().includes(city.toLowerCase())) {
      return `${al1}, ${city}`;
    }
    return al1;
  }
  const full = (p.address ?? '').trim();
  if (full) {
    const segments = full.split(',').map((s) => s.trim()).filter(Boolean);
    if (segments.length >= 2 && segments[0].length > 2 && segments[1].length > 2) {
      return `${segments[0]}, ${segments[1]}`;
    }
    return segments[0] || full;
  }
  return 'Untitled property';
}

function categorise(s: string): Exclude<Category, 'all'> {
  const v = (s ?? '').toLowerCase();
  if (v === 'let' || v === 'occupied' || v === 'tenanted') return 'tenanted';
  if (v === 'vacant' || v === 'available' || v === 'empty') return 'vacant';
  if (v === 'off_market') return 'off_market';
  if (v) console.warn('[lettings/properties] unknown status:', s);
  return 'other';
}

export default function LettingsPropertiesPage() {
  // Session 14c — deep-linkable filter + sort. Tiles on the lettings home
  // can hand the user here pre-filtered (e.g. ?status=vacant from the
  // VACANCIES tile) or pre-sorted (?sort=completeness_asc from the
  // COMPLETENESS tile). Pill interactions still override these — once
  // the user touches a pill, the URL param is no longer authoritative.
  const searchParams = useSearchParams();
  const initialFilter: Category = (() => {
    const s = searchParams.get('status');
    if (s === 'vacant' || s === 'tenanted' || s === 'off_market') return s as Category;
    return 'all';
  })();
  const initialSort: 'default' | 'completeness_asc' =
    searchParams.get('sort') === 'completeness_asc' ? 'completeness_asc' : 'default';

  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Category>(initialFilter);
  const [city, setCity] = useState<string>('all');
  const [sortMode, setSortMode] = useState<'default' | 'completeness_asc'>(initialSort);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/lettings/properties/list')
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || `Fetch failed (${res.status})`);
        return json as ListResponse;
      })
      .then((json) => { if (!cancelled) { setData(json); setLoading(false); } })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Network error');
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const counts = useMemo(() => {
    const c = { tenanted: 0, vacant: 0, off_market: 0, other: 0 };
    for (const p of data?.properties ?? []) c[categorise(p.status)] += 1;
    return c;
  }, [data]);

  const cities = useMemo(() => {
    const set = new Set<string>();
    for (const p of data?.properties ?? []) {
      const c = (p.city ?? '').trim();
      if (c) set.add(c);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [data]);

  const filtered = useMemo(() => {
    const list = data?.properties ?? [];
    const q = search.trim().toLowerCase();
    return list.filter((p) => {
      if (filter !== 'all' && categorise(p.status) !== filter) return false;
      if (city !== 'all' && (p.city ?? '').trim() !== city) return false;
      if (!q) return true;
      const tenant = p.activeTenancy?.tenantName?.toLowerCase() ?? '';
      return p.address.toLowerCase().includes(q) || tenant.includes(q);
    });
  }, [data, search, filter, city]);

  // Session 14c — sort mode applied after filtering. The default keeps
  // server order (created_at desc); 'completeness_asc' surfaces the most
  // incomplete properties first so the agent can fill them in.
  const sorted = useMemo(() => {
    const list = [...filtered];
    if (sortMode === 'completeness_asc') {
      list.sort((a, b) => a.completenessScore - b.completenessScore);
    }
    return list;
  }, [filtered, sortMode]);

  const totalCount = data?.totalCount ?? 0;
  const tenantedCount = data?.tenantedCount ?? 0;
  const rentRoll = data?.monthlyRentRoll ?? 0;
  const pills: Array<{ id: Category; label: string; n: number }> = [
    { id: 'all', label: 'All', n: totalCount },
    { id: 'tenanted', label: 'Tenanted', n: counts.tenanted },
    { id: 'vacant', label: 'Vacant', n: counts.vacant },
    { id: 'off_market', label: 'Off-market', n: counts.off_market },
  ];

  return (
    <AgentShell>
      <div className="min-h-full" style={{ background: '#FAFAF8', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}>
        <div className="sticky top-0 z-10 flex items-center justify-between h-14 px-4 bg-[#FAFAF8] border-b border-black/5">
          <h1 className="text-base font-semibold text-[#0D0D12] m-0">Properties</h1>
          <Link href="/agent/lettings/properties/new" aria-label="Add property" className="inline-flex items-center justify-center w-10 h-10 rounded-full text-white shadow-sm" style={{ background: 'linear-gradient(135deg, #D4AF37, #C49B2A)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </Link>
        </div>

        <div className="max-w-md mx-auto px-4 pt-4 pb-32">
          {error && (
            <div role="alert" className="mb-4 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">{error}</div>
          )}

          {!loading && totalCount === 0 && !error ? (
            <div className="flex flex-col items-center text-center pt-16">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6" style={{ background: 'rgba(212,175,55,0.10)', border: '0.5px solid rgba(212,175,55,0.22)' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#C49B2A" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" /><path d="M10 6h4" /><path d="M10 10h4" /><path d="M10 14h4" />
                </svg>
              </div>
              <h2 className="text-2xl font-semibold text-[#0D0D12] mb-2">No properties yet</h2>
              <p className="text-[15px] text-[#6B7280] leading-relaxed mb-7 max-w-[280px]">Add your first property to get started. We&rsquo;ll fill in most of it for you.</p>
              <Link href="/agent/lettings/properties/new" className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold text-[#0D0D12] no-underline" style={{ background: 'linear-gradient(135deg, #D4AF37, #C49B2A)', boxShadow: '0 1px 2px rgba(0,0,0,0.06), 0 6px 18px rgba(196,155,42,0.32)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0D0D12" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                Add a property
              </Link>
              <Link href="/agent/lettings/properties/import" className="mt-3.5 text-[13px] text-[#A0A8B0] no-underline">Or import from a spreadsheet</Link>
            </div>
          ) : (
            <>
              {totalCount > 0 && (
                <div className="bg-white rounded-xl p-3 mb-3 border border-[#E5E7EB]" style={{ borderLeft: '3px solid #D4AF37' }}>
                  <div className="text-[10px] font-semibold tracking-wider uppercase text-[#9EA8B5] mb-0.5">Rent under management</div>
                  <div className="flex items-baseline gap-3">
                    <div className="text-base font-semibold text-[#0D0D12]">€{rentRoll.toLocaleString()}<span className="text-xs font-normal text-[#6B7280]">/month</span></div>
                    <div className="text-xs text-[#6B7280] ml-auto">{tenantedCount} of {totalCount} tenanted</div>
                  </div>
                </div>
              )}

              <div className="relative mb-3">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#A0A8B0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </span>
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by address or tenant"
                  className="h-10 w-full pl-9 pr-3 bg-white border border-[#E5E7EB] rounded-lg text-sm text-[#0D0D12] focus:outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20"
                />
              </div>

              <div className="flex gap-2 mb-3 overflow-x-auto -mx-4 px-4 pb-1 [&::-webkit-scrollbar]:hidden">
                {pills.map((p) => {
                  const selected = filter === p.id;
                  return (
                    <button key={p.id} type="button" onClick={() => setFilter(p.id)} className="flex-shrink-0 h-8 px-3 rounded-full text-[12px] font-medium border transition-colors" style={selected ? { background: '#D4AF37', color: '#0D0D12', borderColor: '#D4AF37' } : { background: '#fff', color: '#6B7280', borderColor: '#E5E7EB' }}>
                      {p.label} ({p.n})
                    </button>
                  );
                })}
              </div>
              {cities.length > 1 && (
                <div className="flex gap-2 mb-3 overflow-x-auto -mx-4 px-4 pb-1 [&::-webkit-scrollbar]:hidden">
                  {(['all', ...cities] as string[]).map((c) => {
                    const selected = city === c;
                    return (
                      <button key={c} type="button" onClick={() => setCity(c)} className="flex-shrink-0 h-8 px-3 rounded-full text-[12px] font-medium border transition-colors" style={selected ? { background: '#D4AF37', color: '#0D0D12', borderColor: '#D4AF37' } : { background: '#fff', color: '#6B7280', borderColor: '#E5E7EB' }}>
                        {c === 'all' ? 'All locations' : c}
                      </button>
                    );
                  })}
                </div>
              )}

              {loading ? (
                <>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="bg-white border border-[#E5E7EB] rounded-xl p-4 mb-2 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-100 animate-pulse flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="h-4 bg-gray-100 rounded animate-pulse w-3/4 mb-2" />
                        <div className="h-3 bg-gray-100 rounded animate-pulse w-1/2" />
                      </div>
                      <div className="w-16 h-5 bg-gray-100 rounded animate-pulse" />
                    </div>
                  ))}
                </>
              ) : sorted.length === 0 ? (
                <p className="text-center text-sm text-[#A0A8B0] mt-8">No properties match these filters.</p>
              ) : (
                sorted.map((p) => {
                  const cat = categorise(p.status);
                  const ringPct = Math.max(0, Math.min(100, p.completenessScore));
                  const offset = 2 * Math.PI * 13 * (1 - ringPct / 100);
                  const pillStyle =
                    cat === 'tenanted' ? { background: '#FAF3DD', color: '#A47E1B' }
                    : cat === 'vacant' ? { background: '#FEF2F2', color: '#B91C1C' }
                    : cat === 'off_market' ? { background: '#E5E7EB', color: '#4B5563' }
                    : { background: '#F3F4F6', color: '#6B7280' };
                  const pillLabel = cat === 'tenanted' ? 'Tenanted' : cat === 'vacant' ? 'Vacant' : cat === 'off_market' ? 'Off-market' : 'Other';
                  return (
                    <Link key={p.id} href={`/agent/lettings/properties/${p.id}`} className="flex items-center gap-3 bg-white border border-[#E5E7EB] rounded-xl p-4 mb-2 no-underline">
                      <div className="relative w-8 h-8 flex-shrink-0">
                        <svg width="32" height="32" viewBox="0 0 32 32" className="-rotate-90">
                          <circle cx="16" cy="16" r="13" fill="none" stroke="#F3F4F6" strokeWidth="3" />
                          <circle cx="16" cy="16" r="13" fill="none" stroke="#D4AF37" strokeWidth="3" strokeLinecap="round" strokeDasharray={2 * Math.PI * 13} strokeDashoffset={offset} />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center text-[9px] font-semibold text-[#0D0D12]">{ringPct}</div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-[#0D0D12] truncate">{bestRowLabel(p)}</div>
                        <div className="text-xs text-[#6B7280] truncate">{p.activeTenancy?.tenantName || (cat === 'tenanted' ? 'Tenanted' : 'Vacant')}</div>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-full" style={pillStyle}>{pillLabel}</span>
                        {p.activeTenancy?.rentPcm != null && (
                          <span className="text-xs font-medium text-[#0D0D12]">€{Number(p.activeTenancy.rentPcm).toLocaleString()}/m</span>
                        )}
                      </div>
                    </Link>
                  );
                })
              )}
            </>
          )}
        </div>
      </div>
    </AgentShell>
  );
}
