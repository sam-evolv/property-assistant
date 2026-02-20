'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useCurrentContext } from '@/contexts/CurrentContext';
import {
  Sparkles, Send, Plus, AlertTriangle, X, ChevronRight, ChevronDown, ChevronUp,
  Calendar, Loader2, Home, BarChart2, Trash2, FileText, BookOpen,
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
// Message Formatter (Fix 3: tables, Fix 4: strip sources)
// ============================================================================

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatTextBlock(content: string): string {
  if (!content.trim()) return '';

  let html = escapeHtml(content);

  // ## Headings
  html = html.replace(/^##\s+(.+)$/gm, (_match, heading) => {
    return `<strong class="block mt-3 mb-1 text-[15px] font-semibold">${heading}</strong>`;
  });

  // **bold**
  html = html.replace(/\*\*([^*]+)\*\*/g, '<span class="font-semibold text-gold-600">$1</span>');

  // *italic*
  html = html.replace(/\*([^*]+)\*/g, '$1');

  // Style lines ending with colon as bold headings
  html = html.replace(/^([A-Z][^:\n]{0,50}:)\s*$/gm, (_match, heading) => {
    return `<strong class="block mt-3 mb-1 text-[15px] font-semibold">${heading}</strong>`;
  });

  // Inline headings starting a paragraph
  html = html.replace(/^([A-Z][^:\n]{0,50}:)(\s+\S)/gm, (_match, heading, rest) => {
    return `<strong class="font-semibold">${heading}</strong>${rest}`;
  });

  // Bullet list items
  html = html.replace(/^- (.+)$/gm, (_match, item) => {
    return `<div class="flex items-start gap-2 ml-1 my-1"><span class="text-[#D4AF37] select-none shrink-0 mt-[2px]">\u2022</span><span class="flex-1">${item}</span></div>`;
  });

  // Numbered list items
  html = html.replace(/^(\d+)\.\s+(.+)$/gm, (_match, num, item) => {
    return `<div class="flex items-start gap-2 ml-1 my-1"><span class="text-[#D4AF37] font-medium select-none shrink-0 min-w-[1.25rem] mt-[1px]">${num}.</span><span class="flex-1">${item}</span></div>`;
  });

  // Clickable URLs
  html = html.replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-gold-500 hover:text-gold-400 underline underline-offset-2">$1</a>'
  );

  // Clickable phone numbers
  html = html.replace(
    /(\+\d{1,3}[\s-]?\d{2,4}[\s-]?\d{3,4}[\s-]?\d{3,4}|\b0\d{2,4}[\s-]?\d{3,4}[\s-]?\d{3,4}\b)/g,
    (match) => {
      const cleanNumber = match.replace(/[\s-]/g, '');
      return `<a href="tel:${cleanNumber}" class="text-gold-500 hover:text-gold-400 underline underline-offset-2">${match}</a>`;
    }
  );

  // Clickable emails
  html = html.replace(
    /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
    '<a href="mailto:$1" class="text-gold-500 hover:text-gold-400 underline underline-offset-2">$1</a>'
  );

  // Highlight prices
  html = html.replace(
    /([€£$]\d{1,3}(?:,\d{3})*(?:\.\d{2})?|\d{1,3}(?:,\d{3})*(?:\.\d{2})?\s*(?:euro|EUR|pounds?|GBP))/gi,
    '<span class="font-semibold text-gold-600">$1</span>'
  );

  // Highlight percentages
  html = html.replace(
    /(\d+(?:\.\d+)?%)/g,
    '<span class="font-medium">$1</span>'
  );

  // Paragraph breaks
  html = html.replace(/\n\n/g, '</p><p class="mt-3">');
  html = html.replace(/\n/g, '<br/>');

  // Wrap in paragraph
  html = `<p>${html}</p>`;

  // Clean up empty paragraphs
  html = html.replace(/<p class="mt-3"><\/p>/g, '');
  html = html.replace(/<p><\/p>/g, '');

  return html;
}

