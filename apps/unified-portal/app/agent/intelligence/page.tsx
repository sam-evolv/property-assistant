'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import AgentShell from '../_components/AgentShell';
import { useAgent } from '@/lib/agent/AgentContext';
import { Send, Mail, Copy, Check, ExternalLink } from 'lucide-react';

const SCHEME_PILLS = [
  "What's outstanding on contracts?",
  'Give me a scheme summary',
  'Draft a buyer follow-up email',
  'Generate developer weekly report',
];

const INDEPENDENT_PILLS = [
  "Draft replies to today's enquiries",
  'Prepare a vendor update',
  "Who haven't I followed up with?",
  'Chase a solicitor on contracts',
];

interface DraftedEmail {
  to: string;
  subject: string;
  body: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  emails?: DraftedEmail[];
  followups?: string[];
  toolsUsed?: Array<{ name: string; summary: string }>;
}

// Parse <email> blocks from AI response text
function parseEmails(response: string): { emails: DraftedEmail[]; cleanText: string } {
  const emailRegex = /<email>\s*<to>([\s\S]*?)<\/to>\s*<subject>([\s\S]*?)<\/subject>\s*<body>([\s\S]*?)<\/body>\s*<\/email>/g;
  const emails: DraftedEmail[] = [];
  let match;
  while ((match = emailRegex.exec(response)) !== null) {
    emails.push({
      to: match[1].trim(),
      subject: match[2].trim(),
      body: match[3].trim(),
    });
  }

  // Also detect emails in plain-text format (Subject: ... Dear ...)
  if (emails.length === 0) {
    const subjectMatch = response.match(/Subject:\s*(.+?)(?:\n|$)/);
    const dearMatch = response.match(/Dear\s+(\w+)/);
    if (subjectMatch && dearMatch) {
      // Extract the email body starting from "Subject:" to end or next section
      const subjectIdx = response.indexOf('Subject:');
      const bodyText = response.slice(subjectIdx).trim();
      emails.push({
        to: '',
        subject: subjectMatch[1].trim(),
        body: bodyText,
      });
    }
  }

  // Remove email XML blocks from the display text
  const cleanText = response.replace(/<email>[\s\S]*?<\/email>/g, '').trim();

  return { emails, cleanText };
}

