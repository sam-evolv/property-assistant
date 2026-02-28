'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useCareApp } from '../care-app-provider';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const DEMO_RESPONSES: Record<string, string> = {
  'My inverter has a red light':
    "A red light on your SolarEdge SE3680H inverter usually indicates a ground fault or AC grid issue. Here's what to check:\n\n1. Check that your AC isolator switch is in the ON position\n2. Look at the inverter display for an error code\n3. If the error persists after checking the isolator, try the reset procedure in Guides > Troubleshooting\n\nIf you need further help, I can connect you with SE Systems directly.",
  'How can I save more energy?':
    "Great question, Mary! Here are some tips tailored to your 3.69 kWp system:\n\n1. Run heavy appliances (dishwasher, washing machine) between 11am-3pm when solar generation peaks\n2. Your SolarEdge Home Battery 4.6kWh stores excess energy - make sure it's set to self-consumption mode\n3. Consider a timer on your immersion heater to heat water during solar hours\n4. You're currently at 94% efficiency - that's excellent!\n\nSmall changes like these could save you an extra \u20AC15-20 per month.",
  'Tell me about heat pumps':
    "Heat pumps are a great complement to your solar PV system! Here's what you should know:\n\n1. An air-to-water heat pump could reduce your heating costs by 60-70%\n2. Combined with your 3.69 kWp solar system, you could run your heat pump almost entirely on solar energy during summer\n3. SEAI grants of up to \u20AC6,500 are currently available\n4. SE Systems installs heat pumps and could bundle it with your existing solar system\n\nWould you like me to arrange a free assessment with SE Systems?",
  default:
    "Thanks for your question! I'm here to help with anything related to your solar PV system. I can help with:\n\n- Troubleshooting issues with your inverter or panels\n- Tips to maximise your energy savings\n- Information about your warranty coverage\n- Understanding your energy generation data\n\nWhat would you like to know more about?",
};

const SUGGESTION_PILLS = [
  'My inverter has a red light',
  'How can I save more energy?',
  'Tell me about heat pumps',
];

