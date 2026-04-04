'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import AgentShell from '../_components/AgentShell';
import { AGENT_STATS } from '@/lib/agent/demo-data';

const PROMPT_PILLS = [
  "What's outstanding on contracts?",
  'Give me a scheme summary',
  'Draft a buyer follow-up email',
  'Generate developer weekly report',
];

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export default function IntelligencePage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = (text: string) => {
    if (!text.trim()) return;
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text.trim(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    // Simulate AI response
    setTimeout(() => {
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: getAIResponse(text.trim()),
      };
      setMessages((prev) => [...prev, aiMsg]);
      setIsTyping(false);
    }, 1200);
  };

  const hasMessages = messages.length > 0;

  return (
    <AgentShell agentName="Sam" urgentCount={AGENT_STATS.urgent}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          minHeight: 0,
        }}
      >
        {!hasMessages ? (
          /* ─── Landing state ─── */
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 32px',
              textAlign: 'center',
              background:
                'radial-gradient(ellipse 90% 60% at 50% 35%, rgba(196,155,42,0.07) 0%, transparent 70%)',
              minHeight: 0,
            }}
          >
            {/* Logo on dark circle */}
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                background: '#0D0D12',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 20,
                overflow: 'hidden',
                boxShadow: `
                  0 0 0 1px rgba(255,255,255,0.08) inset,
                  0 8px 32px rgba(0,0,0,0.28),
                  0 2px 8px rgba(0,0,0,0.16)
                `,
              }}
            >
              <Image
                src="/oh-logo.png"
                alt="OpenHouse"
                width={54}
                height={54}
                style={{ objectFit: 'contain' }}
                priority
              />
            </div>

            {/* Gold wordmark */}
            <p
              style={{
                background: 'linear-gradient(135deg, #B8960C, #E8C84A)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                margin: '0 0 18px',
              }}
            >
              OpenHouse Agent
            </p>

            <h2
              style={{
                color: '#0D0D12',
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: '-0.04em',
                lineHeight: 1.22,
                margin: '0 0 12px',
              }}
            >
              Ask anything about your
              <br />
              pipeline or tasks
            </h2>

            <p
              style={{
                color: '#9CA3AF',
                fontSize: 13.5,
                lineHeight: 1.65,
                margin: '0 0 28px',
                maxWidth: 280,
                letterSpacing: '0.005em',
              }}
            >
              Chase contracts, draft reports, follow up buyers. You approve
              every action before it sends.
            </p>

            {/* Prompt pills — 2x2 grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 10,
                width: '100%',
                maxWidth: 320,
              }}
            >
              {PROMPT_PILLS.map((pill, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(pill)}
                  className="agent-tappable"
                  style={{
                    padding: '13px 14px',
                    minHeight: 54,
                    background: '#FFFFFF',
                    border: '0.5px solid rgba(0,0,0,0.10)',
                    borderRadius: 16,
                    color: '#374151',
                    fontSize: 13,
                    fontWeight: 500,
                    lineHeight: 1.4,
                    whiteSpace: 'normal',
                    textAlign: 'center',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                  }}
                >
                  {pill}
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* ─── Conversation state ─── */
          <div
            ref={scrollRef}
            style={{
              flex: 1,
              overflowY: 'auto',
              overflowX: 'hidden',
              scrollbarWidth: 'none',
              padding: '16px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
            className="[&::-webkit-scrollbar]:hidden"
          >
            {messages.map((msg) =>
              msg.role === 'user' ? (
                <UserBubble key={msg.id} text={msg.content} />
              ) : (
                <AIResponseCard key={msg.id} text={msg.content} />
              )
            )}
            {isTyping && <TypingIndicator />}
          </div>
        )}

        {/* Input bar */}
        <div
          style={{
            background: 'rgba(250,250,248,0.95)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderTop: '0.5px solid rgba(0,0,0,0.08)',
            padding: '12px 20px 16px',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: '#F5F5F3',
              borderRadius: 28,
              border: '0.5px solid rgba(0,0,0,0.08)',
              padding: '6px 6px 6px 18px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04) inset',
            }}
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend(input)}
              placeholder="Ask Intelligence anything..."
              style={{
                flex: 1,
                border: 'none',
                background: 'transparent',
                outline: 'none',
                fontSize: 14,
                fontWeight: 400,
                color: '#0D0D12',
                fontFamily: 'inherit',
                letterSpacing: '-0.01em',
              }}
            />
            <button
              onClick={() => handleSend(input)}
              disabled={!input.trim()}
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                background: input.trim()
                  ? 'linear-gradient(135deg, #C49B2A, #E8C84A)'
                  : 'rgba(0,0,0,0.06)',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: input.trim() ? 'pointer' : 'default',
                transition: 'background 0.15s ease',
                flexShrink: 0,
              }}
            >
              <svg
                width={15}
                height={15}
                viewBox="0 0 24 24"
                fill="none"
                stroke={input.trim() ? '#fff' : '#C0C8D4'}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22,2 15,22 11,13 2,9 22,2" />
              </svg>
            </button>
          </div>
          <p
            style={{
              textAlign: 'center',
              fontSize: 10,
              color: '#C0C8D4',
              marginTop: 8,
              letterSpacing: '0.01em',
            }}
          >
            Powered by AI &middot; Information for reference only
          </p>
        </div>
      </div>
    </AgentShell>
  );
}

