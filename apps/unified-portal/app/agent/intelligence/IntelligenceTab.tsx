'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

/* ─── Light palette — matches property assistant exactly ─── */
const C = {
  bg:       '#FFFFFF',
  surface:  '#F7F7F9',
  line:     '#EBEBF0',
  t1:       '#111827',   // slate-900
  t2:       '#6b7280',   // gray-500
  t3:       '#9ca3af',   // gray-400
  t4:       '#d1d5db',   // gray-300
  gold:     '#D4AF37',
  goldLight:'rgba(212,175,55,0.15)',
  goldText: '#9A7A2E',
  userBubble: 'linear-gradient(135deg, #D4AF37, #C4A030)',
  assistBubble: '#E9E9EB',  // exact match to property assistant
};

/* ─── Types ─── */
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolsUsed?: Array<{ name: string; summary: string; draft?: { to: string; email?: string; subject: string; body: string; unit_context?: string } }>;
  followUps?: string[];
}

/* ─── Format assistant content (matches property assistant formatting) ─── */
function formatContent(text: string): string {
  if (!text) return '';
  let html = text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Bold headings — lines ending with colon
  html = html.replace(/^([A-Z][^:\n]{0,50}:)\s*$/gm, '<strong style="display:block;margin-top:12px;margin-bottom:4px;font-size:15px;font-weight:600">$1</strong>');

  // List items with gold dots
  html = html.replace(/^- (.+)$/gm, '<div style="display:flex;align-items:flex-start;gap:8px;margin:4px 0 4px 4px"><span style="color:#D4AF37;flex-shrink:0;margin-top:2px">\u2022</span><span style="flex:1">$1</span></div>');

  // Numbered lists
  html = html.replace(/^(\d+)\.\s+(.+)$/gm, '<div style="display:flex;align-items:flex-start;gap:8px;margin:4px 0 4px 4px"><span style="color:#D4AF37;font-weight:500;flex-shrink:0;min-width:1.25rem;margin-top:1px">$1.</span><span style="flex:1">$2</span></div>');

  // Prices highlighted
  html = html.replace(/([€£]\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g, '<span style="font-weight:600;color:#9A7A2E">$1</span>');

  // Paragraphs
  html = html.replace(/\n\n/g, '</p><p style="margin-top:12px">');
  html = html.replace(/\n/g, '<br/>');
  html = '<p>' + html + '</p>';
  html = html.replace(/<p><\/p>/g, '');

  return html;
}

/* ─── Tool step metadata ─── */
function toolLabel(name: string): string {
  if (name.includes('draft_message')) return 'Drafted email';
  if (name.includes('generate_developer_report')) return 'Generated report';
  if (name.includes('create_task')) return 'Created task';
  if (name.includes('log_communication')) return 'Logged communication';
  if (name.includes('get_unit_status')) return 'Looked up unit';
  if (name.includes('get_buyer')) return 'Looked up buyer';
  if (name.includes('get_scheme_overview')) return 'Checked scheme';
  if (name.includes('get_outstanding')) return 'Checked outstanding items';
  if (name.includes('get_communication')) return 'Checked comms history';
  if (name.includes('search_knowledge_base')) return 'Searched docs';
  return name.replace(/_/g, ' ');
}

/* ─── Clipboard ─── */
async function copyText(text: string) {
  try { await navigator.clipboard.writeText(text); }
  catch {
    const t = document.createElement('textarea');
    t.value = text; document.body.appendChild(t); t.select();
    document.execCommand('copy'); document.body.removeChild(t);
  }
}

/* ─── Suggested prompts ─── */
const PROMPTS = [
  { label: "What's outstanding this week?", query: "What's outstanding this week?" },
  { label: 'Give me a scheme overview',     query: 'Give me an overview of all my schemes' },
  { label: 'Draft a buyer follow-up',       query: 'Draft a follow-up email to the buyer on the most overdue contract' },
  { label: 'Generate developer report',     query: 'Generate a weekly developer report' },
];

/* ─── Draft email queue component ─── */
type DraftData = { to: string; email?: string; subject: string; body: string; unit_context?: string };

function DraftEmailQueue({ drafts, fallbackContent, msgId, copiedId, onCopy }: {
  drafts: DraftData[];
  fallbackContent: string;
  msgId: string;
  copiedId: string | null;
  onCopy: (id: string, text: string) => void;
}) {
  const [current, setCurrent] = useState(0);
  const [sent, setSent] = useState<Set<number>>(new Set());

  // If no structured drafts (or all invalid), fall back to showing the LLM text
  if (!drafts || drafts.length === 0) {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: C.goldText, background: C.goldLight, padding: '2px 8px', borderRadius: 6 }}>Draft</span>
          <span style={{ fontSize: 10, color: C.t3 }}>Review before sending</span>
        </div>
        <div style={{ fontSize: 15, lineHeight: 1.6, color: '#1f2937', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
          dangerouslySetInnerHTML={{ __html: formatContent(fallbackContent) }} />
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button onClick={() => onCopy(msgId, fallbackContent)} style={{
            flex: 1, padding: '8px 12px', borderRadius: 10, background: C.gold, border: 'none', color: '#fff',
            fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', boxShadow: '0 2px 6px rgba(212,175,55,0.3)',
          }}>{copiedId === msgId ? 'Copied' : 'Copy draft'}</button>
        </div>
      </div>
    );
  }

  const total = drafts.length;
  const safeIdx = Math.min(current, total - 1);
  const draft = drafts[safeIdx];
  const isSent = sent.has(safeIdx);

  // Guard against undefined draft (shouldn't happen but prevents crash)
  if (!draft) {
    return (
      <div style={{ fontSize: 15, lineHeight: 1.6, color: '#1f2937', whiteSpace: 'pre-wrap' }}
        dangerouslySetInnerHTML={{ __html: formatContent(fallbackContent) }} />
    );
  }

  return (
    <div>
      {/* Header with counter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: C.goldText, background: C.goldLight, padding: '2px 8px', borderRadius: 6 }}>
          Draft {current + 1}/{total}
        </span>
        {sent.size > 0 && (
          <span style={{ fontSize: 10, color: '#0A7855', fontWeight: 600 }}>{sent.size} sent</span>
        )}
      </div>

      {/* Recipient */}
      <div style={{ fontSize: 13, fontWeight: 600, color: '#1f2937', marginBottom: 4 }}>
        To: {draft.to}
      </div>
      {draft.unit_context && (
        <div style={{ fontSize: 11, color: C.t3, marginBottom: 8 }}>
          Re: {draft.unit_context}
        </div>
      )}

      {/* Subject */}
      <div style={{ fontSize: 12, color: C.t2, fontWeight: 600, marginBottom: 8, paddingBottom: 8, borderBottom: `1px solid ${C.line}` }}>
        {draft.subject}
      </div>

      {/* Email body */}
      <div style={{ fontSize: 14, lineHeight: 1.65, color: '#1f2937', whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginBottom: 12 }}>
        {draft.body}
      </div>

      {/* Action buttons */}
      {isSent ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0' }}>
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#0A7855" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
          <span style={{ color: '#0A7855', fontSize: 13, fontWeight: 600 }}>Sent to {draft.to}</span>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => onCopy(`${msgId}_${current}`, draft.body)} style={{
            flex: 1, padding: '8px 12px', borderRadius: 10, background: C.surface, border: `1px solid ${C.line}`,
            color: C.t2, fontSize: 12, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer',
          }}>{copiedId === `${msgId}_${current}` ? 'Copied' : 'Copy'}</button>
          <button onClick={() => setSent(prev => new Set(prev).add(current))} style={{
            flex: 1, padding: '8px 12px', borderRadius: 10, background: C.gold, border: 'none', color: '#fff',
            fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', boxShadow: '0 2px 6px rgba(212,175,55,0.3)',
          }}>Send</button>
        </div>
      )}

      {/* Navigation — prev/next */}
      {total > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.line}` }}>
          <button
            onClick={() => setCurrent(Math.max(0, current - 1))}
            disabled={current === 0}
            style={{
              padding: '6px 14px', borderRadius: 8, background: current === 0 ? C.surface : C.bg,
              border: `1px solid ${C.line}`, color: current === 0 ? C.t4 : C.t2,
              fontSize: 12, fontWeight: 500, fontFamily: 'inherit', cursor: current === 0 ? 'default' : 'pointer',
            }}>Previous</button>
          <span style={{ fontSize: 11, color: C.t3 }}>{current + 1} of {total}</span>
          <button
            onClick={() => setCurrent(Math.min(total - 1, current + 1))}
            disabled={current === total - 1}
            style={{
              padding: '6px 14px', borderRadius: 8, background: current === total - 1 ? C.surface : C.bg,
              border: `1px solid ${C.line}`, color: current === total - 1 ? C.t4 : C.t2,
              fontSize: 12, fontWeight: 500, fontFamily: 'inherit', cursor: current === total - 1 ? 'default' : 'pointer',
            }}>Next</button>
        </div>
      )}

      {/* Send All button when multiple */}
      {total > 1 && sent.size < total && (
        <button onClick={() => {
          const all = new Set<number>();
          for (let i = 0; i < total; i++) all.add(i);
          setSent(all);
        }} style={{
          width: '100%', padding: '10px 12px', borderRadius: 10, marginTop: 8,
          background: '#1f2937', border: 'none', color: '#fff',
          fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
        }}>Send all {total} emails</button>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════
   Component
   ═══════════════════════════════════════ */

export default function IntelligenceTab() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, sending]);

  /* ── Send via streaming API ── */
  const handleSend = useCallback(async (text?: string) => {
    const msg = text || input.trim();
    if (!msg || sending) return;

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const userMsg: Message = { id: `u_${Date.now()}`, role: 'user', content: msg };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    if (taRef.current) taRef.current.style.height = 'auto';
    setSending(true);

    const history = [...messages, userMsg].slice(-10).map(m => ({ role: m.role, content: m.content }));

    try {
      const res = await fetch('/api/agent-intelligence/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, history: history.slice(0, -1), sessionId }),
        signal: ctrl.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No stream');
      const decoder = new TextDecoder();
      let buffer = '';
      let full = '';
      let tools: Array<{ name: string; summary: string }> = [];
      let followUps: string[] = [];
      let retSession: string | null = null;
      const aId = `a_${Date.now()}`;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const ev = JSON.parse(line);
            if (ev.type === 'token') {
              full += ev.content;
              setMessages(prev => {
                const exists = prev.find(m => m.id === aId);
                if (exists) return prev.map(m => m.id === aId ? { ...m, content: full } : m);
                return [...prev, { id: aId, role: 'assistant' as const, content: full }];
              });
            }
            if (ev.type === 'tools_used') tools = ev.tools || [];
            if (ev.type === 'followups') followUps = ev.questions || [];
            if (ev.type === 'done') retSession = ev.sessionId || null;
            if (ev.type === 'error') full = ev.message || 'Something went wrong.';
          } catch { /* skip */ }
        }
      }
      if (buffer.trim()) {
        try {
          const ev = JSON.parse(buffer);
          if (ev.type === 'token') full += ev.content;
          if (ev.type === 'tools_used') tools = ev.tools || [];
          if (ev.type === 'followups') followUps = ev.questions || [];
          if (ev.type === 'done') retSession = ev.sessionId || null;
        } catch { /* skip */ }
      }

      setMessages(prev => prev.map(m => m.id === aId ? { ...m, content: full, toolsUsed: tools, followUps } : m));
      if (retSession && !sessionId) setSessionId(retSession);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setMessages(prev => [...prev, {
        id: `err_${Date.now()}`, role: 'assistant',
        content: `Sorry, I couldn\u2019t process that. ${err.message || 'Please try again.'}`,
      }]);
    } finally {
      setSending(false);
    }
  }, [input, sending, messages, sessionId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const hasMessages = messages.length > 0 || sending;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: C.bg }}>

      {/* ═══ WELCOME / LANDING ═══ */}
      {!hasMessages && (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '24px 28px 0', textAlign: 'center',
        }}>
          {/* Logo */}
          <div style={{ marginBottom: 12, cursor: 'pointer' }}>
            <img
              src="/openhouse-logo.png" alt="OpenHouse AI" width={72} height={72}
              style={{ objectFit: 'contain' }}
              onError={(e: any) => { e.currentTarget.style.display = 'none'; const fb = e.currentTarget.nextElementSibling; if (fb) fb.style.display = 'flex'; }}
            />
            <div style={{
              display: 'none', width: 72, height: 72, borderRadius: '50%',
              border: `2.5px solid ${C.gold}`, alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 0 0 6px ${C.goldLight}`,
            }}>
              <svg width="38" height="38" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke={C.gold} strokeWidth="1.25"/>
                <path d="M8 14L12 9L16 14" stroke={C.gold} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <line x1="9.5" y1="14" x2="14.5" y2="14" stroke={C.gold} strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
          </div>

          {/* Title */}
          <h1 style={{ color: C.t1, fontSize: 17, fontWeight: 600, lineHeight: 1.3, margin: '12px 0 6px' }}>
            Ask anything about your<br />pipeline or tasks
          </h1>
          <p style={{ color: C.t2, fontSize: 12, lineHeight: 1.5, margin: '0 0 16px', maxWidth: 280 }}>
            Quick answers for sales, units, buyers, and tasks.
          </p>

          {/* 2x2 pill grid — matches property assistant */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, width: '100%', maxWidth: 300 }}>
            {PROMPTS.map(p => (
              <button key={p.label} onClick={() => handleSend(p.query)} style={{
                padding: '8px 10px', background: C.bg,
                border: '1px solid #e2e8f0', borderRadius: 9999,
                color: C.t1, fontSize: 12, fontWeight: 500,
                fontFamily: 'inherit', cursor: 'pointer',
                textAlign: 'center', lineHeight: 1.4, width: '100%',
                transition: 'all .2s', overflow: 'hidden',
                textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ═══ MESSAGES ═══ */}
      {hasMessages && (
        <div ref={scrollRef} style={{
          flex: 1, overflowY: 'auto', padding: '12px 16px 8px',
          display: 'flex', flexDirection: 'column', gap: 16,
          WebkitOverflowScrolling: 'touch', overscrollBehaviorY: 'contain',
        }}>
          {messages.map(msg => msg.role === 'user' ? (
            /* ── User bubble — gold gradient, iMessage style ── */
            <div key={msg.id} style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <div style={{
                background: C.userBubble,
                borderRadius: '20px 20px 6px 20px',
                padding: '10px 16px', maxWidth: '75%',
                boxShadow: '0 1px 3px rgba(212,175,55,0.2)',
              }}>
                <p style={{ color: '#fff', fontSize: 15, lineHeight: 1.5, margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {msg.content}
                </p>
              </div>
            </div>
          ) : (
            /* ── Assistant bubble — light grey, iMessage style ── */
            <div key={msg.id} style={{ display: 'flex', justifyContent: 'flex-start', flexDirection: 'column', gap: 6 }}>
              <div style={{ maxWidth: '80%' }}>
                {/* Tool usage — consolidated badges */}
                {msg.toolsUsed && msg.toolsUsed.length > 0 && (() => {
                  // Group tools by name to avoid 17x "Drafted email" badges
                  const groups: Record<string, number> = {};
                  msg.toolsUsed!.forEach(t => { const l = toolLabel(t.name); groups[l] = (groups[l] || 0) + 1; });
                  return (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
                      {Object.entries(groups).map(([label, count]) => (
                        <span key={label} style={{
                          fontSize: 10, color: C.goldText,
                          background: C.goldLight, padding: '2px 8px',
                          borderRadius: 6, fontWeight: 500,
                        }}>
                          {label}{count > 1 ? ` (${count})` : ''}
                        </span>
                      ))}
                    </div>
                  );
                })()}

                {/* The bubble */}
                <div style={{
                  background: C.assistBubble,
                  borderRadius: '20px 20px 20px 6px',
                  padding: '10px 16px',
                  boxShadow: '0 0.5px 1px rgba(0,0,0,0.05)',
                  position: 'relative',
                }}>
                  {msg.toolsUsed?.some(t => t.name.includes('draft_message')) ? (
                    /* ── Draft email queue ── */
                    <DraftEmailQueue
                      drafts={(msg.toolsUsed || [])
                        .filter(t => t.name.includes('draft_message') && t.draft && t.draft.to && t.draft.body)
                        .map(t => t.draft as DraftData)}
                      fallbackContent={msg.content}
                      msgId={msg.id}
                      copiedId={copiedId}
                      onCopy={handleCopy}
                    />
                  ) : msg.toolsUsed?.some(t => t.name.includes('generate_developer_report')) ? (
                    /* ── Report card ── */
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                        <span style={{
                          fontSize: 9, fontWeight: 700, textTransform: 'uppercase' as const,
                          letterSpacing: '0.06em', color: '#0A7855',
                          background: 'rgba(10,120,85,0.08)', padding: '2px 8px', borderRadius: 6,
                        }}>Report</span>
                      </div>
                      <div style={{ fontSize: 15, lineHeight: 1.6, color: '#1f2937', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                        dangerouslySetInnerHTML={{ __html: formatContent(msg.content) }}
                      />
                      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                        <button onClick={() => { copyText(msg.content); setCopiedId(msg.id); setTimeout(() => setCopiedId(null), 2000); }}
                          style={{
                            flex: 1, padding: '8px 12px', borderRadius: 10,
                            background: C.gold, border: 'none', color: '#fff',
                            fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
                            boxShadow: '0 2px 6px rgba(212,175,55,0.3)',
                          }}>
                          {copiedId === msg.id ? 'Copied' : 'Send to developer'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* ── Standard text ── */
                    <div style={{ fontSize: 15, lineHeight: 1.6, color: '#1f2937', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                      dangerouslySetInnerHTML={{ __html: formatContent(msg.content) }}
                    />
                  )}
                </div>
              </div>

              {/* Follow-up action pills */}
              {msg.followUps && msg.followUps.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingLeft: 4, maxWidth: '85%' }}>
                  {msg.followUps.map((q, i) => (
                    <button key={i} onClick={() => handleSend(q)} style={{
                      padding: '6px 12px', background: C.bg,
                      border: '1px solid #e2e8f0', borderRadius: 9999,
                      color: C.t1, fontSize: 12, fontWeight: 500,
                      cursor: 'pointer', fontFamily: 'inherit',
                      transition: 'all .2s',
                    }}>
                      {q}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Typing indicator — matches property assistant */}
          {sending && (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div style={{
                background: C.assistBubble, borderRadius: '20px 20px 20px 6px',
                padding: '10px 16px', boxShadow: '0 0.5px 1px rgba(0,0,0,0.05)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{
                      width: 8, height: 8, borderRadius: '50%', background: '#9ca3af',
                      animation: `ohDotBounce 1.4s infinite ${i * 0.2}s`,
                    }} />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ INPUT BAR — matches property assistant ═══ */}
      <div style={{ flexShrink: 0, background: C.bg, padding: '8px 16px 14px' }}>
        <p style={{ color: C.t4, fontSize: 10, textAlign: 'center', margin: '0 0 8px' }}>
          Powered by AI &bull; Information for reference only
        </p>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: C.surface, border: `1px solid ${C.line}`,
          borderRadius: 28, padding: '4px 4px 4px 16px',
        }}>
          <textarea
            ref={taRef} rows={1} value={input}
            onChange={e => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 80) + 'px'; }}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your pipeline or tasks..."
            disabled={sending}
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: C.t1, fontSize: 14, lineHeight: 1.5, resize: 'none',
              fontFamily: 'inherit', maxHeight: 80, opacity: sending ? 0.5 : 1,
              padding: '8px 0',
            }}
          />
          {/* Mic icon */}
          <button style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'transparent', border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', flexShrink: 0,
          }}>
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={C.t3} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0014 0"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="8" y1="22" x2="16" y2="22"/>
            </svg>
          </button>
        </div>
      </div>

      <style>{`
        @keyframes ohDotBounce {
          0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
          30% { opacity: 1; transform: translateY(-8px); }
        }
      `}</style>
    </div>
  );
}
