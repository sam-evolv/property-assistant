'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  C, TYPE, RADIUS, SHADOW, EASE, DURATION, KEYFRAMES,
} from './tokens';

interface AIScreenProps {
  unitUid: string;
  purchaserName: string;
  address: string;
  builderName?: string;
  handoverDate?: string;
  onClose: () => void;
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
      {/* AI avatar */}
      <div style={{
        width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
        background: `linear-gradient(135deg, ${C.gHi}, ${C.g}, ${C.gLo})`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: SHADOW.goldGlow,
        animation: `thinkPulse 2.4s ${EASE} infinite`,
      }}>
        <span style={{ ...TYPE.micro, color: C.bg, fontSize: 10 }}>S</span>
      </div>
      {/* Bubble with dots */}
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

// ─── Suggestion chips ─────────────────────────────────────────────────────────
const SUGGESTIONS = [
  { icon: '🔥', cat: 'Tradespeople', q: 'Who installed my heating?' },
  { icon: '📄', cat: 'Finishes', q: 'What tiles are in my en suite?' },
  { icon: '🕐', cat: 'Maintenance', q: 'When is my boiler service due?' },
  { icon: '☀️', cat: 'Energy', q: "What's my BER rating?" },
];

// ─── AIScreen ─────────────────────────────────────────────────────────────────
export default function AIScreen({ unitUid, purchaserName, address, builderName = '', handoverDate, onClose }: AIScreenProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [focused, setFocused] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { requestAnimationFrame(() => setMounted(true)); }, []);

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

