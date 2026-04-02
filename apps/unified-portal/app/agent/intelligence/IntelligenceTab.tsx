'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  CARD, S1, LINE, LINE_B,
  T1, T2, T3, T4,
  GOLD, GOLD_D, GOLD_L, GOLD_M,
  GO, GO_L, WARN, WARN_L, INFO, INFO_L, VIO, VIO_L,
} from '@/lib/agent/design-tokens';

/* ─── Types ─── */

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolsUsed?: Array<{ name: string; summary: string }>;
  followUps?: string[];
}

/* ─── Tool step metadata ─── */

function toolMeta(name: string) {
  if (name.includes('draft_message'))             return { label: 'Draft email',              color: INFO, bg: INFO_L, icon: 'email' as const };
  if (name.includes('generate_developer_report')) return { label: 'Compile report',            color: GO,   bg: GO_L,   icon: 'report' as const };
  if (name.includes('create_task'))               return { label: 'Task created',              color: WARN, bg: WARN_L, icon: 'reminder' as const };
  if (name.includes('log_communication'))         return { label: 'Logged communication',      color: VIO,  bg: VIO_L,  icon: 'status' as const };
  if (name.includes('search_knowledge_base'))     return { label: 'Searched knowledge base',   color: INFO, bg: INFO_L, icon: 'search' as const };
  if (name.includes('get_unit_status'))           return { label: 'Looked up unit',            color: INFO, bg: INFO_L, icon: 'search' as const };
  if (name.includes('get_buyer'))                 return { label: 'Looked up buyer',           color: INFO, bg: INFO_L, icon: 'search' as const };
  if (name.includes('get_scheme_overview'))       return { label: 'Scheme overview',           color: GO,   bg: GO_L,   icon: 'report' as const };
  if (name.includes('get_outstanding'))           return { label: 'Checked outstanding items', color: WARN, bg: WARN_L, icon: 'status' as const };
  if (name.includes('get_communication'))         return { label: 'Checked comms history',     color: VIO,  bg: VIO_L,  icon: 'status' as const };
  return { label: name.replace(/_/g, ' '), color: T3, bg: S1, icon: 'info' as const };
}

const ICON_PATHS: Record<string, string> = {
  email:    '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
  status:   '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  reminder: '<circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/>',
  report:   '<polyline points="23,6 13.5,15.5 8.5,10.5 1,18"/><polyline points="17,6 23,6 23,12"/>',
  search:   '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  info:     '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
};

function StepIcon({ type, color, size = 13 }: { type: string; color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
      dangerouslySetInnerHTML={{ __html: ICON_PATHS[type] || ICON_PATHS.info }} />
  );
}

/* ─── Suggested prompts ─── */

const PROMPTS = [
  { label: 'Chase contracts',      query: 'What contracts are outstanding and need chasing?' },
  { label: 'Weekly report',        query: 'Generate a weekly developer report' },
  { label: 'Pipeline overview',    query: 'Give me an overview of all my schemes' },
  { label: 'What needs attention?', query: "What's outstanding this week?" },
];

/* ─── Clipboard ─── */

async function copyText(text: string) {
  try { await navigator.clipboard.writeText(text); }
  catch {
    const t = document.createElement('textarea');
    t.value = text; document.body.appendChild(t); t.select();
    document.execCommand('copy'); document.body.removeChild(t);
  }
}

/* ═══════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════ */

