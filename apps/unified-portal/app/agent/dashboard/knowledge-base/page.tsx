'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BookOpen,
  Upload,
  Plus,
  Zap,
  FileText,
  HelpCircle,
  AlertCircle,
  ChevronRight,
  X,
  Check,
} from 'lucide-react';
import { useAgentDashboard } from '../layout-provider';

export const dynamic = 'force-dynamic';

interface KBItem {
  id: string;
  title: string;
  content: string;
  document_type: string;
  development_id?: string;
  created_at: string;
}

interface KnowledgeGap {
  id: string;
  query_text: string;
  skin: string;
  user_role: string;
  created_at: string;
}

export default function AgentDashboardKnowledgeBasePage() {
  const router = useRouter();
  const { developments } = useAgentDashboard();
  const [kbItems, setKbItems] = useState<KBItem[]>([]);
  const [gaps, setGaps] = useState<KnowledgeGap[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingFaq, setAddingFaq] = useState(false);
  const [faqForm, setFaqForm] = useState({ question: '', answer: '', category: 'general' });
  const [answeringGap, setAnsweringGap] = useState<string | null>(null);
  const [gapAnswer, setGapAnswer] = useState('');

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/agent/knowledge-base');
        if (res.ok) {
          const data = await res.json();
          setKbItems(data.items ?? []);
          setGaps(data.gaps ?? []);
        }
      } catch { /* silent */ }
      setLoading(false);
    }
    fetchData();
  }, []);

  const schemeDocCounts = developments.map(d => ({
    ...d,
    count: kbItems.filter(k => k.development_id === d.id).length,
    lastUpdated: kbItems.filter(k => k.development_id === d.id).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]?.created_at,
  }));

  const faqs = kbItems.filter(k => k.document_type === 'faq');
  const coveragePct = developments.length > 0 ? Math.round((schemeDocCounts.filter(s => s.count > 0).length / developments.length) * 100) : 0;

  async function saveFaq() {
    try {
      await fetch('/api/agent/knowledge-base', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: faqForm.question, content: faqForm.answer, document_type: 'faq' }),
      });
      setAddingFaq(false);
      setFaqForm({ question: '', answer: '', category: 'general' });
      // Refresh
      const res = await fetch('/api/agent/knowledge-base');
      if (res.ok) { const data = await res.json(); setKbItems(data.items ?? []); }
    } catch { /* silent */ }
  }

  async function saveGapAnswer(gapId: string) {
    const gap = gaps.find(g => g.id === gapId);
    if (!gap) return;
    try {
      await fetch('/api/agent/knowledge-base', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: gap.query_text, content: gapAnswer, document_type: 'faq' }),
      });
      setAnsweringGap(null);
      setGapAnswer('');
      setGaps(gaps.filter(g => g.id !== gapId));
    } catch { /* silent */ }
  }

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' });

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Quick Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 32px', background: '#fff', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: 'rgba(0,0,0,0.35)', textTransform: 'uppercase' as const, marginRight: 8 }}>QUICK ACTIONS</span>
        <button style={{ height: 30, padding: '0 14px', background: '#c8960a', border: 'none', borderRadius: 7, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5 }}>
          <Plus size={13} /> Add Content
        </button>
      </div>

      <div style={{ padding: '28px 32px' }}>
        <h1 style={{ color: '#111', fontSize: 20, fontWeight: 700, letterSpacing: '-0.04em', margin: '0 0 8px' }}>Knowledge Base</h1>

        {/* Intel callout */}
        <div style={{ background: 'linear-gradient(135deg, rgba(184,150,12,0.08), rgba(232,200,74,0.08))', border: '1px solid rgba(200,150,10,0.15)', borderRadius: 10, padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Zap size={16} color="#c8960a" />
          <p style={{ fontSize: 13, color: '#92400e', margin: 0 }}>Intelligence learns from everything you upload here. Better knowledge = better answers.</p>
        </div>

        {/* Three column layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 300px', gap: 16 }}>
          {/* Col 1: Scheme Documents */}
          <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid rgba(0,0,0,0.07)', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
              <h3 style={{ fontSize: 13.5, fontWeight: 600, color: '#111', margin: 0, letterSpacing: '-0.02em' }}>Scheme Documents</h3>
            </div>
            {schemeDocCounts.map((s, i) => (
              <div key={s.id} style={{ padding: '12px 18px', borderBottom: i < schemeDocCounts.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 500, color: '#111', margin: 0 }}>{s.name}</p>
                  <p style={{ fontSize: 11, color: 'rgba(0,0,0,0.38)', margin: '2px 0 0' }}>
                    {s.count} documents{s.lastUpdated ? ` \u00B7 Updated ${formatDate(s.lastUpdated)}` : ''}
                  </p>
                </div>
                <button style={{ height: 26, padding: '0 10px', background: '#fff', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 6, color: '#374151', fontSize: 11, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>Upload</button>
              </div>
            ))}
            {schemeDocCounts.length === 0 && (
              <div style={{ padding: '24px 18px', textAlign: 'center' }}>
                <p style={{ color: 'rgba(0,0,0,0.35)', fontSize: 12 }}>No schemes assigned</p>
              </div>
            )}
          </div>

          {/* Col 2: FAQs */}
          <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid rgba(0,0,0,0.07)', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(0,0,0,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: 13.5, fontWeight: 600, color: '#111', margin: 0, letterSpacing: '-0.02em' }}>FAQs & Custom Q&A</h3>
              <button onClick={() => setAddingFaq(true)} style={{ height: 26, padding: '0 10px', background: '#c8960a', border: 'none', borderRadius: 6, color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>+ Add FAQ</button>
            </div>
            {addingFaq && (
              <div style={{ padding: '12px 18px', borderBottom: '1px solid rgba(0,0,0,0.04)', background: '#faf9f7' }}>
                <input type="text" placeholder="Question" value={faqForm.question} onChange={e => setFaqForm(f => ({ ...f, question: e.target.value }))} style={{ width: '100%', height: 32, padding: '0 10px', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 6, fontSize: 12, fontFamily: 'inherit', marginBottom: 6, outline: 'none' }} />
                <textarea placeholder="Answer" value={faqForm.answer} onChange={e => setFaqForm(f => ({ ...f, answer: e.target.value }))} style={{ width: '100%', height: 60, padding: '6px 10px', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 6, fontSize: 12, fontFamily: 'inherit', resize: 'none', outline: 'none', marginBottom: 6 }} />
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={saveFaq} style={{ height: 26, padding: '0 12px', background: '#c8960a', border: 'none', borderRadius: 6, color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Save</button>
                  <button onClick={() => setAddingFaq(false)} style={{ height: 26, padding: '0 12px', background: '#fff', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 6, color: '#374151', fontSize: 11, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
                </div>
              </div>
            )}
            {faqs.map((faq, i) => (
              <div key={faq.id} style={{ padding: '10px 18px', borderBottom: i < faqs.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <HelpCircle size={14} color="#c8960a" style={{ marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <p style={{ fontSize: 12.5, fontWeight: 500, color: '#111', margin: 0 }}>{faq.title}</p>
                    <p style={{ fontSize: 11, color: 'rgba(0,0,0,0.45)', margin: '2px 0 0', lineHeight: 1.4 }}>{faq.content?.slice(0, 100)}{faq.content?.length > 100 ? '...' : ''}</p>
                  </div>
                </div>
              </div>
            ))}
            {faqs.length === 0 && !addingFaq && (
              <div style={{ padding: '24px 18px', textAlign: 'center' }}>
                <p style={{ color: 'rgba(0,0,0,0.35)', fontSize: 12, margin: '0 0 4px' }}>No FAQs added yet</p>
                <p style={{ color: 'rgba(0,0,0,0.25)', fontSize: 11, margin: 0 }}>Add common questions and answers</p>
              </div>
            )}
          </div>

          {/* Col 3: Health + Upload */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Intelligence Health */}
            <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid rgba(0,0,0,0.07)', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05)', padding: '18px' }}>
              <h3 style={{ fontSize: 13.5, fontWeight: 600, color: '#111', margin: '0 0 14px', letterSpacing: '-0.02em' }}>Intelligence Health</h3>
              {[
                { label: 'Coverage', value: `${coveragePct}%`, color: coveragePct >= 80 ? '#15803d' : coveragePct >= 50 ? '#92400e' : '#b91c1c' },
                { label: 'Documents', value: kbItems.length.toString(), color: '#111' },
                { label: 'Unanswered', value: gaps.length.toString(), color: gaps.length > 0 ? '#b91c1c' : '#15803d' },
              ].map(m => (
                <div key={m.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.5)' }}>{m.label}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: m.color }}>{m.value}</span>
                </div>
              ))}
            </div>

            {/* Upload zone */}
            <div style={{ background: '#fff', borderRadius: 12, border: '2px dashed rgba(0,0,0,0.12)', padding: '28px 18px', textAlign: 'center' }}>
              <Upload size={24} color="rgba(0,0,0,0.2)" style={{ marginBottom: 8 }} />
              <p style={{ fontSize: 12, fontWeight: 500, color: '#111', margin: '0 0 4px' }}>Upload to Knowledge Base</p>
              <p style={{ fontSize: 10, color: 'rgba(0,0,0,0.38)', margin: 0 }}>PDF, DOCX, TXT</p>
            </div>
          </div>
        </div>

        {/* Knowledge Gaps */}
        {gaps.length > 0 && (
          <div style={{ marginTop: 24, background: '#fff', borderRadius: 12, border: '0.5px solid rgba(0,0,0,0.07)', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(0,0,0,0.07)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertCircle size={14} color="#b91c1c" />
              <h3 style={{ fontSize: 13.5, fontWeight: 600, color: '#111', margin: 0, letterSpacing: '-0.02em' }}>Knowledge Gaps</h3>
              <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: '#fef2f2', color: '#b91c1c' }}>{gaps.length}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 100px', padding: '10px 18px', background: '#f9f8f5', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
              {['Question', 'Date', 'Action'].map(h => (
                <span key={h} style={{ color: 'rgba(0,0,0,0.35)', fontSize: 9.5, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' as const }}>{h}</span>
              ))}
            </div>
            {gaps.map((gap, i) => (
              <div key={gap.id}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 100px', padding: '10px 18px', borderBottom: answeringGap === gap.id ? 'none' : (i < gaps.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none'), alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: '#111' }}>{gap.query_text}</span>
                  <span style={{ fontSize: 11, color: 'rgba(0,0,0,0.38)' }}>{formatDate(gap.created_at)}</span>
                  <button onClick={() => { setAnsweringGap(answeringGap === gap.id ? null : gap.id); setGapAnswer(''); }} style={{ height: 26, padding: '0 10px', background: answeringGap === gap.id ? '#fef2f2' : '#fff', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 6, color: '#374151', fontSize: 11, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                    {answeringGap === gap.id ? 'Cancel' : 'Add answer'}
                  </button>
                </div>
                {answeringGap === gap.id && (
                  <div style={{ padding: '8px 18px 12px', background: '#faf9f7', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                    <textarea placeholder="Type your answer..." value={gapAnswer} onChange={e => setGapAnswer(e.target.value)} style={{ width: '100%', height: 60, padding: '8px 10px', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 6, fontSize: 12, fontFamily: 'inherit', resize: 'none', outline: 'none', marginBottom: 6 }} />
                    <button onClick={() => saveGapAnswer(gap.id)} style={{ height: 26, padding: '0 12px', background: '#c8960a', border: 'none', borderRadius: 6, color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Save Answer</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
