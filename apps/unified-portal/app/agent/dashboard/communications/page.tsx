'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Mail,
  Send,
  Users,
  Briefcase,
  Building,
  Search,
  Zap,
  Clock,
  FileText,
  X,
} from 'lucide-react';
import { useAgentDashboard } from '../layout-provider';

export const dynamic = 'force-dynamic';

interface CommEvent {
  id: string;
  type: string;
  subject: string;
  body: string;
  recipient_name: string;
  recipient_email: string;
  created_at: string;
  status: string;
  development_name?: string;
  unit_number?: string;
}

type FilterType = 'all' | 'buyers' | 'solicitors' | 'vendors';

const TEMPLATES = [
  { name: 'Contract chasing email', desc: 'Follow up on outstanding contracts', prompt: 'Draft a professional contract chasing email to a solicitor about overdue contracts.' },
  { name: 'Viewing confirmation', desc: 'Confirm an upcoming viewing', prompt: 'Draft a viewing confirmation email for a buyer. Include date, time, and property details.' },
  { name: 'Vendor weekly update', desc: 'Weekly scheme update for developers', prompt: 'Prepare a weekly vendor update for all my active schemes. Include units sold, active pipeline, and overdue contracts.' },
  { name: 'Booking deposit request', desc: 'Request booking deposit from buyer', prompt: 'Draft a booking deposit request email to a buyer who has just agreed a sale.' },
  { name: 'Solicitor introduction', desc: 'Introduce buyer and vendor solicitors', prompt: 'Draft an introduction email connecting the buyer solicitor and vendor solicitor for a property transaction.' },
];

