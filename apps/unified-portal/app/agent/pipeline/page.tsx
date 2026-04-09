'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useAgent } from '@/lib/agent/AgentContext';
import AgentShell from '../_components/AgentShell';
import IndependentPipelineView from '../_components/IndependentPipelineView';
import {
  getTimelineNudges, logPipelineNote, getInitials,
  daysSince, daysFromNow, type PipelineUnit, type DevelopmentSummary,
} from '@/lib/agent/agentPipelineService';
import {
  AlertTriangle, ChevronRight, Building2, Check
} from 'lucide-react';

interface SchemeGroup {
  id: string;
  name: string;
  allUnits: PipelineUnit[];
  sold: number;
  reserved: number;
  available: number;
  total: number;
  percentSold: number;
  activeBuyers: number;
  urgentCount: number;
}

export default function PipelinePage() {
  const { agent, pipeline, alerts, developments, loading } = useAgent();
  const [showBulkChase, setShowBulkChase] = useState(false);
  const [chaseSuccess, setChaseSuccess] = useState(false);

  const schemes = useMemo((): SchemeGroup[] => {
    const devMap = new Map<string, PipelineUnit[]>();
    for (const unit of pipeline) {
      if (!devMap.has(unit.developmentId)) devMap.set(unit.developmentId, []);
      devMap.get(unit.developmentId)!.push(unit);
    }

    return Array.from(devMap.entries()).map(([devId, allUnits]) => {
      const sold = allUnits.filter(u => u.status === 'sold').length;
      const reserved = allUnits.filter(u => u.status === 'sale_agreed' || u.status === 'signed' || u.status === 'contracts_issued').length;
      const available = allUnits.filter(u => u.status === 'for_sale').length;
      const total = allUnits.length;
      const urgentCount = alerts.filter(a => allUnits.some(u => u.unitId === a.unitId)).length;

      return {
        id: devId,
        name: allUnits[0]?.developmentName || 'Unknown',
        allUnits,
        sold,
        reserved,
        available,
        total,
        percentSold: total > 0 ? Math.round((sold / total) * 100) : 0,
        activeBuyers: allUnits.filter(u => u.status !== 'for_sale' && u.status !== 'sold').length,
        urgentCount,
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [pipeline, alerts]);

  const overdueContracted = useMemo(() => {
    return pipeline.filter(p => {
      if (p.status !== 'contracts_issued') return false;
      if (!p.contractsIssuedDate) return false;
      const days = daysSince(p.contractsIssuedDate);
      return days !== null && days > 60;
    });
  }, [pipeline]);

  const handleBulkChase = async () => {
    for (const unit of overdueContracted) {
      const dateStr = new Date().toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' });
      await logPipelineNote(unit.unitId, unit.id, `Bulk chase initiated by agent: ${dateStr}`, 'bulk_chase');
    }
    setShowBulkChase(false);
    setChaseSuccess(true);
    setTimeout(() => setChaseSuccess(false), 3000);
  };

  if (loading) {
    return (
      <AgentShell agentName={agent?.displayName?.split(' ')[0]} urgentCount={0}>
        <div style={{ padding: '16px 24px 100px' }}>
          {[1,2,3].map(i => (
            <div key={i} style={{ height: 140, background: '#f3f4f6', borderRadius: 18, marginBottom: 12, animation: 'pulse 1.5s infinite' }} />
          ))}
        </div>
      </AgentShell>
    );
  }

  // Independent/hybrid agents see listings instead of scheme pipeline
  if (agent && agent.agentType !== 'scheme') {
    return (
      <AgentShell agentName={agent.displayName?.split(' ')[0]} urgentCount={0}>
        <IndependentPipelineView agent={agent} />
      </AgentShell>
    );
  }

  return (
    <AgentShell agentName={agent?.displayName?.split(' ')[0]} urgentCount={alerts.length}>
      <div style={{ padding: '8px 24px 100px' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0D0D12', letterSpacing: '-0.04em', marginBottom: 14 }}>Sales Pipeline</h1>

        {/* Bulk Chase button */}
        {overdueContracted.length > 0 && (
          <div
            onClick={() => setShowBulkChase(true)}
            className="agent-tappable"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '12px 16px', borderRadius: 14,
              background: '#FEF2F2', border: '1px solid rgba(239,68,68,0.15)',
              marginBottom: 12, cursor: 'pointer',
            }}
          >
            <AlertTriangle size={15} color="#DC2626" />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#DC2626' }}>
              Chase All Overdue ({overdueContracted.length})
            </span>
          </div>
        )}

        {/* Scheme cards — each links to scheme detail page */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {schemes.map(scheme => (
            <SchemeCard key={scheme.id} scheme={scheme} />
          ))}
        </div>

        {/* Solicitor Directory link */}
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 20, cursor: 'pointer' }}
          className="agent-tappable"
        >
          <Building2 size={14} color="#D4AF37" />
          <Link href="/agent/solicitors" style={{
            fontSize: 13, fontWeight: 600, color: '#D4AF37', textDecoration: 'none',
            letterSpacing: '-0.01em',
          }}>
            View Solicitor Directory
          </Link>
          <ChevronRight size={12} color="#D4AF37" />
        </div>
      </div>

      {/* Bulk Chase Confirmation Sheet */}
      {showBulkChase && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 60, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={() => setShowBulkChase(false)}>
          <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 500, padding: '20px 20px 32px' }} onClick={e => e.stopPropagation()}>
            <div style={{ width: 40, height: 4, background: '#E0E0DC', borderRadius: 2, margin: '0 auto 16px' }} />
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0D0D12', marginBottom: 4 }}>Chase All Overdue</h3>
            <p style={{ fontSize: 13, color: '#A0A8B0', marginBottom: 16 }}>Log a follow-up note for {overdueContracted.length} overdue units:</p>
            <div style={{ maxHeight: 200, overflowY: 'auto', marginBottom: 20 }}>
              {overdueContracted.map(u => (
                <div key={u.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(0,0,0,0.04)', fontSize: 13 }}>
                  <span style={{ fontWeight: 500, color: '#0D0D12' }}>Unit {u.unitNumber}</span>
                  <span style={{ color: '#A0A8B0', fontSize: 12 }}>{u.purchaserName}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setShowBulkChase(false)} className="agent-tappable" style={{ flex: 1, padding: '13px 0', borderRadius: 14, border: '1px solid rgba(0,0,0,0.08)', background: '#fff', fontSize: 13, fontWeight: 600, color: '#6B7280', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleBulkChase} className="agent-tappable" style={{ flex: 1, padding: '13px 0', borderRadius: 14, border: 'none', background: '#0D0D12', fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer' }}>Confirm Chase</button>
            </div>
          </div>
        </div>
      )}

      {/* Success toast */}
      {chaseSuccess && (
        <div style={{ position: 'fixed', top: 80, left: '50%', transform: 'translateX(-50%)', background: '#059669', color: '#fff', fontSize: 13, fontWeight: 600, padding: '10px 18px', borderRadius: 14, zIndex: 70, display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
          <Check size={15} />
          {overdueContracted.length} units logged for follow-up
        </div>
      )}
    </AgentShell>
  );
}

/* ─── Scheme card — clickable, links to scheme detail ─── */

function SchemeCard({ scheme }: { scheme: SchemeGroup }) {
  return (
    <Link href={`/agent/pipeline/scheme/${scheme.id}`} style={{ textDecoration: 'none', display: 'block' }}>
      <div
        className="agent-tappable"
        style={{
          background: '#FFFFFF',
          borderRadius: 18,
          overflow: 'hidden',
          boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05), 0 0 0 0.5px rgba(0,0,0,0.04)',
        }}
      >
        {/* Card header */}
        <div style={{ padding: '16px 18px' }}>
          {/* Name + % */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.025em', color: '#0D0D12' }}>
                {scheme.name}
              </span>
              {scheme.urgentCount > 0 && (
                <span style={{
                  background: '#FEF2F2', border: '1px solid rgba(239,68,68,0.2)',
                  borderRadius: 20, padding: '2px 7px', fontSize: 9.5, fontWeight: 700, color: '#DC2626', lineHeight: 1.2,
                }}>
                  {scheme.urgentCount}
                </span>
              )}
            </div>
            <span style={{
              background: 'linear-gradient(135deg, #B8960C, #E8C84A)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em',
            }}>
              {scheme.percentSold}%
            </span>
          </div>

          {/* Subtitle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 13, color: '#A0A8B0' }}>{scheme.name} &middot; {scheme.sold} of {scheme.total}</span>
          </div>

          {/* Progress bar */}
          <div style={{ height: 3, background: 'rgba(0,0,0,0.05)', borderRadius: 2, overflow: 'hidden', marginBottom: 10 }}>
            <div style={{ height: '100%', width: `${scheme.percentSold}%`, background: 'linear-gradient(90deg, #B8960C, #E8C84A)', borderRadius: 2, transition: 'width 0.3s ease' }} />
          </div>

          {/* Status dots */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <StatusDot color="#10B981" label={`${scheme.sold} Sold`} />
            <StatusDot color="#3B82F6" label={`${scheme.reserved} Reserved`} />
            <StatusDot color="#A0A8B0" label={`${scheme.available} Available`} />
          </div>
        </div>

        {/* Footer: active buyers + chevron */}
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 18px', borderTop: '1px solid rgba(0,0,0,0.04)',
          }}
        >
          <span style={{ fontSize: 13, color: '#A0A8B0' }}>{scheme.activeBuyers} active buyers</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{
              background: 'linear-gradient(135deg, #B8960C, #E8C84A)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              fontSize: 13, fontWeight: 600, letterSpacing: '-0.01em',
            }}>
              View all
            </span>
            <ChevronRight size={14} color="#C4A020" />
          </div>
        </div>
      </div>
    </Link>
  );
}

/* ─── Helpers ─── */

function StatusDot({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div style={{ width: 5, height: 5, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <span style={{ fontSize: 13, color: '#6B7280' }}>{label}</span>
    </div>
  );
}
