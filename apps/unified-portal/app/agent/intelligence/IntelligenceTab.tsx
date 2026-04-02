'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

/* ─── Dark palette — Intelligence screen only ─── */
const D = {
  bg:       '#0B0C0F',
  surface:  '#12151A',
  surface2: '#1A1E26',
  border:   '#1E2531',
  border2:  '#2A3040',
  t1:       '#EEF2F8',
  t2:       '#9CA8BC',
  t3:       '#566070',
  gold:     '#D4AF37',
  goldDim:  '#A88B20',
  goldGlow: 'rgba(212,175,55,0.12)',
};

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
  if (name.includes('draft_message'))             return { label: 'Draft email',              color: '#3B82F6', bg: 'rgba(59,130,246,0.12)',  border: 'rgba(59,130,246,0.2)',  icon: 'email' as const };
  if (name.includes('generate_developer_report')) return { label: 'Compile report',            color: '#10B981', bg: 'rgba(16,185,129,0.10)',  border: 'rgba(16,185,129,0.2)',  icon: 'report' as const };
  if (name.includes('create_task'))               return { label: 'Task created',              color: '#F59E0B', bg: 'rgba(245,158,11,0.10)',  border: 'rgba(245,158,11,0.2)',  icon: 'reminder' as const };
  if (name.includes('log_communication'))         return { label: 'Logged communication',      color: '#8B5CF6', bg: 'rgba(139,92,246,0.10)',  border: 'rgba(139,92,246,0.2)',  icon: 'status' as const };
  if (name.includes('search_knowledge_base'))     return { label: 'Searched knowledge base',   color: '#3B82F6', bg: 'rgba(59,130,246,0.10)',  border: 'rgba(59,130,246,0.2)',  icon: 'search' as const };
  if (name.includes('get_unit_status'))           return { label: 'Looked up unit',            color: '#3B82F6', bg: 'rgba(59,130,246,0.10)',  border: 'rgba(59,130,246,0.2)',  icon: 'search' as const };
  if (name.includes('get_buyer'))                 return { label: 'Looked up buyer',           color: '#3B82F6', bg: 'rgba(59,130,246,0.10)',  border: 'rgba(59,130,246,0.2)',  icon: 'search' as const };
  if (name.includes('get_scheme_overview'))       return { label: 'Scheme overview',           color: '#10B981', bg: 'rgba(16,185,129,0.10)',  border: 'rgba(16,185,129,0.2)',  icon: 'report' as const };
  if (name.includes('get_outstanding'))           return { label: 'Checked outstanding items', color: '#F59E0B', bg: 'rgba(245,158,11,0.10)',  border: 'rgba(245,158,11,0.2)',  icon: 'status' as const };
  if (name.includes('get_communication'))         return { label: 'Checked comms history',     color: '#8B5CF6', bg: 'rgba(139,92,246,0.10)',  border: 'rgba(139,92,246,0.2)',  icon: 'status' as const };
  return { label: name.replace(/_/g, ' '), color: D.t3, bg: D.surface2, border: D.border, icon: 'info' as const };
}

const ICON_PATHS: Record<string, string> = {
  email:    '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
  status:   '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  reminder: '<circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/>',
  report:   '<polyline points="23,6 13.5,15.5 8.5,10.5 1,18"/><polyline points="17,6 23,6 23,12"/>',
  search:   '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  info:     '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
};

function StepIcon({ type, color, size = 14 }: { type: string; color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
      dangerouslySetInnerHTML={{ __html: ICON_PATHS[type] || ICON_PATHS.info }} />
  );
}

/* ─── Logo ─── */

