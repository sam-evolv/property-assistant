'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, AlertTriangle, Zap } from 'lucide-react';
import { useAgentDashboard } from '../layout-provider';

export const dynamic = 'force-dynamic';
const tokens = { gold: '#D4AF37', goldLight: '#F5D874', goldDark: '#B8934C', cream: '#fafaf8', dark: '#1a1a1a', success: '#22c55e', danger: '#ef4444' };

interface PipelineItem {
  id: string; unitNumber: string; developmentId: string; developmentName: string; bedrooms: number; status: string; purchaserName: string;
  prices: { sale?: number };
  dates: { saleAgreed?: string; deposit?: string; contractsIssued?: string; contractsSigned?: string; counterSigned?: string; drawdown?: string; handover?: string; estimatedClose?: string; };
}

type Tab = 'overview' | 'velocity' | 'funnel' | 'risk' | 'revenue' | 'pricing';

const fmtCurrency = (v: number) => new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
const fmtShort = (v: number) => { if (v >= 1e6) return `\u20AC${(v / 1e6).toFixed(1)}M`; if (v >= 1e3) return `\u20AC${Math.round(v / 1e3)}K`; return fmtCurrency(v); };
const daysBetween = (a?: string, b?: string) => { if (!a || !b) return null; return Math.max(0, Math.floor((new Date(b).getTime() - new Date(a).getTime()) / 86400000)); };
const avg = (arr: number[]) => arr.length > 0 ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length) : 0;
const isOverdue = (p: PipelineItem) => p.dates?.contractsIssued && !p.dates?.contractsSigned && new Date(p.dates.contractsIssued) < new Date(Date.now() - 21 * 86400000);

function KPI({ label, value, color }: { label: string; value: string; color?: string }) {
  return (<div className="bg-white rounded-2xl border border-gray-100 p-5 transition-all hover:shadow-lg hover:border-gray-200">
    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">{label}</p>
    <p className="text-2xl font-bold mt-1" style={{ color: color || tokens.dark }}>{value}</p>
  </div>);
}

