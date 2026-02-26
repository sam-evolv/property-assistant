'use client';

import { useState, useRef, useEffect } from 'react';
import {
  GOLD, TEXT_1, TEXT_2, TEXT_3, SURFACE_1, SURFACE_2, BORDER, BORDER_LIGHT,
  GREEN, EASE_PREMIUM,
} from '@/lib/dev-app/design-system';
import MobileShell from '@/components/dev-app/layout/MobileShell';
import OHLogo, { ChatAvatar, OHLogoFull } from '@/components/dev-app/shared/OHLogo';
import { MicIcon, SendIcon } from '@/components/dev-app/shared/Icons';
import TypingIndicator from '@/components/dev-app/shared/TypingIndicator';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  type?: 'text' | 'unit_info' | 'action_card' | 'summary' | 'alert_list';
  structured_data?: any;
}

const SUGGESTED_PROMPTS = [
  'Show me units needing attention',
  "What's the pipeline status for Willow Brook?",
  'Any compliance items overdue?',
  "Summarise today's activity",
];

const LOG_ENTRIES = [
  { time: '10:30', action: 'Sent reminder to Unit 7 purchaser', status: 'complete' },
  { time: '09:15', action: 'Flagged compliance item for review', status: 'complete' },
  { time: 'Yesterday', action: 'Generated pipeline report', status: 'complete' },
];

