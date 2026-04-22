'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Building2,
  Clock,
  TrendingUp,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  ChevronLeft,
  ArrowLeft,
  X,
  Zap,
  FileDown,
  BarChart3,
} from 'lucide-react';
import { useAgentDashboard } from '../layout-provider';

export const dynamic = 'force-dynamic';

const tokens = {
  gold: '#D4AF37',
  goldLight: '#F5D874',
  goldDark: '#B8934C',
  dark: '#1a1a1a',
  cream: '#fafaf8',
  warmGray: '#f7f6f3',
  success: '#22c55e',
  danger: '#ef4444',
};

// Flat shape returned by /api/agent/pipeline-data. Matches the developer-
// side pipeline keys so both surfaces share formatting + progress helpers.
interface PipelineItem {
  id: string;
  unitId: string;
  unitNumber: string;
  unitAddress?: string;
  developmentId: string;
  developmentName: string;
  bedrooms: number | null;
  status: string;
  pipelineStatusRaw?: string;
  purchaserName: string | null;
  purchaserEmail?: string | null;
  purchaserPhone?: string | null;
  salePrice: number | null;
  releaseDate: string | null;
  saleAgreedDate: string | null;
  depositDate: string | null;
  contractsIssuedDate: string | null;
  signedContractsDate: string | null;
  counterSignedDate: string | null;
  kitchenDate: string | null;
  snagDate: string | null;
  drawdownDate: string | null;
  estimatedCloseDate: string | null;
  handoverDate: string | null;
  mortgageExpiryDate?: string | null;
}

type StatusFilter = 'all' | 'for_sale' | 'agreed' | 'contracts' | 'signed' | 'complete';