function OHLogo() {
  return (
    <div style={{
      width: 80, height: 80, borderRadius: '50%',
      border: `2px solid ${D.gold}`,
      boxShadow: `0 0 0 8px ${D.goldGlow}, 0 0 32px rgba(212,175,55,0.1)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      marginBottom: 20, flexShrink: 0,
    }}>
      <svg width={40} height={40} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke={D.gold} strokeWidth="1.25" />
        <path d="M8 14L12 9L16 14" stroke={D.gold} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="9.5" y1="14" x2="14.5" y2="14" stroke={D.gold} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </div>
  );
}

/* ─── Prompt pill ─── */

function PromptPill({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: '12px 16px', background: 'transparent',
      border: `1px solid ${D.border2}`, borderRadius: 14,
      color: D.t2, fontSize: 13, fontWeight: 500,
      fontFamily: 'inherit', cursor: 'pointer',
      textAlign: 'center', lineHeight: 1.4,
      transition: 'all 0.15s ease', width: '100%',
    }}
    onMouseEnter={e => { e.currentTarget.style.borderColor = D.gold; e.currentTarget.style.color = D.t1; }}
    onMouseLeave={e => { e.currentTarget.style.borderColor = D.border2; e.currentTarget.style.color = D.t2; }}
    >
      {label}
    </button>
  );
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
  { label: 'Chase contracts',       query: 'What contracts are outstanding and need chasing?' },
  { label: 'Weekly report',         query: 'Generate a weekly developer report' },
  { label: 'AIP follow-up',         query: 'Which buyers still need AIP sorted?' },
  { label: 'Email all pending',     query: 'Draft follow-up emails for all buyers with contracts outstanding' },
];

/* ═══════════════════════════════════════════════════
   Component — Dark premium Intelligence
   ═══════════════════════════════════════════════════ */

export default function IntelligenceTab() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
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

  const handleCopy = (id: string, text: string) => {
    copyText(text); setCopiedId(id); setTimeout(() => setCopiedId(null), 2000);
  };

  const hasMessages = messages.length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: D.bg, position: 'relative' }}>

      {/* ═══ LANDING STATE ═══ */}
      {!hasMessages && !sending && (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '24px 28px 0', textAlign: 'center',
        }}>
          <OHLogo />

          <p style={{
            color: D.gold, fontSize: 11, fontWeight: 700,
            letterSpacing: '0.14em', textTransform: 'uppercase' as const,
            margin: '0 0 20px',
          }}>
            OpenHouse Agent
          </p>

          <h2 style={{
            color: D.t1, fontSize: 22, fontWeight: 700,
            letterSpacing: '-0.025em', lineHeight: 1.25, margin: '0 0 10px',
          }}>
            Ask anything about your<br />pipeline or tasks
          </h2>

          <p style={{
            color: D.t2, fontSize: 13, lineHeight: 1.65,
            margin: '0 0 32px', maxWidth: 300,
          }}>
            Tell me what to do — I'll draft emails, update your pipeline, and set reminders. You confirm each action before anything sends.
          </p>

          {/* 2x2 prompt pills */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, width: '100%', maxWidth: 320 }}>
            {PROMPTS.map(p => (
              <PromptPill key={p.label} label={p.label} onClick={() => handleSend(p.query)} />
            ))}
          </div>
        </div>
      )}

      {/* ═══ THREAD ═══ */}
      {(hasMessages || sending) && (
        <div ref={threadRef} style={{
          flex: 1, overflowY: 'auto', padding: '16px 16px 8px',
          display: 'flex', flexDirection: 'column', gap: 14,
          WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' as any,
        }}>
          {messages.map(msg => msg.role === 'user' ? (
            /* ── User bubble ── */
            <div key={msg.id} style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <div style={{
                background: D.surface2, border: `1px solid ${D.border2}`,
                borderRadius: '18px 18px 4px 18px',
                padding: '10px 15px', maxWidth: '80%',
              }}>
                <p style={{ color: D.t1, fontSize: 13, lineHeight: 1.55, margin: 0 }}>{msg.content}</p>
              </div>
            </div>
          ) : (
            /* ── Assistant response card ── */
            <div key={msg.id} style={{ maxWidth: '92%' }}>
              <div style={{
                background: D.surface, border: `1px solid ${D.border}`,
                borderRadius: 18, overflow: 'hidden',
              }}>
                {/* Card header */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '13px 16px', borderBottom: `1px solid ${D.border}`,
                }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: 8,
                    background: 'rgba(212,175,55,0.12)',
                    border: '1px solid rgba(212,175,55,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <svg width={12} height={12} viewBox="0 0 24 24" fill={D.gold}>
                      <polygon points="13,2 3,14 12,14 11,22 21,10 12,10 13,2" />
                    </svg>
                  </div>
                  <span style={{ color: D.t1, fontSize: 13, fontWeight: 600 }}>Intelligence</span>
                  {msg.toolsUsed && msg.toolsUsed.length > 0 && (
                    <span style={{ color: D.t3, fontSize: 11, marginLeft: 'auto' }}>
                      {msg.toolsUsed.length} action{msg.toolsUsed.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                {/* Tool action steps */}
                {msg.toolsUsed && msg.toolsUsed.length > 0 && msg.toolsUsed.map((tool, ti) => {
                  const meta = toolMeta(tool.name);
                  return (
                    <div key={ti} style={{
                      padding: '14px 16px',
                      borderBottom: ti < (msg.toolsUsed?.length || 0) - 1 ? `1px solid ${D.border}` : 'none',
                    }}>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        <div style={{
                          width: 30, height: 30, borderRadius: 9,
                          background: meta.bg, border: `1px solid ${meta.border}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0, marginTop: 1,
                        }}>
                          <StepIcon type={meta.icon} color={meta.color} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <p style={{ color: D.t2, fontSize: 12, fontWeight: 600, margin: '0 0 4px' }}>{meta.label}</p>
                          <p style={{ color: D.t3, fontSize: 11, margin: 0, lineHeight: 1.5 }}>{tool.summary}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Response body */}
                <div style={{ padding: '14px 16px' }}>
                  {msg.toolsUsed?.some(t => t.name.includes('draft_message')) ? (
                    /* Draft email */
                    <div>
                      <div style={{
                        background: D.surface2, border: `1px solid ${D.border}`,
                        borderRadius: 12, padding: '12px 14px', marginBottom: 10,
                      }}>
                        <p style={{ color: D.t3, fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const, margin: '0 0 8px' }}>DRAFT EMAIL</p>
                        <p style={{ color: D.t1, fontSize: 12, lineHeight: 1.65, margin: 0, whiteSpace: 'pre-line' }}>{msg.content}</p>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button style={{
                          flex: 1, padding: '10px 14px', borderRadius: 10,
                          background: D.surface2, border: `1px solid ${D.border2}`,
                          color: D.t2, fontSize: 12, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer',
                        }}>Edit</button>
                        <button onClick={() => handleCopy(msg.id, msg.content)} style={{
                          flex: 1, padding: '10px 14px', borderRadius: 10,
                          background: D.gold, border: 'none',
                          color: '#0B0C0F', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
                        }}>
                          {copiedId === msg.id ? 'Copied \u2713' : 'Send \u2197'}
                        </button>
                      </div>
                    </div>
                  ) : msg.toolsUsed?.some(t => t.name.includes('generate_developer_report')) ? (
                    /* Report */
                    <div>
                      <div style={{
                        background: D.surface2, border: `1px solid ${D.border}`,
                        borderRadius: 12, padding: '12px 14px', marginBottom: 10,
                      }}>
                        <p style={{ color: D.t1, fontSize: 12, lineHeight: 1.7, margin: 0, whiteSpace: 'pre-line' }}>{msg.content}</p>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button style={{
                          flex: 1, padding: '10px 14px', borderRadius: 10,
                          background: D.surface2, border: `1px solid ${D.border2}`,
                          color: D.t2, fontSize: 12, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer',
                        }}>Edit</button>
                        <button onClick={() => handleCopy(msg.id, msg.content)} style={{
                          flex: 1, padding: '10px 14px', borderRadius: 10,
                          background: D.gold, border: 'none',
                          color: '#0B0C0F', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
                        }}>
                          {copiedId === msg.id ? 'Copied \u2713' : 'Send to Developer \u2197'}
                        </button>
                      </div>
                    </div>
                  ) : msg.toolsUsed?.some(t => t.name.includes('create_task')) ? (
                    /* Task confirmation */
                    <div>
                      <p style={{ color: D.t1, fontSize: 12, lineHeight: 1.6, margin: '0 0 10px', whiteSpace: 'pre-line' }}>{msg.content}</p>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button style={{
                          flex: 1, padding: '9px 14px', borderRadius: 10,
                          background: D.surface2, border: `1px solid ${D.border2}`,
                          color: D.t3, fontSize: 12, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer',
                        }}>Dismiss</button>
                        <button style={{
                          flex: 1, padding: '9px 14px', borderRadius: 10,
                          background: '#0D0D18', border: `1px solid ${D.border2}`,
                          color: D.t1, fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
                        }}>Confirm \u2713</button>
                      </div>
                    </div>
                  ) : msg.toolsUsed?.some(t => t.name.includes('log_communication')) ? (
                    /* Logged communication — confirmed style */
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '12px 16px', background: 'rgba(16,185,129,0.08)',
                      borderRadius: 12, border: '1px solid rgba(16,185,129,0.2)',
                    }}>
                      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                      <span style={{ color: '#10B981', fontSize: 13, fontWeight: 600 }}>Done</span>
                      <span style={{ color: D.t3, fontSize: 12, marginLeft: 4, flex: 1 }}>{msg.content.slice(0, 100)}</span>
                    </div>
                  ) : (
                    /* Standard text */
                    <p style={{ color: D.t1, fontSize: 13, lineHeight: 1.65, margin: 0, whiteSpace: 'pre-line' }}>{msg.content}</p>
                  )}
                </div>
              </div>

              {/* Follow-up pills */}
              {msg.followUps && msg.followUps.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10, paddingLeft: 4 }}>
                  {msg.followUps.map((q, i) => (
                    <button key={i} onClick={() => handleSend(q)} style={{
                      padding: '6px 12px', background: 'transparent',
                      border: `1px solid ${D.border2}`, borderRadius: 20,
                      color: D.t2, fontSize: 11, fontWeight: 500,
                      cursor: 'pointer', fontFamily: 'inherit',
                      transition: 'all .15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = D.gold; e.currentTarget.style.color = D.t1; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = D.border2; e.currentTarget.style.color = D.t2; }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Typing indicator */}
          {sending && (
            <div style={{
              background: D.surface, border: `1px solid ${D.border}`,
              borderRadius: 14, padding: '14px 16px',
              display: 'flex', alignItems: 'center', gap: 12, maxWidth: '70%',
            }}>
              <div style={{ display: 'flex', gap: 5 }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{
                    width: 6, height: 6, borderRadius: '50%', background: D.gold,
                    animation: `intelligenceBlink 1.2s ease-in-out ${i * 0.18}s infinite`,
                  }} />
                ))}
              </div>
              <span style={{ color: D.t3, fontSize: 12 }}>Working on it...</span>
            </div>
          )}
        </div>
      )}

      {/* ═══ BOTTOM BAR ═══ */}
      <div style={{
        flexShrink: 0, background: D.bg,
        borderTop: `1px solid ${D.border}`,
        padding: '8px 16px 14px',
      }}>
        <p style={{ color: D.t3, fontSize: 10, textAlign: 'center', margin: '0 0 10px' }}>
          Powered by AI &bull; Information for reference only
        </p>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: D.surface, border: `1px solid ${D.border2}`,
          borderRadius: 28, padding: '12px 16px',
        }}>
          <textarea
            ref={taRef}
            rows={1}
            value={input}
            onChange={e => {
              setInput(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 88) + 'px';
            }}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your pipeline or tasks..."
            disabled={sending}
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: D.t1, fontSize: 13, lineHeight: 1.5, resize: 'none',
              fontFamily: 'inherit', maxHeight: 88, caretColor: D.gold,
              opacity: sending ? 0.5 : 1,
            }}
          />
          <button style={{
            background: 'transparent', border: 'none', padding: 0,
            cursor: 'pointer', flexShrink: 0,
          }}>
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={D.t3}
              strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="2" width="6" height="12" rx="3" />
              <path d="M5 10a7 7 0 0014 0" />
              <line x1="12" y1="19" x2="12" y2="22" />
              <line x1="8" y1="22" x2="16" y2="22" />
            </svg>
          </button>
        </div>
      </div>

      <style>{`
        @keyframes intelligenceBlink {
          0%, 100% { opacity: 0.2; transform: scale(0.85); }
          50% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
