'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useAgent } from '@/lib/agent/AgentContext';
import AgentShell from '../_components/AgentShell';
import { getSolicitorDirectory, type SolicitorGroup } from '@/lib/agent/agentPipelineService';
import { ArrowLeft, Phone, Mail, Building2, ChevronDown, ChevronUp, Users } from 'lucide-react';

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
      <AgentShell agentName={agent?.displayName?.split(' ')[0]} urgentCount={alerts.length}>
        <div style={{ padding: '16px 20px 100px' }}>
          {[1,2,3].map(i => <div key={i} style={{ height: 96, background: '#f3f4f6', borderRadius: 12, marginBottom: 8, animation: 'pulse 1.5s infinite' }} />)}
        </div>
      </AgentShell>
    );
  }

  return (
    <AgentShell agentName={agent?.displayName?.split(' ')[0]} urgentCount={alerts.length}>
      <div style={{ padding: '16px 20px 100px' }}>
          <Link href="/agent/pipeline" className="flex items-center gap-1.5 text-sm text-gray-400 mb-4 transition-all active:opacity-70">
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
                            href={`/agent/pipeline/${u.unitId}`}
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
    </AgentShell>
  );
}