export default function IntelligencePage() {
  const { agent, alerts, developmentIds } = useAgent();
  const searchParams = useSearchParams();
  const prefillPrompt = searchParams.get('prompt');
  const isIndependent = agent?.agentType !== 'scheme';
  const PROMPT_PILLS = isIndependent ? INDEPENDENT_PILLS : SCHEME_PILLS;

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [sessionId, setSessionId] = useState<string>(`session_${Date.now()}`);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prefillHandled = useRef(false);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Handle prefilled prompt from URL
  useEffect(() => {
    if (prefillPrompt && !prefillHandled.current) {
      prefillHandled.current = true;
      handleSend(prefillPrompt);
    }
  }, [prefillPrompt]);

  const handleSend = useCallback(async (text: string) => {
    if (!text.trim() || isTyping) return;
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text.trim(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      // Build history from existing messages
      const history = messages.map(m => ({ role: m.role, content: m.content }));

      const response = await fetch('/api/agent-intelligence/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text.trim(),
          history,
          sessionId,
          activeDevelopmentId: developmentIds?.[0] || null,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      // Parse the streaming response
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let fullContent = '';
      let followups: string[] = [];
      let toolsUsed: Array<{ name: string; summary: string }> = [];
      let newSessionId = sessionId;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(l => l.trim());

        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            if (data.type === 'token') {
              fullContent += data.content;
            } else if (data.type === 'followups') {
              followups = data.questions || [];
            } else if (data.type === 'tools_used') {
              toolsUsed = data.tools || [];
            } else if (data.type === 'done') {
              newSessionId = data.sessionId || sessionId;
            }
          } catch {
            // Skip malformed lines
          }
        }
      }

      setSessionId(newSessionId);

      // Parse any email drafts from the response
      const { emails, cleanText } = parseEmails(fullContent);

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: cleanText || fullContent,
        emails: emails.length > 0 ? emails : undefined,
        followups: followups.length > 0 ? followups : undefined,
        toolsUsed: toolsUsed.length > 0 ? toolsUsed : undefined,
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch {
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Something went wrong connecting to Intelligence. Check your connection and try again.',
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  }, [messages, isTyping, sessionId, developmentIds]);

  const hasMessages = messages.length > 0;

  return (
    <AgentShell agentName={agent?.displayName?.split(' ')[0] || 'Agent'} urgentCount={alerts?.length || 0}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          minHeight: 0,
        }}
      >
        {!hasMessages ? (
          /* Landing state */
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
            <Image
              src="/oh-logo.png"
              alt="OpenHouse"
              width={168}
              height={168}
              style={{
                objectFit: 'contain',
                display: 'block',
                mixBlendMode: 'multiply',
                marginBottom: 22,
              }}
              priority
            />

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
              OpenHouse Intelligence
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

            {/* Prompt pills */}
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
          /* Conversation state */
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
            {messages.map(msg =>
              msg.role === 'user' ? (
                <UserBubble key={msg.id} text={msg.content} />
              ) : (
                <AIResponseCard
                  key={msg.id}
                  text={msg.content}
                  emails={msg.emails}
                  followups={msg.followups}
                  onFollowup={handleSend}
                />
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
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend(input)}
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
              disabled={!input.trim() || isTyping}
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
              <Send size={15} color={input.trim() ? '#fff' : '#C0C8D4'} />
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
            Powered by AI. Information for reference only.
          </p>
        </div>
      </div>
    </AgentShell>
  );
}

/* ---- Sub-components ---- */

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

function AIResponseCard({
  text,
  emails,
  followups,
  onFollowup,
}: {
  text: string;
  emails?: DraftedEmail[];
  followups?: string[];
  onFollowup: (text: string) => void;
}) {
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
          width: '100%',
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
          <Image
            src="/oh-logo.png"
            alt=""
            width={24}
            height={24}
            style={{
              objectFit: 'contain',
              mixBlendMode: 'multiply',
              flexShrink: 0,
            }}
          />
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
        {text && (
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
        )}

        {/* Email draft cards */}
        {emails && emails.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: text ? 16 : 0 }}>
            {emails.map((email, i) => (
              <EmailDraftCard key={i} email={email} index={i + 1} total={emails.length} />
            ))}
          </div>
        )}

        {/* Follow-up suggestion chips */}
        {followups && followups.length > 0 && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              marginTop: 16,
              paddingTop: 12,
              borderTop: '1px solid rgba(0,0,0,0.05)',
            }}
          >
            {followups.map((suggestion, i) => (
              <button
                key={i}
                onClick={() => onFollowup(suggestion)}
                className="agent-tappable"
                style={{
                  padding: '8px 14px',
                  background: '#FAFAF8',
                  border: '0.5px solid rgba(0,0,0,0.08)',
                  borderRadius: 20,
                  fontSize: 12.5,
                  fontWeight: 500,
                  color: '#6B7280',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  lineHeight: 1.3,
                  transition: 'all 0.15s ease',
                }}
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EmailDraftCard({ email, index, total }: { email: DraftedEmail; index: number; total: number }) {
  const [copied, setCopied] = useState(false);

  const fullEmailText = email.subject
    ? `Subject: ${email.subject}\n\n${email.body}`
    : email.body;

  const handleSendViaGmail = () => {
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email.to)}&su=${encodeURIComponent(email.subject)}&body=${encodeURIComponent(email.body)}`;
    window.open(gmailUrl, '_blank');
  };

  const handleSendViaMailto = () => {
    const mailtoUrl = `mailto:${email.to}?subject=${encodeURIComponent(email.subject)}&body=${encodeURIComponent(email.body)}`;
    window.location.href = mailtoUrl;
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullEmailText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = fullEmailText;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      style={{
        background: '#FAFAF8',
        borderRadius: 14,
        border: '0.5px solid rgba(0,0,0,0.06)',
        overflow: 'hidden',
      }}
    >
      {/* Email header */}
      <div style={{ padding: '12px 14px', borderBottom: '0.5px solid rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Mail size={13} color="#D4AF37" />
            <span style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Draft {total > 1 ? `${index}/${total}` : ''}
            </span>
          </div>
        </div>
        {email.to && (
          <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 2 }}>
            To: {email.to}
          </div>
        )}
        {email.subject && (
          <div style={{ fontSize: 13, fontWeight: 600, color: '#0D0D12', letterSpacing: '-0.01em' }}>
            {email.subject}
          </div>
        )}
      </div>

      {/* Email body */}
      <div
        style={{
          padding: '12px 14px',
          fontSize: 13,
          lineHeight: 1.6,
          color: '#374151',
          whiteSpace: 'pre-wrap',
          maxHeight: 200,
          overflowY: 'auto',
        }}
      >
        {email.body}
      </div>

      {/* Action buttons */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          padding: '10px 14px',
          borderTop: '0.5px solid rgba(0,0,0,0.05)',
        }}
      >
        <button
          onClick={handleSendViaGmail}
          className="agent-tappable"
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            padding: '10px 12px',
            background: '#0D0D12',
            border: 'none',
            borderRadius: 10,
            fontSize: 12,
            fontWeight: 600,
            color: '#fff',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          <ExternalLink size={13} />
          Send via Gmail
        </button>
        <button
          onClick={handleSendViaMailto}
          className="agent-tappable"
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            padding: '10px 12px',
            background: '#fff',
            border: '0.5px solid rgba(0,0,0,0.1)',
            borderRadius: 10,
            fontSize: 12,
            fontWeight: 600,
            color: '#374151',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          <Mail size={13} />
          Mail App
        </button>
        <button
          onClick={handleCopy}
          className="agent-tappable"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '10px 14px',
            background: '#fff',
            border: '0.5px solid rgba(0,0,0,0.1)',
            borderRadius: 10,
            fontSize: 12,
            fontWeight: 600,
            color: copied ? '#059669' : '#374151',
            cursor: 'pointer',
            fontFamily: 'inherit',
            gap: 6,
            transition: 'color 0.15s ease',
          }}
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
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
        <Image
          src="/oh-logo.png"
          alt=""
          width={24}
          height={24}
          style={{
            objectFit: 'contain',
            mixBlendMode: 'multiply',
            flexShrink: 0,
          }}
        />
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {[0, 1, 2].map(i => (
            <div
              key={i}
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                background: '#C0C8D4',
                animation: `intelligence-pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
              }}
            />
          ))}
        </div>
        <style>{`
          @keyframes intelligence-pulse {
            0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
            40% { opacity: 1; transform: scale(1); }
          }
        `}</style>
      </div>
    </div>
  );
}
