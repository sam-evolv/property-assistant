'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Send, Plus, Home, ChevronLeft, ChevronRight, X, Zap, Loader2, Trash2, Calendar, Mail, FileText, BarChart3, Users } from 'lucide-react';
import { useAgentDashboard } from '../layout-provider';
import { useApprovalDrawer } from '@/lib/agent-intelligence/drawer-store';
import { isAgenticSkillEnvelope } from '@/lib/agent-intelligence/envelope';
import Image from 'next/image';

export const dynamic = 'force-dynamic';

const tokens = { gold: '#D4AF37', goldDark: '#B8934C' };

interface ChatMessage { id: string; role: 'user' | 'assistant'; content: string; isStreaming?: boolean; followUps?: string[]; toolsUsed?: { name: string; summary: string }[]; }
interface Session { id: string; title: string; messages: ChatMessage[]; createdAt: string; }

const STORAGE_KEY = 'agent_intel_sessions';
const MAX_SESSIONS = 20;

const PROMPTS = [
  { icon: Mail, title: 'Chase overdue contracts', subtitle: 'Contracts \u00B7 Live data', prompt: 'Draft a chasing email to all solicitors with overdue contracts. Tone: firm but professional. Include all purchaser names and unit numbers.' },
  { icon: FileText, title: 'Prepare weekly vendor update', subtitle: 'Reports \u00B7 Pipeline', prompt: 'Prepare a weekly vendor update for all my active schemes. Include units sold, active pipeline, any overdue contracts.' },
  { icon: BarChart3, title: 'How many contracts are overdue?', subtitle: 'Live data \u00B7 Contracts', prompt: 'How many contracts are currently overdue across all my schemes? Break it down by scheme.' },
  { icon: Users, title: 'Draft buyer follow-up', subtitle: 'Buyers \u00B7 Solicitors', prompt: 'Who are my most at-risk buyers right now? Draft a personalised follow-up for the top 3 most urgent cases.' },
];

function loadSessions(): Session[] { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; } }
function saveSessions(s: Session[]) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s.slice(0, MAX_SESSIONS))); } catch {} }