function formatMessage(content: string): string {
  if (!content) return '';

  // Fix 4: Strip [Source: ...] citations
  let text = content.replace(/\[Source:[^\]]+\]/g, '');

  // Fix 3: Detect and extract markdown tables
  const lines = text.split('\n');
  const blocks: { type: 'text' | 'table'; content: string; rows?: string[][] }[] = [];
  let i = 0;

  while (i < lines.length) {
    if (lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        tableLines.push(lines[i]);
        i++;
      }
      if (tableLines.length >= 2) {
        const rows: string[][] = [];
        for (let j = 0; j < tableLines.length; j++) {
          const cells = tableLines[j].split('|').slice(1, -1).map(c => c.trim());
          if (cells.every(c => /^[-:]+$/.test(c))) continue;
          rows.push(cells);
        }
        blocks.push({ type: 'table', content: '', rows });
      } else {
        blocks.push({ type: 'text', content: tableLines.join('\n') });
      }
    } else {
      const textLines: string[] = [];
      while (i < lines.length && !(lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|'))) {
        textLines.push(lines[i]);
        i++;
      }
      blocks.push({ type: 'text', content: textLines.join('\n') });
    }
  }

  const htmlParts: string[] = [];

  for (const block of blocks) {
    if (block.type === 'table' && block.rows && block.rows.length > 0) {
      const [headers, ...bodyRows] = block.rows;
      let tableHtml = '<div class="overflow-x-auto my-3"><table class="w-full text-sm border-collapse"><thead><tr class="border-b-2 border-[#D4AF37]/30">';
      for (const h of headers) {
        tableHtml += `<th class="text-left py-2 px-3 font-semibold text-slate-700 bg-slate-50">${escapeHtml(h)}</th>`;
      }
      tableHtml += '</tr></thead><tbody>';
      for (const row of bodyRows) {
        tableHtml += '<tr class="border-b border-slate-100 hover:bg-slate-50/50">';
        for (const cell of row) {
          tableHtml += `<td class="py-2 px-3 text-slate-600">${escapeHtml(cell)}</td>`;
        }
        tableHtml += '</tr>';
      }
      tableHtml += '</tbody></table></div>';
      htmlParts.push(tableHtml);
    } else {
      htmlParts.push(formatTextBlock(block.content));
    }
  }

  return htmlParts.join('');
}

// ============================================================================
// Relative Time Helper
// ============================================================================

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(dateStr).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' });
}

// ============================================================================
// Rotating Question Pills
// ============================================================================

const QUESTION_CATEGORIES = [
  {
    icon: '\uD83D\uDCB0',
    label: 'Financial',
    questions: [
      'What is our projected revenue for Q1?',
      'Which units have outstanding stage payments?',
      'What is our total contracted value?',
      'How many units are sale agreed?',
    ],
  },
  {
    icon: '\uD83D\uDCCB',
    label: 'Compliance',
    questions: [
      'Do we have HomeBond for all completed units?',
      'Which units are missing fire safety certificates?',
      'What BCAR documentation is required before handover?',
      'What is our document coverage across all schemes?',
    ],
  },
  {
    icon: '\uD83D\uDC65',
    label: 'Homeowners',
    questions: [
      'What are homeowners asking about most this week?',
      'Which developments have the lowest registration rates?',
      'How many homeowners registered this month?',
      'What is our average response time to homeowner queries?',
    ],
  },
  {
    icon: '\u2696\uFE0F',
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions.slice(0, 5)));
  }
}

// ============================================================================
// Sub-Components
// ============================================================================

function RegulatoryDisclaimer() {
  return (
    <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200 flex gap-2">
      <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
      <p className="text-xs text-amber-800">
        This response references Irish Building Regulations. Always verify compliance requirements
        with your assigned certifier or solicitor before acting on this information.
      </p>
    </div>
  );
}

function InlineChart({ chartData }: { chartData: ChatMessage['chartData'] }) {
  if (!chartData) return null;
  return <InlineChartRenderer chartData={chartData} />;
}

