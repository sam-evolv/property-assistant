'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Send,
  Plus,
  Mail,
  FileText,
  BarChart3,
  Users,
  Home,
  ChevronLeft,
  ChevronRight,
  X,
  Zap,
  MessageSquare,
} from 'lucide-react';
import { useAgentDashboard } from '../layout-provider';

export const dynamic = 'force-dynamic';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
  followUps?: string[];
  toolsUsed?: { name: string; summary: string }[];
}

interface Session {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
}

const STORAGE_KEY = 'agent_intel_sessions';
const MAX_SESSIONS = 20;

const AGENT_PROMPTS = [
  { icon: Mail, title: 'Chase overdue contracts', subtitle: 'Contracts \u00B7 Live data', prompt: 'Draft a chasing email to all solicitors with overdue contracts in \u00C1rdan View. Contracts are 31\u201360 days outstanding. Tone: firm but professional. Include all purchaser names and unit numbers.' },
  { icon: FileText, title: 'Prepare weekly vendor update', subtitle: 'Reports \u00B7 Pipeline', prompt: 'Prepare a weekly vendor update for all my active schemes. Include units sold, active pipeline, any overdue contracts, and upcoming viewings. Format for email.' },
  { icon: BarChart3, title: 'How many contracts are overdue?', subtitle: 'Live data \u00B7 Contracts', prompt: 'How many contracts are currently overdue across all my schemes? Break it down by scheme and show the most at-risk buyers by days outstanding.' },
  { icon: Users, title: 'Draft buyer follow-up \u2014 most at-risk', subtitle: 'Buyers \u00B7 Solicitors', prompt: 'Who are my most at-risk buyers right now? Draft a personalised follow-up message for each of the top 3 most urgent cases.' },
];

function loadSessions(): Session[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveSessions(sessions: Session[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions.slice(0, MAX_SESSIONS))); } catch {}
}

function groupByDate(sessions: Session[]) {
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  const groups: { label: string; sessions: Session[] }[] = [
    { label: 'Today', sessions: [] },
    { label: 'Yesterday', sessions: [] },
    { label: 'Last week', sessions: [] },
    { label: 'Older', sessions: [] },
  ];
  for (const s of sessions) {
    const d = new Date(s.createdAt).toDateString();
    if (d === today) groups[0].sessions.push(s);
    else if (d === yesterday) groups[1].sessions.push(s);
    else if (Date.now() - new Date(s.createdAt).getTime() < 7 * 86400000) groups[2].sessions.push(s);
    else groups[3].sessions.push(s);
  }
  return groups.filter(g => g.sessions.length > 0);
}

export default function AgentDashboardIntelligencePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { profile, selectedSchemeId } = useAgentDashboard();

  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [insightDismissed, setInsightDismissed] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const promptProcessed = useRef(false);

  useEffect(() => {
    setSessions(loadSessions());
  }, []);

  // Handle URL prompt param
  useEffect(() => {
    if (promptProcessed.current) return;
    const prompt = searchParams.get('prompt');
    if (prompt) {
      promptProcessed.current = true;
      // Small delay to ensure component is mounted
      setTimeout(() => sendMessage(prompt), 200);
    }
  }, [searchParams]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const activeSession = sessions.find(s => s.id === activeSessionId);

  function createNewChat() {
    setActiveSessionId(null);
    setMessages([]);
    setInput('');
  }

  function selectSession(s: Session) {
    setActiveSessionId(s.id);
    setMessages(s.messages);
  }

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return;

    const userMsg: ChatMessage = { id: `u_${Date.now()}`, role: 'user', content: text.trim() };
    const assistantMsg: ChatMessage = { id: `a_${Date.now()}`, role: 'assistant', content: '', isStreaming: true };

    const newMessages = [...messages, userMsg, assistantMsg];
    setMessages(newMessages);
    setInput('');
    setIsStreaming(true);

    // Create/update session
    let sessionId = activeSessionId;
    if (!sessionId) {
      sessionId = `sess_${Date.now()}`;
      setActiveSessionId(sessionId);
    }

    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      const res = await fetch('/api/agent-intelligence/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text.trim(), history, sessionId, activeDevelopmentId: selectedSchemeId }),
      });

      if (!res.ok || !res.body) {
        setMessages(msgs => msgs.map(m => m.id === assistantMsg.id ? { ...m, content: 'Sorry, I encountered an error. Please try again.', isStreaming: false } : m));
        setIsStreaming(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';
      let followUps: string[] = [];
      let toolsUsed: { name: string; summary: string }[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);
            if (data.type === 'token') {
              fullContent += data.content;
              setMessages(msgs => msgs.map(m => m.id === assistantMsg.id ? { ...m, content: fullContent, isStreaming: true } : m));
            } else if (data.type === 'followups') {
              followUps = data.questions || [];
            } else if (data.type === 'tools_used') {
              toolsUsed = data.tools || [];
            } else if (data.type === 'done') {
              // Finalize
            }
          } catch { /* skip malformed lines */ }
        }
      }

      // Finalize message
      setMessages(msgs => msgs.map(m => m.id === assistantMsg.id ? { ...m, content: fullContent || 'No response received.', isStreaming: false, followUps: followUps.length > 0 ? followUps : undefined, toolsUsed: toolsUsed.length > 0 ? toolsUsed : undefined } : m));

      // Save session
      const finalMessages = newMessages.map(m => m.id === assistantMsg.id ? { ...m, content: fullContent, isStreaming: false, followUps, toolsUsed } : m);
      const updatedSessions = loadSessions();
      const existingIdx = updatedSessions.findIndex(s => s.id === sessionId);
      const sessionData: Session = {
        id: sessionId!,
        title: text.trim().slice(0, 40),
        messages: finalMessages,
        createdAt: existingIdx >= 0 ? updatedSessions[existingIdx].createdAt : new Date().toISOString(),
      };
      if (existingIdx >= 0) updatedSessions[existingIdx] = sessionData;
      else updatedSessions.unshift(sessionData);
      saveSessions(updatedSessions);
      setSessions(updatedSessions);

    } catch {
      setMessages(msgs => msgs.map(m => m.id === assistantMsg.id ? { ...m, content: 'Connection error. Please try again.', isStreaming: false } : m));
    }

    setIsStreaming(false);
  }, [messages, activeSessionId, isStreaming, selectedSchemeId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const hasConversation = messages.length > 0;

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Left panel - Conversations */}
      {sidebarOpen && (
        <div style={{ width: 250, background: '#fff', borderRight: '1px solid rgba(0,0,0,0.07)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ padding: '16px 14px', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
            <p style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.09em', color: 'rgba(0,0,0,0.35)', textTransform: 'uppercase' as const, margin: '0 0 10px' }}>CONVERSATIONS</p>
            <button onClick={createNewChat} style={{ width: '100%', height: 32, background: '#c8960a', border: 'none', borderRadius: 7, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
              <Plus size={14} /> New Chat
            </button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 8px' }}>
            {groupByDate(sessions).map(group => (
              <div key={group.label} style={{ marginBottom: 12 }}>
                <p style={{ fontSize: 10, fontWeight: 600, color: 'rgba(0,0,0,0.3)', margin: '0 0 4px', paddingLeft: 6 }}>{group.label}</p>
                {group.sessions.map(s => (
                  <button key={s.id} onClick={() => selectSession(s)} style={{ width: '100%', padding: '7px 8px', borderRadius: 6, background: activeSessionId === s.id ? 'rgba(200,150,10,0.1)' : 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', marginBottom: 1 }}
                    onMouseEnter={e => { if (activeSessionId !== s.id) (e.currentTarget as HTMLElement).style.background = '#faf9f7'; }}
                    onMouseLeave={e => { if (activeSessionId !== s.id) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    <p style={{ fontSize: 12, fontWeight: activeSessionId === s.id ? 600 : 400, color: activeSessionId === s.id ? '#c8960a' : '#374151', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</p>
                  </button>
                ))}
              </div>
            ))}
            {sessions.length === 0 && (
              <p style={{ fontSize: 11, color: 'rgba(0,0,0,0.3)', textAlign: 'center', marginTop: 20 }}>No conversations yet</p>
            )}
          </div>
          <button onClick={() => setSidebarOpen(false)} style={{ padding: '10px', borderTop: '1px solid rgba(0,0,0,0.07)', background: 'none', border: 'none', borderTopStyle: 'solid', borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.07)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: 'rgba(0,0,0,0.4)', fontSize: 12, fontFamily: 'inherit' }}>
            <ChevronLeft size={14} /> Collapse
          </button>
        </div>
      )}

      {/* Collapse toggle when sidebar hidden */}
      {!sidebarOpen && (
        <button onClick={() => setSidebarOpen(true)} style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', zIndex: 10, width: 24, height: 48, background: '#fff', border: '1px solid rgba(0,0,0,0.1)', borderLeft: 'none', borderRadius: '0 6px 6px 0', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ChevronRight size={14} color="rgba(0,0,0,0.4)" />
        </button>
      )}

      {/* Right panel - Chat */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Top bar */}
        <div style={{ padding: '12px 24px', borderBottom: '1px solid rgba(0,0,0,0.07)', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Zap size={16} color="#c8960a" />
            <span style={{ fontSize: 14, fontWeight: 600, color: '#111', letterSpacing: '-0.02em' }}>OpenHouse Intelligence</span>
          </div>
        </div>

        {/* Insight bar */}
        {!insightDismissed && !hasConversation && (
          <div style={{ padding: '8px 24px', background: '#fffbeb', borderBottom: '1px solid rgba(146,64,14,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: '#92400e' }}>You have overdue contracts across your schemes. Ask Intelligence to help chase them.</span>
            <button onClick={() => setInsightDismissed(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}><X size={14} color="#92400e" /></button>
          </div>
        )}

        {/* Main content */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          {!hasConversation ? (
            /* Landing state */
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
              <div style={{ width: 60, height: 60, borderRadius: 16, background: 'linear-gradient(135deg, #B8960C, #E8C84A)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <Zap size={28} color="#fff" />
              </div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111', letterSpacing: '-0.03em', margin: '0 0 4px' }}>OPENHOUSE AGENT</h2>
              <p style={{ fontSize: 14, color: 'rgba(0,0,0,0.45)', margin: '0 0 28px' }}>Ask anything about your schemes and pipeline</p>

              {/* Prompt cards 2x2 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, maxWidth: 520, width: '100%' }}>
                {AGENT_PROMPTS.map(p => {
                  const Icon = p.icon;
                  return (
                    <button key={p.title} onClick={() => sendMessage(p.prompt)} style={{ padding: '16px', background: '#fff', border: '0.5px solid rgba(0,0,0,0.07)', borderRadius: 12, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05)', transition: 'box-shadow 0.15s, transform 0.15s' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.08), 0 8px 24px rgba(0,0,0,0.08)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05)'; (e.currentTarget as HTMLElement).style.transform = 'none'; }}
                    >
                      <Icon size={16} color="#c8960a" style={{ marginBottom: 8 }} />
                      <p style={{ fontSize: 13, fontWeight: 500, color: '#111', margin: '0 0 3px', letterSpacing: '-0.01em' }}>{p.title}</p>
                      <p style={{ fontSize: 11, color: 'rgba(0,0,0,0.38)', margin: 0 }}>{p.subtitle}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Conversation */
            <div style={{ flex: 1, padding: '20px 24px' }}>
              {messages.map(msg => (
                <div key={msg.id} style={{ marginBottom: 16, display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  {msg.role === 'assistant' && (
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg, #B8960C, #E8C84A)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 10, flexShrink: 0, marginTop: 2 }}>
                      <Zap size={14} color="#fff" />
                    </div>
                  )}
                  <div style={{
                    maxWidth: '70%', padding: '12px 16px', borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    background: msg.role === 'user' ? 'linear-gradient(135deg, #B8960C, #E8C84A)' : '#fff',
                    color: msg.role === 'user' ? '#fff' : '#111',
                    border: msg.role === 'assistant' ? '0.5px solid rgba(0,0,0,0.07)' : 'none',
                    boxShadow: msg.role === 'assistant' ? '0 1px 2px rgba(0,0,0,0.04)' : 'none',
                  }}>
                    {msg.isStreaming && !msg.content ? (
                      <div style={{ display: 'flex', gap: 4, padding: '4px 0' }}>
                        {[0, 1, 2].map(i => (
                          <span key={i} style={{ width: 6, height: 6, borderRadius: 3, background: 'rgba(0,0,0,0.2)', animation: `pulse 1.4s ease-in-out infinite`, animationDelay: `${i * 0.2}s` }} />
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: 13.5, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{msg.content}</div>
                    )}

                    {/* Tools used */}
                    {msg.toolsUsed && msg.toolsUsed.length > 0 && (
                      <p style={{ fontSize: 10.5, color: 'rgba(0,0,0,0.35)', margin: '8px 0 0', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Zap size={10} /> Used {msg.toolsUsed.length} tool{msg.toolsUsed.length > 1 ? 's' : ''}
                      </p>
                    )}

                    {/* Follow-ups */}
                    {msg.followUps && msg.followUps.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                        {msg.followUps.map((fu, i) => (
                          <button key={i} onClick={() => sendMessage(fu)} style={{ padding: '5px 12px', borderRadius: 20, background: 'rgba(200,150,10,0.08)', border: '1px solid rgba(200,150,10,0.2)', color: '#92400e', fontSize: 11.5, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                            {fu}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input bar */}
        <div style={{ padding: '12px 24px', borderTop: '1px solid rgba(0,0,0,0.07)', background: '#fff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {hasConversation && (
              <button onClick={createNewChat} style={{ width: 36, height: 36, borderRadius: 18, background: '#f3f4f6', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Home size={16} color="rgba(0,0,0,0.4)" />
              </button>
            )}
            <div style={{ flex: 1, position: 'relative' }}>
              <input
                ref={inputRef}
                type="text"
                placeholder="Ask anything..."
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isStreaming}
                style={{ width: '100%', height: 42, padding: '0 48px 0 18px', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 24, fontSize: 13.5, fontFamily: 'inherit', outline: 'none', background: '#fff' }}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || isStreaming}
                style={{ position: 'absolute', right: 5, top: '50%', transform: 'translateY(-50%)', width: 32, height: 32, borderRadius: 16, background: input.trim() ? 'linear-gradient(135deg, #B8960C, #E8C84A)' : '#e5e7eb', border: 'none', cursor: input.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s' }}
              >
                <Send size={14} color={input.trim() ? '#fff' : 'rgba(0,0,0,0.3)'} />
              </button>
            </div>
          </div>
          <p style={{ fontSize: 10, color: 'rgba(0,0,0,0.25)', textAlign: 'center', margin: '8px 0 0' }}>Powered by AI. Information for reference only.</p>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
