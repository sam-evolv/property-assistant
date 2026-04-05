'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import {
  C, TYPE, RADIUS, SHADOW, EASE, DURATION, KEYFRAMES,
} from './tokens';

interface AIScreenProps {
  unitUid: string;
  purchaserName: string;
  address: string;
  builderName?: string;
  handoverDate?: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

// ─── Bold gold renderer (**text** → <strong> in gold) ─────────────────────────
function renderContent(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} style={{ color: C.g, fontWeight: 700 }}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

// ─── ThinkingOrbs ─────────────────────────────────────────────────────────────
function ThinkingOrbs() {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0' }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
        overflow: 'hidden',
        animation: `thinkPulse 2.4s ${EASE} infinite`,
      }}>
        <Image src="/branding/openhouse-ai-logo.png" width={28} height={28} alt="AI" style={{ objectFit: 'contain' }} />
      </div>
      <div style={{
        padding: '14px 20px',
        background: 'rgba(16,14,26,0.85)',
        backdropFilter: 'blur(20px)',
        border: `1px solid ${C.gB}`,
        borderRadius: '6px 20px 20px 20px',
        display: 'flex', gap: 6, alignItems: 'center',
      }}>
        {[0, 1, 2].map(i => (
          <span key={i} style={{
            width: 6, height: 6, borderRadius: '50%',
            background: C.g,
            animation: `thinkDot 1.4s ${EASE} infinite`,
            animationDelay: `${i * 0.18}s`,
          }} />
        ))}
      </div>
    </div>
  );
}

// ─── Suggestion prompts (2×2 grid, matching agent layout) ─────────────────────
const PROMPTS = [
  { label: 'My heating system', q: 'Tell me everything about the heating system in my home — how it works, how to use it efficiently, and what maintenance it needs.' },
  { label: 'Warranties & cover', q: 'What warranties and guarantees came with my home, what do they cover, and when do they expire?' },
  { label: 'My kitchen & finishes', q: 'What kitchen and appliances did I choose, and do you have any tips for getting the best from them?' },
  { label: 'My BER rating', q: "What is my home's BER rating and what does it mean for my energy bills?" },
];

