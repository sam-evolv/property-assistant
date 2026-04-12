'use client';

import { useEffect, useState } from 'react';
import { BookOpen, Upload, Plus, Zap, HelpCircle, AlertCircle } from 'lucide-react';
import { useAgentDashboard } from '../layout-provider';

export const dynamic = 'force-dynamic';
const tokens = { gold: '#D4AF37', goldDark: '#B8934C', cream: '#fafaf8', dark: '#1a1a1a' };

interface KBItem { id: string; title: string; content: string; document_type: string; development_id?: string; created_at: string; }
interface KnowledgeGap { id: string; query_text: string; created_at: string; }

export default function AgentDashboardKnowledgeBasePage() {
  const { developments } = useAgentDashboard();
  const [kbItems, setKbItems] = useState<KBItem[]>([]);
  const [gaps, setGaps] = useState<KnowledgeGap[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingFaq, setAddingFaq] = useState(false);
  const [faqForm, setFaqForm] = useState({ question: '', answer: '' });
  const [answeringGap, setAnsweringGap] = useState<string | null>(null);
  const [gapAnswer, setGapAnswer] = useState('');

  useEffect(() => { (async () => { try { const res = await fetch('/api/agent/knowledge-base'); if (res.ok) { const data = await res.json(); setKbItems(data.items ?? []); setGaps(data.gaps ?? []); } } catch {} setLoading(false); })(); }, []);

  const faqs = kbItems.filter(k => k.document_type === 'faq');
  const coveragePct = developments.length > 0 ? Math.round((developments.filter(d => kbItems.some(k => k.development_id === d.id)).length / developments.length) * 100) : 0;

  async function saveFaq() {
    try { await fetch('/api/agent/knowledge-base', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: faqForm.question, content: faqForm.answer, document_type: 'faq' }) }); setAddingFaq(false); setFaqForm({ question: '', answer: '' }); const res = await fetch('/api/agent/knowledge-base'); if (res.ok) { const data = await res.json(); setKbItems(data.items ?? []); } } catch {}
  }

  async function saveGapAnswer(gapId: string) {
    const gap = gaps.find(g => g.id === gapId); if (!gap) return;
    try { await fetch('/api/agent/knowledge-base', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: gap.query_text, content: gapAnswer, document_type: 'faq' }) }); setAnsweringGap(null); setGapAnswer(''); setGaps(gaps.filter(g => g.id !== gapId)); } catch {}
  }

  return (
    <div className="min-h-full" style={{ backgroundColor: tokens.cream }}>
      <div className="p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Knowledge Base</h1>
        <p className="text-sm text-gray-500 mb-4">Manage content that powers Intelligence answers</p>

        <div className="rounded-xl p-4 mb-6 flex items-center gap-3" style={{ background: 'linear-gradient(135deg, rgba(212,175,55,0.08), rgba(184,147,76,0.04))', border: '1px solid rgba(212,175,55,0.15)' }}>
          <Zap className="w-5 h-5 flex-shrink-0" style={{ color: tokens.gold }} />
          <p className="text-sm text-amber-800">Intelligence learns from everything you upload here. Better knowledge = better answers.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Scheme Documents */}
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100"><h3 className="text-sm font-semibold text-gray-900">Scheme Documents</h3></div>
            {developments.map((d, i) => {
              const count = kbItems.filter(k => k.development_id === d.id).length;
              return (
                <div key={d.id} className={`flex items-center justify-between px-5 py-3 ${i < developments.length - 1 ? 'border-b border-gray-50' : ''}`}>
                  <div><p className="text-sm font-medium text-gray-900">{d.name}</p><p className="text-xs text-gray-500">{count} documents</p></div>
                  <button className="text-xs font-medium px-3 py-1.5 rounded-lg bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100 transition-colors">Upload</button>
                </div>
              );
            })}
            {developments.length === 0 && <div className="p-8 text-center text-xs text-gray-500">No schemes assigned</div>}
          </div>

          {/* FAQs */}
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">FAQs & Custom Q&A</h3>
              <button onClick={() => setAddingFaq(true)} className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white" style={{ backgroundColor: tokens.gold }}>+ Add FAQ</button>
            </div>
            {addingFaq && (
              <div className="p-4 border-b border-gray-100 bg-gray-50 space-y-2">
                <input type="text" placeholder="Question" value={faqForm.question} onChange={e => setFaqForm(f => ({ ...f, question: e.target.value }))} className="w-full h-9 px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gold-500" />
                <textarea placeholder="Answer" value={faqForm.answer} onChange={e => setFaqForm(f => ({ ...f, answer: e.target.value }))} className="w-full h-16 px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:border-gold-500" />
                <div className="flex gap-2"><button onClick={saveFaq} className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white" style={{ backgroundColor: tokens.gold }}>Save</button><button onClick={() => setAddingFaq(false)} className="text-xs font-medium px-3 py-1.5 rounded-lg bg-white text-gray-700 border border-gray-200">Cancel</button></div>
              </div>
            )}
            {faqs.length === 0 && !addingFaq && <div className="p-8 text-center"><HelpCircle className="w-6 h-6 text-gray-300 mx-auto mb-2" /><p className="text-xs text-gray-500">No FAQs added yet</p></div>}
            {faqs.map((faq, i) => (
              <div key={faq.id} className={`px-5 py-3 ${i < faqs.length - 1 ? 'border-b border-gray-50' : ''}`}>
                <div className="flex items-start gap-2"><HelpCircle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: tokens.gold }} /><div><p className="text-sm font-medium text-gray-900">{faq.title}</p><p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{faq.content}</p></div></div>
              </div>
            ))}
          </div>

          {/* Health + Upload */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Intelligence Health</h3>
              {[{ label: 'Coverage', value: `${coveragePct}%`, color: coveragePct >= 80 ? 'text-green-600' : coveragePct >= 50 ? 'text-amber-600' : 'text-red-600' }, { label: 'Documents', value: String(kbItems.length), color: 'text-gray-900' }, { label: 'Unanswered', value: String(gaps.length), color: gaps.length > 0 ? 'text-red-600' : 'text-green-600' }].map(m => (
                <div key={m.label} className="flex items-center justify-between mb-2"><span className="text-sm text-gray-500">{m.label}</span><span className={`text-base font-bold ${m.color}`}>{m.value}</span></div>
              ))}
            </div>
            <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-8 text-center hover:border-gold-300 transition-colors cursor-pointer">
              <Upload className="w-8 h-8 text-gray-300 mx-auto mb-2" /><p className="text-sm font-medium text-gray-900">Upload to Knowledge Base</p><p className="text-[10px] text-gray-400 mt-1">PDF, DOCX, TXT</p>
            </div>
          </div>
        </div>

        {gaps.length > 0 && (
          <div className="mt-6 bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2"><AlertCircle className="w-4 h-4 text-red-500" /><h3 className="text-sm font-semibold text-gray-900">Knowledge Gaps</h3><span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-700">{gaps.length}</span></div>
            <table className="w-full"><thead><tr className="bg-gray-50">
              {['Question', 'Date', 'Action'].map(h => <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{h}</th>)}
            </tr></thead><tbody className="divide-y divide-gray-50">
              {gaps.map(gap => (
                <tr key={gap.id}>
                  <td className="px-5 py-3 text-sm text-gray-900">{gap.query_text}</td>
                  <td className="px-5 py-3 text-xs text-gray-500">{new Date(gap.created_at).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' })}</td>
                  <td className="px-5 py-3"><button onClick={() => { setAnsweringGap(answeringGap === gap.id ? null : gap.id); setGapAnswer(''); }} className="text-xs font-medium px-3 py-1.5 rounded-lg bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100">{answeringGap === gap.id ? 'Cancel' : 'Add answer'}</button>
                    {answeringGap === gap.id && <div className="mt-2"><textarea value={gapAnswer} onChange={e => setGapAnswer(e.target.value)} placeholder="Type your answer..." className="w-full h-16 px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:border-gold-500 mb-2" /><button onClick={() => saveGapAnswer(gap.id)} className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white" style={{ backgroundColor: tokens.gold }}>Save</button></div>}
                  </td>
                </tr>
              ))}
            </tbody></table>
          </div>
        )}
      </div>
    </div>
  );
}
