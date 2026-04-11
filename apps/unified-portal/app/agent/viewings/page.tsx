'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAgent } from '@/lib/agent/AgentContext';
import AgentShell from '../_components/AgentShell';
import StatusBadge from '../_components/StatusBadge';
import { X, Check, Clock, ChevronDown, Loader2 } from 'lucide-react';

interface Viewing {
  id: string;
  buyerName: string;
  schemeName: string;
  unitRef: string;
  viewingDate: string;
  viewingTime: string;
  status: 'confirmed' | 'pending' | 'completed' | 'cancelled' | 'no_show';
  notes?: string;
  source?: string;
}

export default function ViewingsPage() {
  const { agent, alerts, developments } = useAgent();
  const [viewings, setViewings] = useState<Viewing[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formSuccess, setFormSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [formBuyer, setFormBuyer] = useState('');
  const [formScheme, setFormScheme] = useState('');
  const [formUnit, setFormUnit] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formTime, setFormTime] = useState('');
  const [formNote, setFormNote] = useState('');

  const fetchViewings = useCallback(async () => {
    try {
      const res = await fetch('/api/agent/viewings');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setViewings(data.viewings || []);
    } catch (err) {
      console.error('[Viewings] Failed to load:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchViewings();
  }, [fetchViewings]);

  const today = new Date().toISOString().split('T')[0];
  const todayViewings = viewings.filter(v => v.viewingDate === today);
  const weekEnd = new Date();
  weekEnd.setDate(weekEnd.getDate() + 7);
  const weekEndStr = weekEnd.toISOString().split('T')[0];
  const thisWeekViewings = viewings.filter(v => v.viewingDate >= today && v.viewingDate <= weekEndStr);

  const stats = {
    today: todayViewings.length,
    thisWeek: thisWeekViewings.length,
    confirmed: thisWeekViewings.filter(v => v.status === 'confirmed').length,
  };

  const schemeOptions = developments.map(d => d.name);

  // Group viewings by date for display
  const upcomingViewings = viewings
    .filter(v => v.viewingDate >= today && v.status !== 'cancelled')
    .sort((a, b) => {
      if (a.viewingDate !== b.viewingDate) return a.viewingDate.localeCompare(b.viewingDate);
      return a.viewingTime.localeCompare(b.viewingTime);
    });

  const handleSubmitViewing = async () => {
    if (!formBuyer.trim() || !formTime.trim() || !formDate.trim()) return;
    setSubmitting(true);

    try {
      const res = await fetch('/api/agent/viewings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buyerName: formBuyer.trim(),
          schemeName: formScheme || null,
          unitRef: formUnit || null,
          viewingDate: formDate,
          viewingTime: formTime,
          notes: formNote.trim() || null,
          status: 'confirmed',
        }),
      });

      if (!res.ok) throw new Error('Failed to create');

      const data = await res.json();
      setViewings(prev => [...prev, data.viewing].sort((a, b) => {
        if (a.viewingDate !== b.viewingDate) return a.viewingDate.localeCompare(b.viewingDate);
        return a.viewingTime.localeCompare(b.viewingTime);
      }));

      setShowForm(false);
      setFormBuyer('');
      setFormScheme('');
      setFormUnit('');
      setFormDate('');
      setFormTime('');
      setFormNote('');
      setFormSuccess(true);
      setTimeout(() => setFormSuccess(false), 3000);
    } catch (err) {
      console.error('[Viewings] Failed to create:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const formatDisplayDate = (dateStr: string) => {
    if (dateStr === today) return 'Today';
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (dateStr === tomorrow.toISOString().split('T')[0]) return 'Tomorrow';
    return new Date(dateStr).toLocaleDateString('en-IE', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  const formatTime = (timeStr: string) => {
    const [h, m] = timeStr.split(':');
    return `${h}:${m}`;
  };

  // Group by date
  const dateGroups = new Map<string, Viewing[]>();
  for (const v of upcomingViewings) {
    if (!dateGroups.has(v.viewingDate)) dateGroups.set(v.viewingDate, []);
    dateGroups.get(v.viewingDate)!.push(v);
  }

  return (
    <AgentShell agentName={agent?.displayName?.split(' ')[0] || 'Sam'} urgentCount={alerts.length}>
      <div style={{ padding: '8px 24px 100px' }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.05em', color: '#0D0D12', marginBottom: 20 }}>
          Viewings
        </h1>

        {/* Summary stat strip */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
          <StatCard label="Today" value={stats.today} />
          <StatCard label="This week" value={stats.thisWeek} />
          <StatCard label="Confirmed" value={stats.confirmed} highlight />
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <Loader2 size={24} color="#A0A8B0" style={{ animation: 'spin 1s linear infinite' }} />
          </div>
        ) : upcomingViewings.length === 0 ? (
          <div style={{
            background: '#FFFFFF', borderRadius: 18, padding: '32px 20px', textAlign: 'center',
            boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05), 0 0 0 0.5px rgba(0,0,0,0.04)',
            marginBottom: 24,
          }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>
              <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="#D0D5DD" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
            <p style={{ color: '#6B7280', fontSize: 14, fontWeight: 500, marginBottom: 4 }}>No upcoming viewings</p>
            <p style={{ color: '#A0A8B0', fontSize: 12 }}>Schedule your first viewing below</p>
          </div>
        ) : (
          <>
            {Array.from(dateGroups).map(([date, dayViewings]) => (
              <div key={date} style={{ marginBottom: 20 }}>
                <div style={{
                  fontSize: 11, fontWeight: 600, letterSpacing: '0.06em',
                  textTransform: 'uppercase', color: '#A0A8B0', marginBottom: 10,
                }}>
                  {formatDisplayDate(date)}
                </div>

                <div style={{
                  background: '#FFFFFF', borderRadius: 18, overflow: 'hidden',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05), 0 0 0 0.5px rgba(0,0,0,0.04)',
                }}>
                  {dayViewings.map((v, i) => (
                    <div
                      key={v.id}
                      className="agent-tappable"
                      style={{
                        display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px',
                        borderBottom: i < dayViewings.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none',
                      }}
                    >
                      <div style={{
                        width: 52, height: 52, borderRadius: 15, background: '#F5F5F3',
                        border: '0.5px solid rgba(0,0,0,0.06)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        <span style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: '-0.02em', color: '#0D0D12' }}>
                          {formatTime(v.viewingTime)}
                        </span>
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 500, color: '#0D0D12', letterSpacing: '-0.01em', marginBottom: 2 }}>
                          {v.buyerName}
                        </div>
                        <div style={{ fontSize: 12, color: '#A0A8B0', letterSpacing: '0.005em' }}>
                          {v.schemeName || 'No scheme'}{v.unitRef ? ` \u00B7 ${v.unitRef}` : ''}
                        </div>
                        {v.notes && (
                          <div style={{
                            fontSize: 11, color: '#C0C8D4', fontStyle: 'italic', marginTop: 3,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {v.notes}
                          </div>
                        )}
                      </div>

                      <StatusBadge status={v.status} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}

        {/* Schedule viewing button */}
        <div
          className="agent-tappable"
          onClick={() => {
            setFormDate(today);
            setShowForm(true);
          }}
          style={{
            borderRadius: 16, border: '1.5px dashed rgba(0,0,0,0.1)',
            padding: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, cursor: 'pointer',
          }}
        >
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#C49B2A" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span style={{ color: '#A0A8B0', fontSize: 13, fontWeight: 500, letterSpacing: '0.01em' }}>
            Schedule a viewing
          </span>
        </div>
      </div>

      {/* Schedule Viewing Form (Bottom Sheet) */}
      {showForm && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
            zIndex: 200, display: 'flex', alignItems: 'flex-end',
          }}
          onClick={() => setShowForm(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%', background: '#fff', borderRadius: '24px 24px 0 0',
              boxShadow: '0 -4px 32px rgba(0,0,0,0.12)',
              animation: 'slideUp 300ms cubic-bezier(.2,.8,.2,1)',
              maxHeight: '90dvh', overflowY: 'auto',
            }}
          >
            <div style={{ width: 40, height: 4, background: '#E0E0DC', borderRadius: 2, margin: '14px auto 16px' }} />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px 16px' }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0D0D12', margin: 0, letterSpacing: '-0.03em' }}>
                Schedule Viewing
              </h2>
              <button
                onClick={() => setShowForm(false)}
                style={{
                  width: 32, height: 32, borderRadius: 10, background: '#F5F5F3',
                  border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                }}
              >
                <X size={16} color="#6B7280" />
              </button>
            </div>

            <div style={{ padding: '0 24px' }}>
              <FormField label="Buyer name" required>
                <input value={formBuyer} onChange={(e) => setFormBuyer(e.target.value)} placeholder="e.g. Sarah & Michael Kelly" style={inputStyle} />
              </FormField>

              <FormField label="Scheme">
                <div style={{ position: 'relative' }}>
                  <select value={formScheme} onChange={(e) => setFormScheme(e.target.value)} style={{ ...inputStyle, appearance: 'none', paddingRight: 36 }}>
                    <option value="">Select scheme...</option>
                    {schemeOptions.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <ChevronDown size={14} color="#A0A8B0" style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                </div>
              </FormField>

              <FormField label="Unit">
                <input value={formUnit} onChange={(e) => setFormUnit(e.target.value)} placeholder="e.g. Unit 12" style={inputStyle} />
              </FormField>

              <div style={{ display: 'flex', gap: 12 }}>
                <FormField label="Date" required style={{ flex: 1 }}>
                  <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} style={inputStyle} />
                </FormField>
                <FormField label="Time" required style={{ flex: 1 }}>
                  <input type="time" value={formTime} onChange={(e) => setFormTime(e.target.value)} style={inputStyle} />
                </FormField>
              </div>

              <FormField label="Notes">
                <textarea
                  value={formNote} onChange={(e) => setFormNote(e.target.value)}
                  placeholder="Any details for this viewing..."
                  rows={3} style={{ ...inputStyle, resize: 'none', minHeight: 80 }}
                />
              </FormField>

              <button
                onClick={handleSubmitViewing}
                disabled={!formBuyer.trim() || !formTime.trim() || !formDate.trim() || submitting}
                style={{
                  width: '100%', padding: '14px', borderRadius: 14,
                  background: (!formBuyer.trim() || !formTime.trim() || !formDate.trim() || submitting) ? '#E0E0E0' : '#0D0D12',
                  color: '#fff', fontSize: 14, fontWeight: 600,
                  border: 'none', cursor: (!formBuyer.trim() || !formTime.trim() || !formDate.trim() || submitting) ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  marginTop: 8, marginBottom: 120,
                }}
              >
                {submitting ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Clock size={15} />}
                {submitting ? 'Scheduling...' : 'Schedule Viewing'}
              </button>
            </div>
          </div>
        </div>
      )}

      {formSuccess && (
        <div style={{
          position: 'fixed', top: 80, left: '50%', transform: 'translateX(-50%)',
          background: '#059669', color: '#fff', fontSize: 13, fontWeight: 600,
          padding: '10px 18px', borderRadius: 14, zIndex: 210,
          display: 'flex', alignItems: 'center', gap: 8,
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
        }}>
          <Check size={15} />
          Viewing scheduled
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </AgentShell>
  );
}

/* ─── Sub-components ─── */

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px 14px', borderRadius: 12,
  border: '1px solid rgba(0,0,0,0.08)', fontSize: 14,
  color: '#0D0D12', background: '#FAFAF8',
  fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
};

function FormField({ label, required, children, style }: {
  label: string; required?: boolean; children: React.ReactNode; style?: React.CSSProperties;
}) {
  return (
    <div style={{ marginBottom: 14, ...style }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', letterSpacing: '0.01em', display: 'block', marginBottom: 6 }}>
        {label}{required && <span style={{ color: '#DC2626' }}> *</span>}
      </label>
      {children}
    </div>
  );
}

function StatCard({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div style={{
      flex: 1, background: '#FFFFFF', borderRadius: 16, padding: '14px 12px', textAlign: 'center',
      boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05), 0 0 0 0.5px rgba(0,0,0,0.04)',
      borderTop: highlight ? '2px solid rgba(16,185,129,0.4)' : '2px solid transparent',
    }}>
      <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.05em', color: '#0D0D12', lineHeight: 1, marginBottom: 4 }}>
        {value}
      </div>
      <div style={{ fontSize: 11, fontWeight: 500, color: '#A0A8B0' }}>{label}</div>
    </div>
  );
}
