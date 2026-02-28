'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Home, Send, Info, ChevronDown, ChevronUp, FileText } from 'lucide-react';
import Image from 'next/image';
import { cleanForDisplay } from '@/lib/assistant/formatting';

// ─── Animation Styles ────────────────────────────────────────────────────────
// Copied exactly from PurchaserChatTab – dot-bounce, logo-float, message-fade-in,
// toastSlideIn, typing-dot CSS classes
const ANIMATION_STYLES = `
  @keyframes dot-bounce {
    0%, 60%, 100% {
      opacity: 0.3;
      transform: translateY(0);
    }
    30% {
      opacity: 1;
      transform: translateY(-8px);
    }
  }
  @keyframes logo-float {
    0%, 100% {
      transform: translateY(0px);
    }
    50% {
      transform: translateY(-12px);
    }
  }
  @keyframes message-fade-in {
    0% {
      opacity: 0;
      transform: translateY(8px);
    }
    100% {
      opacity: 1;
      transform: translateY(0);
    }
  }
  @keyframes toastSlideIn {
    from { opacity: 0; transform: translateX(-50%) translateY(-10px); }
    to { opacity: 1; transform: translateX(-50%) translateY(0); }
  }
  .typing-dot {
    animation: dot-bounce 1.4s infinite;
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    margin: 0 2px;
  }
  .dot-1 { animation-delay: 0s; }
  .dot-2 { animation-delay: 0.2s; }
  .dot-3 { animation-delay: 0.4s; }
  .logo-container {
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  .logo-container:hover {
    animation: logo-float 2s ease-in-out infinite;
  }
  .message-bubble {
    animation: message-fade-in 0.3s ease-out forwards;
  }
`;

const TYPING_STYLES = ANIMATION_STYLES;

// ─── Streaming Config ────────────────────────────────────────────────────────
// Exact same values as PurchaserChatTab
const STREAMING_CONFIG = {
  baseDelay: 18,           // Base delay between words (ms)
  variance: 8,             // Random variance +/- (ms)
  sentenceDelay: 50,       // Extra delay after . ! ?
  paragraphDelay: 100,     // Extra delay after paragraph breaks
  initialDelay: 350,       // Delay before text starts appearing (thinking time)
};

// ─── getWordDelay ────────────────────────────────────────────────────────────
// Helper to calculate delay for natural text cadence
function getWordDelay(word: string, isAfterParagraph: boolean): number {
  const base = STREAMING_CONFIG.baseDelay;
  const variance = (Math.random() * STREAMING_CONFIG.variance * 2) - STREAMING_CONFIG.variance;
  let delay = base + variance;

  // Add extra pause after sentence-ending punctuation
  if (/[.!?]$/.test(word)) {
    delay += STREAMING_CONFIG.sentenceDelay;
  }

  // Add extra pause after paragraph breaks
  if (isAfterParagraph) {
    delay += STREAMING_CONFIG.paragraphDelay;
  }

  return Math.max(10, delay);
}