// ─── AIScreen ─────────────────────────────────────────────────────────────────
export default function AIScreen({ unitUid, purchaserName, address, builderName = '', handoverDate }: AIScreenProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [focused, setFocused] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, thinking]);

  const send = useCallback(async (text: string) => {
    if (!text.trim() || thinking) return;
    const userMsg: Message = { role: 'user', content: text.trim() };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput('');
    setThinking(true);

    const assistantMsg: Message = { role: 'assistant', content: '' };
    setMessages(prev => [...prev, assistantMsg]);
    setThinking(false);

    try {
      const res = await fetch('/api/select/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text.trim(),
          unitUid,
          purchaserName,
          address,
          builderName,
          handoverDate,
          conversationHistory: messages,
        }),
      });

      if (!res.ok || !res.body) {
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: "Sorry, I'm having trouble connecting right now." };
          return updated;
        });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages(prev => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last?.role === 'assistant') {
            updated[updated.length - 1] = { ...last, content: last.content + chunk };
          }
          return updated;
        });
      }
    } catch {
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: 'assistant', content: "Sorry, I'm having trouble connecting right now." };
        return updated;
      });
    }
  }, [messages, thinking, unitUid, purchaserName, address, builderName, handoverDate]);

  const firstName = purchaserName.split(' ')[0];
  const hasMessages = messages.length > 0 || thinking;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: C.bg, fontFamily: '"Inter", system-ui, sans-serif',
      position: 'relative',
    }}>
      <style dangerouslySetInnerHTML={{ __html: KEYFRAMES }} />

      {/* ═══ WELCOME / LANDING — matches agent layout ═══ */}
      {!hasMessages && (
        <div ref={scrollRef} style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '24px 28px 0', textAlign: 'center',
          overflowY: 'auto',
        }}>
          {/* OpenHouse AI logo */}
          <div style={{
            width: 100, height: 100, margin: '0 auto 12px',
            position: 'relative',
          }}>
            {/* Outer halo */}
            <div style={{
              position: 'absolute', inset: -14, borderRadius: '50%',
              border: '1px solid rgba(212,175,55,0.08)',
              animation: `haloPulse 4s ${EASE} infinite`,
            }} />
            {/* Inner halo */}
            <div style={{
              position: 'absolute', inset: -7, borderRadius: '50%',
              border: '1px solid rgba(212,175,55,0.20)',
              animation: `haloPulse 4s ${EASE} infinite`,
              animationDelay: '0.5s',
            }} />
            {/* Logo */}
            <Image
              src="/branding/openhouse-ai-logo.png"
              width={100}
              height={100}
              alt="OpenHouse AI"
              style={{ objectFit: 'contain' }}
              priority
            />
          </div>

          {/* Overline */}
          <div style={{ ...TYPE.overline, color: C.g, marginBottom: 8, marginTop: 4 }}>
            OpenHouse Select
          </div>

          {/* Title — matches agent "Ask anything about your pipeline or tasks" */}
          <h1 style={{ color: C.t1, fontSize: 17, fontWeight: 600, lineHeight: 1.3, margin: '0 0 6px' }}>
            Ask anything about your<br />home
          </h1>
          <p style={{ ...TYPE.body, color: C.t2, margin: '0 0 20px', maxWidth: 280, fontSize: 12, lineHeight: 1.5 }}>
            Heating, warranties, finishes, maintenance.<br />Your home, answered instantly.
          </p>

          {/* 2×2 pill grid — matches agent layout */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
            width: '100%', maxWidth: 320,
          }}>
            {PROMPTS.map(p => (
              <button key={p.label} onClick={() => send(p.q)} style={{
                padding: '10px 12px',
                background: C.s2,
                border: `1px solid ${C.b2}`,
                borderRadius: RADIUS.pill,
                color: C.t1,
                fontSize: 12, fontWeight: 500,
                fontFamily: 'inherit', cursor: 'pointer',
                textAlign: 'center', lineHeight: 1.4,
                transition: `all ${DURATION.fast}ms ${EASE}`,
              }}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ═══ CONVERSATION ═══ */}
      {hasMessages && (
        <div ref={scrollRef} style={{
          flex: 1, overflowY: 'auto',
          padding: '16px 16px 8px',
          display: 'flex', flexDirection: 'column', gap: 14,
        }}>
          {messages.map((msg, i) => (
            <div key={i} style={{
              display: 'flex', gap: 10,
              alignItems: 'flex-start',
              flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
            }}>
              {/* Avatar */}
              {msg.role === 'assistant' ? (
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                  overflow: 'hidden',
                }}>
                  <Image src="/branding/openhouse-ai-logo.png" width={28} height={28} alt="AI" style={{ objectFit: 'contain' }} />
                </div>
              ) : (
                <div style={{
                  width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                  border: `1.5px solid ${C.g}`,
                  background: C.s2,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ fontSize: 10, color: C.g, fontWeight: 700 }}>
                    {firstName[0]}
                  </span>
                </div>
              )}
              {/* Bubble */}
              <div style={{
                maxWidth: '78%',
                padding: '12px 16px',
                ...(msg.role === 'assistant' ? {
                  background: 'rgba(16,14,26,0.85)',
                  backdropFilter: 'blur(20px)',
                  border: `1px solid ${C.gB}`,
                  borderRadius: '6px 20px 20px 20px',
                  boxShadow: SHADOW.aiMsg,
                } : {
                  background: `linear-gradient(135deg, ${C.gHi}, ${C.g}, ${C.gLo})`,
                  borderRadius: '20px 20px 6px 20px',
                  boxShadow: SHADOW.userMsg,
                }),
              }}>
                <span style={{
                  ...TYPE.body,
                  color: msg.role === 'assistant' ? C.t1 : C.bg,
                  whiteSpace: 'pre-wrap',
                }}>
                  {msg.role === 'assistant' ? renderContent(msg.content) : msg.content}
                </span>
              </div>
            </div>
          ))}

          {thinking && <ThinkingOrbs />}
        </div>
      )}

      {/* ═══ INPUT BAR — matches agent layout ═══ */}
      <div style={{
        flexShrink: 0, position: 'relative',
        padding: '8px 16px 16px',
        background: C.s1,
        borderTop: `1px solid ${C.b1}`,
      }}>
        <p style={{ ...TYPE.caption, color: C.t3, textAlign: 'center', margin: '0 0 8px', fontSize: 9 }}>
          Powered by AI · Information for reference only
        </p>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: C.s2, border: `1px solid ${focused ? C.gB2 : C.b1}`,
          borderRadius: 28, padding: '4px 4px 4px 16px',
          boxShadow: focused ? `0 0 0 3px ${C.gFog}` : 'none',
          transition: `all ${DURATION.fast}ms ${EASE}`,
        }}>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={e => { if (e.key === 'Enter') send(input); }}
            placeholder={`Ask about your home...`}
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: C.t1, fontSize: 14, lineHeight: 1.5,
              fontFamily: 'inherit', padding: '8px 0',
            }}
          />
          {/* Send button */}
          <button
            onClick={() => send(input)}
            style={{
              width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
              background: input.trim()
                ? `linear-gradient(135deg, ${C.gHi}, ${C.g}, ${C.gLo})`
                : C.s3,
              border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: input.trim() ? SHADOW.goldRing : 'none',
              transition: `all ${DURATION.fast}ms ${EASE}`,
            }}
          >
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none"
              stroke={input.trim() ? C.bg : C.t3} strokeWidth={2.5}
              strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="19" x2="12" y2="5" />
              <polyline points="5 12 12 5 19 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
