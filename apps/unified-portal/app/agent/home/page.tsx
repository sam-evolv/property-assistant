'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useAgent } from '@/lib/agent/AgentContext';
import { type Alert, type DevelopmentSummary, type PipelineUnit, getInitials } from '@/lib/agent/agentPipelineService';
import AgentShell from '../_components/AgentShell';
import StatModal from '../_components/StatModal';
import IndependentHomeView from '../_components/IndependentHomeView';
import type { StatModalType, Scheme as UIScheme, Buyer as UIBuyer } from '../_components/types';

// Convert real pipeline data to the Scheme/Buyer types that StatModal expects
function buildSchemes(pipeline: PipelineUnit[], developments: DevelopmentSummary[]): UIScheme[] {
  return developments.map(dev => {
    const devUnits = pipeline.filter(p => p.developmentId === dev.id);
    const buyers: UIBuyer[] = devUnits
      .filter(u => u.status !== 'for_sale')
      .map(u => ({
        id: u.unitId,
        name: u.purchaserName || 'Unknown',
        initials: getInitials(u.purchaserName),
        unit: `Unit ${u.unitNumber}`,
        price: u.salePrice || 0,
        status: u.status === 'sale_agreed' ? 'reserved' as const
          : u.status === 'contracts_issued' ? 'contracts_out' as const
          : u.status === 'signed' ? 'exchanged' as const
          : u.status === 'sold' ? 'confirmed' as const
          : 'pending' as const,
        depositDate: u.depositDate,
        contractsDate: u.contractsIssuedDate,
        signedDate: u.signedContractsDate,
        closingDate: u.handoverDate,
        daysOverdue: 0,
        isUrgent: false,
        schemeName: dev.name,
      }));
    return {
      id: dev.id,
      name: dev.name,
      developer: 'Longview Estates',
      location: 'Co. Cork',
      totalUnits: dev.totalUnits,
      sold: dev.sold,
      reserved: dev.saleAgreed,
      available: dev.forSale,
      percentSold: dev.percentSold,
      activeBuyers: buyers.length,
      urgentCount: 0,
      buyers,
    };
  });
}

function buildUrgentBuyers(pipeline: PipelineUnit[], alerts: Alert[]): UIBuyer[] {
  return alerts
    .filter(a => a.type === 'overdue_contracts')
    .map(a => {
      const unit = pipeline.find(p => p.unitId === a.unitId);
      return {
        id: a.unitId,
        name: a.purchaserName,
        initials: getInitials(a.purchaserName),
        unit: `Unit ${a.unitNumber}`,
        price: unit?.salePrice || 0,
        status: 'contracts_out' as const,
        depositDate: null,
        contractsDate: unit?.contractsIssuedDate || null,
        signedDate: null,
        closingDate: null,
        daysOverdue: a.daysOverdue || 0,
        isUrgent: true,
        schemeName: a.developmentName,
      };
    });
}

