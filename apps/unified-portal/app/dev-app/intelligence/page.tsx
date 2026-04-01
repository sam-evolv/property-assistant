'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  GOLD, GOLD_LIGHT, TEXT_1, TEXT_2, TEXT_3, SURFACE_1, SURFACE_2, BORDER, BORDER_LIGHT,
  GREEN, GREEN_BG, AMBER, AMBER_BG, BLUE, BLUE_BG, EASE_PREMIUM,
} from '@/lib/dev-app/design-system';
import MobileShell from '@/components/dev-app/layout/MobileShell';
import { ChatAvatar } from '@/components/dev-app/shared/OHLogo';
import { MicIcon, SendIcon } from '@/components/dev-app/shared/Icons';
import TypingIndicator from '@/components/dev-app/shared/TypingIndicator';

/* ─────────────────── Types ─────────────────── */

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolsUsed?: Array<{ name: string; summary: string }>;
  followUps?: string[];
  isDraft?: boolean;
  isReport?: boolean;
  isTaskCreated?: boolean;
}

/* ─────────────────── Constants ─────────────────── */

const SUGGESTED_PROMPTS = [
  "What's outstanding this week?",
  'Give me a scheme overview',
  'Draft a buyer follow-up',
  'Generate developer report',
];

const LOG_ENTRIES = [
  { time: '10:30', action: 'Sent reminder to Unit 7 purchaser', status: 'complete' },
  { time: '09:15', action: 'Flagged compliance item for review', status: 'complete' },
  { time: 'Yesterday', action: 'Generated pipeline report', status: 'complete' },
];

/* ─────────────────── Helpers ─────────────────── */

/** Detect if the response content looks like a draft message (from draft_message tool). */
function isDraftContent(content: string, toolsUsed?: Array<{ name: string }>): boolean {
  if (toolsUsed?.some(t => t.name === 'draft_message')) return true;
  if (content.startsWith('Subject:') || content.includes('\nSubject:')) return true;
  return false;
}

/** Detect if the response is a developer report. */
function isReportContent(toolsUsed?: Array<{ name: string }>): boolean {
  return !!toolsUsed?.some(t => t.name === 'generate_developer_report');
}

/** Detect if a task was created. */
function isTaskCreatedContent(toolsUsed?: Array<{ name: string }>): boolean {
  return !!toolsUsed?.some(t => t.name === 'create_task');
}

/** Copy text to clipboard. */
async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // fallback
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
}

/* ─────────────────── Component ─────────────────── */