export default function AgentDashboardCommunicationsPage() {
  const router = useRouter();
  const { profile } = useAgentDashboard();
  const [events, setEvents] = useState<CommEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [search, setSearch] = useState('');
  const [composing, setComposing] = useState(false);
  const [composeData, setComposeData] = useState({ to: '', subject: '', body: '' });

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/agent/communications');
        if (res.ok) {
          const data = await res.json();
          setEvents(data.events ?? []);
        }
      } catch { /* silent */ }
      setLoading(false);
    }
    fetchData();
  }, []);

  const filtered = events.filter(e => {
    if (search) {
      const q = search.toLowerCase();
      if (!e.recipient_name?.toLowerCase().includes(q) && !e.subject?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const formatTime = (d: string) => {
    const date = new Date(d);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);
    if (diffDays === 0) return date.toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' });
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return date.toLocaleDateString('en-IE', { weekday: 'short' });
    return date.toLocaleDateString('en-IE', { day: 'numeric', month: 'short' });
  };

  const getTypeBadge = (type: string) => {
    const map: Record<string, { bg: string; color: string; label: string }> = {
      buyer: { bg: '#eff6ff', color: '#1d4ed8', label: 'Buyer' },
      solicitor: { bg: '#f5f3ff', color: '#5b21b6', label: 'Solicitor' },
      vendor: { bg: '#f0fdf4', color: '#15803d', label: 'Vendor' },
      enquiry: { bg: '#fffbeb', color: '#92400e', label: 'Enquiry' },
    };
    const s = map[type] || { bg: '#f3f4f6', color: '#6b7280', label: type || 'Email' };
    return <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 8, background: s.bg, color: s.color }}>{s.label}</span>;
  };

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Quick Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 32px', background: '#fff', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: 'rgba(0,0,0,0.35)', textTransform: 'uppercase' as const, marginRight: 8 }}>QUICK ACTIONS</span>
        <button onClick={() => setComposing(true)} style={{ height: 30, padding: '0 14px', background: '#c8960a', border: 'none', borderRadius: 7, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5 }}>
          <Mail size={13} /> Compose
        </button>
        <button onClick={() => router.push('/agent/dashboard/intelligence?prompt=Draft a weekly vendor update for all my schemes')} style={{ height: 30, padding: '0 12px', background: '#fff', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 7, color: '#374151', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5 }}>
          <Zap size={13} /> Draft with Intelligence
        </button>
      </div>

      <div style={{ padding: '28px 32px' }}>
        <h1 style={{ color: '#111', fontSize: 20, fontWeight: 700, letterSpacing: '-0.04em', margin: '0 0 20px' }}>Communications</h1>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20 }}>
          {/* Left: Inbox */}
          <div>
            {/* Filter + search */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ display: 'flex', gap: 4 }}>
                {(['all', 'buyers', 'solicitors', 'vendors'] as FilterType[]).map(f => (
                  <button key={f} onClick={() => setFilter(f)} style={{ padding: '5px 12px', borderRadius: 8, background: filter === f ? 'rgba(200,150,10,0.1)' : 'transparent', border: filter === f ? '1px solid rgba(200,150,10,0.2)' : '1px solid transparent', color: filter === f ? '#c8960a' : 'rgba(0,0,0,0.5)', fontSize: 12, fontWeight: filter === f ? 600 : 500, cursor: 'pointer', fontFamily: 'inherit', textTransform: 'capitalize' as const }}>
                    {f}
                  </button>
                ))}
              </div>
              <div style={{ position: 'relative' }}>
                <Search size={14} color="rgba(0,0,0,0.3)" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
                <input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: 200, height: 32, paddingLeft: 32, paddingRight: 10, border: '1px solid rgba(0,0,0,0.12)', borderRadius: 8, fontSize: 12.5, fontFamily: 'inherit', outline: 'none', background: '#fff' }} />
              </div>
            </div>

            {/* Thread list */}
            <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid rgba(0,0,0,0.07)', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
              {loading ? (
                <div style={{ padding: '40px', textAlign: 'center' }}>
                  <p style={{ color: 'rgba(0,0,0,0.35)', fontSize: 13 }}>Loading communications...</p>
                </div>
              ) : filtered.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center' }}>
                  <Mail size={28} color="rgba(0,0,0,0.12)" style={{ marginBottom: 8 }} />
                  <p style={{ color: 'rgba(0,0,0,0.35)', fontSize: 13, margin: 0 }}>No communications yet</p>
                  <p style={{ color: 'rgba(0,0,0,0.25)', fontSize: 12, margin: '4px 0 0' }}>Use Intelligence to draft emails or log communications</p>
                </div>
              ) : (
                filtered.map((e, i) => (
                  <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderBottom: i < filtered.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none', cursor: 'pointer', transition: 'background 0.1s' }}
                    onMouseEnter={ev => (ev.currentTarget as HTMLElement).style.background = '#faf9f7'}
                    onMouseLeave={ev => (ev.currentTarget as HTMLElement).style.background = 'transparent'}
                  >
                    <div style={{ width: 34, height: 34, borderRadius: 8, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Mail size={15} color="#1d4ed8" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 500, color: '#111' }}>{e.recipient_name || 'Unknown'}</span>
                        {getTypeBadge(e.type)}
                      </div>
                      <p style={{ fontSize: 12, color: 'rgba(0,0,0,0.5)', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.subject || 'No subject'}</p>
                    </div>
                    <span style={{ fontSize: 11, color: 'rgba(0,0,0,0.35)', flexShrink: 0 }}>{formatTime(e.created_at)}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right: Templates + Drafts */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Intelligence Drafts */}
            <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid rgba(0,0,0,0.07)', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(0,0,0,0.07)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Zap size={14} color="#c8960a" />
                <h3 style={{ fontSize: 13.5, fontWeight: 600, color: '#111', margin: 0, letterSpacing: '-0.02em' }}>Intelligence Drafts</h3>
              </div>
              <div style={{ padding: '16px 18px', textAlign: 'center' }}>
                <p style={{ fontSize: 12, color: 'rgba(0,0,0,0.4)', margin: '0 0 10px' }}>Use Intelligence to generate email drafts</p>
                <button onClick={() => router.push('/agent/dashboard/intelligence?prompt=Draft chasing emails for all overdue contracts')} style={{ height: 30, padding: '0 14px', background: 'linear-gradient(135deg, #B8960C, #E8C84A)', border: 'none', borderRadius: 7, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Generate Drafts
                </button>
              </div>
            </div>

            {/* Templates */}
            <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid rgba(0,0,0,0.07)', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                <h3 style={{ fontSize: 13.5, fontWeight: 600, color: '#111', margin: 0, letterSpacing: '-0.02em' }}>Templates</h3>
              </div>
              {TEMPLATES.map((t, i) => (
                <div key={t.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 18px', borderBottom: i < TEMPLATES.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none' }}>
                  <div>
                    <p style={{ fontSize: 12.5, fontWeight: 500, color: '#111', margin: 0 }}>{t.name}</p>
                    <p style={{ fontSize: 11, color: 'rgba(0,0,0,0.38)', margin: '1px 0 0' }}>{t.desc}</p>
                  </div>
                  <button onClick={() => router.push(`/agent/dashboard/intelligence?prompt=${encodeURIComponent(t.prompt)}`)} style={{ height: 26, padding: '0 10px', background: '#fff', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 6, color: '#374151', fontSize: 11, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>Use</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Compose modal */}
      {composing && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setComposing(false)}>
          <div onClick={e => e.stopPropagation()} style={{ width: 520, background: '#fff', borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: '#111', margin: 0 }}>New Message</h3>
              <button onClick={() => setComposing(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} color="rgba(0,0,0,0.4)" /></button>
            </div>
            <div style={{ padding: '16px 20px' }}>
              <input type="text" placeholder="To" value={composeData.to} onChange={e => setComposeData(d => ({ ...d, to: e.target.value }))} style={{ width: '100%', height: 36, padding: '0 12px', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', marginBottom: 8, outline: 'none' }} />
              <input type="text" placeholder="Subject" value={composeData.subject} onChange={e => setComposeData(d => ({ ...d, subject: e.target.value }))} style={{ width: '100%', height: 36, padding: '0 12px', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', marginBottom: 8, outline: 'none' }} />
              <textarea placeholder="Message..." value={composeData.body} onChange={e => setComposeData(d => ({ ...d, body: e.target.value }))} style={{ width: '100%', height: 180, padding: '10px 12px', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', resize: 'none', outline: 'none' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 20px', borderTop: '1px solid rgba(0,0,0,0.07)' }}>
              <button onClick={() => router.push('/agent/dashboard/intelligence?prompt=Improve this email draft: ' + encodeURIComponent(composeData.body))} style={{ height: 30, padding: '0 12px', background: '#fff', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 7, color: '#374151', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Zap size={13} color="#c8960a" /> Improve with Intelligence
              </button>
              <button style={{ height: 30, padding: '0 14px', background: '#c8960a', border: 'none', borderRadius: 7, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Send size={13} /> Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
