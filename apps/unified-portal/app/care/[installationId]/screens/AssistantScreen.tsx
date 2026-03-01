'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Home, Send, Info, ChevronDown, ChevronUp, FileText } from 'lucide-react';
import Image from 'next/image';
import { cleanForDisplay } from '@/lib/assistant/formatting';

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
interface Message { role: 'user' | 'assistant'; content: string; sources?: { title: string; snippet: string }[]; }

/* ── Pills — 4 solar-specific prompts, "Run Diagnostic" always present ──── */
const PILLS = [
  'How much energy am I generating?',
  'What does the red light mean?',
  'When is my warranty up?',
  '▶ Run Diagnostic',
];

/* ══════════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════════════════════ */
export default function AssistantScreen({ installationId }: { installationId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [showHome, setShowHome] = useState(true);
  const [streamText, setStreamText] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  const scroll = useCallback(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), []);

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

    try {
      const res = await fetch('/api/care/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ installation_id: installationId, message: msg }),
      });
      const data = await res.json();
      const full = data.response || 'Sorry, I couldn\'t process that.';
      const sources = data.sources || [];

      // Word-by-word streaming
      const words = full.split(' ');
      let shown = '';
      for (let i = 0; i < words.length; i++) {
        const afterParagraph = i > 0 && words[i - 1].includes('\n');
        await new Promise(r => setTimeout(r, getWordDelay(words[i], afterParagraph)));
        shown += (i > 0 ? ' ' : '') + words[i];
        setStreamText(shown);
      }

      setStreamText('');
      setMessages(p => [...p, { role: 'assistant', content: full, sources }]);
    } catch {
      setStreamText('');
      setMessages(p => [...p, { role: 'assistant', content: 'Sorry, something went wrong.' }]);
    }
    setSending(false);
    setTimeout(scroll, 100);
  }, [input, sending, installationId, scroll]);

  useEffect(() => { scroll(); }, [messages, scroll]);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white">
      <style>{ANIMATION_STYLES}</style>

      {messages.length === 0 && showHome ? (
        /* ═══ WELCOME STATE — matches Property PurchaserChatTab layout ═══ */
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-4 overflow-y-auto pb-4 welcome-container">

          {/* Logo — transparent PNG, same size as Property (h-[147px]) */}
          <div className="logo-container drop-shadow-[0_8px_32px_rgba(0,0,0,0.12)]">
            <Image
              src="/branding/openhouse-ai-logo.png"
              alt="OpenHouse AI"
              width={147}
              height={147}
              className="h-[120px] w-auto object-contain"
            />
          </div>

          {/* Headline — same text-[17px] font-semibold as Property */}
          <h1 className="mt-3 text-center text-[17px] font-semibold leading-tight text-slate-900 sm:text-lg md:text-xl">
            Ask anything about{'\n'}your solar system
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
                  <div className="message-bubble max-w-[75%] rounded-[20px] rounded-br-[6px] px-4 py-3 bg-gradient-to-br from-gold-400 to-gold-500 text-white shadow-sm shadow-gold-500/20">
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
          <div className="group flex flex-1 items-center gap-2 rounded-full px-4 py-2.5 sm:py-3 bg-black/5 shadow-[inset_0_1px_0_0_rgba(0,0,0,0.02),0_1px_3px_0_rgba(0,0,0,0.05)] transition-all duration-200 hover:bg-black/[0.07] focus-within:ring-2 focus-within:ring-gold-500/30 focus-within:bg-black/[0.08]">
            <input
              type="text" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Ask about your solar system..."
              disabled={sending}
              className="flex-1 border-none bg-transparent text-[15px] sm:text-base placeholder:text-gray-400 focus:outline-none text-gray-900 disabled:opacity-50 transition-opacity duration-200"
            />
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
        <p className="mt-2 text-center text-[10px] text-gray-400 sm:text-[11px]">Powered by AI · Information for reference only</p>
      </div>
    </div>
  );
}