function HBar({ label, value, max, color }: { label: string; value: number; max: number; color?: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (<div className="flex items-center gap-3 mb-2">
    <span className="w-28 text-xs text-gray-500 text-right flex-shrink-0">{label}</span>
    <div className="flex-1 h-6 bg-gray-100 rounded-md overflow-hidden"><div className="h-full rounded-md" style={{ width: `${pct}%`, background: color || `linear-gradient(90deg, ${tokens.gold}, ${tokens.goldLight})` }} /></div>
    <span className="w-8 text-sm font-semibold text-gray-900 text-right">{value}</span>
  </div>);
}

export default function AgentDashboardAnalyticsPage() {
  const router = useRouter();
  const { selectedSchemeId, developments } = useAgentDashboard();
  const [pipeline, setPipeline] = useState<PipelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('overview');

  useEffect(() => { (async () => { try { const res = await fetch('/api/agent/pipeline-data'); if (res.ok) { const data = await res.json(); setPipeline(data.pipeline ?? []); } } catch {} setLoading(false); })(); }, []);

  const data = useMemo(() => selectedSchemeId ? pipeline.filter(p => p.developmentId === selectedSchemeId) : pipeline, [pipeline, selectedSchemeId]);
  const sold = data.filter(p => ['sold', 'complete'].includes(p.status));
  const active = data.filter(p => ['agreed', 'sale_agreed', 'in_progress', 'signed', 'contracts_issued', 'contracts_signed'].includes(p.status));
  const overdue = data.filter(p => isOverdue(p));
  const revenueSold = sold.reduce((s, p) => s + (p.prices?.sale || 0), 0);
  const pipelineValue = active.reduce((s, p) => s + (p.prices?.sale || 0), 0);
  const overdueValue = overdue.reduce((s, p) => s + (p.prices?.sale || 0), 0);

  const funnel = [{ label: 'Released', count: data.length }, { label: 'Agreed', count: data.filter(p => p.dates?.saleAgreed).length }, { label: 'Deposit', count: data.filter(p => p.dates?.deposit).length }, { label: 'Contracts', count: data.filter(p => p.dates?.contractsIssued).length }, { label: 'Signed', count: data.filter(p => p.dates?.contractsSigned).length }, { label: 'Counter', count: data.filter(p => p.dates?.counterSigned).length }, { label: 'Drawdown', count: data.filter(p => p.dates?.drawdown).length }, { label: 'Handover', count: data.filter(p => p.dates?.handover).length }];
  const maxFunnel = Math.max(...funnel.map(f => f.count), 1);

  const velItems = data.filter(p => p.dates?.saleAgreed);
  const avgA2C = avg(velItems.filter(p => p.dates?.contractsIssued).map(p => daysBetween(p.dates?.saleAgreed, p.dates?.contractsIssued)!).filter(d => d >= 0));
  const avgC2S = avg(velItems.filter(p => p.dates?.contractsSigned).map(p => daysBetween(p.dates?.contractsIssued, p.dates?.contractsSigned)!).filter(d => d >= 0));
  const critical = overdue.filter(p => daysBetween(p.dates?.contractsIssued, new Date().toISOString())! > 45);
  const high = overdue.filter(p => { const d = daysBetween(p.dates?.contractsIssued, new Date().toISOString())!; return d > 30 && d <= 45; });

  const priced = data.filter(p => p.prices?.sale);
  const avgPrice = priced.length > 0 ? priced.reduce((s, p) => s + (p.prices.sale || 0), 0) / priced.length : 0;
  const schemeComparison = developments.map(d => { const items = data.filter(p => p.developmentId === d.id); const s = items.filter(p => ['sold', 'complete'].includes(p.status)); const a = items.filter(p => !['sold', 'complete', 'for_sale'].includes(p.status)); const o = items.filter(p => isOverdue(p)); const rev = items.reduce((sum, p) => sum + (p.prices?.sale || 0), 0); return { name: d.name, total: items.length, sold: s.length, active: a.length, overdue: o.length, revenue: rev, pct: items.length > 0 ? Math.round((s.length / items.length) * 100) : 0 }; });

  const tabs: { key: Tab; label: string }[] = [{ key: 'overview', label: 'Overview' }, { key: 'velocity', label: 'Sales Velocity' }, { key: 'funnel', label: 'Pipeline Funnel' }, { key: 'risk', label: 'Risk Register' }, { key: 'revenue', label: 'Revenue & Forecast' }, { key: 'pricing', label: 'Pricing Analysis' }];

  if (loading) return <div className="min-h-full flex items-center justify-center" style={{ backgroundColor: tokens.cream }}><div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: tokens.gold, borderTopColor: 'transparent' }} /></div>;

  return (
    <div className="min-h-full" style={{ backgroundColor: tokens.cream }}>
      <div className="p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Analytics</h1>

        <div className="flex items-center gap-0 mb-6 border-b border-gray-200">
          {tabs.map(t => (<button key={t.key} onClick={() => setTab(t.key)} className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 ${tab === t.key ? 'border-gold-500 text-gold-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{t.label}</button>))}
        </div>

        {tab === 'overview' && (<>
          <div className="grid grid-cols-5 gap-4 mb-6">
            <KPI label="Units Sold" value={String(sold.length)} color={tokens.success} />
            <KPI label="Active" value={String(active.length)} color="#2563eb" />
            <KPI label="Overdue" value={String(overdue.length)} color={overdue.length > 0 ? tokens.danger : tokens.success} />
            <KPI label="Revenue" value={fmtShort(revenueSold)} />
            <KPI label="Pipeline" value={fmtShort(pipelineValue)} />
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100"><h3 className="text-sm font-semibold text-gray-900">Scheme Comparison</h3></div>
            <table className="w-full"><thead><tr className="bg-gray-50">{['Scheme', 'Total', 'Sold', 'Active', 'Overdue', 'Revenue', '% Complete'].map(h => <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-gray-50">{schemeComparison.map(s => (
                <tr key={s.name} className="hover:bg-gray-50/50">
                  <td className="px-5 py-3 text-sm font-medium text-gray-900">{s.name}</td>
                  <td className="px-5 py-3 text-sm text-gray-600">{s.total}</td>
                  <td className="px-5 py-3 text-sm font-medium text-green-600">{s.sold}</td>
                  <td className="px-5 py-3 text-sm font-medium" style={{ color: tokens.gold }}>{s.active}</td>
                  <td className="px-5 py-3">{s.overdue > 0 ? <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-700">{s.overdue}</span> : <span className="text-gray-400">\u2014</span>}</td>
                  <td className="px-5 py-3 text-sm text-gray-900">{fmtShort(s.revenue)}</td>
                  <td className="px-5 py-3 w-32"><div className="flex items-center gap-2"><div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${s.pct}%`, background: `linear-gradient(90deg, ${tokens.gold}, ${tokens.goldLight})` }} /></div><span className="text-xs font-semibold text-gray-500">{s.pct}%</span></div></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </>)}

        {tab === 'velocity' && (<>
          <div className="grid grid-cols-4 gap-4 mb-6">
            <KPI label="Avg Agreed\u2192Contracts" value={`${avgA2C}d`} />
            <KPI label="Avg Contracts\u2192Signed" value={`${avgC2S}d`} color={avgC2S > 30 ? tokens.danger : undefined} />
            <KPI label="Total Pipeline Items" value={String(velItems.length)} />
            <KPI label="Signed Contracts" value={String(data.filter(p => p.dates?.contractsSigned).length)} color={tokens.success} />
          </div>
          {avgC2S > 30 && <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 mb-6 flex items-center gap-3"><AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" /><p className="text-sm text-amber-800">Average contract-to-signature time is {avgC2S} days, above the 28-day target.</p></div>}
        </>)}

        {tab === 'funnel' && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Combined Funnel</h3>
            {funnel.map((stage, i) => { const prev = i > 0 ? funnel[i - 1].count : stage.count; const drop = prev > 0 && i > 0 ? Math.round(((prev - stage.count) / prev) * 100) : 0; return (
              <div key={stage.label} className="flex items-center gap-3 mb-2">
                <span className="w-28 text-xs text-gray-500 text-right flex-shrink-0">{stage.label}</span>
                <div className="flex-1 h-7 bg-gray-100 rounded-md overflow-hidden"><div className="h-full rounded-md" style={{ width: `${maxFunnel > 0 ? (stage.count / maxFunnel) * 100 : 0}%`, background: `linear-gradient(90deg, ${tokens.gold}, ${tokens.goldLight})` }} /></div>
                <span className="w-8 text-sm font-semibold text-gray-900 text-right">{stage.count}</span>
                {i > 0 && drop > 0 && <span className="text-[10px] font-semibold text-red-600 w-10">-{drop}%</span>}
              </div>
            ); })}
          </div>
        )}

        {tab === 'risk' && (<>
          <div className="grid grid-cols-4 gap-4 mb-6">
            <KPI label="Total At-Risk" value={String(overdue.length)} color={tokens.danger} />
            <KPI label="Critical (>45d)" value={String(critical.length)} color={tokens.danger} />
            <KPI label="High (31\u201345d)" value={String(high.length)} color="#d97706" />
            <KPI label="At-Risk Value" value={fmtShort(overdueValue)} color={tokens.danger} />
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100"><h3 className="text-sm font-semibold text-gray-900">Overdue Contracts</h3></div>
            <table className="w-full"><thead><tr className="bg-gray-50">{['Unit', 'Purchaser', 'Price', 'Days', 'Risk', 'Action'].map(h => <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-gray-50">
                {overdue.sort((a, b) => daysBetween(b.dates?.contractsIssued, new Date().toISOString())! - daysBetween(a.dates?.contractsIssued, new Date().toISOString())!).map(p => {
                  const days = daysBetween(p.dates?.contractsIssued, new Date().toISOString()) || 0;
                  const isCrit = days > 45;
                  return (<tr key={p.id} className={`${isCrit ? 'border-l-[3px] border-l-red-400' : 'border-l-[3px] border-l-amber-400'}`}>
                    <td className="px-5 py-3"><p className="text-sm font-medium text-gray-900">{p.unitNumber}</p><p className="text-xs text-gray-500">{p.developmentName}</p></td>
                    <td className="px-5 py-3 text-sm text-gray-900">{p.purchaserName || '\u2014'}</td>
                    <td className="px-5 py-3 text-sm font-medium" style={{ color: tokens.goldDark }}>{fmtCurrency(p.prices?.sale || 0)}</td>
                    <td className="px-5 py-3 text-sm font-bold" style={{ color: isCrit ? tokens.danger : '#d97706' }}>{days}d</td>
                    <td className="px-5 py-3"><span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${isCrit ? 'bg-red-50 text-red-700 border-red-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>{isCrit ? 'Critical' : 'High'}</span></td>
                    <td className="px-5 py-3"><button onClick={() => router.push(`/agent/dashboard/intelligence?prompt=${encodeURIComponent(`Chase solicitor for ${p.purchaserName} on ${p.unitNumber} in ${p.developmentName}. ${days} days overdue.`)}`)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg text-white" style={{ background: `linear-gradient(135deg, ${tokens.gold}, ${tokens.goldDark})` }}><Zap className="w-3 h-3" /> Chase</button></td>
                  </tr>);
                })}
              </tbody>
            </table>
            {overdue.length === 0 && <div className="p-12 text-center text-sm text-green-600 font-medium">No overdue contracts. All on track.</div>}
          </div>
        </>)}

        {tab === 'revenue' && (<>
          <div className="grid grid-cols-5 gap-4 mb-6">
            <KPI label="Total Contracted" value={fmtShort(revenueSold + pipelineValue)} />
            <KPI label="Complete" value={fmtShort(revenueSold)} color={tokens.success} />
            <KPI label="Active Pipeline" value={fmtShort(pipelineValue)} color="#2563eb" />
            <KPI label="Overdue Value" value={fmtShort(overdueValue)} color={tokens.danger} />
            <KPI label="Forecast" value={fmtShort(revenueSold + pipelineValue + overdueValue)} />
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Revenue Breakdown</h3>
            <HBar label="Complete" value={revenueSold} max={Math.max(revenueSold, pipelineValue, overdueValue, 1)} color={tokens.success} />
            <HBar label="Active" value={pipelineValue} max={Math.max(revenueSold, pipelineValue, overdueValue, 1)} color="#2563eb" />
            <HBar label="Overdue" value={overdueValue} max={Math.max(revenueSold, pipelineValue, overdueValue, 1)} color={tokens.danger} />
          </div>
        </>)}

        {tab === 'pricing' && (<>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <KPI label="Portfolio Avg" value={fmtCurrency(avgPrice)} />
            <KPI label="Priced Units" value={String(priced.length)} />
            <KPI label="Schemes Tracked" value={String(developments.length)} />
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100"><h3 className="text-sm font-semibold text-gray-900">Price by Scheme & Bed Type</h3></div>
            <table className="w-full"><thead><tr className="bg-gray-50">{['Scheme', 'Beds', 'Min', 'Avg', 'Max', 'Count'].map(h => <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-gray-50">
                {developments.map(d => {
                  const items = priced.filter(p => p.developmentId === d.id);
                  const beds = [...new Set(items.map(p => p.bedrooms))].sort();
                  return beds.map((b, i) => { const bedItems = items.filter(p => p.bedrooms === b); const prices = bedItems.map(p => p.prices.sale || 0); return (
                    <tr key={`${d.id}-${b}`}><td className="px-5 py-3 text-sm font-medium text-gray-900">{i === 0 ? d.name : ''}</td><td className="px-5 py-3 text-sm font-semibold text-blue-700">{b}-bed</td>
                      <td className="px-5 py-3 text-sm text-gray-600">{fmtCurrency(Math.min(...prices))}</td><td className="px-5 py-3 text-sm font-semibold text-gray-900">{fmtCurrency(Math.round(prices.reduce((s, v) => s + v, 0) / prices.length))}</td>
                      <td className="px-5 py-3 text-sm text-gray-600">{fmtCurrency(Math.max(...prices))}</td><td className="px-5 py-3 text-sm text-gray-500">{bedItems.length}</td></tr>
                  ); });
                })}
              </tbody>
            </table>
          </div>
        </>)}
      </div>
    </div>
  );
}
