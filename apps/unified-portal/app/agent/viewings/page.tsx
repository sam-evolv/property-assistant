'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useAgent } from '@/lib/agent/AgentContext';
import AgentShell from '../_components/AgentShell';
import StatusBadge from '../_components/StatusBadge';
import {
  X, Check, Clock, ChevronDown, Loader2, MoreVertical,
  CalendarClock, XCircle, UserX, CheckCircle2, MessageSquare,
  Mic, Plus,
} from 'lucide-react';
import VoiceCaptureCard from '@/components/agent/intelligence/VoiceCaptureCard';

type ViewingTableSource = 'viewings' | 'agent_viewings';

interface Viewing {
  id: string;
  buyerName: string;
  schemeName: string;
  unitRef: string;
  viewingDate: string;
  viewingTime: string;
  durationMinutes?: number;
  status: 'confirmed' | 'pending' | 'completed' | 'cancelled' | 'no_show';
  notes?: string;
  source?: string;
  developmentId?: string | null;
  tableSource?: ViewingTableSource;
  hasCapture?: boolean;
}

type RowAction = 'reschedule' | 'cancel' | 'mark_no_show' | 'mark_completed';

interface ActiveAction {
  viewing: Viewing;
  action: RowAction;
}

// "Captureable" = the viewing has happened in real life so a post-viewing
// voice loop makes sense. We allow capture for any scheduled/confirmed
// viewing whose start time is in the past OR within the next 2 hours
// (an agent might tap straight after a viewing wraps but before the
// official end time). Already-completed, no-shows, and cancellations
// are out of scope, the voice loop wouldn't change the outcome.
function isViewingCaptureable(v: Viewing, nowMs: number = Date.now()): boolean {
  // The API formatter remaps canonical status='scheduled' to 'confirmed'
  // before returning, so we only check the post-remap states here.
  if (v.status !== 'confirmed' && v.status !== 'pending') return false;
  if (!v.viewingDate || !v.viewingTime) return false;
  const iso = `${v.viewingDate}T${v.viewingTime.slice(0, 5)}:00`;
  const scheduled = new Date(iso).getTime();
  if (Number.isNaN(scheduled)) return false;
  return scheduled - nowMs <= 2 * 60 * 60 * 1000;
}

