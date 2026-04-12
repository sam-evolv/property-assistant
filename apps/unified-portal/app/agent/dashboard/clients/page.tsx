'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Search, X, CheckCircle, Zap, ChevronRight, ChevronDown, Building2 } from 'lucide-react';
import { useAgentDashboard } from '../layout-provider';

export const dynamic = 'force-dynamic';

const tokens = { gold: '#D4AF37', goldLight: '#F5D874', goldDark: '#B8934C', cream: '#fafaf8', dark: '#1a1a1a', success: '#22c55e', danger: '#ef4444' };

interface BuyerItem {
  id: string; unitNumber: string; developmentId: string; developmentName: string;
  bedrooms: number; status: string; purchaserName: string;
  prices: { sale?: number };
  dates: { saleAgreed?: string; deposit?: string; contractsIssued?: string; contractsSigned?: string; counterSigned?: string; drawdown?: string; handover?: string; estimatedClose?: string; };
}

type FilterTab = 'all' | 'active' | 'needs_followup' | 'complete';
type ViewMode = 'by_scheme' | 'all_buyers';

const fmtCurrency = (v?: number) => v ? new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v) : '\u2014';
const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' }) : '\u2014';
const getInitials = (name: string) => { const p = name.split(' ').filter(Boolean); return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : (p[0]?.[0] || '?').toUpperCase(); };
const isOverdue = (b: BuyerItem) => b.dates?.contractsIssued && !b.dates?.contractsSigned && new Date(b.dates.contractsIssued) < new Date(Date.now() - 21 * 86400000);
const getProgress = (b: BuyerItem) => { const steps = [b.dates?.saleAgreed, b.dates?.deposit, b.dates?.contractsIssued, b.dates?.contractsSigned, b.dates?.counterSigned, b.dates?.drawdown, b.dates?.handover]; return Math.round((steps.filter(Boolean).length / steps.length) * 100); };
const daysSince = (d?: string) => d ? Math.floor((Date.now() - new Date(d).getTime()) / 86400000) : 0;

