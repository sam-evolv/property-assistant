'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  GOLD, TEXT_1, TEXT_2, TEXT_3, SURFACE_1, SURFACE_2, BORDER, BORDER_LIGHT,
  GREEN, GREEN_BG, AMBER, AMBER_BG, BLUE, BLUE_BG, RED, RED_BG, EASE_PREMIUM,
} from '@/lib/dev-app/design-system';
import MobileShell from '@/components/dev-app/layout/MobileShell';
import TypingIndicator from '@/components/dev-app/shared/TypingIndicator';

/* ─── Prototype color overrides (matching the HTML design) ─── */
const C = {
  bg: '#F4F4F6',
  card: '#FFFFFF',
  s1: '#F0F0F4',
  s2: '#E8E8EE',
  line: '#EBEBF0',
  lineB: '#DCDCE6',
  t1: '#0D0D18',
  t2: '#38384E',
  t3: '#86869A',
  t4: '#B4B4C8',
  gold: '#C4A44A',
  goldD: '#97791E',
  goldL: '#FAF4E4',
  goldM: '#E8D48A',
  go: '#0A7855',
  goL: '#E6F5EF',
  flag: '#BF3728',
  flagL: '#FDF0EE',
  warn: '#B05208',
  warnL: '#FEF4EE',
  info: '#1756A8',
  infoL: '#EDF3FC',
  vio: '#5B30AC',
  vioL: '#F2EEF9',
};

/* ─── Types ─── */

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolsUsed?: Array<{ name: string; summary: string }>;
  followUps?: string[];
}

/* ─── Helpers ─── */

/** Classify a tool into icon/color for step display. */
function toolMeta(name: string): { label: string; color: string; bg: string; icon: 'email' | 'status' | 'reminder' | 'report' | 'search' | 'info' } {
  if (name.includes('draft_message')) return { label: 'Draft email', color: C.info, bg: C.infoL, icon: 'email' };
  if (name.includes('generate_developer_report')) return { label: 'Compile report', color: C.go, bg: C.goL, icon: 'report' };
  if (name.includes('create_task')) return { label: 'Task created', color: C.warn, bg: C.warnL, icon: 'reminder' };
  if (name.includes('log_communication')) return { label: 'Logged communication', color: C.vio, bg: C.vioL, icon: 'status' };
  if (name.includes('search_knowledge_base')) return { label: 'Searched knowledge base', color: C.info, bg: C.infoL, icon: 'search' };
  if (name.includes('get_unit_status') || name.includes('get_buyer')) return { label: 'Looked up data', color: C.info, bg: C.infoL, icon: 'search' };
  if (name.includes('get_scheme_overview')) return { label: 'Scheme overview', color: C.go, bg: C.goL, icon: 'report' };
  if (name.includes('get_outstanding')) return { label: 'Checked outstanding items', color: C.warn, bg: C.warnL, icon: 'status' };
  return { label: name.replace(/_/g, ' '), color: C.t3, bg: C.s1, icon: 'info' };
}

function StepIcon({ type, color, size = 13 }: { type: string; color: string; size?: number }) {
  const s = size;
  const p: Record<string, string> = {
    email: `<rect x="2" y="4" width="20" height="16" rx="2" stroke="${color}"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" stroke="${color}"/>`,
    status: `<rect x="3" y="3" width="7" height="7" rx="1.5" stroke="${color}"/><rect x="14" y="3" width="7" height="7" rx="1.5" stroke="${color}"/><rect x="3" y="14" width="7" height="7" rx="1.5" stroke="${color}"/><rect x="14" y="14" width="7" height="7" rx="1.5" stroke="${color}"/>`,
    reminder: `<circle cx="12" cy="12" r="10" stroke="${color}"/><polyline points="12,6 12,12 16,14" stroke="${color}"/>`,
    report: `<polyline points="23,6 13.5,15.5 8.5,10.5 1,18" stroke="${color}"/><polyline points="17,6 23,6 23,12" stroke="${color}"/>`,
    search: `<circle cx="11" cy="11" r="8" stroke="${color}"/><path d="m21 21-4.3-4.3" stroke="${color}"/>`,
    info: `<circle cx="12" cy="12" r="10" stroke="${color}"/><path d="M12 16v-4M12 8h.01" stroke="${color}"/>`,
  };
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" strokeWidth="1.75"
      strokeLinecap="round" strokeLinejoin="round"
      dangerouslySetInnerHTML={{ __html: p[type] || p.info }} />
  );
}