export default function ViewingsPage() {
  const { agent, alerts, developments } = useAgent();
  const router = useRouter();
  const [viewings, setViewings] = useState<Viewing[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formSuccess, setFormSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeAction, setActiveAction] = useState<ActiveAction | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [captureTarget, setCaptureTarget] = useState<Viewing | null>(null);

  async function handleActionConfirm(payload: { reason?: string; status?: 'no_show' | 'completed'; reschedule?: { isoDateTime: string; durationMinutes: number; developmentId: string | null; notes: string | null } }) {
    if (!activeAction) return;
    const { viewing, action } = activeAction;
    const tableSource: ViewingTableSource = viewing.tableSource || 'viewings';
    setActionBusy(true);
    setActionError(null);
    try {
      let res: Response;
      if (action === 'reschedule' && payload.reschedule) {
        const r = payload.reschedule;
        res = await fetch('/api/agent-intelligence/confirm-update-viewing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            viewing_id: viewing.id,
            source: tableSource,
            next: {
              scheduled_at: r.isoDateTime,
              duration_minutes: r.durationMinutes,
              property: r.developmentId
                ? { development_id: r.developmentId, name: developments.find(d => d.id === r.developmentId)?.name ?? null }
                : undefined,
              notes: r.notes,
            },
          }),
        });
      } else if (action === 'cancel') {
        res = await fetch('/api/agent-intelligence/confirm-cancel-viewing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            viewing_id: viewing.id,
            source: tableSource,
            reason: payload.reason || null,
          }),
        });
      } else if (action === 'mark_no_show' || action === 'mark_completed') {
        res = await fetch('/api/agent-intelligence/confirm-mark-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            viewing_id: viewing.id,
            source: tableSource,
            status: action === 'mark_completed' ? 'completed' : 'no_show',
          }),
        });
      } else {
        throw new Error('Unknown action');
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || 'Could not save changes');
      }
      // Refresh the list so the row reflects the new state.
      setActiveAction(null);
      await fetchViewings();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not save changes');
    } finally {
      setActionBusy(false);
    }
  }

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
            <p style={{ color: '#A0A8B0', fontSize: 12, marginBottom: 16 }}>
              Schedule one from the Intelligence chat, or tap + to add one manually.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => router.push('/agent/intelligence')}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '10px 18px', borderRadius: 999,
                  background: 'linear-gradient(180deg, #D4AF37 0%, #C49B2A 100%)',
                  border: 'none', fontSize: 13, fontWeight: 600, color: '#FFFFFF',
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                <MessageSquare size={14} strokeWidth={2.25} />
                Open chat
              </button>
              <button
                type="button"
                onClick={() => { setFormDate(today); setShowForm(true); }}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '10px 18px', borderRadius: 999,
                  background: '#F4F4F5', border: '0.5px solid rgba(0,0,0,0.08)',
                  fontSize: 13, fontWeight: 600, color: '#0D0D12',
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                <Plus size={14} strokeWidth={2.25} />
                Add manually
              </button>
            </div>
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

                      {v.hasCapture ? (
                        <span
                          title="Already captured"
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            padding: '4px 8px', borderRadius: 999,
                            background: 'rgba(16,112,60,0.10)', color: '#10703C',
                            fontSize: 11, fontWeight: 600, letterSpacing: '0.01em',
                            flexShrink: 0,
                          }}
                        >
                          <Check size={11} strokeWidth={2.5} />
                          Captured
                        </span>
                      ) : isViewingCaptureable(v) ? (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setCaptureTarget(v); }}
                          aria-label="Capture viewing notes"
                          title="Capture viewing notes"
                          style={{
                            width: 32, height: 32, borderRadius: 999, border: 'none',
                            background: 'rgba(196,155,42,0.10)', cursor: 'pointer',
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0, color: '#C49B2A', transition: 'background 120ms ease',
                          }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(196,155,42,0.20)'; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(196,155,42,0.10)'; }}
                        >
                          <Mic size={14} strokeWidth={2.25} />
                        </button>
                      ) : null}
                      <StatusBadge status={v.status} />
                      <DropdownMenu.Root>
                        <DropdownMenu.Trigger asChild>
                          <button
                            type="button"
                            onClick={(e) => e.stopPropagation()}
                            aria-label="Viewing actions"
                            style={{
                              width: 28, height: 28, borderRadius: 14, border: 'none',
                              background: 'transparent', display: 'flex', alignItems: 'center',
                              justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
                              outline: 'none',
                            }}
                          >
                            <MoreVertical size={16} color="#A0A8B0" />
                          </button>
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Portal>
                          <DropdownMenu.Content
                            align="end"
                            side="bottom"
                            sideOffset={6}
                            collisionPadding={{ top: 16, bottom: 96, left: 16, right: 16 }}
                            avoidCollisions
                            style={{
                              minWidth: 200, background: '#FFFFFF', borderRadius: 12,
                              boxShadow: '0 8px 24px rgba(0,0,0,0.12), 0 0 0 0.5px rgba(0,0,0,0.06)',
                              padding: 4, zIndex: 60,
                            }}
                          >
                            <KebabItem icon={CalendarClock} label="Reschedule" onSelect={() => setActiveAction({ viewing: v, action: 'reschedule' })} />
                            <KebabItem icon={CheckCircle2} label="Mark as completed" onSelect={() => setActiveAction({ viewing: v, action: 'mark_completed' })} />
                            <KebabItem icon={UserX} label="Mark as no-show" onSelect={() => setActiveAction({ viewing: v, action: 'mark_no_show' })} />
                            <KebabItem icon={XCircle} label="Cancel viewing" tone="danger" onSelect={() => setActiveAction({ viewing: v, action: 'cancel' })} />
                          </DropdownMenu.Content>
                        </DropdownMenu.Portal>
                      </DropdownMenu.Root>
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

      {activeAction && (
        <ActionModal
          activeAction={activeAction}
          developments={developments}
          busy={actionBusy}
          error={actionError}
          onClose={() => { setActiveAction(null); setActionError(null); }}
          onConfirm={handleActionConfirm}
        />
      )}

      {captureTarget && (
        <VoiceCaptureSheet
          viewing={captureTarget}
          onClose={() => { setCaptureTarget(null); fetchViewings(); }}
        />
      )}
    </AgentShell>
  );
}

