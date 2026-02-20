'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useCurrentContext } from '@/contexts/CurrentContext';
import {
  Sparkles, Send, Plus, AlertTriangle, X, ChevronRight,
  Calendar, Loader2, MessageSquare, BarChart3, Brain,
} from 'lucide-react';
import dynamic from 'next/dynamic';

// Dynamic chart component (SSR disabled)
const InlineChartRenderer = dynamic(() => import('./inline-chart'), { ssr: false });

// ============================================================================
// Types
// ============================================================================

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: Array<{ title: string; type: string; excerpt: string }>;
  chartData?: { type: 'bar' | 'donut' | 'line'; labels: string[]; values: number[] };
  isRegulatory?: boolean;
  actions?: Array<{ label: string; href: string }>;
  isStreaming?: boolean;
}

interface Session {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
}

interface Insight {
  icon: string;
  text: string;
  href?: string;
}

interface BriefingItem {
  priority: 'critical' | 'important' | 'info';
  text: string;
  action?: { label: string; href: string };
}

// ============================================================================
// Design Tokens
// ============================================================================

const tokens = {
  gold: '#D4AF37',
  goldLight: '#F5D874',
  goldDark: '#B8934C',
};

// ============================================================================
// Rotating Question Pills
// ============================================================================

const QUESTION_CATEGORIES = [
  {
    icon: '💰',
    label: 'Financial',
    questions: [
      'What is our projected revenue for Q1?',
      'Which units have outstanding stage payments?',
      'What is our total contracted value?',
      'How many units are sale agreed?',
    ],
  },
  {
    icon: '📋',
    label: 'Compliance',
    questions: [
      'Do we have HomeBond for all completed units?',
      'Which units are missing fire safety certificates?',
      'What BCAR documentation is required before handover?',
      'What is our document coverage across all schemes?',
    ],
  },
  {
    icon: '👥',
    label: 'Homeowners',
    questions: [
      'What are homeowners asking about most this week?',
      'Which developments have the lowest registration rates?',
      'How many homeowners registered this month?',
      'What is our average response time to homeowner queries?',
    ],
  },
  {
    icon: '⚖️',
    label: 'Regulatory',
    questions: [
      'What fire safety documentation is required under BCAR?',
      'What is the HomeBond defects liability period?',
      'Does our ventilation comply with Part F?',
      'What are our GDPR obligations for homeowner data?',
    ],
  },
];

// ============================================================================
// LocalStorage Helpers
// ============================================================================

const STORAGE_KEY = 'scheme-intelligence-sessions';
const MAX_SESSIONS = 20;

function loadSessions(): Session[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSessions(sessions: Session[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions.slice(0, MAX_SESSIONS)));
  } catch {
    // Storage full - clear old sessions
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions.slice(0, 5)));
  }
}

// ============================================================================
// Sub-Components
// ============================================================================

function RegulatoryDisclaimer() {
  return (
    <div className="mt-3 p-3 rounded-lg bg-amber-50 border border-amber-200 flex gap-2">
      <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
      <p className="text-xs text-amber-800">
        This information is based on current Irish Building Regulations and your uploaded documents.
        Verify all compliance determinations with your assigned certifier or solicitor before acting.
      </p>
    </div>
  );
}

function InlineChart({ chartData }: { chartData: ChatMessage['chartData'] }) {
  if (!chartData) return null;
  return <InlineChartRenderer chartData={chartData} />;
}

function SourceChips({
  sources,
  onSourceClick,
}: {
  sources: ChatMessage['sources'];
  onSourceClick: (source: any) => void;
}) {
  if (!sources?.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {sources.map((s, i) => (
        <button
          key={i}
          onClick={() => onSourceClick(s)}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium
            bg-grey-100 text-grey-600 hover:bg-gold-50 hover:text-gold-700 transition-colors"
        >
          {s.type === 'function' ? <BarChart3 className="w-2.5 h-2.5" /> : <MessageSquare className="w-2.5 h-2.5" />}
          {s.title}
        </button>
      ))}
    </div>
  );
}

