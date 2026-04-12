'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { BarChart3, TrendingUp, AlertTriangle, Zap } from 'lucide-react';
import { useAgentDashboard } from '../layout-provider';

export const dynamic = 'force-dynamic';

interface PipelineItem {
  id: string;
  unitId: string;
  unitNumber: string;
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

type AnalyticsTab = 'overview' | 'velocity' | 'funnel' | 'risk' | 'revenue' | 'pricing';

const fmtCurrency = (v: number) => new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
const fmtShortCurrency = (v: number) => {
  if (v >= 1000000) return `\u20AC${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `\u20AC${(v / 1000).toFixed(0)}K`;
  return fmtCurrency(v);
};

function daysBetween(a?: string, b?: string) {
  if (!a || !b) return null;
  return Math.max(0, Math.floor((new Date(b).getTime() - new Date(a).getTime()) / 86400000));
}

function KPICard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid rgba(0,0,0,0.07)', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05)', padding: '14px 16px' }}>
      <p style={{ color: 'rgba(0,0,0,0.35)', fontSize: 9.5, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' as const, margin: '0 0 6px' }}>{label}</p>
      <p style={{ color: color || '#111', fontSize: 22, fontWeight: 700, letterSpacing: '-0.04em', margin: 0, lineHeight: 1 }}>{value}</p>
    </div>
  );
}

function HBar({ label, value, max, color }: { label: string; value: number; max: number; color?: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
      <span style={{ width: 120, fontSize: 12, color: 'rgba(0,0,0,0.5)', textAlign: 'right', flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, height: 22, background: '#f3f4f6', borderRadius: 6, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color || 'linear-gradient(135deg, #B8960C, #E8C84A)', borderRadius: 6, minWidth: value > 0 ? 2 : 0 }} />
      </div>
      <span style={{ minWidth: 30, fontSize: 13, fontWeight: 600, color: '#111', textAlign: 'right' }}>{value}</span>
    </div>
  );
}

export default function AgentDashboardAnalyticsPage() {
  const router = useRouter();
  const { selectedSchemeId, developments } = useAgentDashboard();
  const [pipeline, setPipeline] = useState<PipelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<AnalyticsTab>('overview');

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

  const data = useMemo(() => selectedSchemeId ? pipeline.filter(p => p.developmentId === selectedSchemeId) : pipeline, [pipeline, selectedSchemeId]);

  // Core stats
  const sold = data.filter(p => ['sold', 'complete'].includes(p.status));
  const active = data.filter(p => ['agreed', 'sale_agreed', 'in_progress', 'signed', 'contracts_issued', 'contracts_signed'].includes(p.status));
  const overdue = data.filter(p => p.dates?.contractsIssued && !p.dates?.contractsSigned && new Date(p.dates.contractsIssued) < new Date(Date.now() - 21 * 86400000));
  const revenueSold = sold.reduce((s, p) => s + (p.prices?.sale || 0), 0);
  const pipelineValue = active.reduce((s, p) => s + (p.prices?.sale || 0), 0);
  const overdueValue = overdue.reduce((s, p) => s + (p.prices?.sale || 0), 0);

  // Funnel
  const funnel = [
    { label: 'Released', count: data.length },
    { label: 'Agreed', count: data.filter(p => p.dates?.saleAgreed).length },
    { label: 'Deposit', count: data.filter(p => p.dates?.deposit).length },
    { label: 'Contracts Issued', count: data.filter(p => p.dates?.contractsIssued).length },
    { label: 'Signed', count: data.filter(p => p.dates?.contractsSigned).length },
    { label: 'Counter Signed', count: data.filter(p => p.dates?.counterSigned).length },
    { label: 'Drawdown', count: data.filter(p => p.dates?.drawdown).length },
    { label: 'Handover', count: data.filter(p => p.dates?.handover).length },
  ];
  const maxFunnel = Math.max(...funnel.map(f => f.count), 1);

  // Velocity
  const velocityItems = data.filter(p => p.dates?.saleAgreed);
  const avgAgreedToContracts = velocityItems.filter(p => p.dates?.contractsIssued).map(p => daysBetween(p.dates?.saleAgreed, p.dates?.contractsIssued)!).filter(d => d >= 0);
  const avgContractsToSigned = velocityItems.filter(p => p.dates?.contractsSigned).map(p => daysBetween(p.dates?.contractsIssued, p.dates?.contractsSigned)!).filter(d => d >= 0);
  const avgSignedToCounter = velocityItems.filter(p => p.dates?.counterSigned).map(p => daysBetween(p.dates?.contractsSigned, p.dates?.counterSigned)!).filter(d => d >= 0);
  const avgCounterToDrawdown = velocityItems.filter(p => p.dates?.drawdown).map(p => daysBetween(p.dates?.counterSigned, p.dates?.drawdown)!).filter(d => d >= 0);
  const avg = (arr: number[]) => arr.length > 0 ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length) : 0;

  // Risk
  const critical = overdue.filter(p => daysBetween(p.dates?.contractsIssued, new Date().toISOString())! > 45);
  const high = overdue.filter(p => { const d = daysBetween(p.dates?.contractsIssued, new Date().toISOString())!; return d > 30 && d <= 45; });

  // Contracts->Signed distribution
  const signedDays = data.filter(p => p.dates?.contractsIssued && p.dates?.contractsSigned).map(p => daysBetween(p.dates?.contractsIssued, p.dates?.contractsSigned)!);
  const distBuckets = [
    { label: '0\u201314d', count: signedDays.filter(d => d <= 14).length },
    { label: '15\u201328d', count: signedDays.filter(d => d > 14 && d <= 28).length },
    { label: '29\u201345d', count: signedDays.filter(d => d > 28 && d <= 45).length },
    { label: '46\u201360d', count: signedDays.filter(d => d > 45 && d <= 60).length },
    { label: '60+d', count: signedDays.filter(d => d > 60).length },
  ];
  const maxDist = Math.max(...distBuckets.map(b => b.count), 1);

  // Pricing
  const priced = data.filter(p => p.prices?.sale);
  const avgPrice = priced.length > 0 ? priced.reduce((s, p) => s + (p.prices.sale || 0), 0) / priced.length : 0;
  const schemeGroups = developments.map(d => {
    const items = priced.filter(p => p.developmentId === d.id);
    const beds = [...new Set(items.map(p => p.bedrooms))].sort();
    return {
      name: d.name,
      beds: beds.map(b => {
        const bedItems = items.filter(p => p.bedrooms === b);
        const prices = bedItems.map(p => p.prices.sale || 0);
        return {
          bed: b,
          count: bedItems.length,
          min: Math.min(...prices),
          avg: Math.round(prices.reduce((s, v) => s + v, 0) / prices.length),
          max: Math.max(...prices),
        };
      }),
    };
  }).filter(g => g.beds.length > 0);

  // Scheme comparison
  const schemeComparison = developments.map(d => {
    const items = data.filter(p => p.developmentId === d.id);
    const s = items.filter(p => ['sold', 'complete'].includes(p.status));
    const a = items.filter(p => ['agreed', 'sale_agreed', 'in_progress', 'signed', 'contracts_issued', 'contracts_signed'].includes(p.status));
    const o = items.filter(p => p.dates?.contractsIssued && !p.dates?.contractsSigned && new Date(p.dates.contractsIssued) < new Date(Date.now() - 21 * 86400000));
    const rev = items.filter(p => p.prices?.sale).reduce((sum, p) => sum + (p.prices.sale || 0), 0);
    return { name: d.name, total: items.length, sold: s.length, active: a.length, overdue: o.length, revenue: rev, pctComplete: items.length > 0 ? Math.round((s.length / items.length) * 100) : 0 };
  });

  const tabs: { key: AnalyticsTab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'velocity', label: 'Sales Velocity' },
    { key: 'funnel', label: 'Pipeline Funnel' },
    { key: 'risk', label: 'Risk Register' },
    { key: 'revenue', label: 'Revenue & Forecast' },
    { key: 'pricing', label: 'Pricing Analysis' },
  ];

  if (loading) {
    return (
      <div style={{ padding: '32px 32px' }}>
        <div style={{ height: 24, width: 120, background: 'rgba(0,0,0,0.06)', borderRadius: 6, marginBottom: 24 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
          {[1,2,3,4,5].map(i => <div key={i} style={{ height: 80, background: '#fff', borderRadius: 12, border: '0.5px solid rgba(0,0,0,0.07)' }} />)}
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 32px', background: '#fff', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: 'rgba(0,0,0,0.35)', textTransform: 'uppercase' as const, marginRight: 8 }}>QUICK ACTIONS</span>
        <button style={{ height: 30, padding: '0 12px', background: '#fff', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 7, color: '#374151', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>Export Report</button>
      </div>

      <div style={{ padding: '28px 32px' }}>
        <h1 style={{ color: '#111', fontSize: 20, fontWeight: 700, letterSpacing: '-0.04em', margin: '0 0 16px' }}>Analytics</h1>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{ padding: '8px 16px', background: 'none', border: 'none', borderBottom: tab === t.key ? '2px solid #c8960a' : '2px solid transparent', color: tab === t.key ? '#c8960a' : 'rgba(0,0,0,0.45)', fontSize: 12.5, fontWeight: tab === t.key ? 600 : 500, cursor: 'pointer', fontFamily: 'inherit' }}>{t.label}</button>
          ))}
        </div>

        {/* TAB: Overview */}
        {tab === 'overview' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 24 }}>
              <KPICard label="Units Sold" value={sold.length.toString()} color="#15803d" />
              <KPICard label="Active Pipeline" value={active.length.toString()} color="#1d4ed8" />
              <KPICard label="Overdue" value={overdue.length.toString()} color={overdue.length > 0 ? '#b91c1c' : '#15803d'} />
              <KPICard label="Revenue Sold" value={fmtShortCurrency(revenueSold)} />
              <KPICard label="Pipeline Value" value={fmtShortCurrency(pipelineValue)} />
            </div>

            {/* Scheme comparison table */}
            <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid rgba(0,0,0,0.07)', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                <h3 style={{ fontSize: 13.5, fontWeight: 600, color: '#111', margin: 0, letterSpacing: '-0.02em' }}>Scheme Comparison</h3>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr repeat(6, 1fr)', padding: '10px 18px', background: '#f9f8f5', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                {['Scheme', 'Total', 'Sold', 'Active', 'Overdue', 'Revenue', '% Complete'].map(h => (
                  <span key={h} style={{ color: 'rgba(0,0,0,0.35)', fontSize: 9.5, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' as const }}>{h}</span>
                ))}
              </div>
              {schemeComparison.map((s, i) => (
                <div key={s.name} style={{ display: 'grid', gridTemplateColumns: '2fr repeat(6, 1fr)', padding: '11px 18px', borderBottom: i < schemeComparison.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: '#111' }}>{s.name}</span>
                  <span style={{ fontSize: 13, color: '#374151' }}>{s.total}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#15803d' }}>{s.sold}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#1d4ed8' }}>{s.active}</span>
                  <span style={{ fontSize: 13, fontWeight: s.overdue > 0 ? 600 : 400, color: s.overdue > 0 ? '#b91c1c' : 'rgba(0,0,0,0.25)' }}>{s.overdue || '\u2014'}</span>
                  <span style={{ fontSize: 12, fontWeight: 500, color: '#111' }}>{fmtShortCurrency(s.revenue)}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ flex: 1, height: 4, background: '#e5e7eb', borderRadius: 2 }}>
                      <div style={{ height: '100%', width: `${s.pctComplete}%`, background: 'linear-gradient(135deg, #B8960C, #E8C84A)', borderRadius: 2 }} />
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 600, color: 'rgba(0,0,0,0.4)' }}>{s.pctComplete}%</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* TAB: Velocity */}
        {tab === 'velocity' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 24 }}>
              <KPICard label="Avg Agreed\u2192Contracts" value={`${avg(avgAgreedToContracts)}d`} />
              <KPICard label="Avg Contracts\u2192Signed" value={`${avg(avgContractsToSigned)}d`} color={avg(avgContractsToSigned) > 30 ? '#b91c1c' : '#111'} />
              <KPICard label="Avg Signed\u2192Counter" value={`${avg(avgSignedToCounter)}d`} />
              <KPICard label="Avg Counter\u2192Drawdown" value={`${avg(avgCounterToDrawdown)}d`} />
              <KPICard label="Avg Total Journey" value={`${avg([...avgAgreedToContracts, ...avgContractsToSigned, ...avgSignedToCounter, ...avgCounterToDrawdown])}d`} />
            </div>

            {/* Distribution */}
            <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid rgba(0,0,0,0.07)', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05)', padding: '20px', marginBottom: 20 }}>
              <h3 style={{ fontSize: 13.5, fontWeight: 600, color: '#111', margin: '0 0 16px', letterSpacing: '-0.02em' }}>Contract-to-Signature Distribution</h3>
              {distBuckets.map(b => (
                <HBar key={b.label} label={b.label} value={b.count} max={maxDist} />
              ))}
            </div>

            {avg(avgContractsToSigned) > 30 && (
              <div style={{ background: '#fffbeb', border: '1px solid rgba(146,64,14,0.2)', borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <AlertTriangle size={16} color="#92400e" />
                <p style={{ fontSize: 13, color: '#92400e', margin: 0 }}>Average contract-to-signature time is {avg(avgContractsToSigned)} days, above the 28-day target.</p>
              </div>
            )}
          </>
        )}

        {/* TAB: Funnel */}
        {tab === 'funnel' && (
          <>
            <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid rgba(0,0,0,0.07)', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05)', padding: '20px', marginBottom: 20 }}>
              <h3 style={{ fontSize: 13.5, fontWeight: 600, color: '#111', margin: '0 0 16px', letterSpacing: '-0.02em' }}>Combined Funnel</h3>
              {funnel.map((stage, i) => {
                const prev = i > 0 ? funnel[i - 1].count : stage.count;
                const dropoff = prev > 0 && i > 0 ? Math.round(((prev - stage.count) / prev) * 100) : 0;
                return (
                  <div key={stage.label} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                    <span style={{ width: 120, fontSize: 12, color: 'rgba(0,0,0,0.5)', textAlign: 'right', flexShrink: 0 }}>{stage.label}</span>
                    <div style={{ flex: 1, height: 26, background: '#f3f4f6', borderRadius: 6, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${maxFunnel > 0 ? (stage.count / maxFunnel) * 100 : 0}%`, background: 'linear-gradient(135deg, #B8960C, #E8C84A)', borderRadius: 6, minWidth: stage.count > 0 ? 2 : 0 }} />
                    </div>
                    <span style={{ minWidth: 30, fontSize: 13, fontWeight: 600, color: '#111', textAlign: 'right' }}>{stage.count}</span>
                    {i > 0 && dropoff > 0 && <span style={{ fontSize: 10, color: '#b91c1c', minWidth: 35 }}>-{dropoff}%</span>}
                  </div>
                );
              })}
            </div>

            {/* Per-scheme funnels */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
              {developments.map(d => {
                const items = data.filter(p => p.developmentId === d.id);
                const sf = [
                  { label: 'Released', count: items.length },
                  { label: 'Agreed', count: items.filter(p => p.dates?.saleAgreed).length },
                  { label: 'Deposit', count: items.filter(p => p.dates?.deposit).length },
                  { label: 'Contracts', count: items.filter(p => p.dates?.contractsIssued).length },
                  { label: 'Signed', count: items.filter(p => p.dates?.contractsSigned).length },
                  { label: 'Handover', count: items.filter(p => p.dates?.handover).length },
                ];
                const sMax = Math.max(...sf.map(s => s.count), 1);
                return (
                  <div key={d.id} style={{ background: '#fff', borderRadius: 12, border: '0.5px solid rgba(0,0,0,0.07)', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05)', padding: '16px' }}>
                    <h4 style={{ fontSize: 13, fontWeight: 600, color: '#111', margin: '0 0 12px', letterSpacing: '-0.01em' }}>{d.name}</h4>
                    {sf.map(s => (
                      <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ width: 70, fontSize: 10.5, color: 'rgba(0,0,0,0.45)', textAlign: 'right' }}>{s.label}</span>
                        <div style={{ flex: 1, height: 14, background: '#f3f4f6', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${(s.count / sMax) * 100}%`, background: 'linear-gradient(135deg, #B8960C, #E8C84A)', borderRadius: 4, minWidth: s.count > 0 ? 1 : 0 }} />
                        </div>
                        <span style={{ minWidth: 20, fontSize: 11, fontWeight: 600, color: '#111' }}>{s.count}</span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* TAB: Risk */}
        {tab === 'risk' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
              <KPICard label="Total At-Risk" value={overdue.length.toString()} color="#b91c1c" />
              <KPICard label="Critical (>45d)" value={critical.length.toString()} color="#b91c1c" />
              <KPICard label="High Risk (31\u201345d)" value={high.length.toString()} color="#92400e" />
              <KPICard label="At-Risk Value" value={fmtShortCurrency(overdueValue)} color="#b91c1c" />
            </div>

            <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid rgba(0,0,0,0.07)', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                <h3 style={{ fontSize: 13.5, fontWeight: 600, color: '#111', margin: 0, letterSpacing: '-0.02em' }}>Overdue Contracts</h3>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
                  <thead>
                    <tr style={{ background: '#f9f8f5', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                      {['Unit', 'Purchaser', 'Price', 'Issued', 'Days', 'Est. Close', 'Risk', 'Action'].map(h => (
                        <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: 'rgba(0,0,0,0.35)', fontSize: 9.5, fontWeight: 700, letterSpacing: '0.07em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {overdue.sort((a, b) => daysBetween(a.dates?.contractsIssued, new Date().toISOString())! - daysBetween(b.dates?.contractsIssued, new Date().toISOString())!).reverse().map(p => {
                      const days = daysBetween(p.dates?.contractsIssued, new Date().toISOString()) || 0;
                      const isCritical = days > 45;
                      return (
                        <tr key={p.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.04)', borderLeft: isCritical ? '3px solid rgba(239,68,68,0.45)' : '3px solid rgba(245,158,11,0.45)' }}>
                          <td style={{ padding: '10px 12px' }}>
                            <p style={{ fontSize: 13, fontWeight: 500, color: '#111', margin: 0 }}>{p.unitNumber}</p>
                            <p style={{ fontSize: 11, color: 'rgba(0,0,0,0.38)', margin: '1px 0 0' }}>{p.developmentName}</p>
                          </td>
                          <td style={{ padding: '10px 12px', fontSize: 13, color: '#111' }}>{p.purchaserName || '\u2014'}</td>
                          <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 500, color: '#111' }}>{fmtCurrency(p.prices?.sale || 0)}</td>
                          <td style={{ padding: '10px 12px', fontSize: 12, color: 'rgba(0,0,0,0.5)' }}>{p.dates?.contractsIssued ? new Date(p.dates.contractsIssued).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' }) : '\u2014'}</td>
                          <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 700, color: isCritical ? '#b91c1c' : '#92400e' }}>{days}d</td>
                          <td style={{ padding: '10px 12px', fontSize: 12, color: 'rgba(0,0,0,0.5)' }}>{p.dates?.estimatedClose ? new Date(p.dates.estimatedClose).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' }) : '\u2014'}</td>
                          <td style={{ padding: '10px 12px' }}>
                            <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 8, background: isCritical ? '#fef2f2' : '#fffbeb', color: isCritical ? '#b91c1c' : '#92400e', border: `1px solid ${isCritical ? 'rgba(185,28,28,0.2)' : 'rgba(146,64,14,0.2)'}` }}>
                              {isCritical ? 'Critical' : 'High'}
                            </span>
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            <button onClick={() => router.push(`/agent/dashboard/intelligence?prompt=${encodeURIComponent(`Chase solicitor for ${p.purchaserName} on ${p.unitNumber} in ${p.developmentName}. Contracts issued ${days} days ago. Draft a professional chasing email.`)}`)} style={{ height: 26, padding: '0 10px', background: 'linear-gradient(135deg, #B8960C, #E8C84A)', border: 'none', borderRadius: 6, color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4 }}>
                              <Zap size={11} /> Chase
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {overdue.length === 0 && (
                <div style={{ padding: '40px', textAlign: 'center' }}>
                  <p style={{ color: '#15803d', fontSize: 13, fontWeight: 500 }}>No overdue contracts. All on track.</p>
                </div>
              )}
            </div>
          </>
        )}

        {/* TAB: Revenue */}
        {tab === 'revenue' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 24 }}>
              <KPICard label="Total Contracted" value={fmtShortCurrency(revenueSold + pipelineValue)} />
              <KPICard label="Complete" value={fmtShortCurrency(revenueSold)} color="#15803d" />
              <KPICard label="Active Pipeline" value={fmtShortCurrency(pipelineValue)} color="#1d4ed8" />
              <KPICard label="Overdue Value" value={fmtShortCurrency(overdueValue)} color="#b91c1c" />
              <KPICard label="Forecast" value={fmtShortCurrency(revenueSold + pipelineValue + overdueValue)} />
            </div>

            <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid rgba(0,0,0,0.07)', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05)', padding: '20px', marginBottom: 20 }}>
              <h3 style={{ fontSize: 13.5, fontWeight: 600, color: '#111', margin: '0 0 16px', letterSpacing: '-0.02em' }}>Revenue Breakdown</h3>
              {[
                { label: 'Complete', value: revenueSold, color: '#15803d' },
                { label: 'Active Pipeline', value: pipelineValue, color: '#1d4ed8' },
                { label: 'Overdue', value: overdueValue, color: '#b91c1c' },
              ].map(r => (
                <HBar key={r.label} label={r.label} value={r.value} max={Math.max(revenueSold, pipelineValue, overdueValue, 1)} color={r.color} />
              ))}
            </div>
          </>
        )}

        {/* TAB: Pricing */}
        {tab === 'pricing' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
              <KPICard label="Portfolio Avg" value={fmtCurrency(avgPrice)} />
              <KPICard label="Total Priced Units" value={priced.length.toString()} />
              <KPICard label="Price Range" value={priced.length > 0 ? `${fmtShortCurrency(Math.min(...priced.map(p => p.prices.sale!)))} \u2014 ${fmtShortCurrency(Math.max(...priced.map(p => p.prices.sale!)))}` : '\u2014'} />
              <KPICard label="Schemes Tracked" value={schemeGroups.length.toString()} />
            </div>

            {/* Price by scheme + bed */}
            <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid rgba(0,0,0,0.07)', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                <h3 style={{ fontSize: 13.5, fontWeight: 600, color: '#111', margin: 0, letterSpacing: '-0.02em' }}>Price by Scheme & Bed Type</h3>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 0.6fr repeat(3, 1fr) 0.5fr', padding: '10px 18px', background: '#f9f8f5', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                {['Scheme', 'Beds', 'Min', 'Avg', 'Max', 'Units'].map(h => (
                  <span key={h} style={{ color: 'rgba(0,0,0,0.35)', fontSize: 9.5, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' as const }}>{h}</span>
                ))}
              </div>
              {schemeGroups.map(g => (
                g.beds.map((b, i) => (
                  <div key={`${g.name}-${b.bed}`} style={{ display: 'grid', gridTemplateColumns: '1.5fr 0.6fr repeat(3, 1fr) 0.5fr', padding: '10px 18px', borderBottom: '1px solid rgba(0,0,0,0.04)', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, fontWeight: i === 0 ? 500 : 400, color: i === 0 ? '#111' : 'transparent' }}>{i === 0 ? g.name : ''}</span>
                    <span style={{ fontSize: 12, color: '#1d4ed8', fontWeight: 600 }}>{b.bed}-bed</span>
                    <span style={{ fontSize: 12, color: '#374151' }}>{fmtCurrency(b.min)}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#111' }}>{fmtCurrency(b.avg)}</span>
                    <span style={{ fontSize: 12, color: '#374151' }}>{fmtCurrency(b.max)}</span>
                    <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.5)' }}>{b.count}</span>
                  </div>
                ))
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