function VoiceCaptureSheet({
  viewing,
  onClose,
}: {
  viewing: Viewing;
  onClose: () => void;
}) {
  // Reuse the existing bottom-sheet overlay vocabulary used by ActionModal.
  const overlayStyle: React.CSSProperties = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
    backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
    zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
  };
  const sheetStyle: React.CSSProperties = {
    width: '100%', maxWidth: 560, background: 'transparent',
    padding: '0 12px 20px',
    animation: 'slideUp 300ms cubic-bezier(.2,.8,.2,1)',
    maxHeight: '92dvh', overflowY: 'auto',
  };
  const scheduledIso = `${viewing.viewingDate}T${(viewing.viewingTime || '12:00').slice(0, 5)}:00`;
  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={sheetStyle} onClick={(e) => e.stopPropagation()}>
        <VoiceCaptureCard
          viewing={{
            id: viewing.id,
            applicant_name: viewing.buyerName,
            development_name: viewing.schemeName || null,
            scheduled_at: scheduledIso,
            status: viewing.status,
          }}
          onClose={onClose}
        />
      </div>
    </div>
  );
}

function KebabItem({
  icon: Icon,
  label,
  onSelect,
  tone,
}: {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; color?: string }>;
  label: string;
  onSelect: () => void;
  tone?: 'danger' | 'default';
}) {
  const color = tone === 'danger' ? '#B91C1C' : '#0D0D12';
  return (
    <DropdownMenu.Item
      onSelect={onSelect}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        width: '100%', padding: '8px 10px', borderRadius: 8,
        background: 'transparent', cursor: 'pointer',
        color, fontFamily: 'inherit', fontSize: 13, fontWeight: 500,
        textAlign: 'left', outline: 'none', userSelect: 'none',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = '#F4F4F5'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
      onFocus={(e) => { (e.currentTarget as HTMLDivElement).style.background = '#F4F4F5'; }}
      onBlur={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
    >
      <Icon size={14} strokeWidth={2} color={color} />
      {label}
    </DropdownMenu.Item>
  );
}

function ActionModal({
  activeAction,
  developments,
  busy,
  error,
  onClose,
  onConfirm,
}: {
  activeAction: ActiveAction;
  developments: Array<{ id: string; name: string }>;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: (payload: { reason?: string; status?: 'no_show' | 'completed'; reschedule?: { isoDateTime: string; durationMinutes: number; developmentId: string | null; notes: string | null } }) => void;
}) {
  const { viewing, action } = activeAction;
  const [reason, setReason] = useState<string>('');
  // Reschedule form state, only used for action='reschedule'.
  const initialDateTime = `${viewing.viewingDate}T${(viewing.viewingTime || '12:00').slice(0, 5)}`;
  const [dateTime, setDateTime] = useState<string>(initialDateTime);
  const [durationMinutes, setDurationMinutes] = useState<number>(viewing.durationMinutes || 30);
  const [developmentId, setDevelopmentId] = useState<string>(viewing.developmentId || developments[0]?.id || '');
  const [notes, setNotes] = useState<string>(viewing.notes || '');

  const overlayStyle: React.CSSProperties = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
    backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
    zIndex: 200, display: 'flex', alignItems: 'flex-end',
  };
  const sheetStyle: React.CSSProperties = {
    width: '100%', background: '#fff', borderRadius: '24px 24px 0 0',
    boxShadow: '0 -4px 32px rgba(0,0,0,0.12)',
    animation: 'slideUp 300ms cubic-bezier(.2,.8,.2,1)',
    maxHeight: '90dvh', overflowY: 'auto',
  };
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '12px 14px', borderRadius: 12,
    border: '1px solid rgba(0,0,0,0.08)', fontSize: 14,
    color: '#0D0D12', background: '#FAFAF8',
    fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 600, color: '#6B7280', letterSpacing: '0.01em',
    display: 'block', marginBottom: 6,
  };

  const title = action === 'reschedule'
    ? `Reschedule ${viewing.buyerName}`
    : action === 'cancel'
      ? `Cancel ${viewing.buyerName}'s viewing`
      : action === 'mark_completed'
        ? `Mark ${viewing.buyerName} as completed`
        : `Mark ${viewing.buyerName} as no-show`;

  const isDanger = action === 'cancel';

  function handleSubmit() {
    if (action === 'reschedule') {
      const [datePart, timePart] = dateTime.split('T');
      if (!datePart || !timePart) return;
      const [y, m, d] = datePart.split('-').map((n) => parseInt(n, 10));
      const [hh, mm] = timePart.split(':').map((n) => parseInt(n, 10));
      const utcGuess = Date.UTC(y, m - 1, d, hh, mm);
      const probe = new Date(utcGuess);
      const fmt = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/Dublin',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false,
      });
      const parts: Record<string, string> = {};
      for (const p of fmt.formatToParts(probe)) {
        if (p.type !== 'literal') parts[p.type] = p.value;
      }
      const projected = Date.UTC(
        parseInt(parts.year, 10),
        parseInt(parts.month, 10) - 1,
        parseInt(parts.day, 10),
        parseInt(parts.hour, 10),
        parseInt(parts.minute, 10),
      );
      const offset = utcGuess - projected;
      const isoDateTime = new Date(utcGuess + offset).toISOString();
      onConfirm({
        reschedule: {
          isoDateTime,
          durationMinutes: Math.max(5, Math.min(240, Math.round(durationMinutes))),
          developmentId: developmentId || null,
          notes: notes.trim() || null,
        },
      });
    } else if (action === 'cancel') {
      onConfirm({ reason: reason.trim() || undefined });
    } else {
      onConfirm({ status: action === 'mark_completed' ? 'completed' : 'no_show' });
    }
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={sheetStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ width: 40, height: 4, background: '#E0E0DC', borderRadius: 2, margin: '14px auto 16px' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px 16px' }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0D0D12', margin: 0, letterSpacing: '-0.03em' }}>
            {title}
          </h2>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: 10, background: '#F5F5F3',
              border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            }}
          >
            <X size={16} color="#6B7280" />
          </button>
        </div>

        <div style={{ padding: '0 24px 24px' }}>
          {action === 'reschedule' && (
            <>
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>When</label>
                <input
                  type="datetime-local"
                  value={dateTime}
                  onChange={(e) => setDateTime(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Property</label>
                <div style={{ position: 'relative' }}>
                  <select
                    value={developmentId}
                    onChange={(e) => setDevelopmentId(e.target.value)}
                    style={{ ...inputStyle, appearance: 'none', paddingRight: 36 }}
                  >
                    {developments.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} color="#A0A8B0" style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                </div>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Length (minutes)</label>
                <input
                  type="number"
                  min={5}
                  max={240}
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(parseInt(e.target.value || '30', 10))}
                  style={inputStyle}
                />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  style={{ ...inputStyle, resize: 'none', minHeight: 80 }}
                />
              </div>
            </>
          )}

          {action === 'cancel' && (
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Reason (optional)</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. buyer wants to push back"
                rows={3}
                style={{ ...inputStyle, resize: 'none', minHeight: 80 }}
              />
            </div>
          )}

          {(action === 'mark_completed' || action === 'mark_no_show') && (
            <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 14 }}>
              {action === 'mark_completed'
                ? `Mark ${viewing.buyerName}'s viewing as completed.`
                : `Mark ${viewing.buyerName}'s viewing as a no-show.`}
            </p>
          )}

          {error && (
            <p style={{ fontSize: 12.5, color: '#B91C1C', marginBottom: 12 }}>{error}</p>
          )}

          <button
            onClick={handleSubmit}
            disabled={busy}
            style={{
              width: '100%', padding: '14px', borderRadius: 14,
              background: busy
                ? '#E0E0E0'
                : isDanger
                  ? 'linear-gradient(180deg, #EF4444 0%, #DC2626 100%)'
                  : 'linear-gradient(180deg, #D4AF37 0%, #C49B2A 100%)',
              color: '#fff', fontSize: 14, fontWeight: 600, border: 'none',
              cursor: busy ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              marginBottom: 8,
            }}
          >
            {busy ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={15} />}
            {busy
              ? 'Saving'
              : isDanger
                ? 'Confirm cancellation'
                : action === 'reschedule'
                  ? 'Save changes'
                  : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
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