    // Add empty assistant message to stream into
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

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 200,
      display: 'flex', flexDirection: 'column',
      fontFamily: '"Inter", system-ui, sans-serif',
      opacity: mounted ? 1 : 0,
      transform: mounted ? 'translateY(0)' : 'translateY(20px)',
      transition: `all ${DURATION.slide}ms ${EASE}`,
    }}>
      <style dangerouslySetInnerHTML={{ __html: KEYFRAMES }} />

      {/* ── Background layers ── */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'rgba(3,2,8,0.93)',
        backdropFilter: 'blur(40px) saturate(1.2)',
      }} />
      {/* Gold radial from top */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '40%',
        background: 'radial-gradient(ellipse 100% 70% at 50% 0%, rgba(212,175,55,0.18) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      {/* Ambient low glow */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: '30%',
        background: 'radial-gradient(ellipse 120% 60% at 50% 100%, rgba(212,175,55,0.06) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      {/* Gold hairline top */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 1,
        background: `linear-gradient(90deg, transparent, ${C.g}, transparent)`,
        opacity: 0.65,
      }} />

      {/* ── Header ── */}
      <div style={{
        position: 'relative', zIndex: 1, textAlign: 'center',
        padding: '20px 20px 16px',
        borderBottom: `1px solid rgba(212,175,55,0.10)`,
      }}>
        {/* Close button */}
        <button onClick={onClose} style={{
          position: 'absolute', top: 16, right: 16,
          width: 32, height: 32, borderRadius: '50%',
          background: 'rgba(255,255,255,0.04)',
          border: `1px solid ${C.b1}`,
          color: C.t2, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14,
        }}>✕</button>

        {/* Gold badge with halos */}
        <div style={{
          width: 52, height: 52, margin: '0 auto 12px',
          position: 'relative',
        }}>
          {/* Outer halo */}
          <div style={{
            position: 'absolute', inset: -12, borderRadius: '50%',
            border: '1px solid rgba(212,175,55,0.08)',
            animation: `haloPulse 4s ${EASE} infinite`,
          }} />
          {/* Inner halo */}
          <div style={{
            position: 'absolute', inset: -6, borderRadius: '50%',
            border: '1px solid rgba(212,175,55,0.20)',
            animation: `haloPulse 4s ${EASE} infinite`,
            animationDelay: '0.5s',
          }} />
          {/* Badge */}
          <div style={{
            width: 52, height: 52, borderRadius: '50%',
            background: `linear-gradient(135deg, ${C.gHi}, ${C.g}, ${C.gLo})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: SHADOW.goldGlow,
            animation: `badgePulse 3s ${EASE} infinite`,
          }}>
            <span style={{ color: C.bg, fontSize: 20, fontWeight: 900 }}>S</span>
          </div>
        </div>

        <div style={{ ...TYPE.overline, color: C.g, marginBottom: 4 }}>
          OpenHouse Intelligence
        </div>
        <div style={{ fontSize: 17, fontWeight: 700, color: C.t1, marginBottom: 4 }}>
          Home Assistant
        </div>
        <div style={{ ...TYPE.caption, color: C.t2, marginBottom: 8 }}>
          {address}
        </div>
        {/* Live status pill */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 12px', borderRadius: RADIUS.pill,
          background: C.glMid, border: `1px solid ${C.gB}`,
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%', background: C.grn,
            animation: `livePulse 2.4s ${EASE} infinite`,
          }} />
          <span style={{ ...TYPE.caption, color: C.t2 }}>All systems normal</span>
        </div>
      </div>

      {/* ── Messages area ── */}
      <div ref={scrollRef} style={{
        flex: 1, position: 'relative', zIndex: 1,
        overflowY: 'auto', padding: '16px 16px 8px',
        display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        {/* Suggestions — show before first message */}
        {messages.length === 0 && !thinking && (
          <div style={{
            display: 'flex', gap: 10, overflowX: 'auto',
            padding: '8px 0', scrollbarWidth: 'none',
          }}>
            {SUGGESTIONS.map((s, i) => (
              <button key={i} onClick={() => send(s.q)} style={{
                minWidth: 140, padding: '14px 14px 12px', flexShrink: 0,
                borderRadius: 16,
                background: C.glDark,
                border: `1px solid ${C.gB}`,
                backdropFilter: 'blur(16px)',
                cursor: 'pointer', textAlign: 'left',
                display: 'flex', flexDirection: 'column', gap: 8,
                transition: `all ${DURATION.fast}ms ${EASE}`,
              }}>
                <span style={{ fontSize: 16 }}>{s.icon}</span>
                <span style={{ ...TYPE.overline, color: C.g, fontSize: 8 }}>{s.cat}</span>
                <span style={{ ...TYPE.caption, color: C.t1, lineHeight: 1.4 }}>{s.q}</span>
              </button>
            ))}
          </div>
        )}

        {/* Message bubbles */}
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
                background: `linear-gradient(135deg, ${C.gHi}, ${C.g}, ${C.gLo})`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: SHADOW.goldGlow,
              }}>
                <span style={{ ...TYPE.micro, color: C.bg, fontSize: 10 }}>S</span>
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

      {/* ── Input bar ── */}
      <div style={{
        position: 'relative', zIndex: 1,
        padding: '12px 16px 16px',
        background: 'rgba(4,3,10,0.60)',
        backdropFilter: 'blur(20px)',
      }}>
        {/* Gold hairline */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 1,
          background: `linear-gradient(90deg, transparent, ${C.g}, transparent)`,
          opacity: focused ? 0.5 : 0.2,
          transition: `opacity ${DURATION.fast}ms ${EASE}`,
        }} />

        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          {/* Input */}
          <div style={{
            flex: 1, position: 'relative',
            borderRadius: 28,
            background: C.glDark,
            border: `1px solid ${focused ? C.gB2 : C.b1}`,
            boxShadow: focused ? `0 0 0 3px ${C.gFog}` : 'none',
            transition: `all ${DURATION.fast}ms ${EASE}`,
            display: 'flex', alignItems: 'center',
          }}>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onKeyDown={e => { if (e.key === 'Enter') send(input); }}
              placeholder={`Ask about your home, ${firstName}...`}
              style={{
                flex: 1, padding: '12px 40px 12px 18px',
                background: 'transparent', border: 'none', outline: 'none',
                color: C.t1, ...TYPE.body,
              }}
            />
            {/* Mic icon */}
            <button style={{
              position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
              width: 28, height: 28, borderRadius: '50%',
              background: 'transparent', border: 'none',
              color: C.t3, cursor: 'pointer', fontSize: 14,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>🎤</button>
          </div>

          {/* Send button */}
          <button
            onClick={() => send(input)}
            style={{
              width: 46, height: 46, borderRadius: '50%', flexShrink: 0,
              background: input.trim()
                ? `linear-gradient(135deg, ${C.gHi}, ${C.g}, ${C.gLo})`
                : C.s3,
              border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: input.trim() ? SHADOW.goldRing : 'none',
              transform: input.trim() ? 'scale(1.05)' : 'scale(1)',
              transition: `all ${DURATION.fast}ms ${EASE}`,
            }}
          >
            <span style={{
              fontSize: 18,
              color: input.trim() ? C.bg : C.t3,
            }}>↑</span>
          </button>
        </div>

        {/* Caption */}
        <div style={{
          ...TYPE.caption, color: C.t3,
          textAlign: 'center', marginTop: 10,
          fontSize: 9,
        }}>
          Powered by OpenHouse Intelligence · Knows your home completely
        </div>
      </div>
    </div>
  );
}
