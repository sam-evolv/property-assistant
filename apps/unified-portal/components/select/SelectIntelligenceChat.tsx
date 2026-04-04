'use client';

import { useState, useEffect, useRef } from 'react';
import { C, TYPE, RADIUS, EASE, DURATION, KEYFRAMES, getSkyConfig } from './tokens';

export interface SelectIntelligenceChatProps {
  unitId: string;
  developmentId: string;
  homeownerName: string;
  developmentName: string;
  builderName: string;
  handoverDate?: string | null;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

// ─── Gold thinking dots ───────────────────────────────────────────────────────
function ThinkingDots() {
  return (
    <div style={{ display: 'flex', gap: 6, padding: '4px 0 8px' }}>
      {[0, 1, 2].map(i => (
        <span
          key={i}
          style={{
            width: 7, height: 7, borderRadius: '50%',
            background: C.g,
            display: 'inline-block',
            animation: `thinkDot 1.4s ${EASE} infinite`,
            animationDelay: `${i * 0.18}s`,
          }}
        />
      ))}
    </div>
  );
}

// ─── House icon (gold outline SVG) ───────────────────────────────────────────
function HouseIcon() {
  return (
    <svg width={40} height={40} viewBox="0 0 24 24" fill="none"
      stroke={C.g} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12l9-8 9 8v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z" />
    </svg>
  );
}

// ─── Suggestion pill ──────────────────────────────────────────────────────────
function SuggestionPill({ label, onClick }: { label: string; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '12px 14px',
        borderRadius: RADIUS.md,
        background: hovered ? C.s3 : C.s2,
        border: `1px solid ${hovered ? C.gB2 : C.gB}`,
        color: C.t1,
        cursor: 'pointer',
        textAlign: 'left',
        ...TYPE.caption,
        fontSize: 12,
        lineHeight: 1.4,
        transition: `all ${DURATION.fast}ms ${EASE}`,
      }}
    >
      {label}
    </button>
  );
}

const SUGGESTIONS: { label: string; message: string }[] = [
  {
    label: 'My heating system',
    message: 'Tell me everything about the heating system in my home — how it works, how to use it efficiently, and what maintenance it needs.',
  },
  {
    label: 'Warranties and cover',
    message: 'What warranties and guarantees came with my home, what do they cover, and when do they expire?',
  },
  {
    label: 'My kitchen',
    message: 'What kitchen and appliances did I choose, and do you have any tips for getting the best from them?',
  },
  {
    label: 'My BER rating',
    message: "What is my home's BER rating and what does it mean for my energy bills?",
  },
];

// ─── Greeting ─────────────────────────────────────────────────────────────────
function greeting(): string {
  const sky = getSkyConfig();
  switch (sky.name) {
    case 'dawn': case 'morning': return 'Good morning';
    case 'afternoon': return 'Good afternoon';
    default: return 'Good evening';
  }
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function SelectIntelligenceChat({
  unitId,
  developmentId,
  homeownerName,
  developmentName,
  builderName,
  handoverDate,
}: SelectIntelligenceChatProps) {
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [focused, setFocused] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const firstName = homeownerName.split(' ')[0];

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [msgs, thinking]);

  async function send(text: string) {
    if (!text.trim() || thinking) return;
    const next: Message[] = [...msgs, { role: 'user', content: text.trim() }];
    setMsgs(next);
    setInput('');
    setThinking(true);

    try {
      const res = await fetch('/api/select/intelligence/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: next,
          unit_id: unitId,
          development_id: developmentId,
          homeowner_name: homeownerName,
          development_name: developmentName,
          builder_name: builderName,
          handover_date: handoverDate,
        }),
      });
      const data = await res.json();
      setMsgs(prev => [...prev, {
        role: 'assistant',
        content: data.content || 'Sorry, something went wrong there.',
      }]);
    } catch {
      setMsgs(prev => [...prev, {
        role: 'assistant',
        content: 'Having trouble connecting right now — try again in a moment.',
      }]);
    } finally {
      setThinking(false);
    }
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100%', background: C.bg,
      fontFamily: '"Inter", system-ui, sans-serif',
    }}>
      <style dangerouslySetInnerHTML={{ __html: KEYFRAMES }} />

      {/* ── Messages ── */}
      <div
        ref={scrollRef}
        style={{
          flex: 1, overflowY: 'auto', padding: '24px 20px 12px',
          display: 'flex', flexDirection: 'column', gap: 20,
        }}
      >
        {/* Empty state */}
        {msgs.length === 0 && !thinking && (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 12, paddingTop: 40,
          }}>
            <HouseIcon />
            <div style={{ textAlign: 'center' }}>
              <div style={{ ...TYPE.title, color: C.t1, marginBottom: 4, fontSize: 16 }}>
                {greeting()}, {firstName}
              </div>
              <div style={{ ...TYPE.caption, color: C.t2 }}>
                Ask me anything about your home.
              </div>
            </div>
            {/* 2×2 suggestion grid */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10,
              width: '100%', marginTop: 16,
            }}>
              {SUGGESTIONS.map((s, i) => (
                <SuggestionPill key={i} label={s.label} onClick={() => send(s.message)} />
              ))}
            </div>
          </div>
        )}

        {/* Message bubbles */}
        {msgs.map((msg, i) => (
          <div key={i} style={{
            display: 'flex',
            justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
          }}>
            {msg.role === 'user' ? (
              <div style={{
                maxWidth: '80%', padding: '10px 14px',
                borderRadius: '18px 18px 4px 18px',
                background: C.s3,
                border: `1px solid ${C.b2}`,
                ...TYPE.body, color: C.t1,
                whiteSpace: 'pre-wrap',
              }}>
                {msg.content}
              </div>
            ) : (
              <div style={{
                maxWidth: '90%',
                ...TYPE.body, color: C.t2,
                lineHeight: 1.7,
                whiteSpace: 'pre-wrap',
              }}>
                {msg.content}
              </div>
            )}
          </div>
        ))}

        {thinking && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <ThinkingDots />
          </div>
        )}
      </div>

      {/* ── Input bar ── */}
      <div style={{
        padding: '10px 16px 20px',
        borderTop: `1px solid ${C.b1}`,
        background: C.s1,
      }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{
            flex: 1, borderRadius: 28,
            background: C.s2,
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
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
              placeholder={`Ask about your home...`}
              style={{
                flex: 1, padding: '12px 16px',
                background: 'transparent', border: 'none', outline: 'none',
                color: C.t1, ...TYPE.body,
                fontSize: 14,
              }}
            />
          </div>
          {/* Send */}
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || thinking}
            style={{
              width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
              background: input.trim() && !thinking
                ? `linear-gradient(135deg, ${C.gHi}, ${C.g})`
                : C.s3,
              border: 'none', cursor: input.trim() && !thinking ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: `all ${DURATION.fast}ms ${EASE}`,
              transform: input.trim() && !thinking ? 'scale(1.05)' : 'scale(1)',
            }}
          >
            <span style={{
              fontSize: 16,
              color: input.trim() && !thinking ? C.bg : C.t3,
            }}>↑</span>
          </button>
        </div>
      </div>
    </div>
  );
}