/* ─── Sub-components ─── */

function UserBubble({ text }: { text: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
      <div
        style={{
          background: 'linear-gradient(135deg, #C49B2A, #E8C84A)',
          borderRadius: '20px 20px 4px 20px',
          padding: '12px 16px',
          maxWidth: '82%',
          boxShadow:
            '0 4px 16px rgba(196,155,42,0.30), 0 1px 4px rgba(196,155,42,0.20)',
        }}
      >
        <p
          style={{
            color: '#fff',
            fontSize: 14,
            lineHeight: 1.5,
            margin: 0,
            fontWeight: 500,
            letterSpacing: '-0.01em',
            textShadow: '0 1px 2px rgba(0,0,0,0.1)',
          }}
        >
          {text}
        </p>
      </div>
    </div>
  );
}

function AIResponseCard({ text }: { text: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: 18,
          padding: '16px',
          maxWidth: '90%',
          boxShadow:
            '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05), 0 0 0 0.5px rgba(0,0,0,0.04)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 12,
          }}
        >
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: 8,
              background: '#0D0D12',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}
          >
            <Image
              src="/oh-logo.png"
              alt=""
              width={20}
              height={20}
              style={{ objectFit: 'contain' }}
            />
          </div>
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: '#0D0D12',
              letterSpacing: '-0.01em',
            }}
          >
            Intelligence
          </span>
        </div>

        {/* Response text */}
        <div
          style={{
            fontSize: 13.5,
            lineHeight: 1.6,
            color: '#374151',
            letterSpacing: '-0.005em',
            whiteSpace: 'pre-wrap',
          }}
        >
          {text}
        </div>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: 18,
          padding: '16px',
          boxShadow:
            '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05), 0 0 0 0.5px rgba(0,0,0,0.04)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: 8,
            background: '#0D0D12',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          <Image
            src="/oh-logo.png"
            alt=""
            width={20}
            height={20}
            style={{ objectFit: 'contain' }}
          />
        </div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                background: '#C0C8D4',
                animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
              }}
            />
          ))}
        </div>
        <style>{`
          @keyframes pulse {
            0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
            40% { opacity: 1; transform: scale(1); }
          }
        `}</style>
      </div>
    </div>
  );
}

/* ─── Demo AI responses ─── */

function getAIResponse(query: string): string {
  const q = query.toLowerCase();

  if (q.includes('outstanding') || q.includes('contracts')) {
    return `There are 17 buyers with contracts outstanding across Riverside Gardens.\n\nMost urgent:\n• Marcelo Acher — Unit 5 — 149 days\n• Stephanie Flanagan — Unit 40 — 121 days\n• Jasmine Thomas — Unit 33 — 111 days\n\nAll 17 are in Riverside Gardens. The longest outstanding is nearly 5 months. I recommend prioritising solicitor follow-ups for the top 5.\n\nWould you like me to draft chase emails for these buyers?`;
  }

  if (q.includes('scheme') || q.includes('summary')) {
    return `Portfolio Summary — 5 Active Schemes\n\n• Oak Hill Estate: 83% sold (62/75) — €27.8m revenue\n• Riverside Gardens: 52% reserved (35+17 contracts/68) — €28.8m\n• Meadow View: 75% progressed (39/52) — €17.3m\n• Willow Brook: 93% reserved (40/43) — €1.6m\n• Harbour View: 25% sold (3/12) — €550k\n\nTotal pipeline value: €76.1m across 250 units.\nKey risk: Riverside has 17 contracts unsigned for 49-149 days.`;
  }

  if (q.includes('email') || q.includes('follow-up') || q.includes('follow up')) {
    return `Here's a draft follow-up for your most overdue buyer:\n\nSubject: Riverside Gardens, Unit 5 — Contract Status Update\n\nDear Marcelo,\n\nI hope you're well. I'm writing regarding the purchase of Unit 5 at Riverside Gardens.\n\nContracts were issued on 4th November 2025 and we're keen to progress matters. Could you confirm the current status with your solicitor?\n\nIf there's anything we can assist with, please don't hesitate to reach out.\n\nKind regards,\nSam\n\nShall I prepare similar emails for the remaining 16 outstanding buyers?`;
  }

  if (q.includes('report') || q.includes('weekly')) {
    return `Developer Weekly Report — w/c 31 March 2026\n\nHighlights:\n• 79 total units sold across 5 schemes\n• 57 active buyers in pipeline\n• 17 contracts requiring follow-up (Riverside Gardens)\n\nRisks:\n• Riverside Gardens contract delays averaging 89 days\n• 5 buyers exceeded 100-day mark\n\nActions Required:\n• Solicitor escalation for top 5 overdue contracts\n• Schedule progress review with Riverside site manager\n\nWould you like me to format this for email to the developer?`;
  }

  return `I can help with that. Based on your current pipeline:\n\n• 5 active schemes with 250 total units\n• 79 units sold, 57 in active pipeline\n• 17 requiring immediate attention\n\nWhat specific action would you like me to take?`;
}
