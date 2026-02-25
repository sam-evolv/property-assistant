'use client';

import { ChatAvatar } from '../shared/OHLogo';
import UnitInfoCard from './rich-cards/UnitInfoCard';
import EmailDraftCard from './rich-cards/EmailDraftCard';
import SummaryCard from './rich-cards/SummaryCard';
import AlertListCard from './rich-cards/AlertListCard';
import { Check } from 'lucide-react';

export interface IntelligenceMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  message_type: 'text' | 'unit_info' | 'email_draft' | 'summary' | 'alert_list' | 'action_result';
  content: string;
  structured_data?: any;
  created_at: string;
}

interface MessageBubbleProps {
  message: IntelligenceMessage;
  onSendEmail?: (messageId: string) => void;
  onEditEmail?: (body: string) => void;
}

export default function MessageBubble({ message, onSendEmail, onEditEmail }: MessageBubbleProps) {
  if (message.role === 'system') return null;

  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'} mb-4`}>
      {/* Avatar for assistant */}
      {!isUser && <ChatAvatar />}

      <div className={`max-w-[85%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1.5`}>
        {/* Rich cards */}
        {!isUser && message.message_type === 'unit_info' && message.structured_data && (
          <UnitInfoCard data={message.structured_data} />
        )}
        {!isUser && message.message_type === 'email_draft' && message.structured_data && (
          <EmailDraftCard
            data={message.structured_data}
            onSend={() => onSendEmail?.(message.id)}
            onEdit={onEditEmail}
          />
        )}
        {!isUser && message.message_type === 'summary' && message.structured_data && (
          <SummaryCard data={message.structured_data} />
        )}
        {!isUser && message.message_type === 'alert_list' && message.structured_data && (
          <AlertListCard data={message.structured_data} />
        )}

        {/* Action result bubble */}
        {!isUser && message.message_type === 'action_result' && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[rgba(5,150,105,0.08)] text-[12px] text-[#059669] font-medium">
            <Check size={14} />
            {message.content}
          </div>
        )}

        {/* Text content */}
        {message.content && (message.message_type === 'text' || (message.message_type !== 'action_result' && message.content)) && (
          <div
            className={`px-3.5 py-2.5 rounded-2xl text-[13px] leading-relaxed ${
              isUser
                ? 'bg-[#111827] text-white rounded-br-md'
                : 'bg-[#f3f4f6] text-[#111827] rounded-bl-md'
            }`}
          >
            {message.content}
          </div>
        )}
      </div>
    </div>
  );
}