/* ── Typing Indicator ── */
function TypingIndicator() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: 8,
        padding: '8px 0',
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #D4AF37, #B8934C)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <svg
          width={14}
          height={14}
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      </div>
      <div
        style={{
          background: '#F5F5F5',
          borderRadius: '18px 18px 18px 4px',
          padding: '14px 18px',
          display: 'flex',
          gap: 5,
          alignItems: 'center',
        }}
      >
        <style>{`
          @keyframes careTypingBounce {
            0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
            30% { transform: translateY(-6px); opacity: 1; }
          }
        `}</style>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: '#B8934C',
              animation: 'careTypingBounce 1.4s ease-in-out infinite',
              animationDelay: `${i * 0.16}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default function AssistantScreen() {
  const { installation, activeTab } = useCareApp();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [mounted, setMounted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  }, []);

  const handleSendMessage = useCallback(
    (text: string) => {
      if (!text.trim() || isTyping) return;

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: text.trim(),
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setInputValue('');
      setIsTyping(true);
      scrollToBottom();

      // Simulate AI response after typing delay
      setTimeout(() => {
        const response =
          DEMO_RESPONSES[text.trim()] || DEMO_RESPONSES['default'];
        const assistantMsg: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: response,
          timestamp: new Date(),
        };
        setIsTyping(false);
        setMessages((prev) => [...prev, assistantMsg]);
        scrollToBottom();
      }, 1500);
    },
    [scrollToBottom, isTyping]
  );

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: '#FFFFFF',
      }}
    >
      {/* ── Chat Header ── */}
      <div
        style={{
          padding: '52px 20px 14px',
          borderBottom: '1px solid rgba(0,0,0,0.04)',
          background: 'rgba(255,255,255,0.95)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          zIndex: 2,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div style={{ position: 'relative' }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #D4AF37, #B8934C)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg
                width={20}
                height={20}
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </div>
            {/* Online status dot */}
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                width: 12,
                height: 12,
                borderRadius: '50%',
                background: '#22C55E',
                border: '2px solid white',
              }}
            />
          </div>
          <div>
            <div
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: '#1a1a1a',
                letterSpacing: '-0.01em',
              }}
            >
              OpenHouse Care
            </div>
            <div
              style={{
                fontSize: 12,
                color: '#22C55E',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: '#22C55E',
                }}
              />
              Online
            </div>
          </div>
        </div>
      </div>

      {/* ── Messages Area ── */}
      <div
        className="care-screen-scroll"
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: '16px 20px',
          paddingBottom: 8,
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {/* Welcome message & suggestion pills when no messages */}
        {messages.length === 0 && (
          <div
            style={{
              opacity: mounted ? 1 : 0,
              transform: mounted ? 'translateY(0)' : 'translateY(12px)',
              transition:
                'opacity 550ms cubic-bezier(.16, 1, .3, 1), transform 550ms cubic-bezier(.16, 1, .3, 1)',
            }}
          >
            <div
              style={{
                textAlign: 'center',
                padding: '40px 20px 32px',
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 16,
                  background: 'linear-gradient(135deg, #D4AF37, #B8934C)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                }}
              >
                <svg
                  width={28}
                  height={28}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                </svg>
              </div>
              <h2
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  color: '#1a1a1a',
                  marginBottom: 8,
                  letterSpacing: '-0.02em',
                }}
              >
                Hi {installation.customer_name.split(' ')[0]}!
              </h2>
              <p
                style={{
                  fontSize: 14,
                  color: '#888',
                  lineHeight: 1.5,
                  margin: 0,
                }}
              >
                I&apos;m your solar system assistant. Ask me anything about your
                system, energy savings, or troubleshooting.
              </p>
            </div>

            {/* Suggestion Pills */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                padding: '0 0 16px',
              }}
            >
              {SUGGESTION_PILLS.map((pill, i) => (
                <SuggestionPill
                  key={i}
                  text={pill}
                  index={i}
                  onClick={() => handleSendMessage(pill)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Chat Messages */}
        {messages.map((msg) => (
          <ChatBubble key={msg.id} message={msg} />
        ))}

        {/* Typing Indicator */}
        {isTyping && <TypingIndicator />}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Chat Input Bar ── */}
      {activeTab === 'assistant' && (
        <div
          style={{
            padding: '12px 16px',
            paddingBottom: 'calc(88px + 12px)',
            borderTop: '1px solid rgba(0,0,0,0.04)',
            background: 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: '#F5F5F5',
              borderRadius: 100,
              padding: '6px 6px 6px 16px',
            }}
          >
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(inputValue);
                }
              }}
              placeholder="Ask about your system..."
              style={{
                flex: 1,
                border: 'none',
                background: 'none',
                outline: 'none',
                fontSize: 15,
                color: '#1a1a1a',
                fontFamily: 'inherit',
              }}
            />
            <button
              onClick={() => handleSendMessage(inputValue)}
              disabled={!inputValue.trim()}
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                border: 'none',
                background:
                  inputValue.trim()
                    ? 'linear-gradient(135deg, #D4AF37, #B8934C)'
                    : '#E0E0E0',
                cursor: inputValue.trim() ? 'pointer' : 'default',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                transition: 'background 200ms ease',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <svg
                width={18}
                height={18}
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Suggestion Pill ── */
function SuggestionPill({
  text,
  index,
  onClick,
}: {
  text: string;
  index: number;
  onClick: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const [pressed, setPressed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 400 + index * 80);
    return () => clearTimeout(timer);
  }, [index]);

  return (
    <button
      onClick={onClick}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        padding: '12px 16px',
        background: '#FAFAFA',
        border: '1px solid rgba(0,0,0,0.04)',
        borderRadius: 16,
        cursor: 'pointer',
        textAlign: 'left',
        WebkitTapHighlightColor: 'transparent',
        opacity: visible ? 1 : 0,
        transform: pressed
          ? 'scale(0.97)'
          : visible
            ? 'translateY(0)'
            : 'translateY(8px)',
        transition: 'all 400ms cubic-bezier(.16, 1, .3, 1)',
        fontFamily: 'inherit',
      }}
    >
      <svg
        width={16}
        height={16}
        viewBox="0 0 24 24"
        fill="none"
        stroke="#B8934C"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
      </svg>
      <span
        style={{
          fontSize: 14,
          fontWeight: 500,
          color: '#1a1a1a',
          flex: 1,
        }}
      >
        {text}
      </span>
      <svg
        width={16}
        height={16}
        viewBox="0 0 24 24"
        fill="none"
        stroke="#ccc"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ flexShrink: 0 }}
      >
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </button>
  );
}

/* ── Chat Bubble ── */
function ChatBubble({ message }: { message: ChatMessage }) {
  const [visible, setVisible] = useState(false);
  const isUser = message.role === 'user';

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        alignItems: 'flex-end',
        gap: 8,
        marginBottom: 12,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(12px)',
        transition:
          'opacity 350ms cubic-bezier(.16, 1, .3, 1), transform 350ms cubic-bezier(.16, 1, .3, 1)',
      }}
    >
      {!isUser && (
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #D4AF37, #B8934C)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <svg
            width={14}
            height={14}
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        </div>
      )}
      <div
        style={{
          maxWidth: '78%',
          padding: '12px 16px',
          borderRadius: isUser
            ? '18px 18px 4px 18px'
            : '18px 18px 18px 4px',
          background: isUser
            ? 'linear-gradient(135deg, #D4AF37, #B8934C)'
            : '#F5F5F5',
          color: isUser ? 'white' : '#1a1a1a',
          fontSize: 14,
          lineHeight: 1.55,
          whiteSpace: 'pre-line',
        }}
      >
        {message.content}
      </div>
    </div>
  );
}