/** Copy text to clipboard. */
async function copyText(text: string) {
  try { await navigator.clipboard.writeText(text); }
  catch { /* fallback */ const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); document.execCommand('copy'); document.body.removeChild(t); }
}

/* ─── Suggested Prompts ─── */
const PROMPTS = [
  { label: 'Chase contracts', query: 'What contracts are outstanding and need chasing?' },
  { label: 'Weekly report', query: 'Generate a weekly developer report' },
  { label: 'Pipeline overview', query: 'Give me an overview of all my schemes' },
  { label: 'What needs attention?', query: "What's outstanding this week?" },
];

/* ─── Component ─── */

export default function IntelligencePage() {
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

  const handleSend = useCallback(async (text?: string) => {
    const messageText = text || input.trim();
    if (!messageText || sending) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const userMsg: Message = { id: `u_${Date.now()}`, role: 'user', content: messageText };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setSending(true);

    const history = [...messages, userMsg].slice(-10).map(m => ({ role: m.role, content: m.content }));

    try {
      const response = await fetch('/api/agent-intelligence/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageText, history: history.slice(0, -1), sessionId }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(err.error || `HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response stream');
      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';
      let toolsUsed: Array<{ name: string; summary: string }> = [];
      let followUps: string[] = [];
      let returnedSessionId: string | null = null;
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
              fullContent += ev.content;
              setMessages(prev => {
                const exists = prev.find(m => m.id === aId);
                if (exists) return prev.map(m => m.id === aId ? { ...m, content: fullContent } : m);
                return [...prev, { id: aId, role: 'assistant' as const, content: fullContent }];
              });
            }
            if (ev.type === 'tools_used') toolsUsed = ev.tools || [];
            if (ev.type === 'followups') followUps = ev.questions || [];
            if (ev.type === 'done') returnedSessionId = ev.sessionId || null;
            if (ev.type === 'error') fullContent = ev.message || 'Something went wrong.';
          } catch { /* skip */ }
        }
      }

      // Process remaining buffer
      if (buffer.trim()) {
        try {
          const ev = JSON.parse(buffer);
          if (ev.type === 'token') fullContent += ev.content;
          if (ev.type === 'tools_used') toolsUsed = ev.tools || [];
          if (ev.type === 'followups') followUps = ev.questions || [];
          if (ev.type === 'done') returnedSessionId = ev.sessionId || null;
        } catch { /* skip */ }
      }

      // Final update with metadata
      setMessages(prev => prev.map(m => m.id === aId ? { ...m, content: fullContent, toolsUsed, followUps } : m));
      if (returnedSessionId && !sessionId) setSessionId(returnedSessionId);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setMessages(prev => [...prev, { id: `err_${Date.now()}`, role: 'assistant', content: `Sorry, I couldn\u2019t process that. ${err.message || 'Please try again.'}` }]);
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
    <MobileShell>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: C.card }}>

        {/* ── Landing State ── */}
        {!hasMessages && (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            padding: '20px 28px 0', textAlign: 'center',
          }}>
            {/* Gold ring logo */}
            <div style={{ marginBottom: 18 }}>
              <div style={{
                width: 72, height: 72, borderRadius: '50%',
                border: `2.5px solid ${C.goldM}`,
                boxShadow: `0 0 0 6px ${C.goldL}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width={36} height={36} viewBox="0 0 24 24" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" stroke={C.gold} />
                  <path d="M8 14 L12 9 L16 14" stroke={C.gold} fill="none" />
                  <line x1="9.5" y1="14" x2="14.5" y2="14" stroke={C.gold} />
                </svg>
              </div>
            </div>

            <p style={{
              color: C.goldD, fontSize: 12, fontWeight: 700,
              letterSpacing: '0.1em', textTransform: 'uppercase' as const, margin: '0 0 18px',
            }}>
              OpenHouse AI
            </p>

            <h2 style={{
              color: C.t1, fontSize: 20, fontWeight: 700,
              letterSpacing: '-0.02em', lineHeight: 1.3, margin: '0 0 8px',
            }}>
              Ask anything about your pipeline or tasks
            </h2>
            <p style={{ color: C.t3, fontSize: 13, lineHeight: 1.6, margin: '0 0 28px' }}>
              Quick actions for sales agents: chase contracts, draft reports, follow up buyers, and more.
            </p>

            {/* 2×2 prompt grid */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr',
              gap: 10, width: '100%', maxWidth: 320,
            }}>
              {PROMPTS.map((p, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(p.query)}
                  style={{
                    padding: '11px 14px', background: C.card,
                    border: `1px solid ${C.lineB}`, borderRadius: 24,
                    color: C.t2, fontSize: 12, fontWeight: 500,
                    cursor: 'pointer', textAlign: 'center', width: '100%',
                    transition: 'all .15s', fontFamily: 'inherit',
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Thread ── */}
        {hasMessages && (
          <div
            ref={threadRef}
            style={{
              flex: 1, overflowY: 'auto', padding: '16px 16px 8px',
              display: 'flex', flexDirection: 'column', gap: 14,
              WebkitOverflowScrolling: 'touch',
            }}
          >
            {messages.map(msg => msg.role === 'user' ? (
              /* ── User bubble: dark, right-aligned ── */
              <div key={msg.id} style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <div style={{
                  background: C.t1, borderRadius: '16px 16px 4px 16px',
                  padding: '10px 15px', maxWidth: '80%',
                }}>
                  <p style={{ color: '#fff', fontSize: 13, lineHeight: 1.55, margin: 0 }}>{msg.content}</p>
                </div>
              </div>
            ) : (
              /* ── Assistant: white card with Intelligence header ── */
              <div key={msg.id} style={{ maxWidth: '92%' }}>
                <div style={{
                  background: C.card, borderRadius: 16,
                  border: `1px solid ${C.line}`, overflow: 'hidden',
                  boxShadow: '0 1px 2px rgba(0,0,0,.04), 0 4px 14px rgba(0,0,0,.03)',
                }}>
                  {/* Card header */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '13px 16px', borderBottom: `1px solid ${C.line}`,
                  }}>
                    <div style={{
                      width: 26, height: 26, borderRadius: 8,
                      background: C.goldL, display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      <svg width={12} height={12} viewBox="0 0 24 24" fill={C.goldD} stroke={C.goldD} strokeWidth="1.5">
                        <polygon points="13,2 3,14 12,14 11,22 21,10 12,10 13,2" />
                      </svg>
                    </div>
                    <span style={{ color: C.t1, fontSize: 13, fontWeight: 600 }}>Intelligence</span>
                    {msg.toolsUsed && msg.toolsUsed.length > 0 && (
                      <span style={{ color: C.t3, fontSize: 11, marginLeft: 'auto' }}>
                        {msg.toolsUsed.length} action{msg.toolsUsed.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  {/* Tool steps (if tools were used) */}
                  {msg.toolsUsed && msg.toolsUsed.length > 0 && msg.toolsUsed.map((tool, ti) => {
                    const meta = toolMeta(tool.name);
                    return (
                      <div key={ti} style={{
                        padding: '14px 16px',
                        borderBottom: ti < (msg.toolsUsed?.length || 0) - 1 ? `1px solid ${C.line}` : 'none',
                      }}>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                          <div style={{
                            width: 28, height: 28, borderRadius: 8,
                            background: meta.bg, display: 'flex',
                            alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0, marginTop: 1,
                          }}>
                            <StepIcon type={meta.icon} color={meta.color} />
                          </div>
                          <div style={{ flex: 1 }}>
                            <p style={{ color: C.t2, fontSize: 12, fontWeight: 600, margin: '0 0 4px' }}>
                              {meta.label}
                            </p>
                            <p style={{ color: C.t3, fontSize: 11, margin: 0, lineHeight: 1.5 }}>
                              {tool.summary}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Response content */}
                  <div style={{ padding: '14px 16px' }}>
                    {/* Check if this is a draft (from draft_message tool) */}
                    {msg.toolsUsed?.some(t => t.name.includes('draft_message')) ? (
                      <div>
                        <div style={{
                          background: C.s1, border: `1px solid ${C.line}`,
                          borderRadius: 10, padding: '10px 12px', marginBottom: 10,
                        }}>
                          <p style={{
                            color: C.t4, fontSize: 9, fontWeight: 700,
                            letterSpacing: '0.06em', margin: '0 0 8px',
                          }}>
                            DRAFT EMAIL
                          </p>
                          <p style={{
                            color: C.t2, fontSize: 12, lineHeight: 1.6,
                            margin: 0, whiteSpace: 'pre-line',
                          }}>
                            {msg.content}
                          </p>
                        </div>
                        <div style={{ display: 'flex', gap: 7 }}>
                          <button onClick={() => handleCopy(msg.id, msg.content)} style={{
                            flex: 1, padding: '10px 14px', borderRadius: 12,
                            background: C.t1, color: '#fff', fontSize: 12, fontWeight: 600,
                            border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                            boxShadow: '0 1px 3px rgba(0,0,0,.12), 0 4px 12px rgba(0,0,0,.08)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                          }}>
                            {copiedId === msg.id ? 'Copied \u2713' : 'Copy Draft'}
                          </button>
                          <button style={{
                            flex: 1, padding: '10px 14px', borderRadius: 12,
                            background: C.s1, color: C.t2, fontSize: 12, fontWeight: 500,
                            border: `1px solid ${C.line}`, cursor: 'pointer', fontFamily: 'inherit',
                          }}>
                            Edit
                          </button>
                        </div>
                      </div>
                    ) : msg.toolsUsed?.some(t => t.name.includes('generate_developer_report')) ? (
                      /* Report content */
                      <div>
                        <div style={{
                          background: C.s1, border: `1px solid ${C.line}`,
                          borderRadius: 10, padding: '10px 12px', marginBottom: 10,
                        }}>
                          <p style={{
                            color: C.t2, fontSize: 12, lineHeight: 1.65,
                            margin: 0, whiteSpace: 'pre-line',
                          }}>
                            {msg.content}
                          </p>
                        </div>
                        <div style={{ display: 'flex', gap: 7 }}>
                          <button onClick={() => handleCopy(msg.id, msg.content)} style={{
                            flex: 1, padding: '10px 14px', borderRadius: 12,
                            background: C.gold, color: C.t1, fontSize: 12, fontWeight: 700,
                            border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                            boxShadow: '0 1px 3px rgba(196,164,74,.22), 0 4px 12px rgba(196,164,74,.16)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                          }}>
                            {copiedId === msg.id ? 'Copied \u2713' : 'Send to Developer'}
                          </button>
                          <button style={{
                            flex: 1, padding: '10px 14px', borderRadius: 12,
                            background: C.s1, color: C.t2, fontSize: 12, fontWeight: 500,
                            border: `1px solid ${C.line}`, cursor: 'pointer', fontFamily: 'inherit',
                          }}>
                            Edit
                          </button>
                        </div>
                      </div>
                    ) : msg.toolsUsed?.some(t => t.name.includes('create_task')) ? (
                      /* Task confirmation */
                      <div>
                        <p style={{ color: C.t2, fontSize: 12, lineHeight: 1.6, margin: '0 0 8px', whiteSpace: 'pre-line' }}>
                          {msg.content}
                        </p>
                        <div style={{ display: 'flex', gap: 7 }}>
                          <button style={{
                            flex: 1, padding: '10px 14px', borderRadius: 12,
                            background: C.t1, color: '#fff', fontSize: 12, fontWeight: 600,
                            border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                          }}>
                            Confirm
                          </button>
                          <button style={{
                            flex: 1, padding: '10px 14px', borderRadius: 12,
                            background: C.s1, color: C.t2, fontSize: 12, fontWeight: 500,
                            border: `1px solid ${C.line}`, cursor: 'pointer', fontFamily: 'inherit',
                          }}>
                            Dismiss
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Standard text response */
                      <p style={{
                        color: C.t2, fontSize: 13, lineHeight: 1.65,
                        margin: 0, whiteSpace: 'pre-line',
                      }}>
                        {msg.content}
                      </p>
                    )}
                  </div>
                </div>

                {/* Follow-up suggestions */}
                {msg.followUps && msg.followUps.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10, paddingLeft: 4 }}>
                    {msg.followUps.map((q, i) => (
                      <button key={i} onClick={() => handleSend(q)} style={{
                        padding: '6px 12px', background: C.card,
                        border: `1px solid ${C.lineB}`, borderRadius: 20,
                        color: C.t2, fontSize: 11, fontWeight: 500,
                        cursor: 'pointer', fontFamily: 'inherit',
                        transition: 'all .15s',
                      }}>
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
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '12px 16px', background: C.card,
                border: `1px solid ${C.line}`, borderRadius: 14,
                boxShadow: '0 1px 2px rgba(0,0,0,.04)', maxWidth: '70%',
              }}>
                <div style={{ display: 'flex', gap: 4 }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{
                      width: 5, height: 5, borderRadius: 3,
                      background: C.gold,
                      animation: `blink ${1.1 + i * 0.15}s ease-in-out ${i * 0.18}s infinite`,
                    }} />
                  ))}
                </div>
                <span style={{ color: C.t3, fontSize: 12 }}>Working on it...</span>
              </div>
            )}
          </div>
        )}

        {/* ── Footer + Input ── */}
        <div style={{ flexShrink: 0, padding: '0 16px 0', background: C.card }}>
          <p style={{ color: C.t4, fontSize: 10, textAlign: 'center', margin: '0 0 10px', padding: '8px 0 0' }}>
            Powered by AI &bull; Information for reference only
          </p>

          <div style={{
            display: 'flex', alignItems: 'center',
            background: C.s1, border: `1px solid ${C.line}`,
            borderRadius: 28, padding: '12px 16px', gap: 10,
            marginBottom: 10,
          }}>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your pipeline or tasks..."
              disabled={sending}
              rows={1}
              style={{
                flex: 1, background: 'transparent', border: 'none',
                color: C.t1, fontSize: 13, lineHeight: 1.5,
                maxHeight: 88, minHeight: 20, resize: 'none',
                outline: 'none', fontFamily: 'inherit',
                opacity: sending ? 0.6 : 1,
              }}
              onInput={(e) => {
                const el = e.target as HTMLTextAreaElement;
                el.style.height = 'auto';
                el.style.height = Math.min(el.scrollHeight, 88) + 'px';
              }}
            />

            {/* Mic button */}
            <button style={{
              width: 34, height: 34, borderRadius: '50%',
              background: 'transparent', border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, cursor: 'pointer', color: C.t3,
            }}>
              <svg width={20} height={20} viewBox="0 0 24 24" fill="none" strokeWidth="1.75"
                stroke={C.t3} strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="2" width="6" height="12" rx="3" />
                <path d="M5 10a7 7 0 0014 0" />
                <line x1="12" y1="19" x2="12" y2="22" />
                <line x1="8" y1="22" x2="16" y2="22" />
              </svg>
            </button>
          </div>
        </div>

        {/* Blink animation for typing dots */}
        <style>{`
          @keyframes blink { 0%,100% { opacity: .2 } 50% { opacity: .85 } }
        `}</style>
      </div>
    </MobileShell>
  );
}
