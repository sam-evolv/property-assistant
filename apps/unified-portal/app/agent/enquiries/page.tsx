'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAgent } from '@/lib/agent/AgentContext';
import AgentShell from '../_components/AgentShell';
import type { Enquiry, EnquiryStatus } from '@/lib/agent/independentAgentService';
import { getEnquiries, updateEnquiryStatus } from '@/lib/agent/independentAgentService';

type FilterKey = 'all' | 'new' | 'contacted' | 'viewing_booked' | 'sale_agreed';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'new', label: 'New' },
  { key: 'contacted', label: 'Contacted' },
  { key: 'viewing_booked', label: 'Viewing Booked' },
  { key: 'sale_agreed', label: 'Sale Agreed' },
];

const STATUS_CONFIGS: Record<string, { bg: string; color: string; label: string }> = {
  new: { bg: '#EFF6FF', color: '#1D4ED8', label: 'NEW' },
  contacted: { bg: '#ECFDF5', color: '#059669', label: 'CONTACTED' },
  viewing_booked: { bg: '#FFF7ED', color: '#D97706', label: 'VIEWING' },
  sale_agreed: { bg: '#F3E8FF', color: '#7C3AED', label: 'AGREED' },
  dead: { bg: '#F3F4F6', color: '#6B7280', label: 'CLOSED' },
};