// ─── formatAssistantContent ──────────────────────────────────────────────────
// Full HTML formatting with headings, lists, links, phone numbers, emails,
// smart typography, prices, measurements, percentages, dates.
// Copied exactly from PurchaserChatTab.
function formatAssistantContent(content: string, isDarkMode: boolean): string {
  if (!content) return '';

  // Escape HTML to prevent XSS
  let html = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Style lines that end with a colon as bold headings (e.g., "Walls:" or "Important:")
  html = html.replace(/^([A-Z][^:\n]{0,50}:)\s*$/gm, (match, heading) => {
    return `<strong class="block mt-3 mb-1 text-[15px] font-semibold">${heading}</strong>`;
  });

  // Also style inline headings that start a paragraph (e.g., "Walls: The walls are...")
  html = html.replace(/^([A-Z][^:\n]{0,50}:)(\s+\S)/gm, (match, heading, rest) => {
    return `<strong class="font-semibold">${heading}</strong>${rest}`;
  });

  // Style list items with proper indentation and bullet styling
  html = html.replace(/^- (.+)$/gm, (match, item) => {
    return `<div class="flex items-start gap-2 ml-1 my-1"><span class="text-gold-500 select-none shrink-0 mt-[2px]">\u2022</span><span class="flex-1">${item}</span></div>`;
  });

  // Style numbered lists with proper alignment for multi-line items
  html = html.replace(/^(\d+)\.\s+(.+)$/gm, (match, num, item) => {
    return `<div class="flex items-start gap-2 ml-1 my-1"><span class="text-gold-500 font-medium select-none shrink-0 min-w-[1.25rem] mt-[1px]">${num}.</span><span class="flex-1">${item}</span></div>`;
  });

  // Make URLs clickable (but keep them clean-looking)
  html = html.replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-gold-500 hover:text-gold-400 underline underline-offset-2">$1</a>'
  );

  // Make phone numbers clickable (Irish and international formats)
  html = html.replace(
    /(\+\d{1,3}[\s-]?\d{2,4}[\s-]?\d{3,4}[\s-]?\d{3,4}|\b0\d{2,4}[\s-]?\d{3,4}[\s-]?\d{3,4}\b)/g,
    (match) => {
      const cleanNumber = match.replace(/[\s-]/g, '');
      return `<a href="tel:${cleanNumber}" class="text-gold-500 hover:text-gold-400 underline underline-offset-2">${match}</a>`;
    }
  );

  // Make email addresses clickable
  html = html.replace(
    /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
    '<a href="mailto:$1" class="text-gold-500 hover:text-gold-400 underline underline-offset-2">$1</a>'
  );

  // Smart typography - convert straight quotes to curly quotes
  html = html.replace(/(\s|^)"([^"]+)"(\s|$|[.,!?])/g, '$1\u201C$2\u201D$3');
  html = html.replace(/(\s|^)'([^']+)'(\s|$|[.,!?])/g, '$1\u2018$2\u2019$3');
  html = html.replace(/(\w)'(\w)/g, '$1\u2019$2');
  html = html.replace(/--/g, '\u2013');
  html = html.replace(/\.\.\./g, '\u2026');

  // Highlight important numbers - prices, measurements, percentages
  // Prices
  html = html.replace(
    /([€£$]\d{1,3}(?:,\d{3})*(?:\.\d{2})?|\d{1,3}(?:,\d{3})*(?:\.\d{2})?\s*(?:euro|EUR|pounds?|GBP))/gi,
    '<span class="font-semibold text-gold-600">$1</span>'
  );
  // Measurements
  html = html.replace(
    /(\d+(?:\.\d+)?\s*(?:m²|sq\.?\s*(?:ft|m|metres?|meters?)|sqm|square\s+(?:feet|metres?|meters?)|hectares?|ha|acres?|kWh?|kWp|watts?))/gi,
    '<span class="font-medium">$1</span>'
  );
  // Percentages
  html = html.replace(
    /(\d+(?:\.\d+)?%)/g,
    '<span class="font-medium">$1</span>'
  );
  // Dates
  html = html.replace(
    /(\d{1,2}(?:st|nd|rd|th)?\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{4})/gi,
    '<span class="font-medium">$1</span>'
  );

  // Convert newlines to proper breaks (preserve paragraph structure)
  html = html.replace(/\n\n/g, '</p><p class="mt-3">');
  html = html.replace(/\n/g, '<br/>');

  // Wrap in paragraph
  html = `<p>${html}</p>`;

  // Clean up empty paragraphs
  html = html.replace(/<p class="mt-3"><\/p>/g, '');
  html = html.replace(/<p><\/p>/g, '');

  return html;
}

// ─── TypingIndicator ─────────────────────────────────────────────────────────
// 3 bouncing dots – identical to PurchaserChatTab
const TypingIndicator = ({ isDarkMode }: { isDarkMode: boolean }) => (
  <div className="flex justify-start">
    <style>{TYPING_STYLES}</style>
    <div
      className={`rounded-[20px] rounded-bl-[6px] px-4 py-2.5 shadow-sm ${
        isDarkMode
          ? 'bg-[#1A1A1A] shadow-black/20'
          : 'bg-[#E9E9EB] shadow-black/5'
      }`}
    >
      <div className="flex items-center gap-1">
        <div className={`typing-dot dot-1 ${isDarkMode ? 'bg-[#808080]' : 'bg-gray-400'}`} />
        <div className={`typing-dot dot-2 ${isDarkMode ? 'bg-[#808080]' : 'bg-gray-400'}`} />
        <div className={`typing-dot dot-3 ${isDarkMode ? 'bg-[#808080]' : 'bg-gray-400'}`} />
      </div>
    </div>
  </div>
);

