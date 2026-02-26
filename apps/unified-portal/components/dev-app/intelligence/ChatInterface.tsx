'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send } from 'lucide-react';
import MessageBubble, { type IntelligenceMessage } from './MessageBubble';
import TypingIndicator from '../shared/TypingIndicator';
import VoiceInput from './VoiceInput';

interface ChatInterfaceProps {
  conversationId: string | null;
  initialMessages?: IntelligenceMessage[];
  onConversationCreated?: (id: string) => void;
  prefillText?: string;
}

export default function ChatInterface({
  conversationId,
  initialMessages = [],
  onConversationCreated,
  prefillText,
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<IntelligenceMessage[]>(initialMessages);
  const [input, setInput] = useState(prefillText || '');
  const [isLoading, setIsLoading] = useState(false);
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [activeConvoId, setActiveConvoId] = useState(conversationId);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  // Auto-send prefill
  useEffect(() => {
    if (prefillText && messages.length === 0) {
      setInput(prefillText);
    }
  }, [prefillText, messages.length]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return;

      const userMessage: IntelligenceMessage = {
        id: `temp-${Date.now()}`,
        role: 'user',
        message_type: 'text',
        content: text.trim(),
        created_at: new Date().toISOString(),
      };

      setMessages((prev: IntelligenceMessage[]) => [...prev, userMessage]);
      setInput('');
      setIsLoading(true);

      try {
        const res = await fetch('/api/dev-app/intelligence/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text.trim(),
            conversation_id: activeConvoId,
          }),
        });

        if (res.ok) {
          const data = await res.json();

          if (data.conversation_id && !activeConvoId) {
            setActiveConvoId(data.conversation_id);
            onConversationCreated?.(data.conversation_id);
          }

          // Add assistant messages
          if (data.messages && Array.isArray(data.messages)) {
            setMessages((prev: IntelligenceMessage[]) => [...prev, ...data.messages]);
          } else if (data.message) {
            setMessages((prev: IntelligenceMessage[]) => [...prev, data.message]);
          }
        } else {
          setMessages((prev: IntelligenceMessage[]) => [
            ...prev,
            {
              id: `err-${Date.now()}`,
              role: 'assistant',
              message_type: 'text',
              content: 'Sorry, I encountered an error. Please try again.',
              created_at: new Date().toISOString(),
            },
          ]);
        }
      } catch {
        setMessages((prev: IntelligenceMessage[]) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            role: 'assistant',
            message_type: 'text',
            content: 'Connection error. Please check your network and try again.',
            created_at: new Date().toISOString(),
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [activeConvoId, isLoading, onConversationCreated]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleSendEmail = async (messageId: string) => {
    try {
      const res = await fetch('/api/dev-app/intelligence/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message_id: messageId,
          conversation_id: activeConvoId,
        }),
      });
      if (res.ok) {
        setMessages((prev: IntelligenceMessage[]) => [
          ...prev,
          {
            id: `action-${Date.now()}`,
            role: 'assistant',
            message_type: 'action_result',
            content: 'Email sent successfully',
            created_at: new Date().toISOString(),
          },
        ]);
      }
    } catch {
      // Ignore
    }
  };

  const handleEditEmail = (body: string) => {
    setInput(body);
    inputRef.current?.focus();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-3"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {messages.map((msg: IntelligenceMessage) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            onSendEmail={handleSendEmail}
            onEditEmail={handleEditEmail}
          />
        ))}

        {isLoading && (
          <div className="mb-4">
            <TypingIndicator />
          </div>
        )}
      </div>

      {/* Input bar - always visible with gold send button */}
      <div
        className="border-t border-[#f3f4f6] bg-white px-4 py-2.5"
        style={{
          paddingBottom:
            'calc(12px + var(--safe-bottom, env(safe-area-inset-bottom, 0px)))',
        }}
      >
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e: any) => setInput(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 h-10 px-4 rounded-full bg-[#f9fafb] text-[14px] text-[#111827] placeholder-[#9ca3af] outline-none focus:ring-2 focus:ring-[#D4AF37]/30"
            style={{ borderRadius: 24 }}
            disabled={isLoading}
          />
          <VoiceInput
            onTranscript={(text) => setInput(text)}
            onListening={setIsVoiceActive}
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading}
            className="da-press flex items-center justify-center"
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              backgroundColor: '#D4AF37',
              boxShadow: '0 2px 8px rgba(212,175,55,0.3)',
              border: 'none',
              cursor: 'pointer',
              flexShrink: 0,
              opacity: 1,
            }}
          >
            <Send size={16} className="text-white" />
          </button>
        </form>
      </div>
    </div>
  );
}
