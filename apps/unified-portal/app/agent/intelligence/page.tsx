'use client';
import { useState, useRef, useEffect } from 'react';
import { T } from '@/lib/agent/tokens';
import { Step } from '@/lib/agent/types';
import { useIntelligenceContext } from '@/context/IntelligenceContext';
import { DEMO_TASKS } from '@/lib/agent/tasks';
import { TaskResponse } from '@/components/agent/intelligence/TaskResponse';
import { Mic } from 'lucide-react';

const QUICK_ACTIONS = [
  'Chase contracts',
  'Weekly report',
  'AIP follow-up',
  'Email all pending',
];

export default function IntelligencePage() {
  const { history, addToHistory } = useIntelligenceContext();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history, loading]);

  const handleSubmit = async (text?: string) => {
    const query = (text || input).trim();
    if (!query) return;
    setInput('');
    setLoading(true);

    // Try to match a demo task
    const match = DEMO_TASKS.find(t =>
      query.toLowerCase().includes(t.input.toLowerCase().slice(0, 10)) ||
      t.input.toLowerCase().includes(query.toLowerCase().slice(0, 10))
    );

    // Simulate delay
    await new Promise(r => setTimeout(r, 1500));

    let steps: Step[];
    if (match) {
      steps = match.steps;
    } else {
      // Try OpenAI if available, otherwise fallback
      try {
        const res = await fetch('/api/agent/intelligence', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ input: query }),
        });
        if (res.ok) {
          steps = await res.json();
        } else {
          steps = [{ type: 'status', action: 'Processing your request', detail: `I understand you want to: "${query}". This would typically trigger an AI-powered action. For the demo, try one of the quick action prompts.` }];
        }
      } catch {
        steps = [{ type: 'status', action: 'Processing your request', detail: `I understand you want to: "${query}". This would typically trigger an AI-powered action. For the demo, try one of the quick action prompts.` }];
      }
    }

    addToHistory({ input: query, steps });
    setLoading(false);
  };

  const isLanding = history.length === 0 && !loading;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: T.card }}>
      {/* Scrollable content */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto' }}>
        {isLanding ? (
          /* Landing state */
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', minHeight: '100%', padding: '40px 24px 20px',
          }}>
            {/* Logo mark */}
            <div style={{
              width: 72, height: 72, borderRadius: '50%',
              border: `2.5px solid ${T.goldM}`,
              boxShadow: `0 0 0 6px ${T.goldL}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 18,
            }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke={T.gold} strokeWidth="1.5" />
                <path d="M8 14L12 9L16 14" stroke={T.gold} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <line x1="9.5" y1="14" x2="14.5" y2="14" stroke={T.gold} strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>

            {/* Wordmark */}
            <p style={{
              color: T.goldD, fontSize: 12, fontWeight: 700,
              letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 18,
            }}>
              OpenHouse AI
            </p>

            {/* Headline */}
            <h1 style={{
              color: T.t1, fontSize: 20, fontWeight: 700,
              letterSpacing: '-0.02em', lineHeight: 1.3,
              textAlign: 'center', marginBottom: 8, maxWidth: 280,
            }}>
              Ask anything about your pipeline or tasks
            </h1>

            {/* Subtitle */}
            <p style={{
              color: T.t3, fontSize: 13, lineHeight: 1.6,
              textAlign: 'center', marginBottom: 28, maxWidth: 280,
            }}>
              Quick actions for sales agents: chase contracts, draft reports, follow up buyers, and more.
            </p>

            {/* Quick action pills */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr',
              gap: 10, maxWidth: 320, width: '100%',
            }}>
              {QUICK_ACTIONS.map(action => (
                <button key={action} onClick={() => handleSubmit(action)} style={{
                  background: T.card, border: `1px solid ${T.lineB}`,
                  borderRadius: 24, padding: '11px 14px',
                  fontSize: 12, fontWeight: 500, color: T.t2,
                  textAlign: 'center', cursor: 'pointer',
                }}>
                  {action}
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Conversation state */
          <div style={{ padding: '16px 16px 8px' }}>
            {history.map((item, i) => (
              <div key={i} style={{ marginBottom: 16 }}>
                {/* User bubble */}
                <div style={{
                  display: 'flex', justifyContent: 'flex-end', marginBottom: 12,
                }}>
                  <div style={{
                    background: T.t1, color: '#FFFFFF',
                    borderRadius: '16px 16px 4px 16px',
                    padding: '10px 15px', maxWidth: '80%',
                    fontSize: 13, lineHeight: 1.5,
                  }}>
                    {item.input}
                  </div>
                </div>

                {/* AI response */}
                <div style={{ maxWidth: '95%' }}>
                  <TaskResponse steps={item.steps} />
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {loading && (
              <div style={{
                background: T.card, border: `1px solid ${T.line}`,
                borderRadius: 14, padding: '12px 16px', maxWidth: '70%',
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <div style={{ display: 'flex', gap: 4 }}>
                  {[0, 0.18, 0.36].map((delay, i) => (
                    <span key={i} style={{
                      width: 7, height: 7, borderRadius: '50%',
                      background: T.gold,
                      animation: `agentBlink 1.2s infinite ${delay}s`,
                    }} />
                  ))}
                </div>
                <span style={{ fontSize: 12, color: T.t3 }}>Working on it...</span>
                <style>{`
                  @keyframes agentBlink {
                    0%, 100% { opacity: 0.2; }
                    50% { opacity: 0.85; }
                  }
                `}</style>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div style={{
        padding: '8px 16px 14px', background: T.card,
        borderTop: `1px solid ${T.line}`, flexShrink: 0,
      }}>
        <p style={{ color: T.t4, fontSize: 10, textAlign: 'center', marginBottom: 10 }}>
          Powered by AI &middot; Information for reference only
        </p>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: T.s1, border: `1px solid ${T.line}`,
          borderRadius: 28, padding: '12px 16px',
        }}>
          <textarea
            rows={1}
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask about your pipeline or tasks..."
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: T.t1, fontSize: 13, resize: 'none', lineHeight: 1.5,
              fontFamily: 'inherit',
            }}
          />
          <Mic size={20} color={T.t3} />
        </div>
      </div>
    </div>
  );
}
