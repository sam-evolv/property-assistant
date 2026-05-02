'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Home, Mic, Send, Info, ChevronDown, ChevronUp, FileText, Clock, X } from 'lucide-react';
import Image from 'next/image';
import { cleanForDisplay } from '@/lib/assistant/formatting';
import { useCareApp } from '../care-app-provider';

/* ── Animation Styles — VERBATIM from PurchaserChatTab + UX Enhancements ──── */
const ANIMATION_STYLES = `
  @keyframes dot-bounce {
    0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
    30% { opacity: 1; transform: translateY(-8px); }
  }
  @keyframes logo-float {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-12px); }
  }
  @keyframes message-fade-in {
    0% { opacity: 0; transform: translateY(8px); }
    100% { opacity: 1; transform: translateY(0); }
  }
  @keyframes welcome-fade-in {
    0% { opacity: 0; transform: scale(0.95); }
    100% { opacity: 1; transform: scale(1); }
  }
  @keyframes slide-up {
    0% { opacity: 0; transform: translateY(16px); }
    100% { opacity: 1; transform: translateY(0); }
  }
  @keyframes slideDown {
    0% { opacity: 0; transform: translateY(-8px); }
    100% { opacity: 1; transform: translateY(0); }
  }
  .typing-dot {
    animation: dot-bounce 1.4s infinite;
    display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin: 0 2px;
  }
  .dot-1 { animation-delay: 0s; }
  .dot-2 { animation-delay: 0.2s; }
  .dot-3 { animation-delay: 0.4s; }
  .logo-container {
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  .logo-container:hover { animation: logo-float 2s ease-in-out infinite; }
  .message-bubble { animation: message-fade-in 0.3s ease-out forwards; }
  .welcome-container { animation: welcome-fade-in 0.4s ease-out forwards; }
  .pill-item { animation: slide-up 0.5s ease-out backwards; }
  .pill-item:nth-child(1) { animation-delay: 0.1s; }
  .pill-item:nth-child(2) { animation-delay: 0.15s; }
  .pill-item:nth-child(3) { animation-delay: 0.2s; }
  .pill-item:nth-child(4) { animation-delay: 0.25s; }
`;

/* ── Streaming config — VERBATIM from PurchaserChatTab ────────────────────── */
const STREAMING_CONFIG = {
  baseDelay: 18, variance: 8, sentenceDelay: 50, paragraphDelay: 100, initialDelay: 350,
};

function getWordDelay(word: string, isAfterParagraph: boolean): number {
  const base = STREAMING_CONFIG.baseDelay;
  const variance = (Math.random() * STREAMING_CONFIG.variance * 2) - STREAMING_CONFIG.variance;
  let delay = base + variance;
  if (/[.!?]$/.test(word)) delay += STREAMING_CONFIG.sentenceDelay;
  if (isAfterParagraph) delay += STREAMING_CONFIG.paragraphDelay;
  return Math.max(10, delay);
}

/* ── Format assistant response text ───────────────────────────────────────── */
function formatContent(text: string): string {
  let html = cleanForDisplay(text);
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-gray-900">$1</strong>');
  html = html.replace(/^(\d+)\.\s+/gm, '<span class="text-[#D4AF37] font-semibold mr-1">$1.</span> ');
  html = html.replace(/^[-•]\s+/gm, '<span class="text-[#D4AF37] mr-1">•</span> ');
  html = html.replace(/\n/g, '<br/>');
  return html;
}

/* ── Typing Indicator — matches Property portal ───────────────────────────── */
function TypingIndicator() {
  return (
    <div className="flex items-end gap-2 py-2 message-bubble">
      <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0">
        <Image src="/branding/openhouse-ai-logo.png" alt="" width={28} height={28} className="w-full h-full object-contain" />
      </div>
      <div className="bg-[#E9E9EB] rounded-[20px] rounded-bl-[6px] px-4 py-3">
        <div className="typing-dot dot-1 bg-gray-400" />
        <div className="typing-dot dot-2 bg-gray-400" />
        <div className="typing-dot dot-3 bg-gray-400" />
      </div>
    </div>
  );
}