export default function AgentHomePage() {
  const { agent, pipeline, alerts, developments, loading } = useAgent();
  const [modalType, setModalType] = useState<StatModalType>(null);

  const stats = useMemo(() => {
    if (!pipeline.length) return { total: 0, forSale: 0, saleAgreed: 0, contracted: 0, signed: 0, sold: 0, active: 0, urgent: 0 };
    const sold = pipeline.filter(p => p.status === 'sold').length;
    const active = pipeline.filter(p => p.status !== 'sold' && p.status !== 'for_sale').length;
    const urgent = alerts.length;
    return {
      total: pipeline.length,
      forSale: pipeline.filter(p => p.status === 'for_sale').length,
      saleAgreed: pipeline.filter(p => p.status === 'sale_agreed').length,
      contracted: pipeline.filter(p => p.status === 'contracts_issued').length,
      signed: pipeline.filter(p => p.status === 'signed').length,
      sold,
      active,
      urgent,
    };
  }, [pipeline, alerts]);

  const schemes = useMemo(() => buildSchemes(pipeline, developments), [pipeline, developments]);
  const urgentBuyers = useMemo(() => buildUrgentBuyers(pipeline, alerts), [pipeline, alerts]);

  if (loading) {
    return (
      <AgentShell agentName={agent?.displayName?.split(' ')[0] || 'Agent'} urgentCount={0}>
        <div style={{ padding: '2px 24px 100px' }}>
          <div style={{ height: 40, background: '#f3f4f6', borderRadius: 12, marginBottom: 20, animation: 'pulse 1.5s infinite' }} />
          {[1,2,3].map(i => (
            <div key={i} style={{ height: 80, background: '#f3f4f6', borderRadius: 16, marginBottom: 10, animation: 'pulse 1.5s infinite' }} />
          ))}
        </div>
      </AgentShell>
    );
  }

  // Independent/hybrid agents get a different home screen
  if (agent && agent.agentType !== 'scheme') {
    return (
      <AgentShell agentName={agent.displayName?.split(' ')[0] || 'Agent'} urgentCount={0}>
        <IndependentHomeView agent={agent} />
      </AgentShell>
    );
  }

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning,' : hour < 18 ? 'Good afternoon,' : 'Good evening,';

  return (
    <AgentShell
      agentName={agent?.displayName?.split(' ')[0] || 'Agent'}
      urgentCount={stats.urgent}
      modal={modalType ? (
        <StatModal
          type={modalType}
          onClose={() => setModalType(null)}
          schemes={schemes}
          totalSold={stats.sold}
          totalActive={stats.active}
          urgentBuyers={urgentBuyers}
        />
      ) : undefined}
    >
      <div style={{ padding: '2px 24px 100px' }}>
        {/* Greeting */}
        <p style={{ color: '#A0A8B0', fontSize: 13, fontWeight: 400, marginBottom: 4, letterSpacing: '0.01em' }}>
          {greeting}
        </p>
        <h1 style={{ color: '#0D0D12', fontSize: 32, fontWeight: 700, letterSpacing: '-0.055em', lineHeight: 1.05, marginBottom: 4 }}>
          {agent?.displayName?.split(' ')[0] || 'Agent'}.
        </h1>
        <p style={{ color: '#B0B8C4', fontSize: 13, letterSpacing: '0.01em', marginBottom: 28 }}>
          {agent?.agencyName} &middot; {developments.length} scheme{developments.length !== 1 ? 's' : ''} active
        </p>

        {/* Stat rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          <StatRow icon="trending" label="Units sold" value={stats.sold} color="#10B981" onClick={() => setModalType('sold')} />
          <StatRow icon="users" label="Active pipeline" value={stats.active} color="#3B82F6" onClick={() => setModalType('active')} />
          <StatRow icon="clock" label="Need attention" value={stats.urgent} color="#EF4444" urgent onClick={() => setModalType('urgent')} />
        </div>

        {/* Requires action section */}
        <SectionLabel>Requires action</SectionLabel>
        <div style={{
          background: '#FFFFFF',
          borderRadius: 18,
          overflow: 'hidden',
          boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05), 0 0 0 0.5px rgba(0,0,0,0.04)',
          marginBottom: 28,
        }}>
          {alerts.length === 0 ? (
            <div style={{ padding: '20px 18px', textAlign: 'center', color: '#A0A8B0', fontSize: 13 }}>
              No urgent items
            </div>
          ) : (
            alerts.slice(0, 5).map((alert, i) => (
              <Link
                key={`${alert.unitId}-${alert.type}-${i}`}
                href={`/agent/pipeline/${alert.unitId}`}
                style={{ textDecoration: 'none' }}
              >
                <div
                  className="agent-tappable"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '14px 18px',
                    position: 'relative',
                    borderBottom: i < Math.min(alerts.length, 5) - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none',
                  }}
                >
                  <div style={{
                    position: 'absolute', left: 0, top: 0, bottom: 0, width: 2,
                    background: alert.type === 'overdue_contracts' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(245, 158, 11, 0.3)',
                    borderRadius: i === 0 ? '18px 0 0 0' : i === Math.min(alerts.length, 5) - 1 ? '0 0 0 18px' : '0',
                  }} />
                  <div style={{ flex: 1, minWidth: 0, paddingLeft: 6 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 500, letterSpacing: '-0.01em', color: '#0D0D12' }}>
                      {alert.purchaserName}
                    </div>
                    <div style={{ fontSize: 11.5, color: '#A0A8B0', marginTop: 2 }}>
                      {alert.developmentName} &middot; Unit {alert.unitNumber}
                    </div>
                  </div>
                  <span style={{
                    background: alert.type === 'overdue_contracts' ? '#FEF2F2' : '#FFFBEB',
                    border: `1px solid ${alert.type === 'overdue_contracts' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)'}`,
                    borderRadius: 20,
                    padding: '3px 8px',
                    fontSize: 10,
                    fontWeight: 700,
                    color: alert.type === 'overdue_contracts' ? '#DC2626' : '#D97706',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}>
                    {alert.type === 'overdue_contracts' ? `${alert.daysOverdue}d` : `${alert.daysUntilExpiry}d`}
                  </span>
                </div>
              </Link>
            ))
          )}
        </div>

        {/* Schemes */}
        <SectionLabel>Your schemes</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {developments.map(dev => (
            <Link key={dev.id} href={`/agent/pipeline?dev=${dev.id}`} style={{ textDecoration: 'none' }}>
              <div
                className="agent-tappable"
                style={{
                  background: '#FFFFFF',
                  borderRadius: 18,
                  padding: '18px 18px 16px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05), 0 0 0 0.5px rgba(0,0,0,0.04)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 14.5, fontWeight: 600, color: '#0D0D12', letterSpacing: '-0.01em' }}>
                    {dev.name}
                  </span>
                  <span style={{
                    background: 'linear-gradient(135deg, #B8960C, #E8C84A)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    fontSize: 14,
                    fontWeight: 700,
                  }}>
                    {dev.percentSold}%
                  </span>
                </div>
                {/* Progress bar */}
                <div style={{ height: 4, background: 'rgba(0,0,0,0.04)', borderRadius: 2, overflow: 'hidden', marginBottom: 10 }}>
                  <div style={{
                    height: '100%', borderRadius: 2,
                    width: `${dev.percentSold}%`,
                    background: 'linear-gradient(90deg, #B8960C, #E8C84A)',
                  }} />
                </div>
                <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#A0A8B0' }}>
                  <span>{dev.totalUnits} total</span>
                  <span>{dev.forSale} available</span>
                  <span>{dev.sold} sold</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

    </AgentShell>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#A0A8B0', marginBottom: 12 }}>
      {children}
    </div>
  );
}

function StatRow({ icon, label, value, color, urgent, onClick }: {
  icon: 'trending' | 'users' | 'clock'; label: string; value: number; color: string; urgent?: boolean; onClick?: () => void;
}) {
  const iconBg = urgent ? 'rgba(239,68,68,0.08)' : icon === 'trending' ? 'rgba(16,185,129,0.08)' : 'rgba(59,130,246,0.08)';
  const iconBorder = urgent ? 'rgba(239,68,68,0.15)' : icon === 'trending' ? 'rgba(16,185,129,0.15)' : 'rgba(59,130,246,0.15)';

  return (
    <div className="agent-tappable" onClick={onClick} style={{
      padding: '16px 18px', borderRadius: 16, background: '#FFFFFF',
      boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05), 0 0 0 0.5px rgba(0,0,0,0.04)',
      display: 'flex', alignItems: 'center', gap: 14, position: 'relative', overflow: 'hidden',
      cursor: 'pointer',
    }}>
      {urgent && (
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: 'linear-gradient(180deg, #EF4444, #DC2626)', borderRadius: '3px 0 0 3px' }} />
      )}
      <div style={{
        width: 34, height: 34, borderRadius: 10, background: iconBg, border: `1px solid ${iconBorder}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginLeft: urgent ? 8 : 0,
      }}>
        <StatIcon type={icon} color={color} />
      </div>
      <span style={{ flex: 1, color: '#6B7280', fontSize: 13, fontWeight: 500 }}>{label}</span>
      <span style={{ color: urgent ? '#EF4444' : '#0D0D12', fontSize: 24, fontWeight: 700, letterSpacing: '-0.05em', lineHeight: 1 }}>
        {value}
      </span>
      <div style={{
        width: 22, height: 22, borderRadius: 7, background: iconBg, border: `1px solid ${iconBorder}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke={urgent ? 'rgba(239,68,68,0.5)' : `${color}80`} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9,18 15,12 9,6" />
        </svg>
      </div>
    </div>
  );
}

function StatIcon({ type, color }: { type: 'trending' | 'users' | 'clock'; color: string }) {
  switch (type) {
    case 'trending':
      return <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="23,6 13.5,15.5 8.5,10.5 1,18" /><polyline points="17,6 23,6 23,12" /></svg>;
    case 'users':
      return <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg>;
    case 'clock':
      return <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12,6 12,12 16,14" /></svg>;
  }
}