// ─── SourcesDropdown ─────────────────────────────────────────────────────────
// Collapsible sources panel – identical to PurchaserChatTab
const SourcesDropdown = ({
  sources,
  isDarkMode,
}: {
  sources: Array<{ title: string; type: string; excerpt: string }>;
  isDarkMode: boolean;
}) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!sources || sources.length === 0) return null;

  return (
    <div className="mt-2">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1 text-xs transition-colors ${
          isDarkMode
            ? 'text-gray-500 hover:text-gray-400'
            : 'text-gray-400 hover:text-gray-600'
        }`}
      >
        <Info className="h-3 w-3" />
        <span>Sources</span>
        {isOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>

      {isOpen && (
        <div
          className={`mt-2 rounded-lg border p-2 text-xs ${
            isDarkMode
              ? 'border-[#2A2A2A] bg-[#1A1A1A]'
              : 'border-gray-200 bg-gray-50'
          }`}
        >
          <p className={`mb-1 font-medium ${isDarkMode ? 'text-[#B0B0B0]' : 'text-gray-500'}`}>
            Based on:
          </p>
          <ul className="space-y-1">
            {sources.map((source, idx) => (
              <li
                key={idx}
                className={`flex items-start gap-1.5 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}
              >
                <FileText className="h-3 w-3 mt-0.5 flex-shrink-0" />
                <span>
                  {source.title}
                  {source.type && (
                    <span className={isDarkMode ? 'text-gray-500' : 'text-gray-400'}>
                      {' '}({source.type})
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

// ─── Interfaces ──────────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: Array<{ title: string; type: string; excerpt: string }>;
  isStreaming?: boolean;
  followUps?: string[];
}

interface AssistantScreenProps {
  installationId: string;
  systemType?: string;
  isDarkMode?: boolean;
}

// ─── Suggested Prompts for Care ──────────────────────────────────────────────

const CARE_PROMPTS = [
  { label: 'How much energy am I generating?', category: 'Performance' },
  { label: 'What does the red light mean?', category: 'Troubleshooting' },
  { label: 'When is my warranty up?', category: 'Warranty' },
  { label: 'How do I read my inverter?', category: 'Guides' },
];

// ─── Main Component ──────────────────────────────────────────────────────────

export default function AssistantScreen({
  installationId,
  systemType,
  isDarkMode = false,
}: AssistantScreenProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [showHome, setShowHome] = useState(true);

  // Streaming display state
  const typingAbortRef = useRef<boolean>(false);
  const streamingMessageIndexRef = useRef<number>(-1);

  // Scroll refs
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isInitialLoad = useRef(true);
  const userScrolledUp = useRef(false);
  const inputBarRef = useRef<HTMLDivElement>(null);

  // Generate unique message IDs
  const generateId = () => `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  // ─── Input bar height CSS var ────────────────────────────────────────────
  useEffect(() => {
    const el = inputBarRef.current;
    if (!el) return;

    const updateHeight = () => {
      const height = el.offsetHeight;
      document.documentElement.style.setProperty('--care-inputbar-h', `${height}px`);
    };

    const ro = new ResizeObserver(updateHeight);
    ro.observe(el);
    updateHeight();

    return () => ro.disconnect();
  }, []);

  // ─── Track user scroll ───────────────────────────────────────────────────
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const threshold = 100;
      const isAtBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
      userScrolledUp.current = !isAtBottom;
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [showHome, messages.length > 0]);

  // ─── scrollToBottom helper ───────────────────────────────────────────────
  const scrollToBottom = useCallback((smooth = true) => {
    const container = scrollContainerRef.current;
    if (!container) return;

    requestAnimationFrame(() => {
      if (smooth) {
        container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
      } else {
        container.scrollTop = container.scrollHeight;
      }
    });
  }, []);

  // ─── Scroll on new messages / sending ────────────────────────────────────
  useEffect(() => {
    if ((messages.length > 0 || sending) && scrollContainerRef.current) {
      if (sending || isInitialLoad.current || !userScrolledUp.current) {
        scrollToBottom(!isInitialLoad.current);
        if (sending) {
          userScrolledUp.current = false;
        }
      }
      if (isInitialLoad.current) {
        isInitialLoad.current = false;
      }
    }
  }, [messages.length, sending, scrollToBottom]);

  // Auto-scroll during streaming (when last message content updates)
  const lastMessage = messages[messages.length - 1];
  const lastMessageContent = lastMessage?.content || '';
  useEffect(() => {
    if (
      scrollContainerRef.current &&
      lastMessage?.role === 'assistant' &&
      !userScrolledUp.current
    ) {
      scrollToBottom(true);
    }
  }, [lastMessageContent, scrollToBottom]);

  // ─── displayTextWithDelay (word-by-word streaming) ───────────────────────
  const displayTextWithDelay = useCallback(
    async (fullText: string, messageIndex: number) => {
      typingAbortRef.current = false;

      const sanitizedText = cleanForDisplay(fullText);

      // Initial thinking delay
      await new Promise((resolve) => setTimeout(resolve, STREAMING_CONFIG.initialDelay));

      if (typingAbortRef.current) return;

      const words = sanitizedText.split(/(\s+)/);
      let displayed = '';
      let prevWasParagraph = false;

      for (let i = 0; i < words.length; i++) {
        if (typingAbortRef.current) break;

        const word = words[i];
        displayed += word;

        setMessages((prev) => {
          const updated = [...prev];
          if (messageIndex >= 0 && updated[messageIndex]) {
            updated[messageIndex] = {
              ...updated[messageIndex],
              content: displayed,
            };
          }
          return updated;
        });

        if (word.trim()) {
          const delay = getWordDelay(word, prevWasParagraph);
          await new Promise((resolve) => setTimeout(resolve, delay));
          prevWasParagraph = false;
        } else if (word.includes('\n\n')) {
          prevWasParagraph = true;
        }
      }
    },
    [],
  );

  // ─── sendMessage ─────────────────────────────────────────────────────────
  const sendMessage = async (messageText?: string) => {
    const textToSend = messageText || input.trim();
    if (!textToSend || sending) return;

    if (showHome) {
      setShowHome(false);
    }

    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content: textToSend,
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setSending(true);

    // Haptic feedback on send (mobile)
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(15);
    }

    try {
      // Build history for context
      const history = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch('/api/care/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend,
          installationId,
          history,
        }),
      });

      const contentType = res.headers.get('content-type') || '';

      // ── Handle SSE streaming response ──
      if (contentType.includes('text/event-stream')) {
        const reader = res.body?.getReader();
        if (!reader) throw new Error('No reader available');

        const decoder = new TextDecoder();
        let streamedContent = '';
        let sources: Array<{ title: string; type: string; excerpt: string }> | null = null;
        let followUps: string[] | null = null;
        let assistantMessageIndex = -1;

        // Add placeholder assistant message immediately
        setMessages((prev) => {
          assistantMessageIndex = prev.length;
          streamingMessageIndexRef.current = assistantMessageIndex;
          return [
            ...prev,
            {
              id: generateId(),
              role: 'assistant',
              content: '',
              isStreaming: true,
            },
          ];
        });

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));

                if (data.type === 'token' || data.type === 'text') {
                  // IMMEDIATE DISPLAY: Show text as it arrives
                  streamedContent += data.content || data.token || '';
                  const displayContent = cleanForDisplay(streamedContent);
                  setMessages((prev) => {
                    const updated = [...prev];
                    if (assistantMessageIndex >= 0 && updated[assistantMessageIndex]) {
                      updated[assistantMessageIndex] = {
                        ...updated[assistantMessageIndex],
                        content: displayContent,
                        isStreaming: true,
                      };
                    }
                    return updated;
                  });
                } else if (data.type === 'sources') {
                  sources = data.sources || null;
                } else if (data.type === 'followups' || data.type === 'follow_ups') {
                  followUps = data.followUps || data.follow_ups || null;
                } else if (data.type === 'done') {
                  // Finalize message
                  if (data.sources) sources = data.sources;
                  if (data.followUps || data.follow_ups) {
                    followUps = data.followUps || data.follow_ups;
                  }

                  setMessages((prev) => {
                    const updated = [...prev];
                    if (assistantMessageIndex >= 0 && updated[assistantMessageIndex]) {
                      updated[assistantMessageIndex] = {
                        ...updated[assistantMessageIndex],
                        content: cleanForDisplay(streamedContent),
                        sources: sources || undefined,
                        followUps: followUps || undefined,
                        isStreaming: false,
                      };
                    }
                    return updated;
                  });
                } else if (data.type === 'error') {
                  setMessages((prev) => {
                    const updated = [...prev];
                    if (assistantMessageIndex >= 0 && updated[assistantMessageIndex]) {
                      updated[assistantMessageIndex] = {
                        ...updated[assistantMessageIndex],
                        content: 'Sorry, I encountered an error. Please try again.',
                        isStreaming: false,
                      };
                    }
                    return updated;
                  });
                }
              } catch {
                // Ignore parse errors for incomplete chunks
              }
            }
          }
        }
      } else {
        // ── Handle non-streaming JSON response ──
        const data = await res.json();

        if (data.answer || data.content) {
          const rawAnswer = data.answer || data.content;
          const sanitizedAnswer = cleanForDisplay(rawAnswer);

          setMessages((prev) => [
            ...prev,
            {
              id: generateId(),
              role: 'assistant',
              content: sanitizedAnswer,
              sources: data.sources || undefined,
              followUps: data.followUps || data.follow_ups || undefined,
            },
          ]);
        } else if (data.error) {
          setMessages((prev) => [
            ...prev,
            {
              id: generateId(),
              role: 'assistant',
              content: 'Sorry, I encountered an error. Please try again.',
            },
          ]);
        }
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      setMessages((prev) => [
        ...prev,
        {
          id: generateId(),
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please try again.',
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  // ─── Handlers ────────────────────────────────────────────────────────────

  const handleQuickPrompt = (prompt: string) => {
    sendMessage(prompt);
  };

  const handleHomeClick = () => {
    setShowHome(true);
    setMessages([]);
  };

  const handleFollowUp = (text: string) => {
    sendMessage(text);
  };

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className={`flex flex-col h-full min-h-0 overflow-hidden ${isDarkMode ? 'bg-[#0F0F0F]' : 'bg-white'}`}>
      {/* CONTENT AREA - Either home screen or messages */}
      {messages.length === 0 && showHome ? (
        /* ── HOME SCREEN ── */
        <div
          className="flex-1 min-h-0 flex flex-col items-center justify-center px-4 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]"
          style={{
            paddingBottom: 'calc(var(--care-inputbar-h, 88px) + 24px)',
          }}
        >
          <style>{ANIMATION_STYLES}</style>

          {/* OpenHouse Care Logo — gold circle with icon */}
          <div
            className={`logo-container ${
              isDarkMode
                ? 'drop-shadow-[0_0_35px_rgba(245,158,11,0.25)]'
                : 'drop-shadow-[0_8px_32px_rgba(0,0,0,0.12)]'
            }`}
          >
            <div
              className="flex items-center justify-center rounded-full"
              style={{
                width: 80,
                height: 80,
                background: 'linear-gradient(135deg, rgba(212,175,55,0.2), rgba(184,147,76,0.1))',
                border: '2px solid rgba(212,175,55,0.3)',
              }}
            >
              <Image
                src="/icon-192.png"
                alt="OpenHouse AI"
                width={48}
                height={48}
                className="rounded-full"
              />
            </div>
          </div>

          {/* Welcome Headline */}
          <h1
            className={`mt-5 text-center text-[17px] font-semibold leading-tight ${
              isDarkMode ? 'text-white' : 'text-slate-900'
            }`}
          >
            Ask me anything about
            <span className="block">your solar system</span>
          </h1>

          {/* Subtitle */}
          <p
            className={`mt-1.5 text-center text-[12px] leading-relaxed max-w-[280px] ${
              isDarkMode ? 'text-[#B0B0B0]' : 'text-slate-500'
            }`}
          >
            I can help with performance data, troubleshooting, warranties, and more.
          </p>

          {/* 2x2 Prompt Grid */}
          <div className="mt-4" />
          <div className="grid w-full max-w-[300px] grid-cols-2 gap-1.5">
            {CARE_PROMPTS.map((prompt, i) => (
              <button
                key={i}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleQuickPrompt(prompt.label);
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  handleQuickPrompt(prompt.label);
                }}
                className={`flex flex-col items-center justify-center rounded-full px-2.5 py-2 text-[12px] font-medium transition-all duration-200 cursor-pointer touch-manipulation ${
                  isDarkMode
                    ? 'border border-[#2A2A2A] bg-[#1A1A1A] text-[#E0E0E0] hover:border-[#D4AF37] hover:bg-[#252525] hover:shadow-[0_0_10px_rgba(212,175,55,0.3)] active:scale-95'
                    : 'border border-slate-200 bg-white text-slate-800 shadow-sm hover:border-gold-500 hover:shadow-[0_0_10px_rgba(234,179,8,0.35)] active:scale-95'
                }`}
                title={prompt.category}
              >
                {prompt.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        /* ── MESSAGES AREA ── */
        <div
          ref={scrollContainerRef}
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch] px-4 pt-3"
          style={{
            paddingBottom: 'calc(var(--care-inputbar-h, 88px) + 24px)',
            overflowAnchor: 'auto',
            overscrollBehaviorY: 'contain',
          }}
        >
          <div className="mx-auto max-w-3xl flex flex-col gap-4">
            {messages.map((msg, idx) => {
              if (msg.role === 'user') {
                return (
                  <div key={msg.id} className="flex justify-end">
                    {/* User bubble - gold gradient, asymmetric rounded (iMessage style) */}
                    <div
                      className="message-bubble max-w-[75%] rounded-[20px] rounded-br-[6px] px-4 py-3 shadow-sm"
                      style={{
                        background:
                          'linear-gradient(135deg, rgba(212,175,55,0.15), rgba(184,147,76,0.08))',
                      }}
                    >
                      <p
                        className={`text-[15px] leading-[1.5] whitespace-pre-wrap break-words ${
                          isDarkMode ? 'text-white' : 'text-gray-900'
                        }`}
                      >
                        {msg.content}
                      </p>
                    </div>
                  </div>
                );
              }

              // Skip rendering empty assistant messages (placeholder during typing indicator)
              if (!msg.content) {
                return null;
              }

              return (
                <div key={msg.id} className="flex justify-start gap-2.5 items-end">
                  {/* Assistant avatar — gold-tinted circle with OpenHouse logo */}
                  <div
                    className="flex-shrink-0 flex items-center justify-center rounded-full mb-1"
                    style={{
                      width: 28,
                      height: 28,
                      background:
                        'linear-gradient(135deg, rgba(212,175,55,0.2), rgba(184,147,76,0.1))',
                      border: '1px solid rgba(212,175,55,0.25)',
                    }}
                  >
                    <Image
                      src="/icon-192.png"
                      alt="OpenHouse AI"
                      width={18}
                      height={18}
                      className="rounded-full"
                    />
                  </div>

                  {/* Assistant bubble - gray bg, asymmetric rounded (iMessage style) */}
                  <div
                    className={`message-bubble max-w-[80%] rounded-[20px] rounded-bl-[6px] px-4 py-3 shadow-sm relative ${
                      isDarkMode
                        ? 'bg-[#1A1A1A] text-white shadow-black/20'
                        : 'bg-[#E9E9EB] text-gray-900 shadow-black/5'
                    }`}
                  >
                    <div
                      className="text-[15px] leading-[1.6] whitespace-pre-wrap break-words assistant-content"
                      dangerouslySetInnerHTML={{
                        __html: formatAssistantContent(msg.content, isDarkMode),
                      }}
                    />

                    {/* Sources dropdown */}
                    {msg.sources && msg.sources.length > 0 && (
                      <SourcesDropdown sources={msg.sources} isDarkMode={isDarkMode} />
                    )}
                  </div>
                </div>
              );
            })}

            {/* Follow-up suggestion pills after last assistant message */}
            {!sending &&
              messages.length > 0 &&
              messages[messages.length - 1]?.role === 'assistant' &&
              messages[messages.length - 1]?.followUps &&
              (messages[messages.length - 1].followUps?.length ?? 0) > 0 && (
                <div className="flex flex-wrap gap-2 ml-[38px]">
                  {messages[messages.length - 1].followUps!.map((followUp, i) => (
                    <button
                      key={i}
                      onClick={() => handleFollowUp(followUp)}
                      className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition-all duration-200 active:scale-95 ${
                        isDarkMode
                          ? 'border border-[#2A2A2A] bg-[#1A1A1A] text-[#E0E0E0] hover:border-[#D4AF37] hover:bg-[#252525]'
                          : 'border border-slate-200 bg-white text-slate-700 shadow-sm hover:border-gold-500 hover:shadow-[0_0_8px_rgba(234,179,8,0.25)]'
                      }`}
                    >
                      {followUp}
                    </button>
                  ))}
                </div>
              )}

            {/* Typing indicator while waiting for response */}
            {sending && <TypingIndicator isDarkMode={isDarkMode} />}

            {/* Scroll anchor */}
            <div ref={messagesEndRef} style={{ height: '1px', width: '100%' }} aria-hidden="true" />
          </div>
        </div>
      )}

      {/* ── INPUT BAR ── Fixed above bottom, glass feel */}
      <div
        ref={inputBarRef}
        className={`fixed left-0 right-0 z-[60] px-4 pt-3 pb-2 ${
          isDarkMode
            ? 'bg-[#0F0F0F]/97 backdrop-blur-xl border-t border-[#2A2A2A]/50'
            : 'bg-white/95 backdrop-blur-xl border-t border-black/5'
        }`}
        style={{
          bottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        <div className="mx-auto flex max-w-3xl items-center gap-2">
          {/* Home button - only show when in chat mode */}
          {messages.length > 0 && (
            <button
              onClick={handleHomeClick}
              className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full transition-all duration-150 active:scale-95 ${
                isDarkMode
                  ? 'text-gray-400 hover:bg-white/10 hover:text-gray-200'
                  : 'text-gray-500 hover:bg-black/5 hover:text-gray-700'
              }`}
              aria-label="Back to home"
            >
              <Home className="h-5 w-5" />
            </button>
          )}

          {/* Input pill container - iMessage inspired */}
          <div
            className={`flex flex-1 items-center gap-2 rounded-full px-4 py-2.5 transition-all duration-200 ${
              isDarkMode
                ? 'bg-[#1A1A1A] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04),0_1px_3px_0_rgba(0,0,0,0.12)]'
                : 'bg-black/5 shadow-[inset_0_1px_0_0_rgba(0,0,0,0.02),0_1px_3px_0_rgba(0,0,0,0.05)]'
            }`}
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Ask about your solar system..."
              disabled={sending}
              className={`flex-1 border-none bg-transparent text-[15px] placeholder:text-gray-400 focus:outline-none ${
                isDarkMode ? 'text-white' : 'text-gray-900'
              }`}
            />

            {input.trim() && (
              <button
                onClick={() => sendMessage()}
                disabled={sending}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-gold-400 to-gold-500 text-white shadow-lg shadow-gold-500/25 transition-all duration-150 hover:shadow-gold-500/40 active:scale-95 disabled:opacity-50"
                aria-label="Send message"
              >
                <Send className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Powered by footer */}
        <p
          className={`mt-2 text-center text-[10px] leading-tight ${
            isDarkMode ? 'text-[#808080]' : 'text-gray-400'
          }`}
        >
          Powered by OpenHouse AI
        </p>
      </div>
    </div>
  );
}
