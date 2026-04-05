'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useAgent } from '@/lib/agent/AgentContext';
import AgentBottomNav from '../_components/AgentBottomNavNew';
import { getSolicitorDirectory, type SolicitorGroup } from '@/lib/agent/agentPipelineService';
import { ArrowLeft, Phone, Mail, Building2, ChevronDown, ChevronUp, Bell, Users } from 'lucide-react';

const STATUS_LABELS: Record<string, string> = {
  for_sale: 'For Sale', sale_agreed: 'Sale Agreed', contracts_issued: 'Contracts Out',
  signed: 'Contracts Signed', sold: 'Sold',
};
const STATUS_CLASS: Record<string, string> = {
  for_sale: 'bg-gray-100 text-gray-600',
  sale_agreed: 'bg-blue-50 text-blue-700',
  contracts_issued: 'bg-amber-50 text-amber-700 border border-amber-200',
  signed: 'bg-emerald-50 text-emerald-700',
  sold: 'bg-gray-50 text-gray-400',
};

export default function SolicitorsPage() {
  const { agent, pipeline, alerts, loading } = useAgent();
  const [expanded, setExpanded] = useState<string | null>(null);

  const groups = useMemo(() => getSolicitorDirectory(pipeline), [pipeline]);

  if (loading) {
    return (
      <div className="flex flex-col h-dvh bg-[#FAFAF8]" style={{ fontFamily: 'Inter, sans-serif' }}>
        <div className="h-[54px] border-b border-gray-100" />
        <div className="flex-1 p-5 space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}
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

      <main className="flex-1 overflow-y-auto overflow-x-hidden pb-24" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="px-5 pt-4">
          <Link href="/agent/pipeline?preview=savills" className="flex items-center gap-1.5 text-sm text-gray-400 mb-4 transition-all active:opacity-70">
            <ArrowLeft size={16} /> Back to Pipeline
          </Link>

          <h1 className="text-xl font-bold text-gray-900 tracking-tight mb-4">Solicitor Directory</h1>

          {groups.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 text-center">
              <Building2 size={24} className="text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No solicitors assigned yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {groups.map(group => {
                const isExpanded = expanded === group.firm;
                return (
                  <div key={group.firm} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-semibold text-gray-900 text-sm">{group.firm}</h3>
                          <p className="text-xs text-gray-500 mt-0.5">{group.contact}</p>
                        </div>
                        <span className="bg-gray-100 text-gray-600 text-[10px] font-medium rounded-full px-2 py-0.5 flex items-center gap-1">
                          <Users size={10} /> {group.units.length} unit{group.units.length !== 1 ? 's' : ''}
                        </span>
                      </div>

                      <div className="flex gap-2 mt-3">
                        {group.phone && (
                          <a href={`tel:${group.phone}`} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-medium transition-all active:scale-[0.95]" style={{ minHeight: 36 }}>
                            <Phone size={13} /> Call
                          </a>
                        )}
                        {group.email && (
                          <a href={`mailto:${group.email}`} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-xs font-medium transition-all active:scale-[0.95]" style={{ minHeight: 36 }}>
                            <Mail size={13} /> Email
                          </a>
                        )}
                        <button
                          onClick={() => setExpanded(isExpanded ? null : group.firm)}
                          className="ml-auto flex items-center gap-1 text-xs text-gray-400 transition-all active:opacity-70"
                        >
                          {isExpanded ? 'Hide' : 'Show'} units
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-gray-50 px-4 py-2">
                        {group.units.map(u => (
                          <Link
                            key={u.unitId}
                            href={`/agent/pipeline/${u.unitId}?preview=savills`}
                            className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0 transition-all active:opacity-70"
                          >
                            <div>
                              <span className="text-sm font-medium text-gray-900">Unit {u.unitNumber}</span>
                              <span className="text-xs text-gray-400 ml-2">{u.purchaserName}</span>
                            </div>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_CLASS[u.status] || ''}`}>
                              {STATUS_LABELS[u.status] || u.status}
                            </span>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <AgentBottomNav />
    </div>
  );
}
