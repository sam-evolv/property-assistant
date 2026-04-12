'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users,
  Search,
  Phone,
  Mail,
  MessageSquare,
  Zap,
  X,
  CheckCircle,
  Clock,
  AlertTriangle,
  ChevronRight,
} from 'lucide-react';
import { useAgentDashboard } from '../layout-provider';

export const dynamic = 'force-dynamic';

interface BuyerItem {
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

type FilterTab = 'all' | 'active' | 'needs_followup' | 'complete';

export default function AgentDashboardClientsPage() {
  const router = useRouter();
  const { selectedSchemeId } = useAgentDashboard();
  const [buyers, setBuyers] = useState<BuyerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [selectedBuyer, setSelectedBuyer] = useState<BuyerItem | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/agent/pipeline-data');
        if (!res.ok) return;
        const data = await res.json();
        const allBuyers = (data.pipeline ?? []).filter((p: BuyerItem) => p.purchaserName && p.status !== 'for_sale');
        setBuyers(allBuyers);
      } catch { /* silent */ }
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
    if (activeTab === 'needs_followup') list = list.filter(b =>
      b.dates?.contractsIssued && !b.dates?.contractsSigned &&
      new Date(b.dates.contractsIssued) < new Date(Date.now() - 14 * 86400000)
    );
    return list;
  }, [buyers, selectedSchemeId, search, activeTab]);

  const tabCounts = useMemo(() => {
    const base = selectedSchemeId ? buyers.filter(b => b.developmentId === selectedSchemeId) : buyers;
    return {
      all: base.length,
      active: base.filter(b => ['agreed', 'sale_agreed', 'in_progress', 'signed', 'contracts_issued', 'contracts_signed'].includes(b.status)).length,
      needs_followup: base.filter(b => b.dates?.contractsIssued && !b.dates?.contractsSigned && new Date(b.dates.contractsIssued) < new Date(Date.now() - 14 * 86400000)).length,
      complete: base.filter(b => ['sold', 'complete'].includes(b.status)).length,
    };
  }, [buyers, selectedSchemeId]);

  const getInitials = (name: string) => {
    const parts = name.split(' ').filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return (parts[0]?.[0] || '?').toUpperCase();
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, { bg: string; color: string; border: string; label: string }> = {
      agreed: { bg: '#eff6ff', color: '#1d4ed8', border: 'rgba(29,78,216,0.2)', label: 'Agreed' },
      sale_agreed: { bg: '#eff6ff', color: '#1d4ed8', border: 'rgba(29,78,216,0.2)', label: 'Sale Agreed' },
      in_progress: { bg: '#fffbeb', color: '#92400e', border: 'rgba(146,64,14,0.2)', label: 'In Progress' },
      contracts_issued: { bg: '#fffbeb', color: '#92400e', border: 'rgba(146,64,14,0.2)', label: 'Contracts Out' },
      signed: { bg: '#f5f3ff', color: '#5b21b6', border: 'rgba(91,33,182,0.2)', label: 'Signed' },
      contracts_signed: { bg: '#f5f3ff', color: '#5b21b6', border: 'rgba(91,33,182,0.2)', label: 'Signed' },
      sold: { bg: '#f0fdf4', color: '#15803d', border: 'rgba(21,128,61,0.2)', label: 'Complete' },
      complete: { bg: '#f0fdf4', color: '#15803d', border: 'rgba(21,128,61,0.2)', label: 'Complete' },
    };
    const s = map[status] || { bg: '#f3f4f6', color: '#6b7280', border: 'rgba(0,0,0,0.1)', label: status };
    return (
      <span style={{
        display: 'inline-block', fontSize: 11, fontWeight: 600,
        padding: '2px 8px', borderRadius: 10,
        background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      }}>
        {s.label}
      </span>
    );
  };

  const formatDate = (d?: string) => d ? new Date(d).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' }) : '\u2014';
  const formatCurrency = (v?: number) => v ? new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v) : '\u2014';

  const isOverdue = (b: BuyerItem) => b.dates?.contractsIssued && !b.dates?.contractsSigned && new Date(b.dates.contractsIssued) < new Date(Date.now() - 21 * 86400000);

  const getProgress = (b: BuyerItem) => {
    const steps = [b.dates?.saleAgreed, b.dates?.deposit, b.dates?.contractsIssued, b.dates?.contractsSigned, b.dates?.counterSigned, b.dates?.drawdown, b.dates?.handover];
    const done = steps.filter(Boolean).length;
    return Math.round((done / steps.length) * 100);
  };

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: `All (${tabCounts.all})` },
    { key: 'active', label: `Active (${tabCounts.active})` },
    { key: 'needs_followup', label: `Needs Follow-up (${tabCounts.needs_followup})` },
    { key: 'complete', label: `Complete (${tabCounts.complete})` },
  ];

  if (loading) {
    return (
      <div style={{ padding: '32px 32px' }}>
        <div style={{ height: 24, width: 180, background: 'rgba(0,0,0,0.06)', borderRadius: 6, marginBottom: 24 }} />
        {[1,2,3,4,5].map(i => (
          <div key={i} style={{ height: 56, background: '#fff', borderRadius: 8, marginBottom: 4, border: '0.5px solid rgba(0,0,0,0.07)' }} />
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: '100vh' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Quick Actions */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 32px', background: '#fff',
          borderBottom: '1px solid rgba(0,0,0,0.07)',
        }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: 'rgba(0,0,0,0.35)', textTransform: 'uppercase' as const, marginRight: 8 }}>
            QUICK ACTIONS
          </span>
          <button
            onClick={() => router.push('/agent/dashboard/communications')}
            style={{ height: 30, padding: '0 14px', background: '#c8960a', border: 'none', borderRadius: 7, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            + Log Contact
          </button>
          <button
            onClick={() => router.push('/agent/dashboard/intelligence?prompt=Who are my most at-risk buyers right now?')}
            style={{ height: 30, padding: '0 12px', background: '#fff', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 7, color: '#374151', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            At-Risk Report
          </button>
        </div>

        <div style={{ padding: '28px 32px' }}>
          <h1 style={{ color: '#111', fontSize: 20, fontWeight: 700, letterSpacing: '-0.04em', margin: '0 0 20px' }}>
            Clients & Buyers
          </h1>

          {/* Filter tabs + search */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {tabs.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  style={{
                    padding: '6px 14px', borderRadius: 8,
                    background: activeTab === tab.key ? 'rgba(200,150,10,0.1)' : 'transparent',
                    border: activeTab === tab.key ? '1px solid rgba(200,150,10,0.2)' : '1px solid transparent',
                    color: activeTab === tab.key ? '#c8960a' : 'rgba(0,0,0,0.5)',
                    fontSize: 12.5, fontWeight: activeTab === tab.key ? 600 : 500,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div style={{ position: 'relative' }}>
              <Search size={14} color="rgba(0,0,0,0.3)" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder="Search buyers..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  width: 220, height: 32, paddingLeft: 32, paddingRight: 10,
                  border: '1px solid rgba(0,0,0,0.12)', borderRadius: 8,
                  fontSize: 12.5, fontFamily: 'inherit', outline: 'none',
                  background: '#fff',
                }}
              />
            </div>
          </div>

          {/* Buyers table */}
          <div style={{
            background: '#fff', borderRadius: 12,
            border: '0.5px solid rgba(0,0,0,0.07)',
            boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05)',
            overflow: 'hidden',
          }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1.2fr 0.8fr 1fr 0.8fr 0.8fr',
              padding: '10px 18px',
              background: '#f9f8f5',
              borderBottom: '1px solid rgba(0,0,0,0.07)',
            }}>
              {['Buyer', 'Scheme', 'Unit', 'Stage', 'Price', 'Progress'].map(h => (
                <span key={h} style={{ color: 'rgba(0,0,0,0.35)', fontSize: 9.5, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' as const }}>
                  {h}
                </span>
              ))}
            </div>
            {filtered.map((buyer, i) => (
              <div
                key={buyer.id}
                onClick={() => setSelectedBuyer(buyer)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1.2fr 0.8fr 1fr 0.8fr 0.8fr',
                  padding: '11px 18px',
                  borderBottom: i < filtered.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none',
                  cursor: 'pointer',
                  transition: 'background 0.1s',
                  borderLeft: isOverdue(buyer) ? '3px solid rgba(239,68,68,0.45)' : '3px solid transparent',
                }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#faf9f7'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: '#1d4ed8', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: 11, fontWeight: 700, flexShrink: 0,
                  }}>
                    {getInitials(buyer.purchaserName)}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 500, color: '#111' }}>{buyer.purchaserName}</span>
                </div>
                <span style={{ fontSize: 13, color: '#111', alignSelf: 'center' }}>{buyer.developmentName}</span>
                <span style={{ fontSize: 13, color: 'rgba(0,0,0,0.5)', alignSelf: 'center' }}>{buyer.unitNumber}</span>
                <div style={{ alignSelf: 'center' }}>{getStatusBadge(buyer.status)}</div>
                <span style={{ fontSize: 13, fontWeight: 500, color: '#111', alignSelf: 'center' }}>{formatCurrency(buyer.prices?.sale)}</span>
                <div style={{ alignSelf: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ flex: 1, height: 4, background: '#e5e7eb', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${getProgress(buyer)}%`, background: 'linear-gradient(135deg, #B8960C, #E8C84A)', borderRadius: 2 }} />
                    </div>
                    <span style={{ fontSize: 11, color: 'rgba(0,0,0,0.4)', fontWeight: 600 }}>{getProgress(buyer)}%</span>
                  </div>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div style={{ padding: '40px 18px', textAlign: 'center' }}>
                <Users size={24} color="rgba(0,0,0,0.15)" style={{ marginBottom: 8 }} />
                <p style={{ color: 'rgba(0,0,0,0.35)', fontSize: 13, margin: 0 }}>No buyers found</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right-side buyer profile panel */}
      {selectedBuyer && (
        <div style={{
          width: 320, borderLeft: '1px solid rgba(0,0,0,0.08)',
          background: '#fff', display: 'flex', flexDirection: 'column',
          height: '100vh', position: 'sticky', top: 0,
        }}>
          {/* Header */}
          <div style={{ padding: '16px 18px 12px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div style={{
                width: 42, height: 42, background: '#1d4ed8', borderRadius: 9,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontWeight: 700, fontSize: 14,
              }}>
                {getInitials(selectedBuyer.purchaserName)}
              </div>
              <button onClick={() => setSelectedBuyer(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                <X size={16} color="rgba(0,0,0,0.3)" />
              </button>
            </div>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: '#111', margin: '0 0 2px', letterSpacing: '-0.02em' }}>{selectedBuyer.purchaserName}</h3>
            <p style={{ fontSize: 12, color: 'rgba(0,0,0,0.5)', margin: 0 }}>
              {selectedBuyer.developmentName} \u00B7 {selectedBuyer.unitNumber}
            </p>
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              {selectedBuyer.bedrooms && (
                <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: '#eff6ff', color: '#1d4ed8' }}>
                  {selectedBuyer.bedrooms} Bed
                </span>
              )}
              {getStatusBadge(selectedBuyer.status)}
            </div>
          </div>

          {/* Progress bar */}
          <div style={{ padding: '12px 18px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: 'rgba(0,0,0,0.5)' }}>Sale Progress</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#111' }}>{getProgress(selectedBuyer)}%</span>
            </div>
            <div style={{ height: 4, background: '#e5e7eb', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${getProgress(selectedBuyer)}%`, background: 'linear-gradient(135deg, #B8960C, #E8C84A)', borderRadius: 2 }} />
            </div>
          </div>

          {/* Meta */}
          <div style={{ display: 'flex', padding: '10px 18px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.07em', color: 'rgba(0,0,0,0.35)', textTransform: 'uppercase' as const, margin: '0 0 3px' }}>PRICE</p>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#111', margin: 0 }}>{formatCurrency(selectedBuyer.prices?.sale)}</p>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.07em', color: 'rgba(0,0,0,0.35)', textTransform: 'uppercase' as const, margin: '0 0 3px' }}>EST. CLOSE</p>
              <p style={{ fontSize: 13, fontWeight: 600, color: selectedBuyer.dates?.estimatedClose && new Date(selectedBuyer.dates.estimatedClose) < new Date() ? '#dc2626' : '#111', margin: 0 }}>
                {formatDate(selectedBuyer.dates?.estimatedClose)}
              </p>
            </div>
          </div>

          {/* Timeline */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
            <p style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.07em', color: 'rgba(0,0,0,0.35)', textTransform: 'uppercase' as const, margin: '0 0 4px', padding: '8px 18px 0' }}>TIMELINE</p>
            {[
              { label: 'Sale Agreed', date: selectedBuyer.dates?.saleAgreed },
              { label: 'Deposit Received', date: selectedBuyer.dates?.deposit },
              { label: 'Contracts Issued', date: selectedBuyer.dates?.contractsIssued },
              { label: 'Contracts Signed', date: selectedBuyer.dates?.contractsSigned, overdue: isOverdue(selectedBuyer) && !selectedBuyer.dates?.contractsSigned },
              { label: 'Counter Signed', date: selectedBuyer.dates?.counterSigned },
              { label: 'Drawdown', date: selectedBuyer.dates?.drawdown },
              { label: 'Handover Complete', date: selectedBuyer.dates?.handover },
            ].map((step) => (
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
                  <p style={{ fontSize: 11, color: step.overdue ? '#dc2626' : 'rgba(0,0,0,0.38)', margin: '1px 0 0' }}>
                    {step.date ? formatDate(step.date) : step.overdue ? 'Overdue' : '\u2014'}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Chase button if overdue */}
          {isOverdue(selectedBuyer) && (
            <div style={{ padding: '12px 18px', background: '#fef9ec', borderTop: '1px solid rgba(200,150,10,0.2)' }}>
              <p style={{ fontSize: 11.5, color: '#92400e', marginBottom: 8, lineHeight: 1.5, margin: '0 0 8px' }}>
                Contracts overdue. Follow up required.
              </p>
              <button
                onClick={() => router.push(`/agent/dashboard/intelligence?prompt=${encodeURIComponent(`Chase solicitor for ${selectedBuyer.purchaserName} on ${selectedBuyer.unitNumber} in ${selectedBuyer.developmentName}. Contracts issued but not signed. Draft a professional follow-up email.`)}`)}
                style={{
                  width: '100%', height: 34,
                  background: 'linear-gradient(135deg, #B8960C, #E8C84A)',
                  border: 'none', borderRadius: 7, color: '#fff',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                <Zap size={13} /> Chase with Intelligence
              </button>
            </div>
          )}

          {/* Action tabs */}
          <div style={{ display: 'flex', borderTop: '1px solid rgba(0,0,0,0.07)' }}>
            {['Message', 'Docs', 'Notes', 'History'].map(tab => (
              <button
                key={tab}
                style={{
                  flex: 1, height: 40, background: 'none', border: 'none',
                  cursor: 'pointer', fontSize: 12, fontWeight: 500,
                  color: 'rgba(0,0,0,0.45)', borderTop: '2px solid transparent',
                  fontFamily: 'inherit',
                }}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
