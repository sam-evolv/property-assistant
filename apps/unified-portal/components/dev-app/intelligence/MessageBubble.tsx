'use client';

import OHLogo from '../shared/OHLogo';
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

export interface MessageBubbleProps {
  message: IntelligenceMessage;
  onSendEmail?: (messageId: string) => Promise<void> | void;
  onEditEmail?: (body: string) => void;
}

export default function MessageBubble({ message, onSendEmail, onEditEmail }: MessageBubbleProps) {
  if (message.role === 'system') return null;

  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div className="da-anim-in flex justify-end mb-4">
        <div
          style={{
            maxWidth: '78%',
            background: '#111827',
            color: '#fff',
            borderRadius: 20,
            borderBottomRightRadius: 6,
            padding: '12px 16px',
            fontSize: 14,
            lineHeight: 1.5,
          }}
        >
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="da-anim-in flex gap-2 mb-4" style={{ alignItems: 'flex-start' }}>
      <div style={{ flexShrink: 0, paddingTop: 2 }}>
        <OHLogo size={26} />
      </div>

      <div style={{ maxWidth: '85%', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {/* Rich cards */}
        {message.message_type === 'unit_info' && message.structured_data && (
          <UnitInfoCard data={message.structured_data} />
        )}
        {message.message_type === 'email_draft' && message.structured_data && (
          <EmailDraftCard
            data={message.structured_data}
            onSend={() => onSendEmail?.(message.id)}
            onEdit={onEditEmail}
          />
        )}
        {message.message_type === 'summary' && message.structured_data && (
          <SummaryCard data={message.structured_data} />
        )}
        {message.message_type === 'alert_list' && message.structured_data && (
          <AlertListCard data={message.structured_data} />
        )}

        {/* Action result bubble */}
        {message.message_type === 'action_result' && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 8,
              background: 'rgba(5,150,105,0.08)',
              fontSize: 12,
              color: '#059669',
              fontWeight: 500,
            }}
          >
            <Check size={14} />
            {message.content}
          </div>
        )}

        {/* Text content */}
        {message.message_type === 'text' && message.content && (
          <div
            style={{
              background: '#f9fafb',
              color: '#111827',
              borderRadius: 20,
              borderBottomLeftRadius: 6,
              border: '1px solid #f3f4f6',
              padding: '12px 16px',
              fontSize: 14,
              lineHeight: 1.5,
            }}
          >
            {message.content}
          </div>
        )}
      </div>
    </div>
  );
}
