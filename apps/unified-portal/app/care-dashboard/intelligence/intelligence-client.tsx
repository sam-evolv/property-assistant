'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Sparkles, Send, Plus, AlertTriangle, X, ChevronRight, ChevronDown, ChevronUp,
  ChevronLeft, Calendar, Loader2, Home, BarChart2, Trash2, FileText, BookOpen,
  Copy, Check, GitCompare,
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
  followUps?: string[];
}

interface Session {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  systemTypeId?: string;
}

interface SystemType {
  id: string;
  name: string;
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
// Mock System Types (Care context — installations/systems)
// ============================================================================

const MOCK_SYSTEM_TYPES: SystemType[] = [
  { id: 'solar-pv', name: 'Solar PV' },
  { id: 'heat-pump', name: 'Heat Pump' },
  { id: 'battery-storage', name: 'Battery Storage' },
  { id: 'ev-charger', name: 'EV Charger' },
  { id: 'ventilation', name: 'Ventilation (MVHR)' },
];

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
        tableHtml += `<th class="text-left py-2 px-3 font-semibold text-[#9ca8bc] bg-[#161a22] uppercase text-xs tracking-wide">${escapeHtml(h)}</th>`;
      }
      tableHtml += '</tr></thead><tbody>';
      for (const row of bodyRows) {
        tableHtml += '<tr class="border-b border-[#1e2531] hover:bg-[#1e2531]/50">';
        for (const cell of row) {
          tableHtml += `<td class="py-2 px-3 text-[#eef2f8]">${escapeHtml(cell)}</td>`;
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
// Rotating Question Pills (Care-specific categories)
// ============================================================================

const QUESTION_CATEGORIES = [
  {
    icon: '\uD83D\uDD27',
    label: 'Technical',
    questions: [
      'What\'s the most common inverter fault?',
      'How many systems have panel degradation?',
      'Which installations have connectivity issues?',
      'What are the top 5 fault codes this month?',
    ],
  },
  {
    icon: '\uD83D\uDC65',
    label: 'Customer',
    questions: [
      'What are customers asking about most?',
      'Which installations have open complaints?',
      'How many support tickets are unresolved?',
      'What is our average response time this week?',
    ],
  },
  {
    icon: '\uD83D\uDCDC',
    label: 'Warranty',
    questions: [
      'Which warranties expire this month?',
      'How many SEAI grant claims are pending?',
      'What\'s the warranty claim rate by manufacturer?',
      'Which installations are out of warranty?',
    ],
  },
  {
    icon: '\u26A1',
    label: 'Performance',
    questions: [
      'What\'s the average system yield this quarter?',
      'Which installations underperform?',
      'How does this month compare to last month?',
      'What\'s the fleet-wide generation total?',
    ],
  },
];

// ============================================================================
// LocalStorage Helpers
// ============================================================================

const STORAGE_KEY = 'care-intelligence-sessions';
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
    <div className="mt-3 p-3 rounded-xl bg-amber-900/20 border border-amber-700/30 flex gap-2">
      <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
      <p className="text-xs text-amber-200/90">
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
      case 'regulatory': return <BookOpen className="w-3.5 h-3.5 text-amber-400" />;
      default: return <FileText className="w-3.5 h-3.5 text-[#9ca8bc]" />;
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
          className="text-xs text-[#9ca8bc] hover:text-white flex items-center gap-1 transition-colors"
        >
          <span>{'\u2197'} {sources.length} source{sources.length !== 1 ? 's' : ''}</span>
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
        {expanded && (
          <div className="mt-1 rounded-lg border border-[#2A2A2A] bg-[#141414] p-2 space-y-1 animate-fade-in">
            {sources.map((s, i) => (
              <button
                key={i}
                onClick={() => onSourceClick(s)}
                className="w-full flex items-start gap-2 p-1.5 rounded-md hover:bg-[#1A1A1A] transition-colors text-left"
              >
                {getSourceIcon(s.type)}
                <div className="min-w-0">
                  <p className="text-xs font-medium text-[#eef2f8] truncate">{s.title}</p>
                  <p className="text-[10px] text-[#9ca8bc]">{getSourceLabel(s.type)}</p>
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
            border border-[#2A2A2A] text-[#eef2f8] hover:border-[#D4AF37]/50 hover:text-[#D4AF37]
            hover:bg-[#D4AF37]/10 transition-all"
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
    <div className="fixed inset-y-0 right-0 w-96 bg-[#1A1A1A] border-l border-[#2A2A2A] shadow-2xl z-50 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-[#2A2A2A]">
        <div>
          <h3 className="text-sm font-semibold text-white">{source.title}</h3>
          <span className="text-xs text-[#9ca8bc] capitalize">{source.type}</span>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-[#2A2A2A] rounded-lg transition">
          <X className="w-4 h-4 text-[#9ca8bc]" />
        </button>
      </div>
      <div className="flex-1 overflow-auto p-4">
        <p className="text-sm text-[#eef2f8] leading-relaxed whitespace-pre-wrap">{source.excerpt}</p>
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
  systemTypeId,
}: {
  open: boolean;
  onClose: () => void;
  systemTypeId?: string | null;
}) {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<BriefingItem[]>([]);
  const [briefingText, setBriefingText] = useState('');

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const params = new URLSearchParams();
    if (systemTypeId) params.set('systemTypeId', systemTypeId);

    fetch(`/api/care/briefing?${params}`)
      .then((res) => res.json())
      .then((data) => {
        setItems(data.items || []);
        setBriefingText(data.briefingText || '');
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [open, systemTypeId]);

  if (!open) return null;

  const priorityStyles = {
    critical: { bg: 'bg-red-900/20', border: 'border-red-700/30', icon: '\uD83D\uDD34', text: 'text-red-300' },
    important: { bg: 'bg-amber-900/20', border: 'border-amber-700/30', icon: '\uD83D\uDFE1', text: 'text-amber-300' },
    info: { bg: 'bg-blue-900/20', border: 'border-blue-700/30', icon: '\uD83D\uDD35', text: 'text-blue-300' },
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1A1A1A] rounded-2xl shadow-2xl border border-[#2A2A2A] w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-[#2A2A2A]">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: `linear-gradient(135deg, ${tokens.gold} 0%, ${tokens.goldDark} 100%)` }}
            >
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Attention Required</h2>
              <p className="text-xs text-[#9ca8bc]">
                {new Date().toLocaleDateString('en-IE', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-[#2A2A2A] rounded-lg transition">
            <X className="w-5 h-5 text-[#9ca8bc]" />
          </button>
        </div>
        <div className="flex-1 overflow-auto p-6 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-[#D4AF37]" />
              <span className="ml-3 text-sm text-[#9ca8bc]">Loading escalations and queries...</span>
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
                            className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-[#D4AF37] hover:text-[#F5D874]"
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
                <div className="mt-4 p-4 rounded-xl bg-[#141414] border border-[#2A2A2A]">
                  <p className="text-sm text-[#eef2f8] leading-relaxed whitespace-pre-wrap">{briefingText}</p>
                </div>
              )}
              {!items.length && !briefingText && (
                <div className="text-center py-12">
                  <p className="text-sm text-[#9ca8bc]">No open escalations or common queries. Everything looks good!</p>
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

export default function CareIntelligenceClient() {
  // Local context state (no useCurrentContext for Care)
  const [systemTypeId, setSystemTypeId] = useState<string | null>(null);
  const systemTypeName = MOCK_SYSTEM_TYPES.find((s) => s.id === systemTypeId)?.name || null;

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
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  // Feature 1: Collapsible sidebar
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Feature 3: Session loading state
  const [sessionsLoading, setSessionsLoading] = useState(true);

  // Feature 5: System type comparison
  const [compareWithId, setCompareWithId] = useState<string | null>(null);
  const [systemTypes] = useState<SystemType[]>(MOCK_SYSTEM_TYPES);
  const [compareDropdownOpen, setCompareDropdownOpen] = useState(false);

  // Pill rotation
  const [pillIndices, setPillIndices] = useState([0, 0, 0, 0]);

  const activeSession = sessions.find((s) => s.id === activeSessionId) || null;

  // Load sessions from API, fallback to localStorage
  useEffect(() => {
    setSessionsLoading(true);
    fetch('/api/care/sessions')
      .then((res) => {
        if (!res.ok) throw new Error('API failed');
        return res.json();
      })
      .then((data) => {
        if (data.sessions?.length) {
          setSessions(data.sessions.map((s: any) => ({
            id: s.id,
            title: s.title,
            messages: s.messages || [],
            createdAt: s.createdAt || s.created_at,
            systemTypeId: s.systemTypeId,
          })));
        } else {
          setSessions(loadSessions());
        }
      })
      .catch(() => {
        setSessions(loadSessions());
      })
      .finally(() => setSessionsLoading(false));
  }, []);

  // Fetch insights on load (Common Issues This Week)
  useEffect(() => {
    const params = new URLSearchParams();
    if (systemTypeId) params.set('systemTypeId', systemTypeId);
    fetch(`/api/care/insights?${params}`)
      .then((res) => res.json())
      .then((data) => setInsights(data.insights || []))
      .catch(console.error);
  }, [systemTypeId]);

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
      const tempId = crypto.randomUUID();
      const session: Session = {
        id: tempId,
        title: firstMessage.slice(0, 50),
        messages: [],
        createdAt: new Date().toISOString(),
        systemTypeId: systemTypeId || undefined,
      };
      const updated = [session, ...sessions];
      setSessions(updated);
      saveSessions(updated);
      setActiveSessionId(tempId);

      // Persist to API in background
      fetch('/api/care/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: session.title, systemTypeId, messages: [] }),
      })
        .then((res) => res.ok ? res.json() : Promise.reject())
        .then((data) => {
          if (data.session?.id) {
            const apiId = data.session.id;
            setSessions((prev) => {
              const mapped = prev.map((s) => (s.id === tempId ? { ...s, id: apiId } : s));
              saveSessions(mapped);
              return mapped;
            });
            setActiveSessionId((prev) => (prev === tempId ? apiId : prev));
          }
        })
        .catch(() => {});

      return tempId;
    },
    [sessions, systemTypeId]
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

      // Delete from API in background
      fetch('/api/care/sessions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      }).catch(() => {});
    },
    [activeSessionId]
  );

  const sendMessage = useCallback(
    async (messageText: string) => {
      if (!messageText.trim() || isStreaming) return;

      const text = messageText.trim();
      setInput('');
      resetTextareaHeight();

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

        const response = await fetch('/api/care/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text,
            systemTypeId,
            history,
            compareWithSystemTypeId: compareWithId || undefined,
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
        let followUps: string[] = [];
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
                case 'followups':
                  followUps = event.questions || [];
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
            followUps,
          },
        ]);

        // Auto-generate title for first message in session
        if (prevMessages.length === 0 && fullContent) {
          try {
            const titleRes = await fetch('/api/care/title', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ message: text, response: fullContent }),
            });
            if (titleRes.ok) {
              const { title } = await titleRes.json();
              if (title) {
                setSessions((prev) => {
                  const updated = prev.map((s) =>
                    s.id === sessionId ? { ...s, title } : s
                  );
                  saveSessions(updated);
                  return updated;
                });
                // Persist title to API
                fetch(`/api/care/sessions/${sessionId}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ title }),
                }).catch(() => {});
              }
            }
          } catch {
            // Fall back to truncated first message (already set by createSession)
          }
        }

        // Persist messages to API after stream completes
        const finalMessages = [
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
            followUps,
          },
        ];
        fetch(`/api/care/sessions/${sessionId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: finalMessages }),
        }).catch(() => {});
      } catch (err) {
        console.error('[CareIntel] Chat error:', err);
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
    [activeSessionId, sessions, isStreaming, systemTypeId, compareWithId, createSession, updateSessionMessages]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  };

  const resetTextareaHeight = () => {
    if (inputRef.current) {
      inputRef.current.style.height = '48px';
    }
  };

  const startNewSession = () => {
    setActiveSessionId(null);
    setInput('');
  };

  const showSendButton = input.trim() || isStreaming;

  return (
    <div className="min-h-full bg-[#0F0F0F]">
      <div className="max-w-[1400px] mx-auto px-4 py-4">
        {/* Main Card */}
        <div className="bg-[#1A1A1A] rounded-2xl border border-[#2A2A2A] shadow-2xl overflow-hidden flex flex-col" style={{ height: 'calc(100vh - 80px)' }}>
          {/* Header */}
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center flex-shrink-0">
                  <Image src="/branding/openhouse-ai-logo.png" alt="OpenHouse AI" width={36} height={36} className="w-9 h-9 object-contain" />
                </div>
                <div>
                  <h1 className="text-[20px] font-semibold text-white tracking-[-0.01em]">OpenHouse Care Intelligence</h1>
                  {systemTypeName && (
                    <p className="text-xs text-[#9ca8bc]">{systemTypeName}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Feature 5: Compare button (system type comparison) */}
                <div className="relative">
                  <button
                    onClick={() => {
                      if (compareWithId) {
                        setCompareWithId(null);
                        setCompareDropdownOpen(false);
                      } else {
                        setCompareDropdownOpen(!compareDropdownOpen);
                      }
                    }}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border transition-all ${
                      compareWithId
                        ? 'border-[#D4AF37] bg-[#D4AF37]/10 text-[#D4AF37]'
                        : 'border-[#2A2A2A] text-[#9ca8bc] hover:border-[#3A3A3A]'
                    }`}
                    title={compareWithId ? 'Clear comparison' : 'Compare system types'}
                  >
                    <GitCompare className="w-4 h-4" />
                    {compareWithId && (
                      <>
                        <span className="text-xs">
                          vs {systemTypes.find((s) => s.id === compareWithId)?.name || 'System'}
                        </span>
                        <X className="w-3 h-3" />
                      </>
                    )}
                  </button>
                  {compareDropdownOpen && !compareWithId && (
                    <div className="absolute right-0 top-full mt-1 w-64 bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl shadow-lg z-30 max-h-64 overflow-auto">
                      <div className="p-2">
                        <p className="text-xs font-semibold text-[#9ca8bc] px-2 py-1">Compare with...</p>
                        {systemTypes
                          .filter((s) => s.id !== systemTypeId)
                          .map((s) => (
                            <button
                              key={s.id}
                              onClick={() => {
                                setCompareWithId(s.id);
                                setCompareDropdownOpen(false);
                              }}
                              className="w-full text-left px-3 py-2 text-sm text-[#eef2f8] hover:bg-[#2A2A2A] rounded-lg transition-colors"
                            >
                              {s.name}
                            </button>
                          ))}
                        {systemTypes.filter((s) => s.id !== systemTypeId).length === 0 && (
                          <p className="px-3 py-2 text-xs text-[#9ca8bc] italic">No other system types available</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setBriefingOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-[14px] font-medium
                    text-white shadow-lg hover:shadow-xl hover:-translate-y-[1px] active:translate-y-0
                    transition-all duration-100"
                  style={{ background: `linear-gradient(135deg, ${tokens.gold} 0%, ${tokens.goldDark} 100%)`, boxShadow: '0 2px 8px rgba(212,175,55,0.3)' }}
                >
                  <Calendar className="w-4 h-4" />
                  Attention Required
                </button>
              </div>
            </div>
          </div>
          <div className="h-px bg-gradient-to-r from-transparent via-[#D4AF37]/30 to-transparent" />

          {/* Common Issues This Week strip (proactive insights) */}
          {insights.length > 0 && !insightsDismissed && (
            <div className="border-b border-[#2A2A2A] bg-[#141414] px-4 py-2">
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                {insights.map((insight, i) => (
                  <a
                    key={i}
                    href={insight.href || '#'}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#1A1A1A] border border-[#2A2A2A]
                      text-xs whitespace-nowrap hover:border-[#D4AF37]/40 hover:bg-[#D4AF37]/5 transition-all flex-shrink-0"
                  >
                    <span>{insight.icon}</span>
                    <span className="font-semibold text-[#eef2f8]">{insight.text}</span>
                  </a>
                ))}
                <button
                  onClick={() => setInsightsDismissed(true)}
                  className="p-1 hover:bg-[#2A2A2A] rounded-full transition flex-shrink-0 text-[#9ca8bc] hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Body: Sidebar + Chat */}
          <div className="flex flex-1 min-h-0 relative">
            {/* Sidebar toggle button */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="absolute top-1/2 -translate-y-1/2 z-20 w-6 h-10 flex items-center justify-center
                bg-[#1A1A1A] border border-[#2A2A2A] rounded-r-lg shadow-sm hover:bg-[#2A2A2A]
                transition-all duration-200 text-[#9ca8bc] hover:text-white"
              style={{ left: sidebarOpen ? '256px' : '0px', transition: 'left 200ms' }}
            >
              {sidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>

            {/* Sessions Sidebar */}
            <div
              className="bg-[#141414] border-r border-[#2A2A2A] flex flex-col flex-shrink-0 overflow-hidden transition-all duration-200"
              style={{ width: sidebarOpen ? '256px' : '0px' }}
            >
              <div className="p-3 border-b border-[#2A2A2A]">
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className="text-xs font-semibold text-[#9ca8bc] uppercase tracking-wider">Conversations</span>
                </div>
                <button
                  onClick={startNewSession}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl
                    text-sm font-medium text-white shadow-lg hover:shadow-xl
                    hover:-translate-y-[1px] active:translate-y-0
                    transition-all duration-100"
                  style={{ background: `linear-gradient(135deg, ${tokens.gold} 0%, ${tokens.goldDark} 100%)`, boxShadow: '0 2px 8px rgba(212,175,55,0.3)' }}
                >
                  <Plus className="w-4 h-4" />
                  New Chat
                </button>
              </div>
              <div className="flex-1 overflow-auto p-2">
                {sessionsLoading && (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="w-4 h-4 animate-spin text-[#D4AF37]" />
                  </div>
                )}
                {!sessionsLoading && sessions.map((s) => (
                  <div
                    key={s.id}
                    className={`sidebar-section group relative rounded-lg transition-all mb-0.5 border-l-3 ${
                      s.id === activeSessionId
                        ? 'bg-[#1A1A1A] border-l-[3px] border-[#D4AF37]'
                        : 'hover:bg-[#1A1A1A] border-l-[3px] border-transparent'
                    }`}
                  >
                    {deletingSessionId === s.id ? (
                      <div className="flex items-center gap-2 px-3 py-2">
                        <span className="text-xs text-[#eef2f8] flex-1">Delete?</span>
                        <button
                          onClick={() => deleteSession(s.id)}
                          className="text-[11px] font-medium text-red-400 hover:text-red-300 px-1.5 py-0.5 rounded hover:bg-red-900/30 transition-colors"
                        >
                          Yes
                        </button>
                        <button
                          onClick={() => setDeletingSessionId(null)}
                          className="text-[11px] font-medium text-[#9ca8bc] hover:text-white px-1.5 py-0.5 rounded hover:bg-[#2A2A2A] transition-colors"
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
                            s.id === activeSessionId ? 'text-white font-medium' : 'text-[#eef2f8]'
                          }`}>
                            {s.title || 'New conversation'}
                          </p>
                          <p className="text-[10px] text-[#9ca8bc] mt-0.5">{relativeTime(s.createdAt)}</p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletingSessionId(s.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-900/30 hover:text-red-400 text-[#9ca8bc] transition-all flex-shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </button>
                    )}
                  </div>
                ))}
                {!sessionsLoading && sessions.length === 0 && (
                  <p className="text-xs text-[#9ca8bc] text-center py-8 italic">No conversations yet</p>
                )}
              </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 flex flex-col min-w-0">
              {!activeSession ? (
                /* Welcome / Empty State */
                <div className="flex-1 flex items-center justify-center p-8">
                  <div className="text-center max-w-xl">
                    <div className="w-14 h-14 rounded-2xl mx-auto mb-5 overflow-hidden flex items-center justify-center">
                      <Image src="/branding/openhouse-ai-logo.png" alt="OpenHouse AI" width={56} height={56} className="w-14 h-14 object-contain" />
                    </div>
                    <h2 className="text-2xl font-semibold text-white tracking-[-0.01em]">
                      OpenHouse Care Intelligence
                    </h2>
                    <p className="text-[#9ca8bc] text-sm mt-1 mb-8">
                      Ask anything about your installations — performance, warranties, customers.
                    </p>

                    {/* Suggested Questions */}
                    <div className="grid grid-cols-2 gap-3 w-full max-w-lg mx-auto mb-8">
                      {QUESTION_CATEGORIES.map((cat, catIdx) => {
                        const cardEmojis = ['\uD83D\uDD27', '\uD83D\uDC65', '\uD83D\uDCDC', '\u26A1'];
                        const cardLabels = ['Technical', 'Customers', 'Warranty', 'Performance'];
                        return (
                          <button
                            key={catIdx}
                            onClick={() => sendMessage(cat.questions[pillIndices[catIdx]])}
                            className="rounded-2xl border border-[#2A2A2A] bg-[#141414] p-4 text-left
                              hover:border-[#D4AF37]/50 hover:shadow-[0_4px_12px_rgba(212,175,55,0.15)]
                              hover:-translate-y-[1px] active:translate-y-0
                              transition-all duration-150 cursor-pointer group"
                            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(212,175,55,0.05)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#141414'; }}
                          >
                            <span className="text-xl">{cardEmojis[catIdx]}</span>
                            <p
                              key={pillIndices[catIdx]}
                              className="text-[14px] font-medium text-[#eef2f8] mt-2 group-hover:text-[#D4AF37] transition-colors animate-fade-in"
                            >
                              {cat.questions[pillIndices[catIdx]]}
                            </p>
                            <p className="text-xs text-[#9ca8bc] mt-0.5">{cardLabels[catIdx]}</p>
                          </button>
                        );
                      })}
                    </div>

                    <button
                      onClick={() => setBriefingOpen(true)}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-[14px] font-medium
                        text-white shadow-lg hover:shadow-xl hover:-translate-y-[1px] active:translate-y-0
                        transition-all duration-100"
                      style={{ background: `linear-gradient(135deg, ${tokens.gold} 0%, ${tokens.goldDark} 100%)`, boxShadow: '0 2px 8px rgba(212,175,55,0.3)' }}
                    >
                      <Calendar className="w-4 h-4" />
                      View Attention Required
                    </button>
                  </div>
                </div>
              ) : (
                /* Chat Messages (Fix 7: Claude-like layout) */
                <div className="flex-1 overflow-auto px-8 py-6">
                  <div className="max-w-3xl mx-auto space-y-8">
                    {activeSession.messages.map((msg) => (
                      <div key={msg.id} className="animate-slide-in">
                        {msg.role === 'user' ? (
                          /* User bubble: gold-tinted, right-aligned */
                          <div className="flex justify-end">
                            <div className="max-w-[75%] rounded-2xl rounded-tr-sm px-5 py-3 border border-[#D4AF37]/20 text-[16px] text-white leading-[1.5]" style={{ background: 'linear-gradient(135deg, rgba(212,175,55,0.15) 0%, rgba(184,147,76,0.08) 100%)' }}>
                              <div className="whitespace-pre-wrap">{msg.content}</div>
                            </div>
                          </div>
                        ) : (
                          /* Assistant: flat with AI avatar */
                          <div className="flex items-start gap-3 group">
                            <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0 mt-0.5">
                              <Image src="/branding/openhouse-ai-logo.png" alt="OpenHouse AI" width={28} height={28} className="w-7 h-7 object-contain" />
                            </div>
                            <div className="flex-1 min-w-0 relative">
                              {!msg.isStreaming && (
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(msg.content);
                                    setCopiedMessageId(msg.id);
                                    setTimeout(() => setCopiedMessageId(null), 2000);
                                  }}
                                  className="absolute top-0 right-0 p-1.5 rounded-lg opacity-0 group-hover:opacity-100
                                    text-[#9ca8bc] hover:text-white hover:bg-[#2A2A2A] transition-all"
                                  title="Copy message"
                                >
                                  {copiedMessageId === msg.id ? (
                                    <Check className="w-4 h-4 text-green-400" />
                                  ) : (
                                    <Copy className="w-4 h-4" />
                                  )}
                                </button>
                              )}
                              {msg.isStreaming && !msg.content ? (
                                /* Typing indicator with bouncing dots */
                                <div className="flex items-center gap-2">
                                  <span className="text-[#9ca8bc] text-sm italic">OpenHouse Care Intelligence is thinking</span>
                                  <div className="flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37] animate-bounce-dot" />
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37] animate-bounce-dot-delay-1" />
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37] animate-bounce-dot-delay-2" />
                                  </div>
                                </div>
                              ) : (
                                <div
                                  className="text-[#eef2f8] leading-[1.5] text-[16px] scheme-intel-response"
                                  dangerouslySetInnerHTML={{ __html: formatMessage(msg.content) }}
                                />
                              )}
                              {msg.isStreaming && msg.content && <StreamingDots />}

                              {!msg.isStreaming && (
                                <>
                                  {msg.chartData && <div className="scheme-intel-response"><InlineChart chartData={msg.chartData} /></div>}
                                  <CollapsibleSources sources={msg.sources} onSourceClick={setSourceDrawer} />
                                  <ActionCards actions={msg.actions} />
                                  {msg.isRegulatory && <RegulatoryDisclaimer />}
                                  {msg.followUps && msg.followUps.length > 0 && (
                                    <div className="mt-3 flex flex-wrap gap-2">
                                      {msg.followUps.map((question, i) => (
                                        <button
                                          key={i}
                                          onClick={() => sendMessage(question)}
                                          className="rounded-full border border-[#2A2A2A] px-3 py-1.5 text-xs text-[#9ca8bc]
                                            hover:border-[#D4AF37]/50 hover:text-[#D4AF37] hover:bg-[#D4AF37]/10
                                            transition-all duration-150"
                                        >
                                          {question}
                                        </button>
                                      ))}
                                    </div>
                                  )}
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

              {/* Input Area */}
              <div className="bg-[#1A1A1A] border-t border-[#2A2A2A] px-4 py-3">
                <div className="flex items-center gap-3 max-w-3xl mx-auto">
                  <Link
                    href="/care-dashboard"
                    className="p-2.5 rounded-full bg-[#2A2A2A] hover:bg-[#3A3A3A] transition-all flex-shrink-0 text-[#9ca8bc] hover:text-white"
                  >
                    <Home className="w-5 h-5" />
                  </Link>
                  <div className="flex-1 transition-shadow duration-200">
                    <textarea
                      ref={inputRef}
                      value={input}
                      onChange={handleInputChange}
                      onKeyDown={handleKeyDown}
                      placeholder="Message OpenHouse Care Intelligence..."
                      rows={1}
                      className="w-full resize-none rounded-[20px] border-2 border-[#2A2A2A] bg-[#141414] px-5 py-4 text-[16px]
                        text-white placeholder-[#B0B0B0] focus:outline-none focus:border-[#D4AF37]
                        focus:shadow-[0_0_0_3px_rgba(212,175,55,0.1)] transition-all duration-200 scrollbar-hide"
                      style={{ minHeight: 48, maxHeight: 120, overflowY: 'hidden' }}
                      disabled={isStreaming}
                    />
                  </div>
                  <button
                    onClick={() => sendMessage(input)}
                    disabled={!input.trim() || isStreaming}
                    className={`p-2.5 rounded-full text-white transition-all duration-100 flex-shrink-0
                      disabled:cursor-not-allowed hover:shadow-[0_4px_12px_rgba(212,175,55,0.4)] hover:-translate-y-[1px] active:translate-y-0
                      ${showSendButton ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}`}
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

      {/* Briefing Modal (Attention Required) */}
      <BriefingModal
        open={briefingOpen}
        onClose={() => setBriefingOpen(false)}
        systemTypeId={systemTypeId}
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
        @keyframes slideInUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-slide-in {
          animation: slideInUp 0.3s ease-out;
        }
        @keyframes pulse-dot {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }
        @keyframes bounceDot {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-6px); opacity: 1; }
        }
        .animate-bounce-dot { animation: bounceDot 1.4s ease-in-out infinite; }
        .animate-bounce-dot-delay-1 { animation: bounceDot 1.4s ease-in-out 0.16s infinite; }
        .animate-bounce-dot-delay-2 { animation: bounceDot 1.4s ease-in-out 0.32s infinite; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .sidebar-section { transition: border-color 0.2s ease, background-color 0.2s ease; }
        .sidebar-section:hover { border-left-color: #D4AF37; background: rgba(212,175,55,0.05); }
      `}</style>
    </div>
  );
}
