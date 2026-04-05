'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useAgent } from '@/lib/agent/AgentContext';
import AgentBottomNav from '../_components/AgentBottomNavNew';
import {
  getTimelineNudges, logPipelineNote,
  daysSince, daysFromNow, type PipelineUnit,
} from '@/lib/agent/agentPipelineService';
import {
  Bell, AlertTriangle, ChevronRight, Filter,
  Building2, Phone, Search, X, Check
} from 'lucide-react';

type FilterKey = 'all' | 'for_sale' | 'sale_agreed' | 'contracts_issued' | 'signed' | 'sold';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'for_sale', label: 'For Sale' },
  { key: 'sale_agreed', label: 'Sale Agreed' },
  { key: 'contracts_issued', label: 'Contracted' },
  { key: 'signed', label: 'Signed' },
  { key: 'sold', label: 'Sold' },
];

const STATUS_LABELS: Record<string, string> = {
  for_sale: 'For Sale',
  sale_agreed: 'Sale Agreed',
  contracts_issued: 'Contracts Out',
  signed: 'Contracts Signed',
  sold: 'Sold',
};

export default function PipelinePage() {
  const { agent, pipeline, alerts, loading, developmentName } = useAgent();
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [showBulkChase, setShowBulkChase] = useState(false);
  const [chaseSuccess, setChaseSuccess] = useState(false);

  const filtered = useMemo(() => {
    let items = [...pipeline];
    if (activeFilter !== 'all') {
      items = items.filter(p => p.status === activeFilter);
    }
    // Sort: non-sold first by unit number, then sold
    const nonSold = items.filter(p => p.status !== 'sold').sort((a, b) => {
      const aNum = parseInt(a.unitNumber) || 0;
      const bNum = parseInt(b.unitNumber) || 0;
      return aNum - bNum;
    });
    const sold = items.filter(p => p.status === 'sold').sort((a, b) => {
      const aNum = parseInt(a.unitNumber) || 0;
      const bNum = parseInt(b.unitNumber) || 0;
      return aNum - bNum;
    });
    return [...nonSold, ...sold];
  }, [pipeline, activeFilter]);

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
      await logPipelineNote(
        unit.unitId,
        unit.id,
        `Bulk chase initiated by agent: ${dateStr}`,
        'bulk_chase'
      );
    }
    setShowBulkChase(false);
    setChaseSuccess(true);
    setTimeout(() => setChaseSuccess(false), 3000);
  };

  if (loading) {
    return (
      <div className="flex flex-col h-dvh bg-[#FAFAF8]" style={{ fontFamily: 'Inter, sans-serif' }}>
        <div className="h-[54px] border-b border-gray-100" />
        <div className="flex-1 p-5 space-y-3">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-dvh bg-[#FAFAF8]" style={{ fontFamily: "'Inter', -apple-system, sans-serif" }}>
      {/* Header */}
      <header className="h-[54px] flex items-center justify-between px-5 flex-shrink-0 bg-[#FAFAF8] border-b border-gray-100/50">
        <div className="flex items-center gap-2">
          <span className="text-[#D4AF37] font-bold text-sm tracking-wide">OPENHOUSE</span>
          <span className="text-gray-300 text-sm">|</span>
          <span className="text-gray-400 text-sm font-medium">{agent?.agencyName || 'Agent'}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 font-medium">{agent?.displayName}</span>
          <div className="relative">
            <Bell size={20} className="text-gray-400" />
            {alerts.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {alerts.length}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden pb-24" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="px-5 pt-4">
          <h1 className="text-xl font-bold text-gray-900 tracking-tight mb-4">Pipeline</h1>

          {/* Filter pills */}
          <div className="flex gap-2 overflow-x-auto pb-3 -mx-5 px-5 scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
            {FILTERS.map(f => (
              <button
                key={f.key}
                onClick={() => setActiveFilter(f.key)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-150 active:scale-[0.95] flex-shrink-0 ${
                  activeFilter === f.key
                    ? 'bg-gray-900 text-white'
                    : 'bg-white border border-gray-200 text-gray-600'
                }`}
                style={{ minHeight: 32 }}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Bulk Chase button */}
          {activeFilter === 'contracts_issued' && overdueContracted.length > 0 && (
            <button
              onClick={() => setShowBulkChase(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm font-medium mb-3 transition-all duration-150 active:scale-[0.98]"
            >
              <AlertTriangle size={16} />
              Chase All Overdue ({overdueContracted.length})
            </button>
          )}

          {/* Solicitor Directory link */}
          <Link
            href="/agent/solicitors?preview=savills"
            className="flex items-center gap-1.5 text-xs text-[#D4AF37] font-medium mb-4 transition-all duration-150 active:opacity-70"
          >
            <Building2 size={14} />
            View Solicitor Directory
            <ChevronRight size={12} />
          </Link>

          {/* Unit list */}
          <div className="space-y-2">
            {filtered.map(unit => (
              <UnitCard key={unit.id} unit={unit} alerts={alerts} />
            ))}
            {filtered.length === 0 && (
              <div className="text-center text-gray-400 text-sm py-8">No units match this filter</div>
            )}
          </div>
        </div>
      </main>

      {/* Bottom Nav */}
      <AgentBottomNav />

      {/* Bulk Chase Confirmation Sheet */}
      {showBulkChase && (
        <div className="fixed inset-0 bg-black/40 z-[60] flex items-end justify-center" onClick={() => setShowBulkChase(false)}>
          <div className="bg-white rounded-t-2xl w-full max-w-lg p-5 pb-8" onClick={e => e.stopPropagation()} style={{ paddingBottom: 'max(32px, env(safe-area-inset-bottom))' }}>
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
            <h3 className="text-lg font-bold text-gray-900 mb-1">Chase All Overdue</h3>
            <p className="text-sm text-gray-500 mb-4">This will log a follow-up note for {overdueContracted.length} overdue units:</p>
            <div className="space-y-2 mb-5 max-h-48 overflow-y-auto">
              {overdueContracted.map(u => (
                <div key={u.id} className="flex items-center justify-between text-sm py-1.5 border-b border-gray-50">
                  <span className="font-medium text-gray-900">Unit {u.unitNumber}</span>
                  <span className="text-gray-500 text-xs">{u.purchaserName}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowBulkChase(false)} className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium transition-all duration-150 active:scale-[0.98]">
                Cancel
              </button>
              <button onClick={handleBulkChase} className="flex-1 py-3 rounded-xl bg-gray-900 text-white text-sm font-medium transition-all duration-150 active:scale-[0.98]">
                Confirm Chase
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success toast */}
      {chaseSuccess && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-emerald-600 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-lg z-[70] flex items-center gap-2">
          <Check size={16} />
          {overdueContracted.length} units logged for follow-up
        </div>
      )}
    </div>
  );
}

function UnitCard({ unit, alerts }: { unit: PipelineUnit; alerts: any[] }) {
  const nudges = getTimelineNudges(unit);
  const hasOverdue = nudges.length > 0;
  const hasMortgageAlert = unit.mortgageExpiryDate && daysFromNow(unit.mortgageExpiryDate) !== null && (daysFromNow(unit.mortgageExpiryDate) || 999) <= 45;
  const isSold = unit.status === 'sold';

  return (
    <Link
      href={`/agent/pipeline/${unit.unitId}?preview=savills`}
      className={`block transition-all duration-150 active:scale-[0.98] ${isSold ? 'opacity-60' : ''}`}
    >
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3.5 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className={`font-medium text-gray-900 ${isSold ? 'text-xs' : 'text-sm'}`}>
              Unit {unit.unitNumber}
            </span>
            <span className="text-gray-300 text-xs">&middot;</span>
            <span className="text-gray-400 text-xs truncate">{unit.developmentName}</span>
            {/* Nudge indicators */}
            {hasOverdue && <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />}
            {hasMortgageAlert && !hasOverdue && <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />}
          </div>
          <div className={`text-gray-400 mt-0.5 ${isSold ? 'text-[11px]' : 'text-xs'}`}>
            {unit.purchaserName || 'Available'}
          </div>
        </div>
        <StatusBadge status={unit.status} />
        <ChevronRight size={16} className="text-gray-200 flex-shrink-0" />
      </div>
    </Link>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    for_sale: 'bg-gray-100 text-gray-600',
    sale_agreed: 'bg-blue-50 text-blue-700',
    contracts_issued: 'bg-amber-50 text-amber-700 border border-amber-200',
    signed: 'bg-emerald-50 text-emerald-700',
    sold: 'bg-gray-50 text-gray-400',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap flex-shrink-0 ${styles[status] || styles.for_sale}`}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}