/* ── Sources ──────────────────────────────────────────────────────────────── */
function Sources({ sources }: { sources?: { title: string; snippet: string }[] }) {
  const [open, setOpen] = useState(false);
  if (!sources?.length) return null;
  return (
    <div className="mt-3 transition-all duration-200">
      <button 
        onClick={() => setOpen(!open)} 
        className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-all duration-150 hover:-translate-y-0.5 focus:outline-none focus:ring-1 focus:ring-gold-500/30 rounded px-1 py-0.5"
        aria-expanded={open}
        aria-controls={`sources-list-${sources.length}`}
      >
        <Info className="w-3 h-3 transition-transform duration-200" />
        <span>{sources.length} source{sources.length > 1 ? 's' : ''}</span>
        <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div 
          id={`sources-list-${sources.length}`}
          className="mt-2 space-y-1.5 animate-[slideDown_0.2s_ease-out]"
        >
          {sources.map((s, i) => (
            <div key={i} className="flex items-start gap-1.5 text-xs text-gray-500 hover:text-gray-600 transition-colors duration-150 px-1.5 py-1 rounded hover:bg-black/[0.02]">
              <FileText className="w-3 h-3 mt-0.5 flex-shrink-0 text-[#D4AF37]" />
              <span className="font-medium">{s.title}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Types ─────────────────────────────────────────────────────────────────── */
interface Message { role: 'user' | 'assistant'; content: string; sources?: { title: string; snippet: string }[]; citation?: string; }

/* ── Pills — vary by system type ──── */
const SOLAR_PILLS = [
  'How much energy am I generating?',
  'What does the red light mean?',
  'When is my warranty up?',
  '\u25B6 Run Diagnostic',
];

const HEAT_PUMP_PILLS = [
  'Why is my bill higher this month?',
  'What\'s the noise from my heat pump?',
  'When is my warranty up?',
  '\u25B6 Run Diagnostic',
];

/* ── Citation mapping for canned quick-action prompts ── */
function citationFor(userPrompt: string): string | undefined {
  const p = userPrompt.trim().toLowerCase();
  if (p === 'how much energy am i generating?') {
    return 'Live inverter data \u00B7 Mar 14 to Apr 14, 2026';
  }
  if (p === 'what does the red light mean?') {
    return 'SolarEdge SE3680H Manual \u00B7 SE Systems support guidelines';
  }
  if (p === 'when is my warranty up?') {
    return 'Your installation record \u00B7 SE Systems standard warranty terms';
  }
  if (p === 'why is my bill higher this month?') {
    return 'Live heat pump telemetry \u00B7 ESB Networks tariff data';
  }
  if (p === "what's the noise from my heat pump?") {
    return 'Heat pump operating manual \u00B7 SE Systems support guidelines';
  }
  return undefined;
}

/* ── Citation line rendered below assistant bubbles ── */
function Citation({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <div
      className="mt-2 flex items-center gap-1.5"
      style={{ fontSize: 11, color: '#778199' }}
    >
      <Info className="h-3 w-3 flex-shrink-0" />
      <span>Based on: {text}</span>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════════════════════ */
function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMin = Math.floor((now - then) / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(dateStr).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' });
}

export default function AssistantScreen({ installationId }: { installationId: string }) {
  const { installation } = useCareApp();
  const isHeatPump = installation.system_category === 'heat_pump' || installation.system_type === 'heat_pump';
  const PILLS = isHeatPump ? HEAT_PUMP_PILLS : SOLAR_PILLS;
  const systemLabel = isHeatPump ? 'heating' : 'solar';

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [showHome, setShowHome] = useState(true);
  const [streamText, setStreamText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [conversations, setConversations] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const recognitionRef = useRef<any>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const scroll = useCallback(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), []);

  /* ── Load conversation history ── */
  useEffect(() => {
    fetch(`/api/care/conversations?installation_id=${installationId}`)
      .then(r => r.json())
      .then(data => { if (data.conversations) setConversations(data.conversations); })
      .catch(() => {});
  }, [installationId]);

  /* ── Send message ── */
  const send = useCallback(async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || sending) return;
    setShowHome(false);
    setInput('');
    setMessages(p => [...p, { role: 'user', content: msg }]);
    setSending(true);
    setStreamText('');
    setTimeout(scroll, 100);

    const citation = citationFor(msg);

    try {
      const res = await fetch('/api/care/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify({ installationId, message: msg }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const contentType = res.headers.get('content-type') || '';

      if (contentType.includes('text/event-stream') && res.body) {
        // Real SSE streaming
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let fullText = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          let currentEvent = '';
          for (const line of lines) {
            if (line.startsWith('event: ')) {
              currentEvent = line.slice(7);
            } else if (line.startsWith('data: ')) {
              const rawData = line.slice(6);
              if (currentEvent === 'token') {
                try {
                  const token = JSON.parse(rawData);
                  fullText += token;
                  setStreamText(fullText);
                  scroll();
                } catch {}
              } else if (currentEvent === 'error') {
                throw new Error('Stream error');
              }
            }
          }
        }

        setStreamText('');
        if (fullText) {
          setMessages(p => [...p, { role: 'assistant', content: fullText, citation }]);
        } else {
          setMessages(p => [...p, { role: 'assistant', content: 'Sorry, I couldn\'t process that.' }]);
        }
      } else {
        // JSON fallback
        const data = await res.json();
        const textMsg = Array.isArray(data.messages)
          ? data.messages.find((m: any) => m.message_type === 'text')
          : null;
        const full = textMsg?.content || data.response || 'Sorry, I couldn\'t process that.';
        setMessages(p => [...p, { role: 'assistant', content: full, citation }]);
      }
    } catch {
      setStreamText('');
      setMessages(p => [...p, { role: 'assistant', content: 'Sorry, something went wrong.' }]);
    }
    setSending(false);
    setTimeout(scroll, 100);
  }, [input, sending, installationId, scroll]);

  useEffect(() => { scroll(); }, [messages, scroll]);

  /* ── Speech Recognition ── */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    setSpeechSupported(true);
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-IE';
    recognition.onresult = (event: any) => {
      setInput(event.results[0][0].transcript);
      setIsListening(false);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
  }, []);

  const toggleVoiceInput = useCallback(() => {
    if (!speechSupported || !recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setIsListening(true);
      try { recognitionRef.current.start(); } catch { setIsListening(false); }
    }
  }, [speechSupported, isListening]);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white">
      <style>{ANIMATION_STYLES}</style>

      {messages.length === 0 && showHome ? (
        /* ═══ WELCOME STATE — matches Property PurchaserChatTab layout ═══ */
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-4 overflow-y-auto pb-4 welcome-container">

          {(() => {
            const tenantLogo = installation.tenants?.logo_url ?? null;
            const logoSrc = tenantLogo ?? '/branding/se-systems-logo.png';
            const logoAlt = installation.tenants?.name ?? installation.installer_name ?? 'Installer';
            // SE Systems wordmark falls back into a card to give the thin black
            // logo some weight; full-colour tenant logos render bare so the
            // brand artwork breathes.
            if (tenantLogo) {
              return (
                <div className="logo-container flex items-center justify-center" style={{ width: 200 }}>
                  <Image
                    src={logoSrc}
                    alt={logoAlt}
                    width={180}
                    height={180}
                    priority
                    style={{ width: 180, height: 'auto', objectFit: 'contain' }}
                  />
                </div>
              );
            }
            return (
              <div
                className="logo-container flex items-center justify-center"
                style={{
                  width: 180,
                  background: '#FAFAF8',
                  borderRadius: 16,
                  padding: 24,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                }}
              >
                <Image
                  src={logoSrc}
                  alt={logoAlt}
                  width={140}
                  height={42}
                  priority
                  style={{ width: 140, height: 'auto', objectFit: 'contain', filter: 'brightness(0)' }}
                />
              </div>
            );
          })()}

          {/* Headline — same text-[17px] font-semibold as Property */}
          <h1 className="mt-3 text-center text-[17px] font-semibold leading-tight text-slate-900 sm:text-lg md:text-xl">
            Ask anything about{'\n'}your {systemLabel} system
          </h1>

          {/* Subtitle — same text-[12px] as Property */}
          <p className="mt-1.5 text-center text-[12px] leading-relaxed max-w-[280px] text-slate-500 sm:max-w-sm sm:text-[13px]">
            Quick answers for daily life: performance data, troubleshooting, warranties, and more.
          </p>

          {/* 2x2 Pill Grid — EXACT same className as Property PurchaserChatTab + animations */}
          <div className="mt-4" />
          <div className="grid w-full max-w-[300px] grid-cols-2 gap-1.5 sm:max-w-sm">
            {PILLS.map((label, i) => (
              <button
                key={i}
                type="button"
                onClick={() => send(label)}
                className="pill-item flex items-center justify-center rounded-full px-2.5 py-2 text-[12px] font-medium transition-all duration-200 cursor-pointer touch-manipulation border border-slate-200 bg-white text-slate-800 shadow-sm hover:border-gold-500 hover:shadow-[0_0_10px_rgba(234,179,8,0.35)] hover:-translate-y-0.5 active:scale-95 sm:px-3 sm:py-2.5 sm:text-[13px]"
                aria-label={`Send: ${label}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        /* ═══ MESSAGES AREA ═══ */
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pt-3 pb-4 transition-all duration-300">
          <div className="mx-auto max-w-3xl flex flex-col gap-3 sm:gap-4">
            {messages.map((msg, idx) => (
              msg.role === 'user' ? (
                <div key={idx} className="flex justify-end">
                  <div className="message-bubble max-w-[75%] rounded-[20px] rounded-br-[6px] px-4 py-3 bg-[#D4AF37] text-[#1a1200] shadow-sm">
                    <p className="text-[15px] leading-[1.5] whitespace-pre-wrap break-words">{msg.content}</p>
                  </div>
                </div>
              ) : (
                <div key={idx} className="flex justify-start items-end gap-2">
                  <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0">
                    <Image src="/branding/openhouse-ai-logo.png" alt="" width={28} height={28} className="w-full h-full object-contain" />
                  </div>
                  <div className="message-bubble max-w-[80%] rounded-[20px] rounded-bl-[6px] px-4 py-3 bg-[#E9E9EB] text-gray-900 shadow-sm shadow-black/5">
                    <div className="text-[15px] leading-[1.6] whitespace-pre-wrap break-words" dangerouslySetInnerHTML={{ __html: formatContent(msg.content) }} />
                    <Citation text={msg.citation} />
                    <Sources sources={msg.sources} />
                  </div>
                </div>
              )
            ))}

            {sending && streamText && (
              <div className="flex justify-start items-end gap-2">
                <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0">
                  <Image src="/branding/openhouse-ai-logo.png" alt="" width={28} height={28} className="w-full h-full object-contain" />
                </div>
                <div className="message-bubble max-w-[80%] rounded-[20px] rounded-bl-[6px] px-4 py-3 bg-[#E9E9EB] text-gray-900 shadow-sm shadow-black/5">
                  <div className="text-[15px] leading-[1.6] whitespace-pre-wrap break-words" dangerouslySetInnerHTML={{ __html: formatContent(streamText) }} />
                </div>
              </div>
            )}

            {sending && !streamText && <TypingIndicator />}

            <div ref={endRef} className="h-px" aria-hidden="true" />
          </div>
        </div>
      )}

      {/* ═══ INPUT BAR — iMessage pill, matches Property + UX Polish ═══ */}
      <div className="flex-shrink-0 px-4 pt-3 pb-2 sm:pb-3 bg-white border-t border-black/5 transition-all duration-200">
        <div className="mx-auto flex max-w-3xl items-center gap-2 sm:gap-2.5">
          {messages.length > 0 && (
            <button
              onClick={() => { setMessages([]); setShowHome(true); }}
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-gray-500 hover:bg-black/5 hover:text-gray-700 hover:-translate-y-0.5 transition-all duration-150 active:scale-95 focus:outline-none focus:ring-2 focus:ring-gold-500/30"
              aria-label="Back to assistant welcome"
            >
              <Home className="h-5 w-5" />
            </button>
          )}
          <div className="relative">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-gray-500 hover:bg-black/5 hover:text-gray-700 hover:-translate-y-0.5 transition-all duration-150 active:scale-95 focus:outline-none focus:ring-2 focus:ring-gold-500/30"
              aria-label="Conversation history"
            >
              <Clock className="h-5 w-5" />
            </button>
            {showHistory && (
              <div className="absolute bottom-12 left-0 w-64 bg-white rounded-xl border border-slate-200 shadow-lg z-20 overflow-hidden animate-[slideDown_0.2s_ease-out]">
                <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Past Conversations</span>
                  <button onClick={() => setShowHistory(false)} className="p-0.5 rounded hover:bg-slate-100">
                    <X className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {conversations.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-4">No previous conversations.</p>
                  ) : (
                    conversations.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => {
                          setShowHistory(false);
                          // Load this conversation by navigating chat to this thread
                          setMessages([]);
                          setShowHome(false);
                          // Set conversation context so subsequent messages continue this thread
                          fetch(`/api/care/chat`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ installationId, message: '', conversation_id: c.id }),
                          }).catch(() => {});
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0"
                      >
                        <p className="text-sm text-slate-800 truncate font-medium">{c.title || 'Conversation'}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{timeAgo(c.updated_at || c.created_at)}</p>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="group flex flex-1 items-center gap-2 rounded-full px-4 py-2.5 sm:py-3 bg-black/5 shadow-[inset_0_1px_2px_rgba(0,0,0,0.04),0_1px_3px_0_rgba(0,0,0,0.05)] transition-all duration-200 hover:bg-black/[0.07] focus-within:ring-2 focus-within:ring-gold-500/30 focus-within:bg-black/[0.08]">
            <input
              type="text" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder={`Ask about your ${systemLabel} system...`}
              disabled={sending}
              className="flex-1 border-none bg-transparent text-[15px] sm:text-base placeholder:text-gray-400 focus:outline-none text-gray-900 disabled:opacity-50 transition-opacity duration-200"
            />
            {speechSupported && (
              <button
                onClick={toggleVoiceInput}
                disabled={sending}
                className={`flex h-8 w-8 items-center justify-center rounded-full transition-all duration-150 active:scale-95 disabled:opacity-50 flex-shrink-0 ${
                  isListening
                    ? 'bg-gold-500 text-white shadow-lg shadow-gold-500/30'
                    : 'text-gray-400 hover:text-gray-600 hover:bg-black/5'
                }`}
                aria-label="Voice input"
              >
                <Mic className="h-4 w-4" />
              </button>
            )}
            {input.trim() && (
              <button 
                onClick={() => send()} 
                disabled={sending} 
                className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-gold-400 to-gold-500 text-white shadow-lg shadow-gold-500/25 transition-all duration-150 hover:shadow-gold-500/40 hover:-translate-y-0.5 active:scale-95 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-gold-500/40 flex-shrink-0"
                aria-label="Send message"
              >
                <Send className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
        <p className="mt-2 text-center text-[10px] text-gray-400 sm:text-[11px]">
          Powered by AI · Information for reference only ·{' '}
          <a
            href="https://openhouseai.ie/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-gray-600 hover:no-underline"
          >
            Privacy Policy
          </a>
        </p>
      </div>
    </div>
  );
}
