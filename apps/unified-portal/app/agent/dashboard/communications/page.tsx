'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Send, Search, Zap, X, FileText, Clock } from 'lucide-react';
import { useAgentDashboard } from '../layout-provider';

export const dynamic = 'force-dynamic';
const tokens = { gold: '#D4AF37', goldDark: '#B8934C', cream: '#fafaf8', dark: '#1a1a1a' };

const TEMPLATES = [
  { name: 'Contract chasing email', desc: 'Follow up on outstanding contracts', prompt: 'Draft a professional contract chasing email to a solicitor about overdue contracts.' },
  { name: 'Viewing confirmation', desc: 'Confirm an upcoming viewing', prompt: 'Draft a viewing confirmation email for a buyer.' },
  { name: 'Vendor weekly update', desc: 'Weekly scheme update for developers', prompt: 'Prepare a weekly vendor update for all my active schemes.' },
  { name: 'Booking deposit request', desc: 'Request booking deposit from buyer', prompt: 'Draft a booking deposit request email to a buyer who has just agreed a sale.' },
  { name: 'Solicitor introduction', desc: 'Introduce buyer and vendor solicitors', prompt: 'Draft an introduction email connecting the buyer solicitor and vendor solicitor.' },
];

interface CommEvent { id: string; type: string; subject: string; body: string; recipient_name: string; recipient_email: string; created_at: string; status: string; }

export default function AgentDashboardCommunicationsPage() {
  const router = useRouter();
  const [events, setEvents] = useState<CommEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [composing, setComposing] = useState(false);
  const [composeData, setComposeData] = useState({ to: '', subject: '', body: '' });

  useEffect(() => { (async () => { try { const res = await fetch('/api/agent/communications'); if (res.ok) { const data = await res.json(); setEvents(data.events ?? []); } } catch {} setLoading(false); })(); }, []);

  const filtered = events.filter(e => { if (!search) return true; const q = search.toLowerCase(); return e.recipient_name?.toLowerCase().includes(q) || e.subject?.toLowerCase().includes(q); });
  const formatTime = (d: string) => { const date = new Date(d); const diff = Math.floor((Date.now() - date.getTime()) / 86400000); if (diff === 0) return date.toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' }); if (diff === 1) return 'Yesterday'; if (diff < 7) return date.toLocaleDateString('en-IE', { weekday: 'short' }); return date.toLocaleDateString('en-IE', { day: 'numeric', month: 'short' }); };

  return (
    <div className="min-h-full" style={{ backgroundColor: tokens.cream }}>
      <div className="p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Communications</h1>
        <p className="text-sm text-gray-500 mb-6">Manage emails, messages and templates</p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Inbox */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <button onClick={() => setComposing(true)} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg text-white transition-all hover:shadow-md" style={{ backgroundColor: tokens.gold }}><Mail className="w-4 h-4" /> Compose</button>
                <button onClick={() => router.push('/agent/dashboard/intelligence?prompt=Draft a weekly vendor update for all my schemes')} className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 transition-colors"><Zap className="w-4 h-4" style={{ color: tokens.gold }} /> Draft with Intelligence</button>
              </div>
              <div className="relative"><Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" /><input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="h-9 pl-9 pr-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gold-500 bg-white" /></div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              {loading ? <div className="p-12 text-center text-sm text-gray-400">Loading...</div> : filtered.length === 0 ? (
                <div className="p-16 text-center"><Mail className="w-10 h-10 text-gray-200 mx-auto mb-3" /><p className="text-sm font-medium text-gray-900">No communications yet</p><p className="text-xs text-gray-500 mt-1">Use Intelligence to draft emails</p></div>
              ) : filtered.map((e, i) => (
                <div key={e.id} className={`flex items-center gap-4 px-5 py-4 cursor-pointer transition-colors hover:bg-gray-50/50 ${i < filtered.length - 1 ? 'border-b border-gray-50' : ''}`}>
                  <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0"><Mail className="w-4 h-4 text-blue-600" /></div>
                  <div className="flex-1 min-w-0"><p className="text-sm font-medium text-gray-900 truncate">{e.recipient_name || 'Unknown'}</p><p className="text-xs text-gray-500 truncate">{e.subject || 'No subject'}</p></div>
                  <span className="text-xs text-gray-400 flex-shrink-0">{formatTime(e.created_at)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Templates */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2"><Zap className="w-4 h-4" style={{ color: tokens.gold }} /><h3 className="text-sm font-semibold text-gray-900">Intelligence Drafts</h3></div>
              <div className="p-5 text-center"><p className="text-xs text-gray-500 mb-3">Use Intelligence to generate email drafts</p><button onClick={() => router.push('/agent/dashboard/intelligence?prompt=Draft chasing emails for all overdue contracts')} className="px-4 py-2 text-sm font-semibold rounded-lg text-white transition-all hover:shadow-md" style={{ background: `linear-gradient(135deg, ${tokens.gold}, ${tokens.goldDark})` }}>Generate Drafts</button></div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100"><h3 className="text-sm font-semibold text-gray-900">Templates</h3></div>
              {TEMPLATES.map((t, i) => (
                <div key={t.name} className={`flex items-center justify-between px-5 py-3 ${i < TEMPLATES.length - 1 ? 'border-b border-gray-50' : ''}`}>
                  <div><p className="text-sm font-medium text-gray-900">{t.name}</p><p className="text-xs text-gray-500">{t.desc}</p></div>
                  <button onClick={() => router.push(`/agent/dashboard/intelligence?prompt=${encodeURIComponent(t.prompt)}`)} className="text-xs font-medium px-3 py-1.5 rounded-lg bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100 transition-colors">Use</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {composing && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={() => setComposing(false)}>
          <div onClick={e => e.stopPropagation()} className="w-[520px] bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100"><h3 className="text-base font-semibold text-gray-900">New Message</h3><button onClick={() => setComposing(false)}><X className="w-5 h-5 text-gray-400" /></button></div>
            <div className="p-5 space-y-2">
              <input type="text" placeholder="To" value={composeData.to} onChange={e => setComposeData(d => ({ ...d, to: e.target.value }))} className="w-full h-10 px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gold-500" />
              <input type="text" placeholder="Subject" value={composeData.subject} onChange={e => setComposeData(d => ({ ...d, subject: e.target.value }))} className="w-full h-10 px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gold-500" />
              <textarea placeholder="Message..." value={composeData.body} onChange={e => setComposeData(d => ({ ...d, body: e.target.value }))} className="w-full h-44 px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:border-gold-500" />
            </div>
            <div className="flex justify-between px-5 py-4 border-t border-gray-100">
              <button onClick={() => router.push('/agent/dashboard/intelligence?prompt=Improve this email: ' + encodeURIComponent(composeData.body))} className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg text-gray-700 bg-white border border-gray-200 hover:bg-gray-50"><Zap className="w-4 h-4" style={{ color: tokens.gold }} /> Improve</button>
              <button className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg text-white" style={{ backgroundColor: tokens.gold }}><Send className="w-4 h-4" /> Send</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
