'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  CalendarCheck,
  Plus,
  Clock,
  CheckCircle,
  X,
  Star,
  MessageSquare,
  ChevronRight,
  Zap,
} from 'lucide-react';
import { useAgentDashboard } from '../layout-provider';

export const dynamic = 'force-dynamic';

interface Viewing {
  id: string;
  buyer_name: string;
  buyer_phone: string;
  buyer_email: string;
  scheduled_at: string;
  status: string;
  notes: string;
  viewing_type: string;
  development_name?: string;
  unit_number?: string;
  scheme_name?: string;
  unit_ref?: string;
}

interface FeedbackForm {
  interest: string;
  priceFeedback: string;
  concern: string;
  nextSteps: string;
}

export default function AgentDashboardViewingsPage() {
  const router = useRouter();
  const { developments, selectedSchemeId } = useAgentDashboard();
  const [viewings, setViewings] = useState<Viewing[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedbackId, setFeedbackId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackForm>({ interest: '', priceFeedback: '', concern: '', nextSteps: '' });
  const [showSchedule, setShowSchedule] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const now = new Date();
        const from = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString().split('T')[0];
        const to = new Date(now.getTime() + 7 * 86400000).toISOString().split('T')[0];
        const res = await fetch(`/api/agent/viewings?from=${from}&to=${to}`);
        if (res.ok) {
          const data = await res.json();
          setViewings(data.viewings ?? []);
        }
      } catch { /* silent */ }
      setLoading(false);
    }
    fetchData();
  }, []);

  const today = new Date().toDateString();
  const tomorrow = new Date(Date.now() + 86400000).toDateString();

  const todayViewings = viewings.filter(v => new Date(v.scheduled_at).toDateString() === today);
  const tomorrowViewings = viewings.filter(v => new Date(v.scheduled_at).toDateString() === tomorrow);
  const upcomingViewings = viewings.filter(v => {
    const d = new Date(v.scheduled_at).toDateString();
    return d !== today && d !== tomorrow;
  });
  const confirmedTotal = viewings.filter(v => v.status === 'confirmed' || v.status === 'scheduled').length;

  const formatTime = (d: string) => new Date(d).toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' });
  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-IE', { weekday: 'short', day: 'numeric', month: 'short' });

  const getStatusBadge = (status: string) => {
    const map: Record<string, { bg: string; color: string }> = {
      confirmed: { bg: '#f0fdf4', color: '#15803d' },
      scheduled: { bg: '#eff6ff', color: '#1d4ed8' },
      completed: { bg: '#f3f4f6', color: '#6b7280' },
      cancelled: { bg: '#fef2f2', color: '#b91c1c' },
    };
    const s = map[status] || { bg: '#f3f4f6', color: '#6b7280' };
    return <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 8, background: s.bg, color: s.color, textTransform: 'capitalize' as const }}>{status}</span>;
  };

  async function saveFeedback(viewingId: string) {
    try {
      await fetch(`/api/agent/viewings?id=${viewingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: JSON.stringify(feedback), status: 'completed' }),
      });
      setFeedbackId(null);
      setFeedback({ interest: '', priceFeedback: '', concern: '', nextSteps: '' });
    } catch { /* silent */ }
  }

  function ViewingRow({ v, showDate }: { v: Viewing; showDate?: boolean }) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 18px', borderBottom: '1px solid rgba(0,0,0,0.04)', transition: 'background 0.1s' }}
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#faf9f7'}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
      >
        {/* Time block */}
        <span style={{ fontSize: 12, fontWeight: 600, color: '#c8960a', background: 'rgba(200,150,10,0.1)', padding: '6px 10px', borderRadius: 8, fontVariantNumeric: 'tabular-nums', minWidth: 56, textAlign: 'center', flexShrink: 0 }}>
          {formatTime(v.scheduled_at)}
        </span>
        {showDate && <span style={{ fontSize: 11, color: 'rgba(0,0,0,0.35)', minWidth: 70 }}>{formatDate(v.scheduled_at)}</span>}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 500, color: '#111', margin: 0 }}>{v.buyer_name}</p>
          <p style={{ fontSize: 11, color: 'rgba(0,0,0,0.38)', margin: '1px 0 0' }}>
            {v.scheme_name || v.development_name || '\u2014'}{v.unit_ref || v.unit_number ? ` \u00B7 ${v.unit_ref || v.unit_number}` : ''}
          </p>
        </div>
        {getStatusBadge(v.status)}
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => setFeedbackId(feedbackId === v.id ? null : v.id)} style={{ height: 28, padding: '0 10px', background: '#fff', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 6, color: '#374151', fontSize: 11, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>Feedback</button>
          <button style={{ height: 28, padding: '0 10px', background: '#fff', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 6, color: '#374151', fontSize: 11, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>Notes</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Quick Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 32px', background: '#fff', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: 'rgba(0,0,0,0.35)', textTransform: 'uppercase' as const, marginRight: 8 }}>QUICK ACTIONS</span>
        <button onClick={() => setShowSchedule(true)} style={{ height: 30, padding: '0 14px', background: '#c8960a', border: 'none', borderRadius: 7, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5 }}>
          <Plus size={13} /> Schedule Viewing
        </button>
      </div>

      <div style={{ padding: '28px 32px', maxWidth: 900 }}>
        <h1 style={{ color: '#111', fontSize: 20, fontWeight: 700, letterSpacing: '-0.04em', margin: '0 0 20px' }}>Viewings</h1>

        {/* KPI cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
          {[
            { label: "TODAY'S VIEWINGS", value: todayViewings.length.toString(), color: '#c8960a' },
            { label: 'TOMORROW', value: tomorrowViewings.length.toString(), color: '#1d4ed8' },
            { label: 'CONFIRMED TOTAL', value: confirmedTotal.toString(), color: '#15803d' },
          ].map(k => (
            <div key={k.label} style={{ background: '#fff', borderRadius: 12, border: '0.5px solid rgba(0,0,0,0.07)', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05)', padding: '16px 18px' }}>
              <p style={{ color: 'rgba(0,0,0,0.35)', fontSize: 9.5, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' as const, margin: '0 0 6px' }}>{k.label}</p>
              <p style={{ color: k.color, fontSize: 28, fontWeight: 700, letterSpacing: '-0.04em', margin: 0 }}>{k.value}</p>
            </div>
          ))}
        </div>

        {/* Today's Viewings */}
        <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid rgba(0,0,0,0.07)', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05)', overflow: 'hidden', marginBottom: 20 }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(0,0,0,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontSize: 13.5, fontWeight: 600, color: '#111', margin: 0, letterSpacing: '-0.02em' }}>Today&apos;s Viewings</h3>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#c8960a', background: 'rgba(200,150,10,0.1)', padding: '3px 8px', borderRadius: 10 }}>{todayViewings.length}</span>
          </div>
          {todayViewings.length === 0 ? (
            <div style={{ padding: '28px 18px', textAlign: 'center' }}>
              <CalendarCheck size={24} color="rgba(0,0,0,0.12)" style={{ marginBottom: 6 }} />
              <p style={{ color: 'rgba(0,0,0,0.35)', fontSize: 12, margin: 0 }}>No viewings scheduled today</p>
            </div>
          ) : (
            todayViewings.map(v => <ViewingRow key={v.id} v={v} />)
          )}
        </div>

        {/* Feedback slide-out */}
        {feedbackId && (
          <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid rgba(0,0,0,0.07)', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05)', padding: '20px', marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: '#111', margin: 0 }}>Viewing Feedback</h3>
              <button onClick={() => setFeedbackId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={16} color="rgba(0,0,0,0.3)" /></button>
            </div>

            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#111', margin: '0 0 6px' }}>Interest Level</p>
              <div style={{ display: 'flex', gap: 6 }}>
                {['Very interested', 'Interested', 'Not interested'].map(opt => (
                  <button key={opt} onClick={() => setFeedback(f => ({ ...f, interest: opt }))} style={{ padding: '6px 14px', borderRadius: 8, background: feedback.interest === opt ? 'rgba(200,150,10,0.1)' : '#fff', border: feedback.interest === opt ? '1px solid rgba(200,150,10,0.3)' : '1px solid rgba(0,0,0,0.12)', color: feedback.interest === opt ? '#c8960a' : '#374151', fontSize: 12, fontWeight: feedback.interest === opt ? 600 : 500, cursor: 'pointer', fontFamily: 'inherit' }}>{opt}</button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#111', margin: '0 0 6px' }}>Price Feedback</p>
              <div style={{ display: 'flex', gap: 6 }}>
                {['Too high', 'Fair', 'Good value'].map(opt => (
                  <button key={opt} onClick={() => setFeedback(f => ({ ...f, priceFeedback: opt }))} style={{ padding: '6px 14px', borderRadius: 8, background: feedback.priceFeedback === opt ? 'rgba(200,150,10,0.1)' : '#fff', border: feedback.priceFeedback === opt ? '1px solid rgba(200,150,10,0.3)' : '1px solid rgba(0,0,0,0.12)', color: feedback.priceFeedback === opt ? '#c8960a' : '#374151', fontSize: 12, fontWeight: feedback.priceFeedback === opt ? 600 : 500, cursor: 'pointer', fontFamily: 'inherit' }}>{opt}</button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#111', margin: '0 0 6px' }}>Main Concern</p>
              <textarea value={feedback.concern} onChange={e => setFeedback(f => ({ ...f, concern: e.target.value }))} placeholder="Any concerns raised..." style={{ width: '100%', height: 60, padding: '8px 12px', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 8, fontSize: 12.5, fontFamily: 'inherit', resize: 'none', outline: 'none' }} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#111', margin: '0 0 6px' }}>Next Steps</p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {['Second viewing', 'Making offer', 'Not progressing', 'Following up'].map(opt => (
                  <button key={opt} onClick={() => setFeedback(f => ({ ...f, nextSteps: opt }))} style={{ padding: '6px 14px', borderRadius: 8, background: feedback.nextSteps === opt ? 'rgba(200,150,10,0.1)' : '#fff', border: feedback.nextSteps === opt ? '1px solid rgba(200,150,10,0.3)' : '1px solid rgba(0,0,0,0.12)', color: feedback.nextSteps === opt ? '#c8960a' : '#374151', fontSize: 12, fontWeight: feedback.nextSteps === opt ? 600 : 500, cursor: 'pointer', fontFamily: 'inherit' }}>{opt}</button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => saveFeedback(feedbackId)} style={{ height: 32, padding: '0 16px', background: '#c8960a', border: 'none', borderRadius: 7, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Save Feedback</button>
              <button onClick={() => {
                const v = viewings.find(x => x.id === feedbackId);
                if (v) router.push(`/agent/dashboard/intelligence?prompt=${encodeURIComponent(`Generate a vendor update based on viewing feedback for ${v.buyer_name} at ${v.scheme_name || v.development_name}. Interest: ${feedback.interest}. Price feedback: ${feedback.priceFeedback}. Next steps: ${feedback.nextSteps}.`)}`);
              }} style={{ height: 32, padding: '0 12px', background: '#fff', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 7, color: '#374151', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Zap size={12} color="#c8960a" /> Generate vendor update
              </button>
            </div>
          </div>
        )}

        {/* Upcoming Viewings */}
        {(tomorrowViewings.length > 0 || upcomingViewings.length > 0) && (
          <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid rgba(0,0,0,0.07)', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
              <h3 style={{ fontSize: 13.5, fontWeight: 600, color: '#111', margin: 0, letterSpacing: '-0.02em' }}>Upcoming Viewings</h3>
            </div>
            {[...tomorrowViewings, ...upcomingViewings].map(v => <ViewingRow key={v.id} v={v} showDate />)}
          </div>
        )}

        {viewings.length === 0 && !loading && (
          <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid rgba(0,0,0,0.07)', padding: '48px', textAlign: 'center' }}>
            <CalendarCheck size={32} color="rgba(0,0,0,0.12)" style={{ marginBottom: 8 }} />
            <p style={{ color: 'rgba(0,0,0,0.35)', fontSize: 13, margin: '0 0 4px' }}>No viewings scheduled</p>
            <p style={{ color: 'rgba(0,0,0,0.25)', fontSize: 12, margin: 0 }}>Schedule your first viewing to get started</p>
          </div>
        )}
      </div>
    </div>
  );
}
