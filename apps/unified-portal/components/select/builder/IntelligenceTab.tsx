'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Send, Sparkles } from 'lucide-react';
import { colors, EASE } from '@/components/select/builder/tokens';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTIONS = [
  'Outstanding BER certs?',
  'Any snags older than 2 weeks?',
  "What's the status of 14 Innishmore?",
  'Which HomeBond certs are missing?',
];

export default function IntelligenceTab({ projectId }: { projectId: string }) {
  const supabase = createClientComponentClient();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [builderId, setBuilderId] = useState('');
  const [builderName, setBuilderName] = useState('');
  const [projectAddress, setProjectAddress] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setBuilderId(user.id);
        setBuilderName(
          user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Builder'
        );
      }
      const { data: proj } = await supabase
        .from('select_builder_projects')
        .select('address')
        .eq('id', projectId)
        .single();
      if (proj) setProjectAddress(proj.address);
    }
    init();
  }, [supabase, projectId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;

    const newMessages: Message[] = [...messages, { role: 'user', content: text.trim() }];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/select/builder/intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages,
          project_id: projectId,
          builder_id: builderId,
          builder_name: builderName,
          project_address: projectAddress,
        }),
      });

      if (!res.ok) throw new Error('Request failed');

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No stream');

      const decoder = new TextDecoder();
      let assistantContent = '';

      setMessages([...newMessages, { role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        assistantContent += chunk;
        setMessages([...newMessages, { role: 'assistant', content: assistantContent }]);
      }
    } catch (err) {
      console.error('[Intelligence] Error:', err);
      setMessages([
        ...newMessages,
        { role: 'assistant', content: 'Something went wrong. Please try again.' },
      ]);
    } finally {
      setLoading(false);
    }
  }, [messages, loading, projectId, builderId, builderName, projectAddress]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const hasMessages = messages.length > 0;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: 'calc(100vh - 48px)',
      maxWidth: 720,
    }}>
      {/* Chat area */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px 0',
        }}
      >
        {/* Landing state */}
        {!hasMessages && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            paddingTop: 80,
            textAlign: 'center',
          }}>
            {/* Logo circle */}
            <div style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: colors.surface2,
              border: `1px solid ${colors.borderGold}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 12,
            }}>
              <Sparkles size={22} color={colors.gold} />
            </div>
            <div style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: colors.gold,
              marginBottom: 12,
            }}>
              OpenHouse Intelligence
            </div>
            <div style={{
              fontSize: 20,
              fontWeight: 600,
              color: colors.textPrimary,
              marginBottom: 8,
            }}>
              Ask anything across your projects.
            </div>
            <div style={{
              fontSize: 14,
              color: colors.textSecondary,
              marginBottom: 28,
              maxWidth: 400,
            }}>
              Documents, snags, milestones, compliance — all queryable from one place.
            </div>
            {/* Suggestion chips */}
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              justifyContent: 'center',
              maxWidth: 480,
            }}>
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  style={{
                    padding: '7px 14px',
                    borderRadius: 20,
                    background: colors.surface2,
                    border: `1px solid ${colors.border}`,
                    color: colors.textSecondary,
                    fontSize: 12,
                    cursor: 'pointer',
                    transition: `all 200ms ${EASE}`,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(212,175,55,0.3)';
                    e.currentTarget.style.color = colors.textPrimary;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = colors.border;
                    e.currentTarget.style.color = colors.textSecondary;
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        {hasMessages && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {messages.map((m, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
                }}
              >
                <div style={{
                  maxWidth: '85%',
                  padding: '10px 14px',
                  borderRadius: 14,
                  fontSize: 14,
                  lineHeight: 1.6,
                  ...(m.role === 'user'
                    ? {
                        background: `linear-gradient(135deg, ${colors.gold}, #b8941f)`,
                        color: colors.bg,
                        borderBottomRightRadius: 4,
                      }
                    : {
                        background: colors.surface2,
                        border: `1px solid ${colors.border}`,
                        color: colors.textPrimary,
                        borderBottomLeftRadius: 4,
                      }),
                }}>
                  {m.content || (
                    <span style={{ display: 'flex', gap: 4 }}>
                      <span style={{ animation: 'intDot 1.4s ease-in-out infinite', animationDelay: '0ms' }}>●</span>
                      <span style={{ animation: 'intDot 1.4s ease-in-out infinite', animationDelay: '200ms' }}>●</span>
                      <span style={{ animation: 'intDot 1.4s ease-in-out infinite', animationDelay: '400ms' }}>●</span>
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Input bar */}
      <form
        onSubmit={handleSubmit}
        style={{
          display: 'flex',
          gap: 8,
          padding: '12px 0',
          borderTop: `1px solid ${colors.border}`,
        }}
      >
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your projects..."
          disabled={loading}
          style={{
            flex: 1,
            padding: '10px 14px',
            borderRadius: 10,
            background: colors.surface2,
            border: `1px solid ${colors.border}`,
            color: colors.textPrimary,
            fontSize: 14,
            outline: 'none',
            transition: `border-color 200ms ${EASE}`,
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(212,175,55,0.4)'; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = colors.border; }}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          style={{
            width: 42,
            height: 42,
            borderRadius: 10,
            background: input.trim() ? colors.gold : colors.surface3,
            border: 'none',
            color: input.trim() ? colors.bg : colors.textMuted,
            cursor: input.trim() ? 'pointer' : 'default',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: `all 200ms ${EASE}`,
            flexShrink: 0,
          }}
        >
          <Send size={16} />
        </button>
      </form>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes intDot {
          0%, 80%, 100% { opacity: 0.3; }
          40% { opacity: 1; }
        }
      `}} />
    </div>
  );
}