const fmtDate = (d?: string | null) => d ? new Date(d).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' }) : null;
const fmtCurrency = (v?: number | null) => (v && v > 0) ? new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v) : '\u2014';
const fmtCompact = (v: number | null | undefined) => {
  if (!v || v <= 0) return '\u2014';
  if (v >= 1000000) return `\u20AC${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `\u20AC${Math.round(v / 1000).toLocaleString('en-IE')}K`;
  return fmtCurrency(v);
};

function isOverdue(p: PipelineItem) {
  return !!(p.contractsIssuedDate && !p.signedContractsDate && new Date(p.contractsIssuedDate) < new Date(Date.now() - 21 * 86400000));
}
function daysSince(d?: string | null) { return d ? Math.floor((Date.now() - new Date(d).getTime()) / 86400000) : 0; }
// Milestone weighting mirrors the developer-side order: release, sale_agreed,
// deposit, contracts_issued, signed, counter_signed, kitchen, drawdown, handover.
function getProgress(p: PipelineItem) {
  const steps = [
    p.releaseDate,
    p.saleAgreedDate,
    p.depositDate,
    p.contractsIssuedDate,
    p.signedContractsDate,
    p.counterSignedDate,
    p.kitchenDate,
    p.drawdownDate,
    p.handoverDate,
  ];
  return Math.round((steps.filter(Boolean).length / steps.length) * 100);
}
function getInitials(name: string) { const p = name.split(' ').filter(Boolean); return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : (p[0]?.[0] || '?').toUpperCase(); }

// ─── Stat Card (local, matching developer pipeline) ───
function StatCard({ icon, iconBg, iconColor, label, value, subtitle }: { icon: React.ReactNode; iconBg: string; iconColor: string; label: string; value: number | string; subtitle?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 transition-all duration-200 hover:shadow-lg hover:border-gray-200">
      <div className="mb-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: iconBg, color: iconColor }}>
          {icon}
        </div>
      </div>
      <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">{label}</p>
      <p className="text-3xl font-bold mt-1" style={{ color: tokens.dark }}>{value}</p>
      {subtitle && <p className="text-xs text-gray-500 mt-3">{subtitle}</p>}
    </div>
  );
}

export default function AgentDashboardPipelinePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { developments, selectedSchemeId, setSelectedSchemeId } = useAgentDashboard();

  const [pipeline, setPipeline] = useState<PipelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSchemeId, setActiveSchemeId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedUnit, setSelectedUnit] = useState<PipelineItem | null>(null);

  useEffect(() => {
    const schemeParam = searchParams.get('scheme');
    if (schemeParam) setActiveSchemeId(schemeParam);
    else if (selectedSchemeId) setActiveSchemeId(selectedSchemeId);
  }, [searchParams, selectedSchemeId]);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/agent/pipeline-data');
        if (!res.ok) return;
        const data = await res.json();
        setPipeline(data.pipeline ?? []);
      } catch {}
      setLoading(false);
    }
    fetchData();
  }, []);

  // ─── Derive development list from pipeline data (works even if context is empty) ───
  const derivedDevelopments = useMemo(() => {
    // Use context developments if available, otherwise derive from pipeline data
    if (developments.length > 0) return developments;
    const map = new Map<string, { id: string; name: string }>();
    for (const p of pipeline) {
      if (p.developmentId && !map.has(p.developmentId)) {
        map.set(p.developmentId, { id: p.developmentId, name: p.developmentName || 'Unknown' });
      }
    }
    return Array.from(map.values());
  }, [pipeline, developments]);

  // ─── Level 1: All Developments ───
  const devStats = useMemo(() => {
    return derivedDevelopments.map(d => {
      const items = pipeline.filter(p => p.developmentId === d.id);
      const available = items.filter(p => p.status === 'for_sale').length;
      const complete = items.filter(p => p.status === 'sold').length;
      // Everything between for_sale and handed_over. sale_agreed / contracts_issued / signed all count.
      const inProgress = items.filter(p => p.status !== 'for_sale' && p.status !== 'sold').length;
      const overdue = items.filter(p => isOverdue(p)).length;
      return { ...d, total: items.length, available, inProgress, complete, overdue };
    });
  }, [pipeline, derivedDevelopments]);

  const aggregateStats = useMemo(() => devStats.reduce((acc, d) => ({
    total: acc.total + d.total, available: acc.available + d.available,
    inProgress: acc.inProgress + d.inProgress, complete: acc.complete + d.complete, overdue: acc.overdue + d.overdue,
  }), { total: 0, available: 0, inProgress: 0, complete: 0, overdue: 0 }), [devStats]);

  // ─── Level 2: Single Scheme ───
  const schemeItems = useMemo(() => {
    if (!activeSchemeId) return [];
    let items = pipeline.filter(p => p.developmentId === activeSchemeId);
    if (statusFilter === 'for_sale') items = items.filter(p => p.status === 'for_sale');
    else if (statusFilter === 'agreed') items = items.filter(p => p.status === 'sale_agreed');
    else if (statusFilter === 'contracts') items = items.filter(p => p.status === 'contracts_issued' || isOverdue(p));
    else if (statusFilter === 'signed') items = items.filter(p => p.status === 'signed');
    else if (statusFilter === 'complete') items = items.filter(p => p.status === 'sold');
    return items;
  }, [pipeline, activeSchemeId, statusFilter]);

  const schemeName = derivedDevelopments.find(d => d.id === activeSchemeId)?.name || '';
  const schemeTotal = activeSchemeId ? pipeline.filter(p => p.developmentId === activeSchemeId) : [];
  const schemeAgg = (() => {
    const total = schemeTotal.length;
    const available = schemeTotal.filter(p => p.status === 'for_sale').length;
    const complete = schemeTotal.filter(p => p.status === 'sold').length;
    const inProgress = schemeTotal.filter(p => p.status !== 'for_sale' && p.status !== 'sold').length;
    // Revenue = committed sales: sale_agreed / signed / sold.
    const committedStatuses = new Set(['sale_agreed', 'contracts_issued', 'signed', 'sold']);
    const revenue = schemeTotal
      .filter(p => committedStatuses.has(p.status) && p.salePrice)
      .reduce((s, p) => s + (p.salePrice || 0), 0);
    // Avg price = mean of all units with a sale_price recorded.
    const priced = schemeTotal.filter(p => p.salePrice && p.salePrice > 0);
    const avgPrice = priced.length > 0
      ? priced.reduce((s, p) => s + (p.salePrice || 0), 0) / priced.length
      : 0;
    return { total, available, inProgress, complete, revenue, avgPrice };
  })();

  if (loading) {
    return (
      <div className="min-h-full flex items-center justify-center" style={{ backgroundColor: tokens.cream }}>
        <div className="text-center">
          <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin mx-auto" style={{ borderColor: tokens.gold, borderTopColor: 'transparent' }} />
          <p className="text-sm text-gray-500 mt-3">Loading pipeline...</p>
        </div>
      </div>
    );
  }

  // ═══ LEVEL 2: Scheme Detail ═══
  if (activeSchemeId) {
    return (
      <div className="min-h-full" style={{ backgroundColor: tokens.cream }}>
        <div className="flex" >
          <div className="flex-1 min-w-0 p-8">
            {/* Back + Header */}
            <button onClick={() => { setActiveSchemeId(null); setSelectedUnit(null); }} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4 transition-colors">
              <ArrowLeft className="w-4 h-4" /> Back to all schemes
            </button>
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-2xl font-bold" style={{ color: tokens.dark }}>{schemeName}</h1>
                <p className="text-sm text-gray-500 mt-0.5">Sales pipeline \u00B7 {schemeAgg.total} units</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => router.push(`/agent/dashboard/intelligence?prompt=${encodeURIComponent(`Draft chasing emails for all overdue contracts in ${schemeName}`)}`)} className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-gold-500 text-white hover:bg-gold-600 transition-all shadow-sm">
                  <Zap className="w-4 h-4" /> Chase Overdue
                </button>
              </div>
            </div>

            {/* Stat strip */}
            <div className="grid grid-cols-6 gap-4 mb-6">
              {[
                { label: 'Total Units', value: schemeAgg.total, iconBg: '#fef3c7', iconColor: tokens.gold, icon: <Building2 className="w-5 h-5" /> },
                { label: 'Available', value: schemeAgg.available, iconBg: '#fef3c7', iconColor: '#d97706', icon: <Clock className="w-5 h-5" /> },
                { label: 'In Progress', value: schemeAgg.inProgress, iconBg: '#dbeafe', iconColor: '#2563eb', icon: <TrendingUp className="w-5 h-5" /> },
                { label: 'Complete', value: schemeAgg.complete, iconBg: '#dcfce7', iconColor: '#16a34a', icon: <CheckCircle className="w-5 h-5" /> },
                { label: 'Total Revenue', value: fmtCurrency(schemeAgg.revenue), iconBg: '#fef3c7', iconColor: tokens.gold, icon: <TrendingUp className="w-5 h-5" /> },
                { label: 'Avg Price', value: fmtCurrency(schemeAgg.avgPrice), iconBg: '#f3e8ff', iconColor: '#7c3aed', icon: <Building2 className="w-5 h-5" /> },
              ].map(s => <StatCard key={s.label} {...s} />)}
            </div>

            {/* Status filters */}
            <div className="flex items-center gap-2 mb-4">
              {([
                { key: 'all', label: 'All Status' },
                { key: 'for_sale', label: 'For Sale' },
                { key: 'agreed', label: 'Sale Agreed' },
                { key: 'contracts', label: 'Contracts' },
                { key: 'signed', label: 'Signed' },
                { key: 'complete', label: 'Complete' },
              ] as { key: StatusFilter; label: string }[]).map(f => (
                <button key={f.key} onClick={() => setStatusFilter(f.key)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${statusFilter === f.key ? 'bg-white text-gray-900 shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700'}`}>
                  {f.label}
                </button>
              ))}
              <span className="ml-auto text-xs text-gray-400">{schemeItems.length} units</span>
            </div>

            {/* Milestone table */}
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full" style={{ minWidth: 1100 }}>
                  <thead>
                    <tr style={{ backgroundColor: `${tokens.warmGray}cc` }}>
                      {['Unit / Purchaser', 'Price', 'Agreed', 'Deposit', 'Contracts', 'Signed', 'Counter', 'Drawdown', 'Handover', 'Progress', 'Est. Close'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {schemeItems.map(p => {
                      const overdue = isOverdue(p);
                      const pct = getProgress(p);
                      const estPast = p.estimatedCloseDate && new Date(p.estimatedCloseDate) < new Date();
                      return (
                        <tr key={p.id} onClick={() => setSelectedUnit(p)}
                          className={`group cursor-pointer transition-colors hover:bg-gray-50/50 ${overdue ? 'border-l-[3px] border-l-red-400' : ''}`}>
                          <td className="px-4 py-3 min-w-[180px]">
                            <p className="text-sm font-semibold" style={{ color: tokens.dark }}>{p.unitNumber}</p>
                            <p className="text-xs text-gray-500 truncate max-w-[160px]">{p.purchaserName || '\u2014'}</p>
                          </td>
                          <td className="px-4 py-3 text-sm font-medium" style={{ color: p.salePrice ? tokens.goldDark : undefined }}>{fmtCurrency(p.salePrice)}</td>
                          {[p.saleAgreedDate, p.depositDate, p.contractsIssuedDate, p.signedContractsDate, p.counterSignedDate, p.drawdownDate, p.handoverDate].map((d, idx) => {
                            const isPending = idx === 3 && !d && p.contractsIssuedDate;
                            return (
                              <td key={idx} className="px-3 py-3 whitespace-nowrap">
                                {d ? (
                                  <span className="inline-flex items-center gap-1.5 text-xs">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                                    <span className="text-gray-700">{fmtDate(d)}</span>
                                  </span>
                                ) : isPending ? (
                                  <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">Pending</span>
                                ) : (
                                  <span className="text-gray-300">—</span>
                                )}
                              </td>
                            );
                          })}
                          <td className="px-3 py-3 w-20">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${tokens.gold}, ${tokens.goldLight})` }} />
                              </div>
                              <span className="text-[10px] font-semibold text-gray-500 w-7 text-right">{pct}%</span>
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            {p.estimatedCloseDate ? (
                              <span className={`text-[11px] font-semibold px-2 py-1 rounded-md ${estPast ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
                                {fmtDate(p.estimatedCloseDate)}
                              </span>
                            ) : <span className="text-gray-300">—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {schemeItems.length === 0 && (
                <div className="px-6 py-16 text-center">
                  <Building2 className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No units match the current filter</p>
                </div>
              )}
            </div>
          </div>

          {/* Buyer slide-out */}
          {selectedUnit && (
            <div className="w-[360px] border-l border-gray-200 bg-white flex flex-col h-screen sticky top-0">
              <div className="p-5 border-b border-gray-100">
                <div className="flex justify-between items-start mb-3">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white text-sm font-bold"
                    style={{ background: `linear-gradient(135deg, ${tokens.gold}, ${tokens.goldDark})` }}>
                    {selectedUnit.purchaserName ? getInitials(selectedUnit.purchaserName) : '?'}
                  </div>
                  <button onClick={() => setSelectedUnit(null)} className="p-1 rounded-lg hover:bg-gray-100 transition-colors"><X className="w-4 h-4 text-gray-400" /></button>
                </div>
                <h3 className="text-base font-semibold text-gray-900">{selectedUnit.purchaserName || 'No buyer assigned'}</h3>
                <p className="text-sm text-gray-500">{selectedUnit.developmentName} \u00B7 {selectedUnit.unitNumber}</p>
                {(selectedUnit.bedrooms ?? 0) > 0 && (
                  <span className="inline-block mt-2 text-xs font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">{selectedUnit.bedrooms} Bed</span>
                )}
              </div>

              <div className="px-5 py-3 border-b border-gray-100">
                <div className="flex justify-between text-xs mb-1.5"><span className="text-gray-500">Sale Progress</span><span className="font-semibold text-gray-900">{getProgress(selectedUnit)}%</span></div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${getProgress(selectedUnit)}%`, background: `linear-gradient(90deg, ${tokens.gold}, ${tokens.goldLight})` }} />
                </div>
              </div>

              <div className="grid grid-cols-3 px-5 py-3 border-b border-gray-100 gap-2">
                {[
                  { label: 'Est. Close', value: fmtDate(selectedUnit.estimatedCloseDate) || '\u2014', color: selectedUnit.estimatedCloseDate && new Date(selectedUnit.estimatedCloseDate) < new Date() ? '#dc2626' : undefined },
                  { label: 'Days in Stage', value: selectedUnit.contractsIssuedDate && !selectedUnit.signedContractsDate ? `${daysSince(selectedUnit.contractsIssuedDate)}d` : '\u2014' },
                  { label: 'Price', value: fmtCurrency(selectedUnit.salePrice) },
                ].map(m => (
                  <div key={m.label}>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">{m.label}</p>
                    <p className="text-sm font-semibold" style={{ color: m.color || tokens.dark }}>{m.value}</p>
                  </div>
                ))}
              </div>

              {/* Timeline */}
              <div className="flex-1 overflow-y-auto px-5 py-3">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Timeline</p>
                {[
                  { label: 'Sale Agreed', date: selectedUnit.saleAgreedDate },
                  { label: 'Deposit Received', date: selectedUnit.depositDate },
                  { label: 'Contracts Issued', date: selectedUnit.contractsIssuedDate },
                  { label: 'Contracts Signed', date: selectedUnit.signedContractsDate, overdueFlag: isOverdue(selectedUnit) },
                  { label: 'Counter Signed', date: selectedUnit.counterSignedDate },
                  { label: 'Drawdown', date: selectedUnit.drawdownDate },
                  { label: 'Handover Complete', date: selectedUnit.handoverDate },
                ].map(step => (
                  <div key={step.label} className="flex items-start gap-3 py-2">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${step.date ? 'bg-green-500' : step.overdueFlag ? 'bg-red-50 border-2 border-red-500' : 'bg-gray-200'}`}>
                      {step.date && <CheckCircle className="w-3 h-3 text-white" />}
                    </div>
                    <div>
                      <p className={`text-sm font-medium ${step.date ? 'text-gray-900' : 'text-gray-400'}`}>{step.label}</p>
                      <p className={`text-xs ${step.overdueFlag && !step.date ? 'text-red-600' : 'text-gray-400'}`}>
                        {step.date ? fmtDate(step.date) : step.overdueFlag ? `Overdue \u2014 ${daysSince(selectedUnit.contractsIssuedDate)}d` : '\u2014'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {isOverdue(selectedUnit) && (
                <div className="px-5 py-4 bg-amber-50 border-t border-amber-200">
                  <p className="text-xs text-amber-800 mb-2">Contracts issued {daysSince(selectedUnit.contractsIssuedDate)} days ago. No signed copy received.</p>
                  <button onClick={() => router.push(`/agent/dashboard/intelligence?prompt=${encodeURIComponent(`Chase solicitor for ${selectedUnit.purchaserName} on ${selectedUnit.unitNumber} in ${selectedUnit.developmentName}. Contracts issued ${daysSince(selectedUnit.contractsIssuedDate)} days ago.`)}`)}
                    className="w-full py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all hover:shadow-md"
                    style={{ background: `linear-gradient(135deg, ${tokens.gold}, ${tokens.goldDark})` }}>
                    <Zap className="w-4 h-4" /> Chase with Intelligence
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ═══ LEVEL 1: All Developments ═══
  return (
    <div className="min-h-full" style={{ backgroundColor: tokens.cream }}>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold" style={{ color: tokens.dark }}>Sales Pipeline</h1>
          <p className="text-sm text-gray-500 mt-0.5">{derivedDevelopments.length} development{derivedDevelopments.length !== 1 ? 's' : ''} \u00B7 {aggregateStats.total} total units</p>
        </div>

        <div className="grid grid-cols-5 gap-5 mb-8">
          <StatCard icon={<Building2 className="w-5 h-5" />} iconBg="#fef3c7" iconColor={tokens.gold} label="Total Units" value={aggregateStats.total} />
          <StatCard icon={<Clock className="w-5 h-5" />} iconBg="#fef3c7" iconColor="#d97706" label="Available" value={aggregateStats.available} subtitle="Ready for sale" />
          <StatCard icon={<TrendingUp className="w-5 h-5" />} iconBg="#dbeafe" iconColor="#2563eb" label="In Progress" value={aggregateStats.inProgress} />
          <StatCard icon={<CheckCircle className="w-5 h-5" />} iconBg="#dcfce7" iconColor="#16a34a" label="Complete" value={aggregateStats.complete} />
          <StatCard icon={<AlertCircle className="w-5 h-5" />} iconBg="#fee2e2" iconColor="#dc2626" label="Overdue" value={aggregateStats.overdue} subtitle={aggregateStats.overdue > 0 ? 'Contracts outstanding' : 'All on track'} />
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold" style={{ color: tokens.dark }}>All Developments</h2>
              <span className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">{derivedDevelopments.length} developments</span>
            </div>
            <button onClick={() => router.push('/agent/dashboard/analytics')}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition-all hover:shadow-md"
              style={{ backgroundColor: tokens.gold, color: tokens.dark }}>
              <BarChart3 className="w-4 h-4" /> Analysis
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: `${tokens.warmGray}80` }}>
                  {['Development', 'Available', 'In Progress', 'Complete', 'Overdue', 'Progress', ''].map(h => (
                    <th key={h || 'action'} className={`px-6 py-3 ${h === 'Development' || h === 'Progress' ? 'text-left' : h ? 'text-center' : ''} text-xs font-semibold text-gray-600 uppercase tracking-wider ${h === 'Progress' ? 'w-48' : ''}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {devStats.map(dev => {
                  const pct = dev.total > 0 ? Math.round((dev.complete / dev.total) * 100) : 0;
                  return (
                    <tr key={dev.id} onClick={() => setActiveSchemeId(dev.id)} className="group cursor-pointer transition-colors hover:bg-gray-50/50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${tokens.gold} 0%, ${tokens.goldDark} 100%)`, color: tokens.dark }}>
                            <Building2 className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold" style={{ color: tokens.dark }}>{dev.name}</p>
                            <p className="text-xs text-gray-500">{dev.total} units</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center text-sm font-medium text-gray-600">{dev.available}</td>
                      <td className="px-6 py-4 text-center text-sm font-medium" style={{ color: tokens.gold }}>{dev.inProgress}</td>
                      <td className="px-6 py-4 text-center text-sm font-medium" style={{ color: tokens.success }}>{dev.complete}</td>
                      <td className="px-6 py-4 text-center">
                        {dev.overdue > 0 ? (
                          <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 rounded-full text-xs font-bold text-white" style={{ backgroundColor: tokens.danger }}>{dev.overdue}</span>
                        ) : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {pct > 0 && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: tokens.gold }} />}
                          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${tokens.gold} 0%, ${tokens.goldLight} 100%)` }} />
                          </div>
                          <span className="text-xs font-semibold text-gray-500 w-10 text-right">{pct}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4"><div className="flex justify-end"><ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: tokens.gold }} /></div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {devStats.length === 0 && (
              <div className="px-6 py-16 text-center">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: tokens.warmGray }}><Building2 className="w-6 h-6 text-gray-400" /></div>
                <p className="text-sm font-medium" style={{ color: tokens.dark }}>No developments yet</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