function ActionCards({ actions }: { actions?: ChatMessage['actions'] }) {
  if (!actions?.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {actions.map((a, i) => (
        <a
          key={i}
          href={a.href}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
            border border-grey-200 text-grey-700 hover:border-gold-300 hover:text-gold-700
            hover:bg-gold-50 transition-all"
        >
          {a.label}
          <ChevronRight className="w-3 h-3" />
        </a>
      ))}
    </div>
  );
}

function SourceDrawer({
  source,
  onClose,
}: {
  source: any;
  onClose: () => void;
}) {
  if (!source) return null;
  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-white border-l border-grey-200 shadow-2xl z-50 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-grey-100">
        <div>
          <h3 className="text-sm font-semibold text-grey-900">{source.title}</h3>
          <span className="text-xs text-grey-500 capitalize">{source.type}</span>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-grey-100 rounded-lg transition">
          <X className="w-4 h-4 text-grey-500" />
        </button>
      </div>
      <div className="flex-1 overflow-auto p-4">
        <p className="text-sm text-grey-700 leading-relaxed whitespace-pre-wrap">{source.excerpt}</p>
      </div>
    </div>
  );
}

function BriefingModal({
  open,
  onClose,
  developmentId,
}: {
  open: boolean;
  onClose: () => void;
  developmentId?: string | null;
}) {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<BriefingItem[]>([]);
  const [briefingText, setBriefingText] = useState('');

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const params = new URLSearchParams();
    if (developmentId) params.set('developmentId', developmentId);

    fetch(`/api/scheme-intelligence/briefing?${params}`)
      .then((res) => res.json())
      .then((data) => {
        setItems(data.items || []);
        setBriefingText(data.briefingText || '');
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [open, developmentId]);

  if (!open) return null;

  const priorityStyles = {
    critical: { bg: 'bg-red-50', border: 'border-red-200', icon: '🔴', text: 'text-red-800' },
    important: { bg: 'bg-amber-50', border: 'border-amber-200', icon: '🟡', text: 'text-amber-800' },
    info: { bg: 'bg-blue-50', border: 'border-blue-200', icon: '🔵', text: 'text-blue-800' },
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-grey-100">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #D4AF37 0%, #B8934C 100%)' }}
            >
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-grey-900">Today&apos;s Briefing</h2>
              <p className="text-xs text-grey-500">
                {new Date().toLocaleDateString('en-IE', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-grey-100 rounded-lg transition">
            <X className="w-5 h-5 text-grey-500" />
          </button>
        </div>
        <div className="flex-1 overflow-auto p-6 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-gold-500" />
              <span className="ml-3 text-sm text-grey-500">Generating briefing...</span>
            </div>
          ) : (
            <>
              {items.map((item, i) => {
                const style = priorityStyles[item.priority];
                return (
                  <div key={i} className={`p-4 rounded-xl ${style.bg} border ${style.border}`}>
                    <div className="flex items-start gap-3">
                      <span className="text-lg">{style.icon}</span>
                      <div className="flex-1">
                        <p className={`text-sm font-medium ${style.text}`}>{item.text}</p>
                        {item.action && (
                          <a
                            href={item.action.href}
                            className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-gold-700 hover:text-gold-800"
                          >
                            {item.action.label}
                            <ChevronRight className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {briefingText && (
                <div className="mt-4 p-4 rounded-xl bg-grey-50 border border-grey-100">
                  <p className="text-sm text-grey-700 leading-relaxed whitespace-pre-wrap">{briefingText}</p>
                </div>
              )}
              {!items.length && !briefingText && (
                <div className="text-center py-12">
                  <p className="text-sm text-grey-500">No actionable items for today. Everything looks good!</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Page
// ============================================================================

export default function SchemeIntelligencePage() {
  const { developmentId } = useCurrentContext();

  // Sessions
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Chat
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // UI State
  const [insights, setInsights] = useState<Insight[]>([]);
  const [briefingOpen, setBriefingOpen] = useState(false);
  const [sourceDrawer, setSourceDrawer] = useState<any>(null);

  // Pill rotation
  const [pillIndices, setPillIndices] = useState([0, 0, 0, 0]);

  const activeSession = sessions.find((s) => s.id === activeSessionId) || null;

  // Load sessions from localStorage
  useEffect(() => {
    setSessions(loadSessions());
  }, []);

  // Fetch insights on load
  useEffect(() => {
    const params = new URLSearchParams();
    if (developmentId) params.set('developmentId', developmentId);
    fetch(`/api/scheme-intelligence/insights?${params}`)
      .then((res) => res.json())
      .then((data) => setInsights(data.insights || []))
      .catch(console.error);
  }, [developmentId]);

  // Rotate pills every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setPillIndices((prev) =>
        prev.map((idx, catIdx) => (idx + 1) % QUESTION_CATEGORIES[catIdx].questions.length)
      );
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeSession?.messages]);

  const createSession = useCallback(
    (firstMessage: string) => {
      const session: Session = {
        id: crypto.randomUUID(),
        title: firstMessage.slice(0, 50),
        messages: [],
        createdAt: new Date().toISOString(),
      };
      const updated = [session, ...sessions];
      setSessions(updated);
      saveSessions(updated);
      setActiveSessionId(session.id);
      return session.id;
    },
    [sessions]
  );

  const updateSessionMessages = useCallback(
    (sessionId: string, messages: ChatMessage[]) => {
      setSessions((prev) => {
        const updated = prev.map((s) =>
          s.id === sessionId ? { ...s, messages } : s
        );
        saveSessions(updated);
        return updated;
      });
    },
    []
  );

  const sendMessage = useCallback(
    async (messageText: string) => {
      if (!messageText.trim() || isStreaming) return;

      const text = messageText.trim();
      setInput('');

      // Create or get session
      let sessionId = activeSessionId;
      if (!sessionId) {
        sessionId = createSession(text);
      }

      // Add user message
      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: text,
      };

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '',
        isStreaming: true,
      };

      // Get current messages from the latest session state
      const currentSession = sessions.find((s) => s.id === sessionId);
      const prevMessages = currentSession?.messages || [];
      const newMessages = [...prevMessages, userMessage, assistantMessage];
      updateSessionMessages(sessionId, newMessages);

      setIsStreaming(true);

      try {
        const history = prevMessages.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const response = await fetch('/api/scheme-intelligence/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text,
            developmentId,
            history,
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No reader');

        const decoder = new TextDecoder();
        let fullContent = '';
        let sources: any[] = [];
        let chartData: any = null;
        let actions: any[] = [];
        let isRegulatory = false;
        let buffer = '';

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
                  updateSessionMessages(sessionId!, [
                    ...prevMessages,
                    userMessage,
                    { ...assistantMessage, content: fullContent, isStreaming: true },
                  ]);
                  break;
                case 'sources':
                  sources = event.sources;
                  break;
                case 'chart':
                  chartData = event.chartData;
                  break;
                case 'actions':
                  actions = event.actions;
                  break;
                case 'regulatory_disclaimer':
                  isRegulatory = true;
                  break;
                case 'done':
                  break;
              }
            } catch {
              // Skip malformed lines
            }
          }
        }

        // Finalize message
        updateSessionMessages(sessionId!, [
          ...prevMessages,
          userMessage,
          {
            ...assistantMessage,
            content: fullContent,
            sources,
            chartData,
            actions,
            isRegulatory,
            isStreaming: false,
          },
        ]);
      } catch (err) {
        console.error('[SchemeIntel] Chat error:', err);
        updateSessionMessages(sessionId!, [
          ...prevMessages,
          userMessage,
          {
            ...assistantMessage,
            content: 'Sorry, something went wrong. Please try again.',
            isStreaming: false,
          },
        ]);
      } finally {
        setIsStreaming(false);
      }
    },
    [activeSessionId, sessions, isStreaming, developmentId, createSession, updateSessionMessages]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const startNewSession = () => {
    setActiveSessionId(null);
    setInput('');
  };

  const groupSessionsByDate = (sessions: Session[]) => {
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    const groups: Record<string, Session[]> = {};

    for (const s of sessions) {
      const d = new Date(s.createdAt).toDateString();
      const label = d === today ? 'Today' : d === yesterday ? 'Yesterday' : d;
      if (!groups[label]) groups[label] = [];
      groups[label].push(s);
    }
    return groups;
  };

  const sessionGroups = groupSessionsByDate(sessions);

  return (
    <div className="min-h-full bg-gray-50">
      {/* Header */}
      <div className="border-b border-grey-100 bg-white px-6 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shadow-premium"
              style={{ background: 'linear-gradient(135deg, #D4AF37 0%, #B8934C 100%)' }}
            >
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-grey-900">Scheme Intelligence</h1>
              <p className="text-xs text-grey-500">Your scheme. Ask it anything.</p>
            </div>
          </div>
          <button
            onClick={() => setBriefingOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium
              text-white shadow-lg hover:shadow-xl transition-all"
            style={{ background: 'linear-gradient(135deg, #D4AF37 0%, #B8934C 100%)' }}
          >
            <Calendar className="w-4 h-4" />
            Today&apos;s Briefing
          </button>
        </div>
      </div>

      {/* Insight Strip */}
      {insights.length > 0 && (
        <div className="border-b border-grey-100 bg-white px-6 py-3">
          <div className="flex items-center gap-4">
            {insights.map((insight, i) => (
              <a
                key={i}
                href={insight.href || '#'}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gold-50 border border-gold-200
                  text-xs font-medium text-gold-800 hover:bg-gold-100 transition-colors"
              >
                <span>{insight.icon}</span>
                <span>{insight.text}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex" style={{ height: 'calc(100vh - 140px)' }}>
        {/* Sessions Sidebar */}
        {sidebarOpen && (
          <div className="w-64 border-r border-grey-100 bg-white flex flex-col flex-shrink-0">
            <div className="p-3 border-b border-grey-100">
              <button
                onClick={startNewSession}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg
                  border border-grey-200 text-sm font-medium text-grey-700
                  hover:border-gold-300 hover:text-gold-700 hover:bg-gold-50 transition-all"
              >
                <Plus className="w-4 h-4" />
                New Chat
              </button>
            </div>
            <div className="flex-1 overflow-auto p-3 space-y-4">
              {Object.entries(sessionGroups).map(([label, group]) => (
                <div key={label}>
                  <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-grey-400">
                    {label}
                  </p>
                  <div className="space-y-0.5 mt-1">
                    {group.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => setActiveSessionId(s.id)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all truncate ${
                          s.id === activeSessionId
                            ? 'bg-gold-50 text-gold-800 font-medium'
                            : 'text-grey-600 hover:bg-grey-50'
                        }`}
                      >
                        {s.title || 'New conversation'}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {sessions.length === 0 && (
                <p className="text-xs text-grey-400 text-center py-4">No conversations yet</p>
              )}
            </div>
          </div>
        )}

        {/* Chat Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {!activeSession ? (
            /* Welcome / Empty State */
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center max-w-lg">
                <div
                  className="w-16 h-16 rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-premium-lg"
                  style={{ background: 'linear-gradient(135deg, #D4AF37 0%, #B8934C 100%)' }}
                >
                  <Brain className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-grey-900 mb-2">
                  Ask anything about your scheme
                </h2>
                <p className="text-sm text-grey-500 mb-8 leading-relaxed">
                  Query live data, search your documents, check unit specs, and verify
                  regulatory compliance — all in one place.
                </p>

                {/* Rotating Question Pills */}
                <div className="grid grid-cols-2 gap-3 mb-8">
                  {QUESTION_CATEGORIES.map((cat, catIdx) => (
                    <button
                      key={catIdx}
                      onClick={() => sendMessage(cat.questions[pillIndices[catIdx]])}
                      className="group text-left p-3 rounded-xl border border-grey-200 bg-white
                        hover:border-gold-300 hover:shadow-card-hover transition-all"
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-sm">{cat.icon}</span>
                        <span className="text-xs font-semibold text-grey-700">{cat.label}</span>
                      </div>
                      <p
                        key={pillIndices[catIdx]}
                        className="text-xs text-grey-500 group-hover:text-gold-700 transition-all
                          animate-fade-in leading-relaxed"
                      >
                        {cat.questions[pillIndices[catIdx]]}
                      </p>
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setBriefingOpen(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium
                    text-white shadow-lg hover:shadow-xl transition-all"
                  style={{ background: 'linear-gradient(135deg, #D4AF37 0%, #B8934C 100%)' }}
                >
                  <Calendar className="w-4 h-4" />
                  View Today&apos;s Briefing
                </button>
              </div>
            </div>
          ) : (
            /* Chat Messages */
            <div className="flex-1 overflow-auto p-6 space-y-4">
              {activeSession.messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-3 ${
                      msg.role === 'user'
                        ? 'text-white text-sm'
                        : 'bg-white border border-grey-100 shadow-card text-sm text-grey-800'
                    }`}
                    style={
                      msg.role === 'user'
                        ? { background: 'linear-gradient(135deg, #D4AF37 0%, #B8934C 100%)' }
                        : undefined
                    }
                  >
                    <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                    {msg.isStreaming && (
                      <span className="inline-block w-1.5 h-4 ml-0.5 bg-gold-500 animate-pulse rounded-sm" />
                    )}

                    {msg.role === 'assistant' && !msg.isStreaming && (
                      <>
                        {msg.chartData && <InlineChart chartData={msg.chartData} />}
                        <SourceChips sources={msg.sources} onSourceClick={setSourceDrawer} />
                        <ActionCards actions={msg.actions} />
                        {msg.isRegulatory && <RegulatoryDisclaimer />}
                      </>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}

          {/* Input Area */}
          <div className="border-t border-grey-100 bg-white p-4">
            <div className="flex items-end gap-3 max-w-3xl mx-auto">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 hover:bg-grey-100 rounded-lg transition text-grey-400 hover:text-grey-600 flex-shrink-0 mb-0.5"
              >
                <MessageSquare className="w-5 h-5" />
              </button>
              <div className="flex-1 relative">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about your scheme..."
                  rows={1}
                  className="w-full resize-none rounded-xl border border-grey-200 px-4 py-3 text-sm
                    text-grey-900 placeholder-grey-400 focus:outline-none focus:border-gold-400
                    focus:ring-2 focus:ring-gold-100 transition-all"
                  style={{ minHeight: 44, maxHeight: 120 }}
                  disabled={isStreaming}
                />
              </div>
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || isStreaming}
                className="p-2.5 rounded-xl text-white transition-all flex-shrink-0 mb-0.5
                  disabled:opacity-40 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
                style={{
                  background: input.trim() && !isStreaming
                    ? 'linear-gradient(135deg, #D4AF37 0%, #B8934C 100%)'
                    : '#d1d5db',
                }}
              >
                {isStreaming ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Source Drawer */}
      {sourceDrawer && <SourceDrawer source={sourceDrawer} onClose={() => setSourceDrawer(null)} />}

      {/* Briefing Modal */}
      <BriefingModal
        open={briefingOpen}
        onClose={() => setBriefingOpen(false)}
        developmentId={developmentId}
      />

      {/* CSS for fade animation */}
      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fadeIn 0.4s ease-out;
        }
      `}</style>
    </div>
  );
}
