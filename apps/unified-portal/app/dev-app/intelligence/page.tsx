'use client';

import { useState, useRef, useEffect } from 'react';
import {
  GOLD, GOLD_LIGHT, TEXT_1, TEXT_2, TEXT_3, SURFACE_1, SURFACE_2, BORDER, BORDER_LIGHT,
  RED, AMBER, GREEN, BLUE, GREEN_BG, BLUE_BG, AMBER_BG, RED_BG, EASE_PREMIUM,
  SECTORS, type Sector
} from '@/lib/dev-app/design-system';
import MobileShell from '@/components/dev-app/layout/MobileShell';
import { ChatAvatar } from '@/components/dev-app/shared/OHLogo';
import { MicIcon, SendIcon } from '@/components/dev-app/shared/Icons';
import TypingIndicator from '@/components/dev-app/shared/TypingIndicator';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  type?: 'text' | 'unit_info' | 'action_card' | 'summary';
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

function getAssistantResponse(content: string): string {
  const lower = content.toLowerCase();
  if (lower.includes('attention') || lower.includes('needing')) {
    return 'There are 3 units currently needing attention across your developments. Unit 22 at Willow Brook has the most urgent mortgage approval expiring in 2 days.';
  }
  if (lower.includes('pipeline') || lower.includes('willow')) {
    return 'Willow Brook pipeline: 28 of 45 units sold (62%). 12 are in active stages. Key focus: Units 18 and 22 have mortgage approvals pending over 28 days.';
  }
  if (lower.includes('compliance')) {
    return 'Overall compliance is at 89%. 4 items are overdue — mainly BCMS submissions for Willow Brook Units 22-26. I\'d recommend prioritising these today.';
  }
  return 'I\'ve checked across your developments. Everything looks on track. Would you like me to drill into any specific development or unit?';
}

export default function IntelligencePage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [view, setView] = useState<'chat' | 'log'>('chat');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  const handleSend = (text?: string) => {
    const messageText = text || input.trim();
    if (!messageText) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText,
      type: 'text',
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setSending(true);

    setTimeout(() => {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: getAssistantResponse(messageText),
        type: 'text',
      };
      setMessages(prev => [...prev, assistantMessage]);
      setSending(false);
    }, 1500);
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
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          background: 'rgba(255,255,255,0.82)',
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
          {/* Left: avatar + title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ChatAvatar size={28} />
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

          {/* Right: toggle pill */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: SURFACE_2,
              borderRadius: 20,
              padding: 3,
            }}
          >
            <button
              onClick={() => setView('chat')}
              style={{
                border: 'none',
                cursor: 'pointer',
                fontSize: 11.5,
                fontWeight: 600,
                borderRadius: 17,
                padding: '5px 14px',
                background: view === 'chat' ? '#fff' : 'transparent',
                color: view === 'chat' ? TEXT_1 : TEXT_3,
                boxShadow:
                  view === 'chat'
                    ? '0 1px 3px rgba(0,0,0,0.08)'
                    : 'none',
                transition: `all 200ms ${EASE_PREMIUM}`,
              }}
            >
              Chat
            </button>
            <button
              onClick={() => setView('log')}
              style={{
                border: 'none',
                cursor: 'pointer',
                fontSize: 11.5,
                fontWeight: 600,
                borderRadius: 17,
                padding: '5px 14px',
                background: view === 'log' ? '#fff' : 'transparent',
                color: view === 'log' ? TEXT_1 : TEXT_3,
                boxShadow:
                  view === 'log'
                    ? '0 1px 3px rgba(0,0,0,0.08)'
                    : 'none',
                transition: `all 200ms ${EASE_PREMIUM}`,
              }}
            >
              Log
            </button>
          </div>
        </div>
      </header>

      {/* ── Chat view: Welcome State ── */}
      {view === 'chat' && messages.length === 0 && (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 20px',
          }}
        >
          <ChatAvatar size={56} />
          <h2
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: TEXT_1,
              marginTop: 16,
              marginBottom: 0,
              letterSpacing: '-0.02em',
            }}
          >
            Hi Diarmuid,
          </h2>
          <p
            style={{
              fontSize: 15,
              color: TEXT_2,
              marginTop: 4,
              marginBottom: 0,
            }}
          >
            What can I help you with today?
          </p>

          {/* Suggested prompts */}
          <div style={{ marginTop: 32, width: '100%', padding: '0 0' }}>
            {SUGGESTED_PROMPTS.map((prompt, i) => (
              <button
                key={i}
                className="da-press"
                onClick={() => handleSend(prompt)}
                style={{
                  display: 'block',
                  width: '100%',
                  background: '#fff',
                  borderRadius: 14,
                  border: `1px solid ${BORDER_LIGHT}`,
                  padding: '14px 16px',
                  fontSize: 14,
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

      {/* ── Chat view: Messages State ── */}
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
              <div
                key={msg.id}
                style={{
                  alignSelf: 'flex-end',
                  maxWidth: '80%',
                  background: GOLD,
                  color: '#fff',
                  borderRadius: '20px 20px 4px 20px',
                  padding: '12px 16px',
                  fontSize: 14.5,
                  lineHeight: 1.5,
                }}
              >
                {msg.content}
              </div>
            ) : (
              <div
                key={msg.id}
                style={{
                  alignSelf: 'flex-start',
                  maxWidth: '85%',
                  display: 'flex',
                  gap: 10,
                  alignItems: 'flex-start',
                }}
              >
                <div style={{ flexShrink: 0 }}>
                  <ChatAvatar size={28} />
                </div>
                <div
                  style={{
                    background: SURFACE_1,
                    borderRadius: '20px 20px 20px 4px',
                    padding: '12px 16px',
                    fontSize: 14.5,
                    color: TEXT_1,
                    lineHeight: 1.5,
                  }}
                >
                  {msg.content}
                </div>
              </div>
            )
          )}

          {sending && (
            <div
              style={{
                alignSelf: 'flex-start',
                maxWidth: '85%',
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start',
              }}
            >
              <div style={{ flexShrink: 0 }}>
                <ChatAvatar size={28} />
              </div>
              <TypingIndicator />
            </div>
          )}

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

      {/* ── Input bar (chat mode only) ── */}
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
              borderRadius: 22,
              border: `1px solid ${BORDER}`,
              padding: '0 16px',
              fontSize: 14,
              color: TEXT_1,
              outline: 'none',
            }}
          />
          <button
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
            onClick={() => handleSend()}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              background: GOLD,
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
              opacity: input.trim() ? 1 : 0,
              pointerEvents: input.trim() ? 'auto' : 'none',
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
