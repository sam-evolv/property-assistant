'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  CheckCircle,
  X,
  Zap,
  FileDown,
  AlertTriangle,
  ChevronRight,
  Clock,
} from 'lucide-react';
import { useAgentDashboard } from '../layout-provider';

export const dynamic = 'force-dynamic';

interface PipelineItem {
  id: string;
  unitId: string;
  unitNumber: string;
  unitAddress: string;
  developmentId: string;
  developmentName: string;
  bedrooms: number;
  status: string;
  purchaserName: string;
  prices: { sale?: number };
  dates: {
    saleAgreed?: string;
    deposit?: string;
    contractsIssued?: string;
    contractsSigned?: string;
    counterSigned?: string;
    drawdown?: string;
    handover?: string;
    estimatedClose?: string;
  };
}

type StatusFilter = 'all' | 'for_sale' | 'agreed' | 'contracts' | 'signed' | 'complete';
type ViewTab = 'buyers' | 'analysis';

const fmt = (d?: string) => d ? new Date(d).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: '2-digit' }) : null;
const fmtCurrency = (v?: number) => v ? new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v) : '\u2014';

function getProgress(p: PipelineItem) {
  const steps = [p.dates?.saleAgreed, p.dates?.deposit, p.dates?.contractsIssued, p.dates?.contractsSigned, p.dates?.counterSigned, p.dates?.drawdown, p.dates?.handover];
  return Math.round((steps.filter(Boolean).length / steps.length) * 100);
}

function isOverdue(p: PipelineItem) {
  return p.dates?.contractsIssued && !p.dates?.contractsSigned && new Date(p.dates.contractsIssued) < new Date(Date.now() - 21 * 86400000);
}

function daysSince(d?: string) {
  if (!d) return 0;
  return Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
}

function getInitials(name: string) {
  const p = name.split(' ').filter(Boolean);
  return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : (p[0]?.[0] || '?').toUpperCase();
}