export default function IntelligencePage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [view, setView] = useState<'chat' | 'log'>('chat');
  const [displayName, setDisplayName] = useState('');
  const [initialMessage, setInitialMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch user name and attention count for initial message
  useEffect(() => {
    async function fetchInitialData() {
      try {
        const [statsRes, attentionRes] = await Promise.all([
          fetch('/api/dev-app/overview/stats'),
          fetch('/api/dev-app/overview/attention'),
        ]);
        const stats = statsRes.ok ? await statsRes.json() : {};
        const attention = attentionRes.ok ? await attentionRes.json() : {};

        const name = stats.display_name || 'there';
        setDisplayName(name);

        const items = attention.items || [];
        const hour = new Date().getHours();
        const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

        if (items.length > 0) {
          const urgent = items[0];
          setInitialMessage(`${greeting} ${name}. ${items.length} item${items.length > 1 ? 's' : ''} need attention today — ${urgent.title}. Heading to site?`);
        } else {
          setInitialMessage(`${greeting} ${name}. Everything looks on track today. What would you like to check?`);
        }
      } catch {
        setDisplayName('there');
      }
    }
    fetchInitialData();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  const handleSend = async (text?: string) => {
    const messageText = text || input.trim();
    if (!messageText || sending) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText,
      type: 'text',
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setSending(true);

    try {
      const res = await fetch('/api/dev-app/intelligence/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageText }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.messages && Array.isArray(data.messages)) {
          const assistantMsgs = data.messages.map((m: any) => ({
            id: m.id || `${Date.now()}-${Math.random()}`,
            role: 'assistant' as const,
            content: m.content,
            type: m.message_type || 'text',
            structured_data: m.structured_data,
          }));
          setMessages(prev => [...prev, ...assistantMsgs]);
        }
      } else {
        setMessages(prev => [...prev, {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please try again.',
          type: 'text',
        }]);
      }
    } catch {
      setMessages(prev => [...prev, {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: 'Connection error. Please check your network and try again.',
        type: 'text',
      }]);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <MobileShell>
      {/* ── Header ── */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 30,
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          background: 'rgba(255,255,255,0.88)',
          borderBottom: `1px solid ${BORDER_LIGHT}`,
          paddingTop: 'calc(12px + env(safe-area-inset-top, 0px))',
          paddingBottom: 12,
          paddingLeft: 16,
          paddingRight: 16,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ChatAvatar size={32} />
            <h1
              style={{
                fontSize: 20,
                fontWeight: 800,
                color: TEXT_1,
                letterSpacing: '-0.03em',
                margin: 0,
              }}
            >
              Intelligence
            </h1>
          </div>

          {/* Toggle pill */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: SURFACE_2,
              borderRadius: 20,
              padding: 3,
            }}
          >
            {(['chat', 'log'] as const).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                style={{
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 11.5,
                  fontWeight: 600,
                  borderRadius: 17,
                  padding: '5px 14px',
                  background: view === v ? '#fff' : 'transparent',
                  color: view === v ? TEXT_1 : TEXT_3,
                  boxShadow: view === v ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  transition: `all 200ms ${EASE_PREMIUM}`,
                }}
              >
                {v === 'chat' ? 'Chat' : 'Log'}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ── Welcome State ── */}
      {view === 'chat' && messages.length === 0 && (
        <div
          className="da-anim-in"
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 24px',
          }}
        >
          <div className="da-anim-scale">
            <OHLogo size={48} />
          </div>
          <h2
            className="da-anim-in da-s1"
            style={{
              fontSize: 17,
              fontWeight: 700,
              color: TEXT_1,
              marginTop: 16,
              marginBottom: 0,
            }}
          >
            OpenHouse Intelligence
          </h2>
          <p
            className="da-anim-in da-s2"
            style={{
              fontSize: 13,
              color: TEXT_2,
              fontWeight: 450,
              marginTop: 6,
              marginBottom: 0,
              textAlign: 'center',
              lineHeight: 1.5,
            }}
          >
            Your on-site co-worker. Ask about any unit, check compliance,
            draft emails, and take action — all from here.
          </p>

          {/* Initial message from real data */}
          {initialMessage && (
            <div
              className="da-anim-in da-s3"
              style={{
                marginTop: 20,
                padding: '12px 16px',
                background: SURFACE_1,
                borderRadius: 14,
                border: `1px solid ${BORDER_LIGHT}`,
                fontSize: 13,
                color: TEXT_1,
                lineHeight: 1.5,
                width: '100%',
              }}
            >
              {initialMessage}
            </div>
          )}

          {/* TRY ASKING label */}
          <div
            className="da-anim-in da-s4"
            style={{
              marginTop: 28,
              marginBottom: 12,
              fontSize: 11.5,
              color: TEXT_3,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              fontWeight: 600,
            }}
          >
            TRY ASKING
          </div>

          {/* Suggestion cards */}
          <div style={{ width: '100%' }}>
            {SUGGESTED_PROMPTS.map((prompt, i) => (
              <button
                key={i}
                className={`da-press da-anim-in da-s${i + 5 > 7 ? 7 : i + 5}`}
                onClick={() => handleSend(prompt)}
                style={{
                  display: 'block',
                  width: '100%',
                  background: SURFACE_1,
                  borderRadius: 14,
                  border: 'none',
                  padding: '12px 16px',
                  fontSize: 13.5,
                  fontWeight: 500,
                  color: TEXT_1,
                  textAlign: 'left',
                  cursor: 'pointer',
                  marginBottom: 8,
                }}
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Messages State ── */}
      {view === 'chat' && messages.length > 0 && (
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          {messages.map(msg =>
            msg.role === 'user' ? (
              /* ── User message ── */
              <div
                key={msg.id}
                className="da-anim-in"
                style={{
                  alignSelf: 'flex-end',
                  maxWidth: '78%',
                  background: '#111827',
                  color: '#fff',
                  borderRadius: 20,
                  borderBottomRightRadius: 6,
                  padding: '12px 16px',
                  fontSize: 14,
                  lineHeight: 1.5,
                }}
              >
                {msg.content}
              </div>
            ) : (
              /* ── Assistant message ── */
              <div
                key={msg.id}
                className="da-anim-in"
                style={{
                  alignSelf: 'flex-start',
                  maxWidth: '85%',
                  display: 'flex',
                  gap: 8,
                  alignItems: 'flex-start',
                }}
              >
                <div style={{ flexShrink: 0, paddingTop: 2 }}>
                  <OHLogo size={26} />
                </div>
                <div
                  style={{
                    background: '#f9fafb',
                    borderRadius: 20,
                    borderBottomLeftRadius: 6,
                    border: '1px solid #f3f4f6',
                    padding: '12px 16px',
                    fontSize: 14,
                    color: '#111827',
                    lineHeight: 1.5,
                  }}
                >
                  {msg.content}
                </div>
              </div>
            )
          )}

          {sending && <TypingIndicator />}

          <div ref={messagesEndRef} />
        </div>
      )}

      {/* ── Log view ── */}
      {view === 'log' && (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <h2
            style={{
              fontSize: 17,
              fontWeight: 700,
              color: TEXT_1,
              padding: 20,
              margin: 0,
            }}
          >
            Action Log
          </h2>
          {LOG_ENTRIES.map((entry, i) => (
            <div
              key={i}
              className={`da-anim-in da-s${i + 1}`}
              style={{
                padding: '14px 20px',
                borderBottom: `1px solid ${BORDER_LIGHT}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontSize: 11, color: TEXT_3 }}>{entry.time}</div>
                <div
                  style={{
                    fontSize: 13.5,
                    fontWeight: 500,
                    color: TEXT_1,
                    marginTop: 2,
                  }}
                >
                  {entry.action}
                </div>
              </div>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke={GREEN}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          ))}
        </div>
      )}

      {/* ── Input bar — ALWAYS visible in chat mode ── */}
      {view === 'chat' && (
        <div
          style={{
            padding: '12px 16px',
            paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
            background: '#fff',
            borderTop: `1px solid ${BORDER_LIGHT}`,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything..."
            style={{
              flex: 1,
              height: 44,
              background: SURFACE_1,
              borderRadius: 24,
              border: `1px solid ${BORDER}`,
              padding: '0 16px',
              fontSize: 14,
              color: TEXT_1,
              outline: 'none',
            }}
          />
          <button
            className="da-press"
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              background: 'transparent',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <MicIcon />
          </button>
          <button
            className="da-press"
            onClick={() => handleSend()}
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              background: GOLD,
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
              boxShadow: '0 2px 8px rgba(212,175,55,0.3)',
              opacity: 1,
            }}
          >
            <SendIcon />
          </button>
        </div>
      )}
    </MobileShell>
  );
}
