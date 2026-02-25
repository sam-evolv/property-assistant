'use client';

import { useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { MessageCircle, ClipboardList } from 'lucide-react';
import MobileShell from '@/components/dev-app/layout/MobileShell';
import OHLogo from '@/components/dev-app/shared/OHLogo';
import ChatInterface from '@/components/dev-app/intelligence/ChatInterface';
import SuggestedPrompts from '@/components/dev-app/intelligence/SuggestedPrompts';
import ActionLog from '@/components/dev-app/intelligence/ActionLog';

export default function IntelligencePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const unitParam = searchParams.get('unit');
  const unitIdParam = searchParams.get('unit_id');

  const [view, setView] = useState<'chat' | 'log'>('chat');
  const [hasConversation, setHasConversation] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [prefillText, setPrefillText] = useState(
    unitParam ? `Tell me about Unit ${unitParam}` : ''
  );

  const handlePromptSelect = (prompt: string) => {
    setPrefillText(prompt);
    setHasConversation(true);
  };

  return (
    <MobileShell>
      {/* Header */}
      <header
        className="sticky top-0 z-30 border-b frosted-glass-light"
        style={{
          borderColor: '#f3f4f6',
          paddingTop:
            'calc(12px + var(--safe-top, env(safe-area-inset-top, 0px)))',
          paddingBottom: '12px',
        }}
      >
        <div className="flex items-center justify-between px-4">
          <div className="flex items-center gap-2.5">
            <OHLogo size={24} variant="icon-gold" />
            <h1
              className="font-extrabold text-[#111827]"
              style={{ fontSize: 20, letterSpacing: '-0.03em' }}
            >
              Intelligence
            </h1>
          </div>

          <div className="flex items-center gap-1 bg-[#f3f4f6] rounded-full p-0.5">
            <button
              onClick={() => setView('chat')}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all"
              style={{
                backgroundColor: view === 'chat' ? '#fff' : 'transparent',
                color: view === 'chat' ? '#111827' : '#9ca3af',
                boxShadow:
                  view === 'chat'
                    ? '0 1px 3px rgba(0,0,0,0.08)'
                    : 'none',
              }}
            >
              <MessageCircle size={12} />
              Chat
            </button>
            <button
              onClick={() => setView('log')}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all"
              style={{
                backgroundColor: view === 'log' ? '#fff' : 'transparent',
                color: view === 'log' ? '#111827' : '#9ca3af',
                boxShadow:
                  view === 'log'
                    ? '0 1px 3px rgba(0,0,0,0.08)'
                    : 'none',
              }}
            >
              <ClipboardList size={12} />
              Log
            </button>
          </div>
        </div>
      </header>

      {view === 'chat' ? (
        hasConversation || prefillText ? (
          <ChatInterface
            conversationId={conversationId}
            onConversationCreated={setConversationId}
            prefillText={prefillText}
          />
        ) : (
          <SuggestedPrompts onSelect={handlePromptSelect} />
        )
      ) : (
        <ActionLog />
      )}
    </MobileShell>
  );
}