export default function AgentDashboardPipelinePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { developments, selectedSchemeId, setSelectedSchemeId } = useAgentDashboard();

  const [pipeline, setPipeline] = useState<PipelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [viewTab, setViewTab] = useState<ViewTab>('buyers');
  const [selectedUnit, setSelectedUnit] = useState<PipelineItem | null>(null);
  const [panelTab, setPanelTab] = useState('Message');

  // Read scheme from URL param on mount
  useEffect(() => {
    const schemeParam = searchParams.get('scheme');
    if (schemeParam && schemeParam !== selectedSchemeId) {
      setSelectedSchemeId(schemeParam);
    }
  }, [searchParams, selectedSchemeId, setSelectedSchemeId]);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/agent/pipeline-data');
        if (!res.ok) return;
        const data = await res.json();
        setPipeline(data.pipeline ?? []);
      } catch { /* silent */ }
      setLoading(false);
    }
    fetchData();
  }, []);

  const filtered = useMemo(() => {
    let list = pipeline;
    if (selectedSchemeId) list = list.filter(p => p.developmentId === selectedSchemeId);
    if (statusFilter === 'for_sale') list = list.filter(p => p.status === 'for_sale');
    else if (statusFilter === 'agreed') list = list.filter(p => ['agreed', 'sale_agreed'].includes(p.status));
    else if (statusFilter === 'contracts') list = list.filter(p => ['in_progress', 'contracts_issued'].includes(p.status) || isOverdue(p));
    else if (statusFilter === 'signed') list = list.filter(p => ['signed', 'contracts_signed'].includes(p.status));
    else if (statusFilter === 'complete') list = list.filter(p => ['sold', 'complete'].includes(p.status));
    return list;
  }, [pipeline, selectedSchemeId, statusFilter]);

  const stats = useMemo(() => {
    const base = selectedSchemeId ? pipeline.filter(p => p.developmentId === selectedSchemeId) : pipeline;
    const forSale = base.filter(p => p.status === 'for_sale').length;
    const inProgress = base.filter(p => ['agreed', 'sale_agreed', 'in_progress', 'signed', 'contracts_issued', 'contracts_signed'].includes(p.status)).length;
    const complete = base.filter(p => ['sold', 'complete'].includes(p.status)).length;
    const overdue = base.filter(p => isOverdue(p)).length;
    const totalRev = base.filter(p => p.prices?.sale).reduce((s, p) => s + (p.prices.sale || 0), 0);
    const priced = base.filter(p => p.prices?.sale);
    const avgPrice = priced.length > 0 ? totalRev / priced.length : 0;
    return { total: base.length, forSale, inProgress, complete, overdue, totalRev, avgPrice };
  }, [pipeline, selectedSchemeId]);

  const filterTabs: { key: StatusFilter; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: stats.total },
    { key: 'for_sale', label: 'For Sale', count: stats.forSale },
    { key: 'agreed', label: 'Sale Agreed', count: stats.inProgress },
    { key: 'contracts', label: 'Contracts', count: stats.overdue + (selectedSchemeId ? pipeline.filter(p => p.developmentId === selectedSchemeId && ['in_progress', 'contracts_issued'].includes(p.status)).length : pipeline.filter(p => ['in_progress', 'contracts_issued'].includes(p.status)).length) },
    { key: 'signed', label: 'Signed', count: (selectedSchemeId ? pipeline.filter(p => p.developmentId === selectedSchemeId && ['signed', 'contracts_signed'].includes(p.status)).length : pipeline.filter(p => ['signed', 'contracts_signed'].includes(p.status)).length) },
    { key: 'complete', label: 'Complete', count: stats.complete },
  ];

  // Analysis data
  const funnelData = useMemo(() => {
    const base = selectedSchemeId ? pipeline.filter(p => p.developmentId === selectedSchemeId) : pipeline;
    return [
      { label: 'Released', count: base.length },
      { label: 'Agreed', count: base.filter(p => p.dates?.saleAgreed).length },
      { label: 'Deposit', count: base.filter(p => p.dates?.deposit).length },
      { label: 'Contracts Issued', count: base.filter(p => p.dates?.contractsIssued).length },
      { label: 'Signed', count: base.filter(p => p.dates?.contractsSigned).length },
      { label: 'Counter Signed', count: base.filter(p => p.dates?.counterSigned).length },
      { label: 'Drawdown', count: base.filter(p => p.dates?.drawdown).length },
      { label: 'Handover', count: base.filter(p => p.dates?.handover).length },
    ];
  }, [pipeline, selectedSchemeId]);

  const maxFunnel = Math.max(...funnelData.map(f => f.count), 1);

  if (loading) {
    return (
      <div style={{ padding: '32px 32px' }}>
        <div style={{ height: 24, width: 180, background: 'rgba(0,0,0,0.06)', borderRadius: 6, marginBottom: 24 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, marginBottom: 24 }}>
          {[1,2,3,4,5,6].map(i => <div key={i} style={{ height: 80, background: '#fff', borderRadius: 12, border: '0.5px solid rgba(0,0,0,0.07)' }} />)}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: '100vh' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Quick Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 32px', background: '#fff', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: 'rgba(0,0,0,0.35)', textTransform: 'uppercase' as const, marginRight: 8 }}>QUICK ACTIONS</span>
          <button onClick={() => router.push(`/agent/dashboard/intelligence?prompt=${encodeURIComponent('Draft chasing emails for all overdue contracts. Firm but professional tone.')}`)} style={{ height: 30, padding: '0 14px', background: '#c8960a', border: 'none', borderRadius: 7, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5 }}>
            <Zap size={13} /> Chase Overdue
          </button>
          <button style={{ height: 30, padding: '0 12px', background: '#fff', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 7, color: '#374151', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5 }}>
            <FileDown size={13} /> Export CSV
          </button>
        </div>

        <div style={{ padding: '28px 32px' }}>
          <h1 style={{ color: '#111', fontSize: 20, fontWeight: 700, letterSpacing: '-0.04em', margin: '0 0 20px' }}>Sales Pipeline</h1>

          {/* Stat strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'TOTAL UNITS', value: stats.total.toString() },
              { label: 'AVAILABLE', value: stats.forSale.toString() },
              { label: 'IN PROGRESS', value: stats.inProgress.toString(), color: '#1d4ed8' },
              { label: 'COMPLETE', value: stats.complete.toString(), color: '#15803d' },
              { label: 'TOTAL REVENUE', value: fmtCurrency(stats.totalRev) },
              { label: 'AVG PRICE', value: fmtCurrency(stats.avgPrice) },
            ].map(s => (
              <div key={s.label} style={{ background: '#fff', borderRadius: 12, border: '0.5px solid rgba(0,0,0,0.07)', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05)', padding: '14px 16px' }}>
                <p style={{ color: 'rgba(0,0,0,0.35)', fontSize: 9.5, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' as const, margin: '0 0 6px' }}>{s.label}</p>
                <p style={{ color: s.color || '#111', fontSize: 22, fontWeight: 700, letterSpacing: '-0.04em', margin: 0, lineHeight: 1 }}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* View tabs */}
          <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
            {(['buyers', 'analysis'] as ViewTab[]).map(tab => (
              <button key={tab} onClick={() => setViewTab(tab)} style={{ padding: '8px 18px', background: 'none', border: 'none', borderBottom: viewTab === tab ? '2px solid #c8960a' : '2px solid transparent', color: viewTab === tab ? '#c8960a' : 'rgba(0,0,0,0.45)', fontSize: 13, fontWeight: viewTab === tab ? 600 : 500, cursor: 'pointer', fontFamily: 'inherit', textTransform: 'capitalize' as const }}>
                {tab === 'buyers' ? 'All Buyers' : 'Analysis'}
              </button>
            ))}
          </div>

          {viewTab === 'buyers' && (
            <>
              {/* Filter tabs */}
              <div style={{ display: 'flex', gap: 4, marginBottom: 16, flexWrap: 'wrap' }}>
                {filterTabs.map(tab => (
                  <button key={tab.key} onClick={() => setStatusFilter(tab.key)} style={{ padding: '5px 12px', borderRadius: 8, background: statusFilter === tab.key ? 'rgba(200,150,10,0.1)' : 'transparent', border: statusFilter === tab.key ? '1px solid rgba(200,150,10,0.2)' : '1px solid transparent', color: statusFilter === tab.key ? '#c8960a' : 'rgba(0,0,0,0.5)', fontSize: 12, fontWeight: statusFilter === tab.key ? 600 : 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                    {tab.label} ({tab.count})
                  </button>
                ))}
                <span style={{ marginLeft: 'auto', fontSize: 12, color: 'rgba(0,0,0,0.4)', alignSelf: 'center' }}>{filtered.length} units</span>
              </div>

              {/* Milestone table */}
              <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid rgba(0,0,0,0.07)', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1100 }}>
                    <thead>
                      <tr style={{ background: '#f9f8f5', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                        {['UNIT / PURCHASER', 'PRICE', 'AGREED', 'DEPOSIT', 'CONTRACTS', 'SIGNED', 'COUNTER', 'DRAWDOWN', 'HANDOVER', 'PROGRESS', 'EST. CLOSE'].map(h => (
                          <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: 'rgba(0,0,0,0.35)', fontSize: 9.5, fontWeight: 700, letterSpacing: '0.07em', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((p) => {
                        const overdue = isOverdue(p);
                        const pct = getProgress(p);
                        const estPast = p.dates?.estimatedClose && new Date(p.dates.estimatedClose) < new Date();
                        return (
                          <tr
                            key={p.id}
                            onClick={() => setSelectedUnit(p)}
                            style={{ borderBottom: '1px solid rgba(0,0,0,0.04)', cursor: 'pointer', borderLeft: overdue ? '3px solid rgba(239,68,68,0.45)' : '3px solid transparent', transition: 'background 0.1s' }}
                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#faf9f7'}
                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                          >
                            <td style={{ padding: '10px 12px', minWidth: 180 }}>
                              <p style={{ fontSize: 13, fontWeight: 500, color: '#111', margin: 0 }}>{p.unitNumber}</p>
                              <p style={{ fontSize: 11, color: 'rgba(0,0,0,0.38)', margin: '1px 0 0' }}>{p.purchaserName || '\u2014'}</p>
                            </td>
                            <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 500, color: '#111' }}>{fmtCurrency(p.prices?.sale)}</td>
                            {/* Date cells */}
                            {([
                              p.dates?.saleAgreed,
                              p.dates?.deposit,
                              p.dates?.contractsIssued,
                              p.dates?.contractsSigned,
                              p.dates?.counterSigned,
                              p.dates?.drawdown,
                              p.dates?.handover,
                            ] as (string | undefined)[]).map((d, idx) => {
                              const isPending = idx === 3 && !d && p.dates?.contractsIssued;
                              return (
                                <td key={idx} style={{ padding: '10px 8px', whiteSpace: 'nowrap' }}>
                                  {d ? (
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: '#374151' }}>
                                      <span style={{ width: 6, height: 6, borderRadius: 3, background: '#15803d', flexShrink: 0 }} />
                                      {fmt(d)}
                                    </span>
                                  ) : isPending ? (
                                    <span style={{ fontSize: 11, fontWeight: 600, color: '#92400e', background: '#fffbeb', padding: '2px 7px', borderRadius: 6, border: '1px solid rgba(146,64,14,0.2)' }}>Pending</span>
                                  ) : (
                                    <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.2)' }}>{'\u2014'}</span>
                                  )}
                                </td>
                              );
                            })}
                            <td style={{ padding: '10px 8px', width: 90 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <div style={{ flex: 1, height: 4, background: '#e5e7eb', borderRadius: 2, overflow: 'hidden' }}>
                                  <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(135deg, #B8960C, #E8C84A)', borderRadius: 2 }} />
                                </div>
                                <span style={{ fontSize: 10, fontWeight: 600, color: 'rgba(0,0,0,0.4)', minWidth: 26 }}>{pct}%</span>
                              </div>
                            </td>
                            <td style={{ padding: '10px 8px' }}>
                              {p.dates?.estimatedClose ? (
                                <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: estPast ? '#fef2f2' : '#f0fdf4', color: estPast ? '#b91c1c' : '#15803d', border: `1px solid ${estPast ? 'rgba(185,28,28,0.2)' : 'rgba(21,128,61,0.2)'}` }}>
                                  {fmt(p.dates.estimatedClose)}
                                </span>
                              ) : (
                                <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.2)' }}>{'\u2014'}</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {filtered.length === 0 && (
                  <div style={{ padding: '40px 18px', textAlign: 'center' }}>
                    <p style={{ color: 'rgba(0,0,0,0.35)', fontSize: 13 }}>No units match the current filter</p>
                  </div>
                )}
              </div>
            </>
          )}

          {viewTab === 'analysis' && (
            <div>
              {/* KPI cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
                {[
                  { label: 'Total Units', value: stats.total },
                  { label: 'Completed', value: stats.complete, color: '#15803d' },
                  { label: 'In Progress', value: stats.inProgress, color: '#1d4ed8' },
                  { label: 'Overdue', value: stats.overdue, color: '#b91c1c' },
                ].map(k => (
                  <div key={k.label} style={{ background: '#fff', borderRadius: 12, border: '0.5px solid rgba(0,0,0,0.07)', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05)', padding: '16px 18px' }}>
                    <p style={{ color: 'rgba(0,0,0,0.35)', fontSize: 9.5, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' as const, margin: '0 0 6px' }}>{k.label}</p>
                    <p style={{ color: k.color || '#111', fontSize: 28, fontWeight: 700, letterSpacing: '-0.04em', margin: 0 }}>{k.value}</p>
                  </div>
                ))}
              </div>

              {/* Sales Funnel */}
              <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid rgba(0,0,0,0.07)', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05)', padding: '20px', marginBottom: 20 }}>
                <h3 style={{ fontSize: 13.5, fontWeight: 600, color: '#111', letterSpacing: '-0.02em', margin: '0 0 16px' }}>Sales Funnel</h3>
                {funnelData.map((stage, i) => {
                  const pct = maxFunnel > 0 ? (stage.count / maxFunnel) * 100 : 0;
                  const prev = i > 0 ? funnelData[i - 1].count : stage.count;
                  const dropoff = prev > 0 ? Math.round(((prev - stage.count) / prev) * 100) : 0;
                  return (
                    <div key={stage.label} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                      <span style={{ width: 120, fontSize: 12, color: 'rgba(0,0,0,0.5)', textAlign: 'right', flexShrink: 0 }}>{stage.label}</span>
                      <div style={{ flex: 1, height: 24, background: '#f3f4f6', borderRadius: 6, overflow: 'hidden', position: 'relative' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(135deg, #B8960C, #E8C84A)', borderRadius: 6, minWidth: stage.count > 0 ? 2 : 0 }} />
                      </div>
                      <span style={{ minWidth: 30, fontSize: 13, fontWeight: 600, color: '#111', textAlign: 'right' }}>{stage.count}</span>
                      {i > 0 && dropoff > 0 && (
                        <span style={{ fontSize: 10, color: '#b91c1c', minWidth: 35 }}>-{dropoff}%</span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Revenue Summary */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
                {[
                  { label: 'Total Revenue', value: fmtCurrency(stats.totalRev) },
                  { label: 'Complete Revenue', value: fmtCurrency(pipeline.filter(p => ['sold', 'complete'].includes(p.status)).reduce((s, p) => s + (p.prices?.sale || 0), 0)) },
                  { label: 'Avg Price', value: fmtCurrency(stats.avgPrice) },
                ].map(r => (
                  <div key={r.label} style={{ background: '#fff', borderRadius: 12, border: '0.5px solid rgba(0,0,0,0.07)', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05)', padding: '16px 18px' }}>
                    <p style={{ color: 'rgba(0,0,0,0.35)', fontSize: 9.5, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' as const, margin: '0 0 6px' }}>{r.label}</p>
                    <p style={{ fontSize: 20, fontWeight: 700, color: '#111', letterSpacing: '-0.03em', margin: 0 }}>{r.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Buyer slide-out panel */}
      {selectedUnit && (
        <div style={{ width: 320, borderLeft: '1px solid rgba(0,0,0,0.08)', background: '#fff', display: 'flex', flexDirection: 'column', height: '100vh', position: 'sticky', top: 0 }}>
          <div style={{ padding: '16px 18px 12px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div style={{ width: 42, height: 42, background: '#1d4ed8', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 13 }}>
                {selectedUnit.purchaserName ? getInitials(selectedUnit.purchaserName) : '?'}
              </div>
              <button onClick={() => setSelectedUnit(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                <X size={16} color="rgba(0,0,0,0.3)" />
              </button>
            </div>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: '#111', margin: '0 0 2px', letterSpacing: '-0.02em' }}>{selectedUnit.purchaserName || 'No buyer assigned'}</h3>
            <p style={{ fontSize: 12, color: 'rgba(0,0,0,0.5)', margin: 0 }}>{selectedUnit.developmentName} \u00B7 {selectedUnit.unitNumber}</p>
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              {selectedUnit.bedrooms && <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: '#eff6ff', color: '#1d4ed8' }}>{selectedUnit.bedrooms} Bed</span>}
            </div>
          </div>

          {/* Progress */}
          <div style={{ padding: '12px 18px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: 'rgba(0,0,0,0.5)' }}>Sale Progress</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#111' }}>{getProgress(selectedUnit)}%</span>
            </div>
            <div style={{ height: 4, background: '#e5e7eb', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${getProgress(selectedUnit)}%`, background: 'linear-gradient(135deg, #B8960C, #E8C84A)', borderRadius: 2 }} />
            </div>
          </div>

          {/* Meta */}
          <div style={{ display: 'flex', padding: '10px 18px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.07em', color: 'rgba(0,0,0,0.35)', textTransform: 'uppercase' as const, margin: '0 0 3px' }}>EST. CLOSE</p>
              <p style={{ fontSize: 13, fontWeight: 600, color: selectedUnit.dates?.estimatedClose && new Date(selectedUnit.dates.estimatedClose) < new Date() ? '#dc2626' : '#111', margin: 0 }}>
                {fmt(selectedUnit.dates?.estimatedClose) || '\u2014'}
              </p>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.07em', color: 'rgba(0,0,0,0.35)', textTransform: 'uppercase' as const, margin: '0 0 3px' }}>DAYS IN STAGE</p>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#111', margin: 0 }}>
                {selectedUnit.dates?.contractsIssued && !selectedUnit.dates?.contractsSigned ? daysSince(selectedUnit.dates.contractsIssued) : selectedUnit.dates?.saleAgreed ? daysSince(selectedUnit.dates.saleAgreed) : '\u2014'}
              </p>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.07em', color: 'rgba(0,0,0,0.35)', textTransform: 'uppercase' as const, margin: '0 0 3px' }}>PRICE</p>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#111', margin: 0 }}>{fmtCurrency(selectedUnit.prices?.sale)}</p>
            </div>
          </div>

          {/* Timeline */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
            <p style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.07em', color: 'rgba(0,0,0,0.35)', textTransform: 'uppercase' as const, margin: 0, padding: '8px 18px 4px' }}>TIMELINE</p>
            {[
              { label: 'Sale Agreed', date: selectedUnit.dates?.saleAgreed },
              { label: 'Deposit Received', date: selectedUnit.dates?.deposit },
              { label: 'Contracts Issued', date: selectedUnit.dates?.contractsIssued },
              { label: 'Contracts Signed', date: selectedUnit.dates?.contractsSigned, overdue: isOverdue(selectedUnit) },
              { label: 'Counter Signed', date: selectedUnit.dates?.counterSigned },
              { label: 'Drawdown', date: selectedUnit.dates?.drawdown },
              { label: 'Handover Complete', date: selectedUnit.dates?.handover },
            ].map(step => (
              <div key={step.label} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '7px 18px' }}>
                <div style={{
                  width: 18, height: 18, borderRadius: '50%',
                  background: step.date ? '#15803d' : step.overdue ? '#fef2f2' : '#e5e7eb',
                  border: step.overdue ? '2px solid #dc2626' : 'none',
                  flexShrink: 0, marginTop: 2,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {step.date && <CheckCircle size={10} color="#fff" />}
                </div>
                <div>
                  <p style={{ fontSize: 12.5, fontWeight: 500, color: step.date ? '#111' : 'rgba(0,0,0,0.4)', margin: 0 }}>{step.label}</p>
                  <p style={{ fontSize: 11, color: step.overdue && !step.date ? '#dc2626' : 'rgba(0,0,0,0.38)', margin: '1px 0 0' }}>
                    {step.date ? fmt(step.date) : step.overdue ? `Overdue \u2014 ${daysSince(selectedUnit.dates?.contractsIssued)}d` : '\u2014'}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Chase strip */}
          {isOverdue(selectedUnit) && (
            <div style={{ padding: '12px 18px', background: '#fef9ec', borderTop: '1px solid rgba(200,150,10,0.2)' }}>
              <p style={{ fontSize: 11.5, color: '#92400e', margin: '0 0 8px', lineHeight: 1.5 }}>
                Contracts issued {daysSince(selectedUnit.dates?.contractsIssued)} days ago. No signed copy received.
              </p>
              <button
                onClick={() => router.push(`/agent/dashboard/intelligence?prompt=${encodeURIComponent(`Chase solicitor for ${selectedUnit.purchaserName} on ${selectedUnit.unitNumber} in ${selectedUnit.developmentName}. Contracts issued ${daysSince(selectedUnit.dates?.contractsIssued)} days ago, not yet signed. Draft a professional chasing email.`)}`)}
                style={{ width: '100%', height: 34, background: 'linear-gradient(135deg, #B8960C, #E8C84A)', border: 'none', borderRadius: 7, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Chase with Intelligence \u2192
              </button>
            </div>
          )}

          {/* Action tabs */}
          <div style={{ display: 'flex', borderTop: '1px solid rgba(0,0,0,0.07)' }}>
            {['Message', 'Docs', 'Notes', 'History'].map(tab => (
              <button key={tab} onClick={() => setPanelTab(tab)} style={{ flex: 1, height: 40, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500, color: panelTab === tab ? '#c8960a' : 'rgba(0,0,0,0.45)', borderTop: panelTab === tab ? '2px solid #c8960a' : '2px solid transparent', fontFamily: 'inherit' }}>
                {tab}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