export default function IntelligencePage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [view, setView] = useState<'chat' | 'log'>('chat');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  // Show toast for 2.5s
  useEffect(() => {
    if (!toastMessage) return;
    const t = setTimeout(() => setToastMessage(null), 2500);
    return () => clearTimeout(t);
  }, [toastMessage]);

  const handleSend = useCallback(async (text?: string) => {
    const messageText = text || input.trim();
    if (!messageText || sending) return;

    // Cancel any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const userMessage: Message = {
      id: `u_${Date.now()}`,
      role: 'user',
      content: messageText,
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setSending(true);

    // Build history from last 10 messages
    const history = [...messages, userMessage]
      .slice(-10)
      .map(m => ({ role: m.role, content: m.content }));

    try {
      const response = await fetch('/api/agent-intelligence/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageText,
          history: history.slice(0, -1), // exclude the current message (sent separately)
          sessionId,
        }),
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

      const assistantId = `a_${Date.now()}`;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);
            switch (event.type) {
              case 'token':
                fullContent += event.content;
                // Update message incrementally
                setMessages(prev => {
                  const existing = prev.find(m => m.id === assistantId);
                  if (existing) {
                    return prev.map(m => m.id === assistantId ? { ...m, content: fullContent } : m);
                  }
                  return [...prev, { id: assistantId, role: 'assistant' as const, content: fullContent }];
                });
                break;
              case 'tools_used':
                toolsUsed = event.tools || [];
                break;
              case 'followups':
                followUps = event.questions || [];
                break;
              case 'done':
                returnedSessionId = event.sessionId || null;
                break;
              case 'error':
                fullContent = event.message || 'Something went wrong. Please try again.';
                break;
            }
          } catch {
            // skip malformed lines
          }
        }
      }

      // Process remaining buffer
      if (buffer.trim()) {
        try {
          const event = JSON.parse(buffer);
          if (event.type === 'token') fullContent += event.content;
          if (event.type === 'tools_used') toolsUsed = event.tools || [];
          if (event.type === 'followups') followUps = event.questions || [];
          if (event.type === 'done') returnedSessionId = event.sessionId || null;
        } catch { /* skip */ }
      }

      // Final update with metadata
      const isDraft = isDraftContent(fullContent, toolsUsed);
      const isReport = isReportContent(toolsUsed);
      const isTask = isTaskCreatedContent(toolsUsed);

      setMessages(prev =>
        prev.map(m => m.id === assistantId ? {
          ...m,
          content: fullContent,
          toolsUsed,
          followUps,
          isDraft,
          isReport,
          isTaskCreated: isTask,
        } : m)
      );

      if (returnedSessionId && !sessionId) {
        setSessionId(returnedSessionId);
      }

      if (isTask) {
        setToastMessage('Task created successfully');
      }

    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setMessages(prev => [...prev, {
        id: `err_${Date.now()}`,
        role: 'assistant',
        content: `Sorry, I couldn't process that request. ${err.message || 'Please try again.'}`,
      }]);
    } finally {
      setSending(false);
    }
  }, [input, sending, messages, sessionId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCopy = (id: string, content: string) => {
    copyToClipboard(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleNewChat = () => {
    setMessages([]);
    setSessionId(null);
  };

  return (
    <MobileShell>
      {/* ── Toast ── */}
      {toastMessage && (
        <div style={{
          position: 'fixed', top: 'calc(16px + env(safe-area-inset-top, 0px))', left: '50%',
          transform: 'translateX(-50%)', zIndex: 100,
          background: GREEN, color: '#fff', padding: '10px 20px',
          borderRadius: 12, fontSize: 13, fontWeight: 600,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}>
          {toastMessage}
        </div>
      )}

      {/* ── Header ── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 30,
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        background: 'rgba(255,255,255,0.82)',
        borderBottom: `1px solid ${BORDER_LIGHT}`,
        paddingTop: 'calc(12px + env(safe-area-inset-top, 0px))',
        paddingBottom: 12, paddingLeft: 16, paddingRight: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ChatAvatar size={28} />
            <h1 style={{
              fontSize: 20, fontWeight: 800, color: TEXT_1,
              letterSpacing: '-0.03em', margin: 0,
            }}>
              Intelligence
            </h1>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* New chat button (visible when there are messages) */}
            {messages.length > 0 && view === 'chat' && (
              <button
                onClick={handleNewChat}
                style={{
                  border: 'none', cursor: 'pointer', fontSize: 11.5, fontWeight: 600,
                  borderRadius: 17, padding: '5px 12px',
                  background: GOLD_LIGHT, color: GOLD,
                  transition: `all 200ms ${EASE_PREMIUM}`,
                }}
              >
                New
              </button>
            )}

            {/* Chat/Log toggle */}
            <div style={{
              display: 'flex', alignItems: 'center',
              background: SURFACE_2, borderRadius: 20, padding: 3,
            }}>
              {(['chat', 'log'] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  style={{
                    border: 'none', cursor: 'pointer', fontSize: 11.5, fontWeight: 600,
                    borderRadius: 17, padding: '5px 14px',
                    background: view === v ? '#fff' : 'transparent',
                    color: view === v ? TEXT_1 : TEXT_3,
                    boxShadow: view === v ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                    transition: `all 200ms ${EASE_PREMIUM}`,
                    textTransform: 'capitalize',
                  }}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* ── Chat: Welcome State ── */}
      {view === 'chat' && messages.length === 0 && (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', padding: '0 20px',
        }}>
          <ChatAvatar size={56} />
          <h2 style={{
            fontSize: 22, fontWeight: 800, color: TEXT_1,
            marginTop: 16, marginBottom: 0, letterSpacing: '-0.02em',
          }}>
            Hi there,
          </h2>
          <p style={{ fontSize: 15, color: TEXT_2, marginTop: 4, marginBottom: 0 }}>
            What can I help you with today?
          </p>

          <div style={{ marginTop: 32, width: '100%' }}>
            {SUGGESTED_PROMPTS.map((prompt, i) => (
              <button
                key={i}
                className="da-press"
                onClick={() => handleSend(prompt)}
                style={{
                  display: 'block', width: '100%', background: '#fff',
                  borderRadius: 14, border: `1px solid ${BORDER_LIGHT}`,
                  padding: '14px 16px', fontSize: 14, fontWeight: 500,
                  color: TEXT_1, textAlign: 'left', cursor: 'pointer', marginBottom: 8,
                }}
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Chat: Messages ── */}
      {view === 'chat' && messages.length > 0 && (
        <div style={{
          flex: 1, overflowY: 'auto', padding: 20,
          display: 'flex', flexDirection: 'column', gap: 16,
        }}>
          {messages.map(msg =>
            msg.role === 'user' ? (
              /* ── User bubble ── */
              <div
                key={msg.id}
                style={{
                  alignSelf: 'flex-end', maxWidth: '80%',
                  background: GOLD, color: '#fff',
                  borderRadius: '20px 20px 4px 20px',
                  padding: '12px 16px', fontSize: 14.5, lineHeight: 1.5,
                }}
              >
                {msg.content}
              </div>
            ) : (
              /* ── Assistant bubble ── */
              <div key={msg.id} style={{
                alignSelf: 'flex-start', maxWidth: '90%',
                display: 'flex', flexDirection: 'column', gap: 0,
              }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ flexShrink: 0 }}><ChatAvatar size={28} /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>

                    {/* Draft card wrapper */}
                    {msg.isDraft ? (
                      <div style={{
                        background: BLUE_BG, border: `1px solid ${BLUE}22`,
                        borderRadius: 16, padding: '14px 16px', overflow: 'hidden',
                      }}>
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10,
                        }}>
                          <span style={{
                            fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                            letterSpacing: '0.05em', color: BLUE,
                            background: `${BLUE}15`, padding: '2px 8px', borderRadius: 6,
                          }}>
                            Draft
                          </span>
                          <span style={{ fontSize: 11, color: TEXT_3 }}>Review before sending</span>
                        </div>
                        <div style={{
                          fontSize: 14, color: TEXT_1, lineHeight: 1.6,
                          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                        }}>
                          {msg.content}
                        </div>
                        <button
                          onClick={() => handleCopy(msg.id, msg.content)}
                          style={{
                            marginTop: 10, border: `1px solid ${BLUE}30`,
                            background: '#fff', borderRadius: 8,
                            padding: '6px 14px', fontSize: 12, fontWeight: 600,
                            color: BLUE, cursor: 'pointer',
                          }}
                        >
                          {copiedId === msg.id ? 'Copied!' : 'Copy draft'}
                        </button>
                      </div>
                    ) : msg.isReport ? (
                      /* Report card wrapper */
                      <div style={{
                        background: AMBER_BG, border: `1px solid ${AMBER}22`,
                        borderRadius: 16, padding: '14px 16px', overflow: 'hidden',
                      }}>
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10,
                        }}>
                          <span style={{
                            fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                            letterSpacing: '0.05em', color: AMBER,
                            background: `${AMBER}15`, padding: '2px 8px', borderRadius: 6,
                          }}>
                            Report
                          </span>
                          <span style={{ fontSize: 11, color: TEXT_3 }}>Review for accuracy</span>
                        </div>
                        <div style={{
                          fontSize: 14, color: TEXT_1, lineHeight: 1.6,
                          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                        }}>
                          {msg.content}
                        </div>
                        <button
                          onClick={() => handleCopy(msg.id, msg.content)}
                          style={{
                            marginTop: 10, border: `1px solid ${AMBER}30`,
                            background: '#fff', borderRadius: 8,
                            padding: '6px 14px', fontSize: 12, fontWeight: 600,
                            color: AMBER, cursor: 'pointer',
                          }}
                        >
                          {copiedId === msg.id ? 'Copied!' : 'Copy report'}
                        </button>
                      </div>
                    ) : msg.isTaskCreated ? (
                      /* Task created confirmation */
                      <div style={{
                        background: GREEN_BG, border: `1px solid ${GREEN}22`,
                        borderRadius: 16, padding: '14px 16px',
                      }}>
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8,
                        }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                            stroke={GREEN} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          <span style={{
                            fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                            letterSpacing: '0.05em', color: GREEN,
                          }}>
                            Task Created
                          </span>
                        </div>
                        <div style={{
                          fontSize: 14, color: TEXT_1, lineHeight: 1.6,
                          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                        }}>
                          {msg.content}
                        </div>
                      </div>
                    ) : (
                      /* Standard text bubble */
                      <div style={{
                        background: SURFACE_1,
                        borderRadius: '20px 20px 20px 4px',
                        padding: '12px 16px', fontSize: 14.5,
                        color: TEXT_1, lineHeight: 1.6,
                        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                      }}>
                        {msg.content}
                      </div>
                    )}

                    {/* Tools used indicator */}
                    {msg.toolsUsed && msg.toolsUsed.length > 0 && (
                      <div style={{
                        marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4,
                      }}>
                        {msg.toolsUsed.map((t, i) => (
                          <span key={i} style={{
                            fontSize: 10, fontWeight: 500, color: TEXT_3,
                            background: SURFACE_2, borderRadius: 6,
                            padding: '2px 6px',
                          }}>
                            {t.name.replace(/_/g, ' ')}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Follow-up suggestions */}
                    {msg.followUps && msg.followUps.length > 0 && (
                      <div style={{
                        marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6,
                      }}>
                        {msg.followUps.map((q, i) => (
                          <button
                            key={i}
                            onClick={() => handleSend(q)}
                            style={{
                              border: `1px solid ${BORDER}`,
                              background: '#fff', borderRadius: 20,
                              padding: '6px 12px', fontSize: 12.5, fontWeight: 500,
                              color: TEXT_2, cursor: 'pointer',
                              transition: `all 150ms ${EASE_PREMIUM}`,
                            }}
                            onMouseEnter={e => {
                              (e.target as HTMLElement).style.borderColor = GOLD;
                              (e.target as HTMLElement).style.color = TEXT_1;
                            }}
                            onMouseLeave={e => {
                              (e.target as HTMLElement).style.borderColor = BORDER;
                              (e.target as HTMLElement).style.color = TEXT_2;
                            }}
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          )}

          {sending && (
            <div style={{
              alignSelf: 'flex-start', maxWidth: '85%',
              display: 'flex', gap: 10, alignItems: 'flex-start',
            }}>
              <div style={{ flexShrink: 0 }}><ChatAvatar size={28} /></div>
              <TypingIndicator />
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      )}

      {/* ── Log view ── */}
      {view === 'log' && (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <h2 style={{
            fontSize: 17, fontWeight: 700, color: TEXT_1,
            padding: 20, margin: 0,
          }}>
            Action Log
          </h2>
          {LOG_ENTRIES.map((entry, i) => (
            <div
              key={i}
              style={{
                padding: '14px 20px', borderBottom: `1px solid ${BORDER_LIGHT}`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontSize: 11, color: TEXT_3 }}>{entry.time}</div>
                <div style={{
                  fontSize: 13.5, fontWeight: 500, color: TEXT_1, marginTop: 2,
                }}>
                  {entry.action}
                </div>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke={GREEN} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          ))}
        </div>
      )}

      {/* ── Input bar ── */}
      {view === 'chat' && (
        <div style={{
          padding: '12px 16px',
          paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
          background: '#fff', borderTop: `1px solid ${BORDER_LIGHT}`,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything..."
            disabled={sending}
            style={{
              flex: 1, height: 44, background: SURFACE_1,
              borderRadius: 22, border: `1px solid ${BORDER}`,
              padding: '0 16px', fontSize: 14, color: TEXT_1, outline: 'none',
              opacity: sending ? 0.6 : 1,
            }}
          />
          <button style={{
            width: 36, height: 36, borderRadius: 18,
            background: 'transparent', border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', flexShrink: 0,
          }}>
            <MicIcon />
          </button>
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || sending}
            style={{
              width: 36, height: 36, borderRadius: 18,
              background: GOLD, border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0,
              opacity: input.trim() && !sending ? 1 : 0,
              pointerEvents: input.trim() && !sending ? 'auto' : 'none',
              transition: 'opacity 200ms',
            }}
          >
            <SendIcon />
          </button>
        </div>
      )}
    </MobileShell>
  );
}