// Fix 5: Collapsible Sources (replaces SourceChips)
function CollapsibleSources({
  sources,
  onSourceClick,
}: {
  sources: ChatMessage['sources'];
  onSourceClick: (source: any) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  if (!sources?.length) return null;

  const getSourceIcon = (type: string) => {
    switch (type) {
      case 'function': return <BarChart2 className="w-3.5 h-3.5 text-[#D4AF37]" />;
      case 'regulatory': return <BookOpen className="w-3.5 h-3.5 text-amber-600" />;
      default: return <FileText className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  const getSourceLabel = (type: string) => {
    switch (type) {
      case 'function': return 'Live data';
      case 'regulatory': return 'Regulation';
      default: return 'Document';
    }
  };

  return (
    <div className="flex justify-end mt-2">
      <div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 transition-colors"
        >
          <span>{'\u2197'} {sources.length} source{sources.length !== 1 ? 's' : ''}</span>
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
        {expanded && (
          <div className="mt-1 rounded-lg border border-slate-200 bg-slate-50 p-2 space-y-1 animate-fade-in">
            {sources.map((s, i) => (
              <button
                key={i}
                onClick={() => onSourceClick(s)}
                className="w-full flex items-start gap-2 p-1.5 rounded-md hover:bg-white transition-colors text-left"
              >
                {getSourceIcon(s.type)}
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-700 truncate">{s.title}</p>
                  <p className="text-[10px] text-slate-400">{getSourceLabel(s.type)}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
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
            border border-slate-200 text-slate-700 hover:border-amber-300 hover:text-amber-700
            hover:bg-amber-50 transition-all"
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
    <div className="fixed inset-y-0 right-0 w-96 bg-white border-l border-slate-200 shadow-2xl z-50 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-slate-100">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{source.title}</h3>
          <span className="text-xs text-slate-500 capitalize">{source.type}</span>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg transition">
          <X className="w-4 h-4 text-slate-500" />
        </button>
      </div>
      <div className="flex-1 overflow-auto p-4">
        <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{source.excerpt}</p>
      </div>
    </div>
  );
}

function StreamingDots() {
  return (
    <div className="inline-flex items-center gap-1 py-1">
      <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37] animate-[pulse-dot_1.4s_ease-in-out_infinite]" />
      <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37] animate-[pulse-dot_1.4s_ease-in-out_0.2s_infinite]" />
      <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37] animate-[pulse-dot_1.4s_ease-in-out_0.4s_infinite]" />
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
    critical: { bg: 'bg-red-50', border: 'border-red-200', icon: '\uD83D\uDD34', text: 'text-red-800' },
    important: { bg: 'bg-amber-50', border: 'border-amber-200', icon: '\uD83D\uDFE1', text: 'text-amber-800' },
    info: { bg: 'bg-blue-50', border: 'border-blue-200', icon: '\uD83D\uDD35', text: 'text-blue-800' },
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: `linear-gradient(135deg, ${tokens.gold} 0%, ${tokens.goldDark} 100%)` }}
            >
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Today&apos;s Briefing</h2>
              <p className="text-xs text-slate-500">
                {new Date().toLocaleDateString('en-IE', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>
        <div className="flex-1 overflow-auto p-6 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-[#D4AF37]" />
              <span className="ml-3 text-sm text-slate-500">Generating briefing...</span>
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
                            className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-amber-700 hover:text-amber-800"
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
                <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{briefingText}</p>
                </div>
              )}
              {!items.length && !briefingText && (
                <div className="text-center py-12">
                  <p className="text-sm text-slate-500">No actionable items for today. Everything looks good!</p>
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
  const { developmentId, developmentName } = useCurrentContext();

  // Sessions
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  // Chat
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // UI State
  const [insights, setInsights] = useState<Insight[]>([]);
  const [insightsDismissed, setInsightsDismissed] = useState(false);
  const [briefingOpen, setBriefingOpen] = useState(false);
  const [sourceDrawer, setSourceDrawer] = useState<any>(null);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);

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

  // Auto-clear delete confirmation after 3s
  useEffect(() => {
    if (!deletingSessionId) return;
    const timer = setTimeout(() => setDeletingSessionId(null), 3000);
    return () => clearTimeout(timer);
  }, [deletingSessionId]);

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

  const deleteSession = useCallback(
    (sessionId: string) => {
      setSessions((prev) => {
        const updated = prev.filter((s) => s.id !== sessionId);
        saveSessions(updated);
        return updated;
      });
      if (activeSessionId === sessionId) {
        setActiveSessionId(null);
      }
      setDeletingSessionId(null);
    },
    [activeSessionId]
  );

  const sendMessage = useCallback(
    async (messageText: string) => {
      if (!messageText.trim() || isStreaming) return;

      const text = messageText.trim();
      setInput('');

      let sessionId = activeSessionId;
      if (!sessionId) {
        sessionId = createSession(text);
      }

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

  const showSendButton = input.trim() || isStreaming;

  return (
    <div className="min-h-full bg-slate-50">
      <div className="max-w-[1400px] mx-auto px-4 py-4">
        {/* Main Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col" style={{ height: 'calc(100vh - 80px)' }}>
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: `linear-gradient(135deg, ${tokens.gold} 0%, ${tokens.goldDark} 100%)` }}
                >
                  <Sparkles className="w-4.5 h-4.5 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-slate-900">Scheme Intelligence</h1>
                  {developmentName && (
                    <p className="text-xs text-slate-500">{developmentName}</p>
                  )}
                </div>
              </div>
              <button
                onClick={() => setBriefingOpen(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium
                  text-white shadow-lg hover:shadow-xl transition-all"
                style={{ background: `linear-gradient(135deg, ${tokens.gold} 0%, ${tokens.goldDark} 100%)` }}
              >
                <Calendar className="w-4 h-4" />
                Today&apos;s Briefing
              </button>
            </div>
          </div>

          {/* Fix 2: Proactive Insight Strip (below header, above chat) */}
          {insights.length > 0 && !insightsDismissed && (
            <div className="border-b border-slate-100 bg-slate-50/50 px-4 py-2">
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                {insights.map((insight, i) => (
                  <a
                    key={i}
                    href={insight.href || '#'}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200
                      text-xs font-medium text-slate-700 hover:border-[#D4AF37]/50 hover:text-[#B8934C]
                      transition-colors whitespace-nowrap flex-shrink-0"
                  >
                    <span>{insight.icon}</span>
                    <span>{insight.text}</span>
                  </a>
                ))}
                <button
                  onClick={() => setInsightsDismissed(true)}
                  className="p-1 hover:bg-slate-200 rounded-full transition flex-shrink-0 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Body: Sidebar + Chat */}
          <div className="flex flex-1 min-h-0">
            {/* Sessions Sidebar */}
            <div className="w-64 bg-slate-50 border-r border-slate-200 flex flex-col flex-shrink-0">
              <div className="p-3 border-b border-slate-200">
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Conversations</span>
                </div>
                <button
                  onClick={startNewSession}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg
                    text-sm font-medium text-white transition-all"
                  style={{ background: `linear-gradient(135deg, ${tokens.gold} 0%, ${tokens.goldDark} 100%)` }}
                >
                  <Plus className="w-4 h-4" />
                  New Chat
                </button>
              </div>
              <div className="flex-1 overflow-auto p-2">
                {sessions.map((s) => (
                  <div
                    key={s.id}
                    className={`group relative rounded-lg transition-all mb-0.5 ${
                      s.id === activeSessionId
                        ? 'bg-white border-l-2 border-[#D4AF37] shadow-sm'
                        : 'hover:bg-white/60 border-l-2 border-transparent'
                    }`}
                  >
                    {deletingSessionId === s.id ? (
                      <div className="flex items-center gap-2 px-3 py-2">
                        <span className="text-xs text-slate-600 flex-1">Delete?</span>
                        <button
                          onClick={() => deleteSession(s.id)}
                          className="text-[11px] font-medium text-red-600 hover:text-red-700 px-1.5 py-0.5 rounded hover:bg-red-50 transition-colors"
                        >
                          Yes
                        </button>
                        <button
                          onClick={() => setDeletingSessionId(null)}
                          className="text-[11px] font-medium text-slate-500 hover:text-slate-700 px-1.5 py-0.5 rounded hover:bg-slate-100 transition-colors"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setActiveSessionId(s.id)}
                        className="w-full text-left px-3 py-2 flex items-center gap-2"
                      >
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs truncate ${
                            s.id === activeSessionId ? 'text-slate-900 font-medium' : 'text-slate-600'
                          }`}>
                            {s.title || 'New conversation'}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5">{relativeTime(s.createdAt)}</p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletingSessionId(s.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 hover:text-red-500 text-slate-400 transition-all flex-shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </button>
                    )}
                  </div>
                ))}
                {sessions.length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-8 italic">No conversations yet</p>
                )}
              </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 flex flex-col min-w-0">
              {!activeSession ? (
                /* Welcome / Empty State (Fix 7) */
                <div className="flex-1 flex items-center justify-center p-8">
                  <div className="text-center max-w-xl">
                    <div className="w-14 h-14 rounded-2xl mx-auto mb-5 flex items-center justify-center bg-[#D4AF37]/10">
                      <Sparkles className="w-7 h-7 text-[#D4AF37]" />
                    </div>
                    <h2 className="text-2xl font-semibold text-slate-900">
                      Scheme Intelligence
                    </h2>
                    <p className="text-slate-500 text-sm mt-1 mb-8">
                      Ask anything about your scheme — data, documents, regulations.
                    </p>

                    {/* Suggested Questions (Fix 7) */}
                    <div className="grid grid-cols-2 gap-2 mb-8">
                      {QUESTION_CATEGORIES.map((cat, catIdx) => (
                        <button
                          key={catIdx}
                          onClick={() => sendMessage(cat.questions[pillIndices[catIdx]])}
                          className="border border-slate-200 rounded-xl p-3 text-sm text-slate-600
                            hover:border-[#D4AF37]/50 hover:bg-[#D4AF37]/5 cursor-pointer transition-all text-left"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm">{cat.icon}</span>
                            <span className="text-xs font-semibold text-slate-700">{cat.label}</span>
                          </div>
                          <p
                            key={pillIndices[catIdx]}
                            className="text-xs text-slate-500 leading-relaxed animate-fade-in"
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
                      style={{ background: `linear-gradient(135deg, ${tokens.gold} 0%, ${tokens.goldDark} 100%)` }}
                    >
                      <Calendar className="w-4 h-4" />
                      View Today&apos;s Briefing
                    </button>
                  </div>
                </div>
              ) : (
                /* Chat Messages (Fix 7: Claude-like layout) */
                <div className="flex-1 overflow-auto px-8 py-6">
                  <div className="max-w-3xl mx-auto space-y-8">
                    {activeSession.messages.map((msg) => (
                      <div key={msg.id}>
                        {msg.role === 'user' ? (
                          /* User bubble: dark, right-aligned */
                          <div className="flex justify-end">
                            <div className="max-w-[75%] rounded-2xl rounded-tr-sm px-4 py-3 bg-slate-900 text-white text-sm">
                              <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                            </div>
                          </div>
                        ) : (
                          /* Assistant: flat with AI avatar */
                          <div className="flex items-start gap-3">
                            <div className="w-7 h-7 bg-[#D4AF37]/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                              <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" />
                            </div>
                            <div className="flex-1 min-w-0">
                              {msg.isStreaming && !msg.content ? (
                                /* Streaming indicator (Fix 7) */
                                <div className="flex items-center gap-2">
                                  <span className="text-slate-400 text-sm italic">Scheme Intelligence is thinking</span>
                                  <StreamingDots />
                                </div>
                              ) : (
                                <div
                                  className="text-slate-800 leading-relaxed text-[15px]"
                                  dangerouslySetInnerHTML={{ __html: formatMessage(msg.content) }}
                                />
                              )}
                              {msg.isStreaming && msg.content && <StreamingDots />}

                              {!msg.isStreaming && (
                                <>
                                  {msg.chartData && <InlineChart chartData={msg.chartData} />}
                                  <CollapsibleSources sources={msg.sources} onSourceClick={setSourceDrawer} />
                                  <ActionCards actions={msg.actions} />
                                  {msg.isRegulatory && <RegulatoryDisclaimer />}
                                </>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                </div>
              )}

              {/* Input Area (Fix 1: Home button, Fix 7: Claude-like input) */}
              <div className="bg-white px-4 py-3">
                <div className="flex items-end gap-3 max-w-3xl mx-auto">
                  {/* Fix 1: Home button */}
                  <Link
                    href="/developer/overview"
                    className="p-2.5 rounded-full bg-slate-100 hover:bg-slate-200 transition-all flex-shrink-0 mb-0.5 text-slate-500 hover:text-slate-700"
                  >
                    <Home className="w-5 h-5" />
                  </Link>
                  <div className="flex-1">
                    <textarea
                      ref={inputRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Message Scheme Intelligence..."
                      rows={1}
                      className="w-full resize-none rounded-2xl border border-slate-200 px-5 py-3.5 text-sm
                        text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#D4AF37]
                        focus:ring-1 focus:ring-[#D4AF37]/30 shadow-sm transition-all"
                      style={{ minHeight: 48, maxHeight: 120 }}
                      disabled={isStreaming}
                    />
                  </div>
                  <button
                    onClick={() => sendMessage(input)}
                    disabled={!input.trim() || isStreaming}
                    className={`p-2.5 rounded-full text-white transition-all duration-200 flex-shrink-0 mb-0.5
                      disabled:cursor-not-allowed hover:shadow-md ${showSendButton ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}`}
                    style={{
                      background: `linear-gradient(135deg, ${tokens.gold} 0%, ${tokens.goldDark} 100%)`,
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

      {/* CSS for animations */}
      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fadeIn 0.4s ease-out;
        }
        @keyframes pulse-dot {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