export default function IntelligenceTab() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [messages, sending]);

  /* ── Send message via streaming API ── */
  const handleSend = useCallback(async (text?: string) => {
    const msg = text || input.trim();
    if (!msg || sending) return;

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const userMsg: Message = { id: `u_${Date.now()}`, role: 'user', content: msg };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
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

  const handleCopy = (id: string, text: string) => {
    copyText(text); setCopiedId(id); setTimeout(() => setCopiedId(null), 2000);
  };

  const hasMessages = messages.length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: CARD, position: 'relative' }}>

      {/* ═══ LANDING STATE ═══ */}
      {!hasMessages && (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '20px 28px 0', textAlign: 'center',
        }}>
          <div style={{ marginBottom: 18 }}>
            <div style={{
              width: 72, height: 72, borderRadius: '50%',
              border: `2.5px solid ${GOLD_M}`, boxShadow: `0 0 0 6px ${GOLD_L}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width={36} height={36} viewBox="0 0 24 24" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" stroke={GOLD} />
                <path d="M8 14 L12 9 L16 14" stroke={GOLD} fill="none" />
                <line x1="9.5" y1="14" x2="14.5" y2="14" stroke={GOLD} />
              </svg>
            </div>
          </div>

          <p style={{ color: GOLD_D, fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, margin: '0 0 18px' }}>
            OpenHouse AI
          </p>
          <h2 style={{ color: T1, fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.3, margin: '0 0 8px' }}>
            Ask anything about your pipeline or tasks
          </h2>
          <p style={{ color: T3, fontSize: 13, lineHeight: 1.6, margin: '0 0 28px' }}>
            Quick actions for sales agents: chase contracts, draft reports, follow up buyers, and more.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, width: '100%', maxWidth: 320 }}>
            {PROMPTS.map((p, i) => (
              <button key={i} onClick={() => handleSend(p.query)} style={{
                padding: '11px 14px', background: CARD, border: `1px solid ${LINE_B}`, borderRadius: 24,
                color: T2, fontSize: 12, fontWeight: 500, cursor: 'pointer', textAlign: 'center',
                width: '100%', fontFamily: 'inherit', transition: 'all .15s',
              }}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ═══ THREAD ═══ */}
      {hasMessages && (
        <div ref={threadRef} style={{
          flex: 1, overflowY: 'auto', padding: '16px 16px 8px',
          display: 'flex', flexDirection: 'column', gap: 14,
          WebkitOverflowScrolling: 'touch',
        }}>
          {messages.map(msg => msg.role === 'user' ? (
            <div key={msg.id} style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <div style={{ background: T1, borderRadius: '16px 16px 4px 16px', padding: '10px 15px', maxWidth: '80%' }}>
                <p style={{ color: '#fff', fontSize: 13, lineHeight: 1.55, margin: 0 }}>{msg.content}</p>
              </div>
            </div>
          ) : (
            <div key={msg.id} style={{ maxWidth: '92%' }}>
              <div style={{
                background: CARD, borderRadius: 16, border: `1px solid ${LINE}`, overflow: 'hidden',
                boxShadow: '0 1px 2px rgba(0,0,0,.04), 0 4px 14px rgba(0,0,0,.03)',
              }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', borderBottom: `1px solid ${LINE}` }}>
                  <div style={{ width: 26, height: 26, borderRadius: 8, background: GOLD_L, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width={12} height={12} viewBox="0 0 24 24" fill={GOLD_D} stroke={GOLD_D} strokeWidth="1.5">
                      <polygon points="13,2 3,14 12,14 11,22 21,10 12,10 13,2" />
                    </svg>
                  </div>
                  <span style={{ color: T1, fontSize: 13, fontWeight: 600 }}>Intelligence</span>
                  {msg.toolsUsed && msg.toolsUsed.length > 0 && (
                    <span style={{ color: T3, fontSize: 11, marginLeft: 'auto' }}>
                      {msg.toolsUsed.length} action{msg.toolsUsed.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                {/* Tool steps */}
                {msg.toolsUsed && msg.toolsUsed.length > 0 && msg.toolsUsed.map((tool, ti) => {
                  const meta = toolMeta(tool.name);
                  return (
                    <div key={ti} style={{ padding: '14px 16px', borderBottom: ti < (msg.toolsUsed?.length || 0) - 1 ? `1px solid ${LINE}` : 'none' }}>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: meta.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                          <StepIcon type={meta.icon} color={meta.color} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <p style={{ color: T2, fontSize: 12, fontWeight: 600, margin: '0 0 4px' }}>{meta.label}</p>
                          <p style={{ color: T3, fontSize: 11, margin: 0, lineHeight: 1.5 }}>{tool.summary}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Response body */}
                <div style={{ padding: '14px 16px' }}>
                  {msg.toolsUsed?.some(t => t.name.includes('draft_message')) ? (
                    <div>
                      <div style={{ background: S1, border: `1px solid ${LINE}`, borderRadius: 10, padding: '10px 12px', marginBottom: 10 }}>
                        <p style={{ color: T4, fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', margin: '0 0 8px' }}>DRAFT EMAIL</p>
                        <p style={{ color: T2, fontSize: 12, lineHeight: 1.6, margin: 0, whiteSpace: 'pre-line' }}>{msg.content}</p>
                      </div>
                      <div style={{ display: 'flex', gap: 7 }}>
                        <button onClick={() => handleCopy(msg.id, msg.content)} style={{ flex: 1, padding: '10px 14px', borderRadius: 12, background: T1, color: '#fff', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 1px 3px rgba(0,0,0,.12), 0 4px 12px rgba(0,0,0,.08)' }}>
                          {copiedId === msg.id ? 'Copied \u2713' : 'Copy Draft'}
                        </button>
                        <button style={{ flex: 1, padding: '10px 14px', borderRadius: 12, background: S1, color: T2, fontSize: 12, fontWeight: 500, border: `1px solid ${LINE}`, cursor: 'pointer', fontFamily: 'inherit' }}>Edit</button>
                      </div>
                    </div>
                  ) : msg.toolsUsed?.some(t => t.name.includes('generate_developer_report')) ? (
                    <div>
                      <div style={{ background: S1, border: `1px solid ${LINE}`, borderRadius: 10, padding: '10px 12px', marginBottom: 10 }}>
                        <p style={{ color: T2, fontSize: 12, lineHeight: 1.65, margin: 0, whiteSpace: 'pre-line' }}>{msg.content}</p>
                      </div>
                      <div style={{ display: 'flex', gap: 7 }}>
                        <button onClick={() => handleCopy(msg.id, msg.content)} style={{ flex: 1, padding: '10px 14px', borderRadius: 12, background: GOLD, color: T1, fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 1px 3px rgba(196,164,74,.22), 0 4px 12px rgba(196,164,74,.16)' }}>
                          {copiedId === msg.id ? 'Copied \u2713' : 'Send to Developer'}
                        </button>
                        <button style={{ flex: 1, padding: '10px 14px', borderRadius: 12, background: S1, color: T2, fontSize: 12, fontWeight: 500, border: `1px solid ${LINE}`, cursor: 'pointer', fontFamily: 'inherit' }}>Edit</button>
                      </div>
                    </div>
                  ) : msg.toolsUsed?.some(t => t.name.includes('create_task')) ? (
                    <div>
                      <p style={{ color: T2, fontSize: 12, lineHeight: 1.6, margin: '0 0 8px', whiteSpace: 'pre-line' }}>{msg.content}</p>
                      <div style={{ display: 'flex', gap: 7 }}>
                        <button style={{ flex: 1, padding: '10px 14px', borderRadius: 12, background: T1, color: '#fff', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Confirm</button>
                        <button style={{ flex: 1, padding: '10px 14px', borderRadius: 12, background: S1, color: T2, fontSize: 12, fontWeight: 500, border: `1px solid ${LINE}`, cursor: 'pointer', fontFamily: 'inherit' }}>Dismiss</button>
                      </div>
                    </div>
                  ) : (
                    <p style={{ color: T2, fontSize: 13, lineHeight: 1.65, margin: 0, whiteSpace: 'pre-line' }}>{msg.content}</p>
                  )}
                </div>
              </div>

              {/* Follow-ups */}
              {msg.followUps && msg.followUps.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10, paddingLeft: 4 }}>
                  {msg.followUps.map((q, i) => (
                    <button key={i} onClick={() => handleSend(q)} style={{
                      padding: '6px 12px', background: CARD, border: `1px solid ${LINE_B}`, borderRadius: 20,
                      color: T2, fontSize: 11, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                    }}>
                      {q}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}

          {sending && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: CARD, border: `1px solid ${LINE}`, borderRadius: 14, boxShadow: '0 1px 2px rgba(0,0,0,.04)', maxWidth: '70%' }}>
              <div style={{ display: 'flex', gap: 4 }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{ width: 5, height: 5, borderRadius: 3, background: GOLD, animation: `agentBlink ${1.1 + i * 0.15}s ease-in-out ${i * 0.18}s infinite` }} />
                ))}
              </div>
              <span style={{ color: T3, fontSize: 12 }}>Working on it...</span>
            </div>
          )}
        </div>
      )}

      {/* ═══ FOOTER ═══ */}
      <div style={{ flexShrink: 0, padding: '0 16px 0', background: CARD }}>
        <p style={{ color: T4, fontSize: 10, textAlign: 'center', margin: '0 0 10px', padding: '8px 0 0' }}>
          Powered by AI &bull; Information for reference only
        </p>
        <div style={{ display: 'flex', alignItems: 'center', background: S1, border: `1px solid ${LINE}`, borderRadius: 28, padding: '12px 16px', gap: 10, marginBottom: 10 }}>
          <textarea
            value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
            placeholder="Ask about your pipeline or tasks..." disabled={sending} rows={1}
            style={{ flex: 1, background: 'transparent', border: 'none', color: T1, fontSize: 13, lineHeight: 1.5, maxHeight: 88, minHeight: 20, resize: 'none', outline: 'none', fontFamily: 'inherit', opacity: sending ? 0.6 : 1 }}
            onInput={(e) => { const el = e.target as HTMLTextAreaElement; el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 88) + 'px'; }}
          />
          <button style={{ width: 34, height: 34, borderRadius: '50%', background: 'transparent', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer' }}>
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={T3} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0014 0" /><line x1="12" y1="19" x2="12" y2="22" /><line x1="8" y1="22" x2="16" y2="22" />
            </svg>
          </button>
        </div>
      </div>

      <style>{`@keyframes agentBlink { 0%,100% { opacity:.2 } 50% { opacity:.85 } }`}</style>
    </div>
  );
}