export default function EnquiriesPage() {
  const { agent, loading: agentLoading } = useAgent();
  const searchParams = useSearchParams();
  const listingFilter = searchParams.get('listing');
  const statusFilter = searchParams.get('filter');

  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterKey>(statusFilter === 'follow_up' ? 'contacted' : 'all');
  const [showContactSheet, setShowContactSheet] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!agent) return;
      const data = await getEnquiries(agent.id, listingFilter || undefined);
      setEnquiries(data);
      setLoading(false);
    }
    if (!agentLoading) load();
  }, [agent, agentLoading, listingFilter]);

  const filtered = activeFilter === 'all'
    ? enquiries.filter(e => e.status !== 'dead')
    : enquiries.filter(e => e.status === activeFilter);

  const handleLogContact = async (enquiryId: string, outcome: string, nextFollowUp: string) => {
    const success = await updateEnquiryStatus(enquiryId, outcome as EnquiryStatus, {
      lastContactedAt: new Date().toISOString(),
      nextFollowUpAt: nextFollowUp || undefined,
    });
    if (success) {
      setEnquiries(prev => prev.map(e => e.id === enquiryId ? { ...e, status: outcome as EnquiryStatus, lastContactedAt: new Date().toISOString() } : e));
    }
    setShowContactSheet(null);
  };

  return (
    <AgentShell agentName={agent?.displayName?.split(' ')[0]} urgentCount={0}>
      <div style={{ padding: '8px 24px 100px' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0D0D12', letterSpacing: '-0.04em', marginBottom: 14 }}>
          Enquiries
        </h1>

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 16, overflowX: 'auto', scrollbarWidth: 'none' }}>
          {FILTERS.map(f => (
            <button key={f.key} onClick={() => setActiveFilter(f.key)} style={{
              padding: '7px 14px', borderRadius: 20, border: 'none',
              fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', cursor: 'pointer',
              background: activeFilter === f.key ? '#0D0D12' : 'transparent',
              color: activeFilter === f.key ? '#fff' : '#A0A8B0',
            }}>
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ height: 100, background: '#f3f4f6', borderRadius: 18, marginBottom: 12, animation: 'pulse 1.5s infinite' }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{
            background: '#FFFFFF', borderRadius: 18, padding: '32px 18px', textAlign: 'center',
            boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05), 0 0 0 0.5px rgba(0,0,0,0.04)',
          }}>
            <p style={{ color: '#A0A8B0', fontSize: 13 }}>No enquiries found</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map(enquiry => {
              const sc = STATUS_CONFIGS[enquiry.status] || STATUS_CONFIGS.new;
              return (
                <div key={enquiry.id} style={{
                  background: '#FFFFFF', borderRadius: 18, padding: '14px 18px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05), 0 0 0 0.5px rgba(0,0,0,0.04)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#0D0D12' }}>
                      {enquiry.enquirerName || 'Unknown'}
                    </span>
                    <span style={{
                      background: sc.bg, color: sc.color,
                      padding: '2px 8px', borderRadius: 10, fontSize: 9, fontWeight: 700, letterSpacing: '0.05em',
                    }}>
                      {sc.label}
                    </span>
                  </div>
                  {enquiry.enquirerPhone && (
                    <p style={{ fontSize: 12, color: '#A0A8B0', marginBottom: 2 }}>{enquiry.enquirerPhone}</p>
                  )}
                  <p style={{ fontSize: 12, color: '#A0A8B0', marginBottom: 4 }}>
                    {enquiry.source && `${enquiry.source} · `}{enquiry.listingAddress || 'General'}
                  </p>
                  {enquiry.message && (
                    <p style={{ fontSize: 12, color: '#6B7280', marginBottom: 8, fontStyle: 'italic' }}>
                      &ldquo;{enquiry.message.slice(0, 100)}{enquiry.message.length > 100 ? '...' : ''}&rdquo;
                      <span style={{ color: '#A0A8B0', fontStyle: 'normal' }}>
                        {' '}&middot; {new Date(enquiry.receivedAt).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' })}
                      </span>
                    </p>
                  )}
                  <div style={{ display: 'flex', gap: 10 }}>
                    <Link
                      href={`/agent/intelligence?prompt=${encodeURIComponent(`Draft a warm, professional reply to this enquiry from ${enquiry.enquirerName || 'this person'}${enquiry.listingAddress ? ` about ${enquiry.listingAddress}` : ''}. Their message: "${enquiry.message || 'No message'}"`)}`}
                      style={{
                        fontSize: 12, fontWeight: 600, color: '#C49B2A', textDecoration: 'none',
                        padding: '6px 12px', borderRadius: 8, background: '#FFFBEB', border: '1px solid rgba(196,155,42,0.2)',
                      }}
                    >
                      Draft reply
                    </Link>
                    <button
                      onClick={() => setShowContactSheet(enquiry.id)}
                      style={{
                        fontSize: 12, fontWeight: 600, color: '#6B7280', cursor: 'pointer',
                        padding: '6px 12px', borderRadius: 8, background: '#F9FAFB', border: '1px solid rgba(0,0,0,0.08)',
                      }}
                    >
                      Log contact
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Log Contact Sheet */}
      {showContactSheet && (
        <LogContactSheet
          enquiryId={showContactSheet}
          onClose={() => setShowContactSheet(null)}
          onSave={handleLogContact}
        />
      )}
    </AgentShell>
  );
}

function LogContactSheet({ enquiryId, onClose, onSave }: {
  enquiryId: string;
  onClose: () => void;
  onSave: (enquiryId: string, outcome: string, nextFollowUp: string) => void;
}) {
  const [method, setMethod] = useState('');
  const [outcome, setOutcome] = useState('');
  const [nextFollowUp, setNextFollowUp] = useState('');

  const outcomeToStatus: Record<string, string> = {
    'No answer': 'contacted',
    'Spoke': 'contacted',
    'Viewing booked': 'viewing_booked',
    'Not interested': 'dead',
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 60, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: '28px 28px 0 0', width: '100%', maxWidth: 500, padding: '20px 24px 36px' }} onClick={e => e.stopPropagation()}>
        <div style={{ width: 40, height: 4, background: '#E0E0DC', borderRadius: 2, margin: '0 auto 16px' }} />
        <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0D0D12', marginBottom: 16 }}>Log contact</h3>

        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6B7280', marginBottom: 8 }}>How contacted</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {['Call', 'Text', 'Email', 'WhatsApp'].map(m => (
            <button key={m} onClick={() => setMethod(m)} style={{
              padding: '7px 14px', borderRadius: 20,
              border: method === m ? '1.5px solid #C49B2A' : '1px solid rgba(0,0,0,0.08)',
              background: method === m ? '#FFFBEB' : '#fff',
              color: method === m ? '#92400E' : '#6B7280',
              fontSize: 12, fontWeight: 500, cursor: 'pointer',
            }}>
              {m}
            </button>
          ))}
        </div>

        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6B7280', marginBottom: 8 }}>Outcome</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {['No answer', 'Spoke', 'Viewing booked', 'Not interested'].map(o => (
            <button key={o} onClick={() => setOutcome(o)} style={{
              padding: '7px 14px', borderRadius: 20,
              border: outcome === o ? '1.5px solid #C49B2A' : '1px solid rgba(0,0,0,0.08)',
              background: outcome === o ? '#FFFBEB' : '#fff',
              color: outcome === o ? '#92400E' : '#6B7280',
              fontSize: 12, fontWeight: 500, cursor: 'pointer',
            }}>
              {o}
            </button>
          ))}
        </div>

        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6B7280', marginBottom: 6 }}>Next follow-up date</label>
        <input type="date" value={nextFollowUp} onChange={e => setNextFollowUp(e.target.value)}
          style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.08)', fontSize: 13, marginBottom: 20, boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none' }}
        />

        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={onClose} className="agent-tappable" style={{
            flex: 1, padding: '13px 0', borderRadius: 14, border: '1px solid rgba(0,0,0,0.08)',
            background: '#fff', fontSize: 13, fontWeight: 600, color: '#6B7280', cursor: 'pointer',
          }}>Cancel</button>
          <button
            onClick={() => outcome && onSave(enquiryId, outcomeToStatus[outcome] || 'contacted', nextFollowUp)}
            disabled={!outcome}
            className="agent-tappable"
            style={{
              flex: 1, padding: '13px 0', borderRadius: 14, border: 'none',
              background: outcome ? '#0D0D12' : 'rgba(0,0,0,0.1)',
              fontSize: 13, fontWeight: 600, color: '#fff', cursor: outcome ? 'pointer' : 'default',
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