const statusMap: Record<string, { bg: string; text: string; label: string }> = {
  agreed: { bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700', label: 'Agreed' },
  sale_agreed: { bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700', label: 'Sale Agreed' },
  in_progress: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', label: 'In Progress' },
  contracts_issued: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', label: 'Contracts Out' },
  signed: { bg: 'bg-purple-50 border-purple-200', text: 'text-purple-700', label: 'Signed' },
  contracts_signed: { bg: 'bg-purple-50 border-purple-200', text: 'text-purple-700', label: 'Signed' },
  sold: { bg: 'bg-green-50 border-green-200', text: 'text-green-700', label: 'Complete' },
  complete: { bg: 'bg-green-50 border-green-200', text: 'text-green-700', label: 'Complete' },
};

export default function AgentDashboardClientsPage() {
  const router = useRouter();
  const { selectedSchemeId, developments } = useAgentDashboard();
  const [buyers, setBuyers] = useState<BuyerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('by_scheme');
  const [selectedBuyer, setSelectedBuyer] = useState<BuyerItem | null>(null);
  const [expandedSchemes, setExpandedSchemes] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/agent/pipeline-data');
        if (!res.ok) return;
        const data = await res.json();
        // Include ALL pipeline items that have a purchaser name (even with status for_sale if they have a name)
        const allBuyers = (data.pipeline ?? []).filter((p: BuyerItem) =>
          p.purchaserName && p.purchaserName.trim() !== '' && p.status !== 'for_sale'
        );
        setBuyers(allBuyers);
        // Expand all schemes by default
        const schemeIds = new Set(allBuyers.map((b: BuyerItem) => b.developmentId));
        setExpandedSchemes(schemeIds);
      } catch {}
      setLoading(false);
    }
    fetchData();
  }, []);

  const filtered = useMemo(() => {
    let list = buyers;
    if (selectedSchemeId) list = list.filter(b => b.developmentId === selectedSchemeId);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(b =>
        b.purchaserName.toLowerCase().includes(q) ||
        b.unitNumber.toLowerCase().includes(q) ||
        b.developmentName.toLowerCase().includes(q)
      );
    }
    if (activeTab === 'active') list = list.filter(b => ['agreed', 'sale_agreed', 'in_progress', 'signed', 'contracts_issued', 'contracts_signed'].includes(b.status));
    if (activeTab === 'complete') list = list.filter(b => ['sold', 'complete'].includes(b.status));
    if (activeTab === 'needs_followup') list = list.filter(b => isOverdue(b));
    return list;
  }, [buyers, selectedSchemeId, search, activeTab]);

  const counts = useMemo(() => {
    const base = selectedSchemeId ? buyers.filter(b => b.developmentId === selectedSchemeId) : buyers;
    return {
      all: base.length,
      active: base.filter(b => ['agreed', 'sale_agreed', 'in_progress', 'signed', 'contracts_issued', 'contracts_signed'].includes(b.status)).length,
      needs_followup: base.filter(b => isOverdue(b)).length,
      complete: base.filter(b => ['sold', 'complete'].includes(b.status)).length,
    };
  }, [buyers, selectedSchemeId]);

  // Group buyers by development
  const groupedByScheme = useMemo(() => {
    const groups: Record<string, { id: string; name: string; buyers: BuyerItem[]; stats: { total: number; active: number; overdue: number; complete: number } }> = {};
    for (const b of filtered) {
      if (!groups[b.developmentId]) {
        groups[b.developmentId] = { id: b.developmentId, name: b.developmentName, buyers: [], stats: { total: 0, active: 0, overdue: 0, complete: 0 } };
      }
      const g = groups[b.developmentId];
      g.buyers.push(b);
      g.stats.total++;
      if (['agreed', 'sale_agreed', 'in_progress', 'signed', 'contracts_issued', 'contracts_signed'].includes(b.status)) g.stats.active++;
      if (['sold', 'complete'].includes(b.status)) g.stats.complete++;
      if (isOverdue(b)) g.stats.overdue++;
    }
    return Object.values(groups).sort((a, b) => b.stats.total - a.stats.total);
  }, [filtered]);

  const toggleScheme = (id: string) => {
    const next = new Set(expandedSchemes);
    if (next.has(id)) next.delete(id); else next.add(id);
    setExpandedSchemes(next);
  };

  if (loading) {
    return (
      <div className="min-h-full flex items-center justify-center" style={{ backgroundColor: tokens.cream }}>
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: tokens.gold, borderTopColor: 'transparent' }} />
      </div>
    );
  }

  function BuyerRow({ buyer }: { buyer: BuyerItem }) {
    const s = statusMap[buyer.status] || { bg: 'bg-gray-50 border-gray-200', text: 'text-gray-600', label: buyer.status };
    const overdue = isOverdue(buyer);
    const pct = getProgress(buyer);

    return (
      <tr
        onClick={() => setSelectedBuyer(buyer)}
        className={`group cursor-pointer transition-colors hover:bg-gray-50/50 ${overdue ? 'border-l-[3px] border-l-red-400' : ''}`}
      >
        <td className="px-5 py-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
              style={{ background: `linear-gradient(135deg, ${tokens.gold}, ${tokens.goldDark})` }}>
              {getInitials(buyer.purchaserName)}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{buyer.purchaserName}</p>
              {overdue && (
                <p className="text-[10px] text-red-600 font-medium">
                  Contracts overdue \u2014 {daysSince(buyer.dates?.contractsIssued)}d
                </p>
              )}
            </div>
          </div>
        </td>
        <td className="px-5 py-3 text-sm text-gray-600">{buyer.unitNumber}</td>
        <td className="px-5 py-3 text-sm text-gray-500">{buyer.bedrooms > 0 ? `${buyer.bedrooms} bed` : '\u2014'}</td>
        <td className="px-5 py-3">
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${s.bg} ${s.text}`}>{s.label}</span>
        </td>
        <td className="px-5 py-3 text-sm font-medium" style={{ color: buyer.prices?.sale ? tokens.goldDark : undefined }}>
          {fmtCurrency(buyer.prices?.sale)}
        </td>
        <td className="px-5 py-3 text-xs text-gray-500">
          {buyer.dates?.saleAgreed ? fmtDate(buyer.dates.saleAgreed) : '\u2014'}
        </td>
        <td className="px-5 py-3 w-24">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${tokens.gold}, ${tokens.goldDark})` }} />
            </div>
            <span className="text-[10px] font-semibold text-gray-500 w-7 text-right">{pct}%</span>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <div className="min-h-full flex" style={{ backgroundColor: tokens.cream }}>
      <div className="flex-1 min-w-0 p-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Clients & Buyers</h1>
            <p className="text-sm text-gray-500">{counts.all} buyers across {developments.length} schemes</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => router.push('/agent/dashboard/intelligence?prompt=Who are my most at-risk buyers right now?')}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 transition-colors">
              <Zap className="w-4 h-4" style={{ color: tokens.gold }} /> At-Risk Report
            </button>
          </div>
        </div>

        {/* Filters + View toggle */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="flex bg-gray-100 rounded-lg p-1 gap-0.5">
              {([
                { key: 'all' as FilterTab, label: `All (${counts.all})` },
                { key: 'active' as FilterTab, label: `Active (${counts.active})` },
                { key: 'needs_followup' as FilterTab, label: `Follow-up (${counts.needs_followup})` },
                { key: 'complete' as FilterTab, label: `Complete (${counts.complete})` },
              ]).map(t => (
                <button key={t.key} onClick={() => setActiveTab(t.key)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${activeTab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                  {t.label}
                </button>
              ))}
            </div>

            <div className="w-px h-6 bg-gray-200" />

            <div className="flex bg-gray-100 rounded-lg p-1 gap-0.5">
              <button onClick={() => setViewMode('by_scheme')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${viewMode === 'by_scheme' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                By Scheme
              </button>
              <button onClick={() => setViewMode('all_buyers')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${viewMode === 'all_buyers' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                All Buyers
              </button>
            </div>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input type="text" placeholder="Search buyers..." value={search} onChange={e => setSearch(e.target.value)}
              className="h-9 pl-9 pr-3 w-60 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gold-500 focus:ring-1 focus:ring-gold-500/30 bg-white" />
          </div>
        </div>

        {/* Content */}
        {viewMode === 'by_scheme' ? (
          /* ─── BY SCHEME VIEW ─── */
          <div className="space-y-4">
            {groupedByScheme.map(group => (
              <div key={group.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                {/* Scheme header */}
                <button
                  onClick={() => toggleScheme(group.id)}
                  className="w-full px-5 py-4 flex items-center gap-4 hover:bg-gray-50/50 transition-colors"
                >
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: `linear-gradient(135deg, ${tokens.gold}, ${tokens.goldDark})`, color: tokens.dark }}>
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-semibold text-gray-900">{group.name}</p>
                    <p className="text-xs text-gray-500">{group.stats.total} buyers</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-blue-600 font-semibold">{group.stats.active} active</span>
                      {group.stats.overdue > 0 && (
                        <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold text-white bg-red-500">
                          {group.stats.overdue}
                        </span>
                      )}
                      <span className="text-green-600 font-semibold">{group.stats.complete} complete</span>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${expandedSchemes.has(group.id) ? 'rotate-180' : ''}`} />
                  </div>
                </button>

                {/* Buyers table */}
                {expandedSchemes.has(group.id) && (
                  <div className="border-t border-gray-100">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-50">
                          {['Buyer', 'Unit', 'Type', 'Stage', 'Price', 'Agreed', 'Progress'].map(h => (
                            <th key={h} className="px-5 py-2.5 text-left text-[11px] font-semibold text-gray-600 uppercase tracking-wider">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {group.buyers.map(buyer => <BuyerRow key={buyer.id} buyer={buyer} />)}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}

            {groupedByScheme.length === 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center">
                <Users className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-900">No buyers found</p>
                <p className="text-xs text-gray-500 mt-1">Adjust your filters or search terms</p>
              </div>
            )}
          </div>
        ) : (
          /* ─── ALL BUYERS VIEW (flat table) ─── */
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50">
                  {['Buyer', 'Scheme', 'Unit', 'Stage', 'Price', 'Agreed', 'Progress'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(buyer => {
                  const s = statusMap[buyer.status] || { bg: 'bg-gray-50 border-gray-200', text: 'text-gray-600', label: buyer.status };
                  const overdue = isOverdue(buyer);
                  const pct = getProgress(buyer);
                  return (
                    <tr key={buyer.id} onClick={() => setSelectedBuyer(buyer)}
                      className={`group cursor-pointer transition-colors hover:bg-gray-50/50 ${overdue ? 'border-l-[3px] border-l-red-400' : ''}`}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                            style={{ background: `linear-gradient(135deg, ${tokens.gold}, ${tokens.goldDark})` }}>
                            {getInitials(buyer.purchaserName)}
                          </div>
                          <span className="text-sm font-medium text-gray-900">{buyer.purchaserName}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-sm text-gray-600">{buyer.developmentName}</td>
                      <td className="px-5 py-3 text-sm text-gray-500">{buyer.unitNumber}</td>
                      <td className="px-5 py-3"><span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${s.bg} ${s.text}`}>{s.label}</span></td>
                      <td className="px-5 py-3 text-sm font-medium" style={{ color: buyer.prices?.sale ? tokens.goldDark : undefined }}>{fmtCurrency(buyer.prices?.sale)}</td>
                      <td className="px-5 py-3 text-xs text-gray-500">{buyer.dates?.saleAgreed ? fmtDate(buyer.dates.saleAgreed) : '\u2014'}</td>
                      <td className="px-5 py-3 w-24">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${tokens.gold}, ${tokens.goldDark})` }} />
                          </div>
                          <span className="text-[10px] font-semibold text-gray-500 w-7 text-right">{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="px-6 py-16 text-center">
                <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No buyers found</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── Buyer slide-out panel ─── */}
      {selectedBuyer && (
        <div className="w-[360px] border-l border-gray-200 bg-white flex flex-col h-screen sticky top-0">
          <div className="p-5 border-b border-gray-100">
            <div className="flex justify-between items-start mb-3">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white text-sm font-bold"
                style={{ background: `linear-gradient(135deg, ${tokens.gold}, ${tokens.goldDark})` }}>
                {getInitials(selectedBuyer.purchaserName)}
              </div>
              <button onClick={() => setSelectedBuyer(null)} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <h3 className="text-base font-semibold text-gray-900">{selectedBuyer.purchaserName}</h3>
            <p className="text-sm text-gray-500">{selectedBuyer.developmentName} \u00B7 {selectedBuyer.unitNumber}</p>
            <div className="flex gap-2 mt-2">
              {selectedBuyer.bedrooms > 0 && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">{selectedBuyer.bedrooms} Bed</span>
              )}
              {(() => { const s = statusMap[selectedBuyer.status]; return s ? <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${s.bg} ${s.text}`}>{s.label}</span> : null; })()}
            </div>
          </div>

          {/* Progress */}
          <div className="px-5 py-3 border-b border-gray-100">
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-gray-500">Sale Progress</span>
              <span className="font-semibold text-gray-900">{getProgress(selectedBuyer)}%</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${getProgress(selectedBuyer)}%`, background: `linear-gradient(90deg, ${tokens.gold}, ${tokens.goldDark})` }} />
            </div>
          </div>

          {/* Meta */}
          <div className="grid grid-cols-3 px-5 py-3 border-b border-gray-100 gap-2">
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Price</p>
              <p className="text-sm font-semibold" style={{ color: tokens.dark }}>{fmtCurrency(selectedBuyer.prices?.sale)}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Est. Close</p>
              <p className="text-sm font-semibold" style={{ color: selectedBuyer.dates?.estimatedClose && new Date(selectedBuyer.dates.estimatedClose) < new Date() ? tokens.danger : tokens.dark }}>
                {fmtDate(selectedBuyer.dates?.estimatedClose)}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Days in Stage</p>
              <p className="text-sm font-semibold" style={{ color: tokens.dark }}>
                {selectedBuyer.dates?.contractsIssued && !selectedBuyer.dates?.contractsSigned
                  ? `${daysSince(selectedBuyer.dates.contractsIssued)}d`
                  : selectedBuyer.dates?.saleAgreed ? `${daysSince(selectedBuyer.dates.saleAgreed)}d` : '\u2014'}
              </p>
            </div>
          </div>

          {/* Timeline */}
          <div className="flex-1 overflow-y-auto px-5 py-3">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Timeline</p>
            {[
              { label: 'Sale Agreed', date: selectedBuyer.dates?.saleAgreed },
              { label: 'Deposit Received', date: selectedBuyer.dates?.deposit },
              { label: 'Contracts Issued', date: selectedBuyer.dates?.contractsIssued },
              { label: 'Contracts Signed', date: selectedBuyer.dates?.contractsSigned, overdueFlag: isOverdue(selectedBuyer) },
              { label: 'Counter Signed', date: selectedBuyer.dates?.counterSigned },
              { label: 'Drawdown', date: selectedBuyer.dates?.drawdown },
              { label: 'Handover Complete', date: selectedBuyer.dates?.handover },
            ].map(step => (
              <div key={step.label} className="flex items-start gap-3 py-2">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                  step.date ? 'bg-green-500' : step.overdueFlag ? 'bg-red-50 border-2 border-red-500' : 'bg-gray-200'
                }`}>
                  {step.date && <CheckCircle className="w-3 h-3 text-white" />}
                </div>
                <div>
                  <p className={`text-sm font-medium ${step.date ? 'text-gray-900' : 'text-gray-400'}`}>{step.label}</p>
                  <p className={`text-xs ${step.overdueFlag && !step.date ? 'text-red-600 font-medium' : 'text-gray-400'}`}>
                    {step.date ? fmtDate(step.date) : step.overdueFlag ? `Overdue \u2014 ${daysSince(selectedBuyer.dates?.contractsIssued)}d` : '\u2014'}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Chase button */}
          {isOverdue(selectedBuyer) && (
            <div className="px-5 py-4 bg-amber-50 border-t border-amber-200">
              <p className="text-xs text-amber-800 mb-2">
                Contracts issued {daysSince(selectedBuyer.dates?.contractsIssued)} days ago. No signed copy received.
              </p>
              <button
                onClick={() => router.push(`/agent/dashboard/intelligence?prompt=${encodeURIComponent(`Chase solicitor for ${selectedBuyer.purchaserName} on ${selectedBuyer.unitNumber} in ${selectedBuyer.developmentName}. Contracts issued ${daysSince(selectedBuyer.dates?.contractsIssued)} days ago.`)}`)}
                className="w-full py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all hover:shadow-md"
                style={{ background: `linear-gradient(135deg, ${tokens.gold}, ${tokens.goldDark})` }}>
                <Zap className="w-4 h-4" /> Chase with Intelligence
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
