'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarCheck, Plus, X, Zap, CheckCircle } from 'lucide-react';
import { useAgentDashboard } from '../layout-provider';

export const dynamic = 'force-dynamic';
const tokens = { gold: '#D4AF37', goldDark: '#B8934C', cream: '#fafaf8', dark: '#1a1a1a' };

interface Viewing { id: string; buyer_name: string; buyer_phone: string; buyer_email: string; scheduled_at: string; status: string; notes: string; scheme_name?: string; development_name?: string; unit_ref?: string; unit_number?: string; }
interface FeedbackForm { interest: string; priceFeedback: string; concern: string; nextSteps: string; }

export default function AgentDashboardViewingsPage() {
  const router = useRouter();
  const [viewings, setViewings] = useState<Viewing[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedbackId, setFeedbackId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackForm>({ interest: '', priceFeedback: '', concern: '', nextSteps: '' });

  useEffect(() => { (async () => { try { const from = new Date().toISOString().split('T')[0]; const to = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]; const res = await fetch(`/api/agent/viewings?from=${from}&to=${to}`); if (res.ok) { const data = await res.json(); setViewings(data.viewings ?? []); } } catch {} setLoading(false); })(); }, []);

  const today = new Date().toDateString();
  const tomorrow = new Date(Date.now() + 86400000).toDateString();
  const todayViewings = viewings.filter(v => new Date(v.scheduled_at).toDateString() === today);
  const tomorrowViewings = viewings.filter(v => new Date(v.scheduled_at).toDateString() === tomorrow);
  const upcomingViewings = viewings.filter(v => { const d = new Date(v.scheduled_at).toDateString(); return d !== today && d !== tomorrow; });
  const confirmedTotal = viewings.filter(v => v.status === 'confirmed' || v.status === 'scheduled').length;
  const fmtTime = (d: string) => new Date(d).toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' });
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-IE', { weekday: 'short', day: 'numeric', month: 'short' });

  const statusBadge = (s: string) => { const m: Record<string, string> = { confirmed: 'bg-green-50 text-green-700 border-green-200', scheduled: 'bg-blue-50 text-blue-700 border-blue-200', completed: 'bg-gray-100 text-gray-600 border-gray-200', cancelled: 'bg-red-50 text-red-700 border-red-200' }; return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${m[s] || m.scheduled} capitalize`}>{s}</span>; };

  function ViewingRow({ v, showDate }: { v: Viewing; showDate?: boolean }) {
    return (
      <div className="flex items-center gap-4 px-5 py-3 border-b border-gray-50 transition-colors hover:bg-gray-50/50">
        <span className="text-xs font-semibold px-3 py-1.5 rounded-lg min-w-[56px] text-center flex-shrink-0" style={{ color: tokens.gold, backgroundColor: 'rgba(212,175,55,0.1)' }}>{fmtTime(v.scheduled_at)}</span>
        {showDate && <span className="text-xs text-gray-400 w-20 flex-shrink-0">{fmtDate(v.scheduled_at)}</span>}
        <div className="flex-1 min-w-0"><p className="text-sm font-medium text-gray-900">{v.buyer_name}</p><p className="text-xs text-gray-500 truncate">{v.scheme_name || v.development_name || '\u2014'}{v.unit_ref || v.unit_number ? ` \u00B7 ${v.unit_ref || v.unit_number}` : ''}</p></div>
        {statusBadge(v.status)}
        <button onClick={() => setFeedbackId(feedbackId === v.id ? null : v.id)} className="text-xs font-medium px-3 py-1.5 rounded-lg bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100 transition-colors">Feedback</button>
      </div>
    );
  }

  if (loading) return <div className="min-h-full flex items-center justify-center" style={{ backgroundColor: tokens.cream }}><div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: tokens.gold, borderTopColor: 'transparent' }} /></div>;

  return (
    <div className="min-h-full" style={{ backgroundColor: tokens.cream }}>
      <div className="p-8 max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <div><h1 className="text-2xl font-bold text-gray-900 mb-1">Viewings</h1><p className="text-sm text-gray-500">Manage and track your property viewings</p></div>
          <button className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg text-white transition-all hover:shadow-md" style={{ backgroundColor: tokens.gold }}><Plus className="w-4 h-4" /> Schedule Viewing</button>
        </div>

        <div className="grid grid-cols-3 gap-5 mb-6">
          {[{ label: 'Today', value: todayViewings.length, color: tokens.gold }, { label: 'Tomorrow', value: tomorrowViewings.length, color: '#2563eb' }, { label: 'Confirmed', value: confirmedTotal, color: '#16a34a' }].map(k => (
            <div key={k.label} className="bg-white rounded-2xl border border-gray-100 p-5 transition-all hover:shadow-lg hover:border-gray-200">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">{k.label}</p>
              <p className="text-3xl font-bold mt-1" style={{ color: k.color }}>{k.value}</p>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-6">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Today&apos;s Viewings</h3>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ color: tokens.gold, backgroundColor: 'rgba(212,175,55,0.1)' }}>{todayViewings.length}</span>
          </div>
          {todayViewings.length === 0 ? <div className="p-12 text-center"><CalendarCheck className="w-8 h-8 text-gray-200 mx-auto mb-2" /><p className="text-sm text-gray-500">No viewings scheduled today</p></div> : todayViewings.map(v => <ViewingRow key={v.id} v={v} />)}
        </div>

        {feedbackId && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-6">
            <div className="flex justify-between mb-4"><h3 className="text-base font-semibold text-gray-900">Viewing Feedback</h3><button onClick={() => setFeedbackId(null)}><X className="w-4 h-4 text-gray-400" /></button></div>
            {[{ label: 'Interest Level', options: ['Very interested', 'Interested', 'Not interested'], field: 'interest' as const }, { label: 'Price Feedback', options: ['Too high', 'Fair', 'Good value'], field: 'priceFeedback' as const }, { label: 'Next Steps', options: ['Second viewing', 'Making offer', 'Not progressing', 'Following up'], field: 'nextSteps' as const }].map(section => (
              <div key={section.label} className="mb-4">
                <p className="text-xs font-semibold text-gray-900 mb-2">{section.label}</p>
                <div className="flex gap-2 flex-wrap">{section.options.map(opt => (
                  <button key={opt} onClick={() => setFeedback(f => ({ ...f, [section.field]: opt }))}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${feedback[section.field] === opt ? 'bg-gold-50 text-gold-800 border border-gold-300' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>{opt}</button>
                ))}</div>
              </div>
            ))}
            <div className="mb-4"><p className="text-xs font-semibold text-gray-900 mb-2">Main Concern</p><textarea value={feedback.concern} onChange={e => setFeedback(f => ({ ...f, concern: e.target.value }))} placeholder="Any concerns raised..." className="w-full h-16 px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:border-gold-500" /></div>
            <div className="flex gap-2">
              <button className="px-4 py-2 text-sm font-semibold rounded-lg text-white" style={{ backgroundColor: tokens.gold }}>Save Feedback</button>
              <button onClick={() => { const v = viewings.find(x => x.id === feedbackId); if (v) router.push(`/agent/dashboard/intelligence?prompt=${encodeURIComponent(`Generate a vendor update based on viewing feedback for ${v.buyer_name}. Interest: ${feedback.interest}. Price: ${feedback.priceFeedback}. Next steps: ${feedback.nextSteps}.`)}`); }}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg text-gray-700 bg-white border border-gray-200 hover:bg-gray-50"><Zap className="w-4 h-4" style={{ color: tokens.gold }} /> Generate update</button>
            </div>
          </div>
        )}

        {(tomorrowViewings.length > 0 || upcomingViewings.length > 0) && (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100"><h3 className="text-sm font-semibold text-gray-900">Upcoming Viewings</h3></div>
            {[...tomorrowViewings, ...upcomingViewings].map(v => <ViewingRow key={v.id} v={v} showDate />)}
          </div>
        )}

        {viewings.length === 0 && !loading && (
          <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center">
            <CalendarCheck className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-900">No viewings scheduled</p>
            <p className="text-xs text-gray-500 mt-1">Schedule your first viewing to get started</p>
          </div>
        )}
      </div>
    </div>
  );
}