function groupByDate(sessions: Session[]) {
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  const groups: { label: string; sessions: Session[] }[] = [{ label: 'Today', sessions: [] }, { label: 'Yesterday', sessions: [] }, { label: 'Last week', sessions: [] }, { label: 'Older', sessions: [] }];
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
  const { selectedSchemeId } = useAgentDashboard();
  const { open: openApprovalDrawer } = useApprovalDrawer();

  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const promptProcessed = useRef(false);

  useEffect(() => { setSessions(loadSessions()); }, []);

  useEffect(() => {
    if (promptProcessed.current) return;
    const prompt = searchParams.get('prompt');
    if (prompt) { promptProcessed.current = true; setTimeout(() => sendMessage(prompt), 300); }
  }, [searchParams]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  function createNewChat() { setActiveSessionId(null); setMessages([]); setInput(''); }
  function selectSession(s: Session) { setActiveSessionId(s.id); setMessages(s.messages); }
  function deleteSession(id: string) {
    const updated = sessions.filter(s => s.id !== id);
    saveSessions(updated); setSessions(updated);
    if (activeSessionId === id) createNewChat();
  }

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return;
    const userMsg: ChatMessage = { id: `u_${Date.now()}`, role: 'user', content: text.trim() };
    const assistantMsg: ChatMessage = { id: `a_${Date.now()}`, role: 'assistant', content: '', isStreaming: true };
    const newMessages = [...messages, userMsg, assistantMsg];
    setMessages(newMessages); setInput(''); setIsStreaming(true);

    let sessionId = activeSessionId;
    if (!sessionId) { sessionId = `sess_${Date.now()}`; setActiveSessionId(sessionId); }

    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      const res = await fetch('/api/agent-intelligence/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text.trim(), history, sessionId, activeDevelopmentId: selectedSchemeId }),
      });
      if (!res.ok || !res.body) { setMessages(ms => ms.map(m => m.id === assistantMsg.id ? { ...m, content: 'Sorry, an error occurred. Please try again.', isStreaming: false } : m)); setIsStreaming(false); return; }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '', fullContent = '', followUps: string[] = [], toolsUsed: { name: string; summary: string }[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n'); buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);
            if (data.type === 'token') { fullContent += data.content; setMessages(ms => ms.map(m => m.id === assistantMsg.id ? { ...m, content: fullContent } : m)); }
            else if (data.type === 'followups') followUps = data.questions || [];
            else if (data.type === 'tools_used') toolsUsed = data.tools || [];
            else if (data.type === 'envelope' && isAgenticSkillEnvelope(data.envelope)) { console.log('[drawer] envelope received:', data.envelope); openApprovalDrawer(data.envelope); }
          } catch {}
        }
      }

      setMessages(ms => ms.map(m => m.id === assistantMsg.id ? { ...m, content: fullContent || 'No response received.', isStreaming: false, followUps: followUps.length > 0 ? followUps : undefined, toolsUsed: toolsUsed.length > 0 ? toolsUsed : undefined } : m));
      const finalMessages = newMessages.map(m => m.id === assistantMsg.id ? { ...m, content: fullContent, isStreaming: false, followUps, toolsUsed } : m);
      const updatedSessions = loadSessions();
      const existingIdx = updatedSessions.findIndex(s => s.id === sessionId);
      const sessionData: Session = { id: sessionId!, title: text.trim().slice(0, 40), messages: finalMessages, createdAt: existingIdx >= 0 ? updatedSessions[existingIdx].createdAt : new Date().toISOString() };
      if (existingIdx >= 0) updatedSessions[existingIdx] = sessionData; else updatedSessions.unshift(sessionData);
      saveSessions(updatedSessions); setSessions(updatedSessions);
    } catch { setMessages(ms => ms.map(m => m.id === assistantMsg.id ? { ...m, content: 'Connection error. Please try again.', isStreaming: false } : m)); }
    setIsStreaming(false);
  }, [messages, activeSessionId, isStreaming, selectedSchemeId, openApprovalDrawer]);

  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); } };
  const hasConversation = messages.length > 0;

  return (
    <div className="min-h-full bg-[#0F0F0F]">
      <div className="max-w-[1400px] mx-auto px-4 py-4">
        <div className="bg-[#1A1A1A] rounded-2xl border border-[#2A2A2A] shadow-2xl overflow-hidden flex flex-col" style={{ height: 'calc(100vh - 80px)' }}>
          {/* Header */}
          <div className="px-6 py-4 border-b border-[#2A2A2A] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${tokens.gold}, ${tokens.goldDark})` }}>
                <Zap className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="text-[20px] font-semibold text-white tracking-[-0.01em]">OpenHouse Intelligence</h1>
                <p className="text-xs text-[#9ca8bc]">Agent Assistant</p>
              </div>
            </div>
          </div>

          <div className="h-px bg-gradient-to-r from-transparent via-[#D4AF37]/30 to-transparent" />

          <div className="flex flex-1 min-h-0">
            {/* Sidebar */}
            {sidebarOpen && (
              <div className="w-64 bg-[#141414] border-r border-[#2A2A2A] flex flex-col flex-shrink-0">
                <div className="p-4 border-b border-[#2A2A2A]">
                  <p className="text-[10px] font-semibold text-[#9ca8bc] uppercase tracking-wider mb-3">Conversations</p>
                  <button onClick={createNewChat} className="w-full py-2 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all"
                    style={{ background: `linear-gradient(135deg, ${tokens.gold}, ${tokens.goldDark})` }}>
                    <Plus className="w-4 h-4" /> New Chat
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1" style={{ scrollbarWidth: 'none' }}>
                  {groupByDate(sessions).map(group => (
                    <div key={group.label} className="mb-3">
                      <p className="px-3 py-1 text-[10px] font-semibold text-[#9ca8bc]/60 uppercase">{group.label}</p>
                      {group.sessions.map(s => (
                        <div key={s.id} className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${activeSessionId === s.id ? 'bg-[#1A1A1A] border-l-[3px] border-[#D4AF37]' : 'hover:bg-[#1A1A1A] border-l-[3px] border-transparent'}`}
                          onClick={() => selectSession(s)}>
                          <p className="flex-1 text-sm text-white truncate">{s.title}</p>
                          <button onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }} className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/20 transition-all">
                            <Trash2 className="w-3 h-3 text-[#9ca8bc] hover:text-red-400" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ))}
                  {sessions.length === 0 && <p className="text-center text-xs text-[#9ca8bc]/50 mt-8">No conversations yet</p>}
                </div>
                <button onClick={() => setSidebarOpen(false)} className="p-3 border-t border-[#2A2A2A] flex items-center gap-2 text-xs text-[#9ca8bc] hover:text-white transition-colors">
                  <ChevronLeft className="w-4 h-4" /> Collapse
                </button>
              </div>
            )}

            {!sidebarOpen && (
              <button onClick={() => setSidebarOpen(true)} className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-6 h-12 bg-[#2A2A2A] hover:bg-[#3A3A3A] border border-[#3A3A3A] rounded-r-lg flex items-center justify-center transition-colors">
                <ChevronRight className="w-3 h-3 text-[#9ca8bc]" />
              </button>
            )}

            {/* Chat area */}
            <div className="flex-1 flex flex-col min-w-0">
              {!hasConversation ? (
                /* Landing */
                <div className="flex-1 flex flex-col items-center justify-center p-8">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: `linear-gradient(135deg, ${tokens.gold}, ${tokens.goldDark})` }}>
                    <Zap className="w-7 h-7 text-white" />
                  </div>
                  <h2 className="text-2xl font-semibold text-white tracking-[-0.01em] mb-1">OpenHouse Intelligence</h2>
                  <p className="text-sm text-[#9ca8bc] mb-8">Ask anything about your schemes and pipeline</p>
                  <div className="grid grid-cols-2 gap-3 max-w-lg w-full">
                    {PROMPTS.map(p => {
                      const Icon = p.icon;
                      return (
                        <button key={p.title} onClick={() => sendMessage(p.prompt)}
                          className="rounded-2xl border border-[#2A2A2A] bg-[#141414] p-4 text-left transition-all hover:border-[#D4AF37]/50 hover:shadow-[0_4px_12px_rgba(212,175,55,0.15)] hover:-translate-y-[1px]">
                          <Icon className="w-5 h-5 mb-2" style={{ color: tokens.gold }} />
                          <p className="text-[14px] font-medium text-[#eef2f8]">{p.title}</p>
                          <p className="text-xs text-[#9ca8bc] mt-0.5">{p.subtitle}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* Messages */
                <div className="flex-1 overflow-y-auto px-8 py-6" style={{ scrollbarWidth: 'none' }}>
                  <div className="max-w-3xl mx-auto space-y-6">
                    {messages.map(msg => (
                      <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {msg.role === 'assistant' && (
                          <div className="w-7 h-7 rounded-full flex items-center justify-center mr-3 flex-shrink-0 mt-1" style={{ background: `linear-gradient(135deg, ${tokens.gold}, ${tokens.goldDark})` }}>
                            <Zap className="w-3.5 h-3.5 text-white" />
                          </div>
                        )}
                        <div className={`max-w-[75%] ${msg.role === 'user'
                          ? 'rounded-2xl rounded-tr-sm px-5 py-3'
                          : 'rounded-2xl rounded-tl-sm px-5 py-3 border border-[#2A2A2A] bg-[#141414]'}`}
                          style={msg.role === 'user' ? { background: `linear-gradient(135deg, rgba(212,175,55,0.15) 0%, rgba(184,147,76,0.08) 100%)`, border: '1px solid rgba(212,175,55,0.2)' } : undefined}>
                          {msg.isStreaming && !msg.content ? (
                            <div className="flex items-center gap-1.5 py-1">
                              {[0, 1, 2].map(i => <span key={i} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tokens.gold, animation: `pulse 1.4s ease-in-out infinite`, animationDelay: `${i * 0.2}s` }} />)}
                            </div>
                          ) : (
                            <div className="text-[14px] leading-relaxed text-[#eef2f8] whitespace-pre-wrap">{msg.content}</div>
                          )}
                          {msg.toolsUsed && msg.toolsUsed.length > 0 && (
                            <p className="text-[10px] text-[#9ca8bc]/60 mt-2 flex items-center gap-1"><Zap className="w-3 h-3" /> Used {msg.toolsUsed.length} tool{msg.toolsUsed.length > 1 ? 's' : ''}</p>
                          )}
                          {msg.followUps && msg.followUps.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-3">
                              {msg.followUps.map((fu, i) => (
                                <button key={i} onClick={() => sendMessage(fu)}
                                  className="rounded-full border border-[#2A2A2A] px-3 py-1.5 text-xs text-[#9ca8bc] hover:border-[#D4AF37]/50 hover:text-[#D4AF37] hover:bg-[#D4AF37]/10 transition-all">
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
                </div>
              )}

              {/* Input */}
              <div className="bg-[#1A1A1A] border-t border-[#2A2A2A] px-4 py-3">
                <div className="flex items-center gap-3 max-w-3xl mx-auto">
                  {hasConversation && (
                    <button onClick={createNewChat} className="p-2.5 rounded-full bg-[#2A2A2A] hover:bg-[#3A3A3A] flex-shrink-0 transition-colors">
                      <Home className="w-5 h-5 text-[#9ca8bc]" />
                    </button>
                  )}
                  <div className="flex-1 relative">
                    <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
                      disabled={isStreaming} placeholder="Ask anything about your pipeline..."
                      className="w-full resize-none rounded-[20px] border-2 border-[#2A2A2A] bg-[#141414] px-5 py-3 text-[15px] text-white placeholder-[#B0B0B0] focus:border-[#D4AF37] focus:shadow-[0_0_0_3px_rgba(212,175,55,0.1)] focus:outline-none transition-all disabled:opacity-50"
                      style={{ minHeight: 48, maxHeight: 120 }} rows={1} />
                  </div>
                  <button onClick={() => sendMessage(input)} disabled={!input.trim() || isStreaming}
                    className={`p-2.5 rounded-full text-white flex-shrink-0 transition-all ${input.trim() ? 'hover:shadow-[0_4px_12px_rgba(212,175,55,0.4)] hover:-translate-y-[1px]' : 'opacity-40'}`}
                    style={{ background: input.trim() ? `linear-gradient(135deg, ${tokens.gold}, ${tokens.goldDark})` : '#2A2A2A' }}>
                    {isStreaming ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                  </button>
                </div>
                <p className="text-center text-[10px] text-[#9ca8bc]/40 mt-2">Powered by AI. Information for reference only.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`@keyframes pulse { 0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); } 40% { opacity: 1; transform: scale(1); } }`}</style>
    </div>
  );
}
