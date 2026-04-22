'use client';

import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { draftTypeLabel } from '@/lib/agent-intelligence/drafts';

interface AutoSendOfferCardProps {
  draftType: string;
  totalSent: number;
  sentEdited: number;
  onEnable: () => Promise<void>;
  onDismiss: () => Promise<void>;
}

/**
 * Shown in the Drafts review "Sent" confirmation state the first time the
 * user crosses eligibility for auto-send on a given draft_type. Copy is
 * pulled straight from the Session 3 spec — understated, no pressure, no
 * dark pattern. Dismissal is as easy as acceptance.
 */
export default function AutoSendOfferCard({
  draftType,
  totalSent,
  sentEdited,
  onEnable,
  onDismiss,
}: AutoSendOfferCardProps) {
  const [busy, setBusy] = useState<'enable' | 'dismiss' | null>(null);

  const typeLabel = draftTypeLabel(draftType).toLowerCase();
  const typeLabelPlural = typeLabel.endsWith('s') ? typeLabel : `${typeLabel}s`;

  return (
    <div
      data-testid="auto-send-offer-card"
      style={{
        margin: '0 18px 18px',
        padding: '14px 16px',
        borderRadius: 14,
        background: '#FFFFFF',
        border: '0.5px solid rgba(0,0,0,0.06)',
        borderLeft: '3px solid #D4AF37',
        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 6,
          color: '#8A6E1F',
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}
      >
        <Sparkles size={12} />
        Offer
      </div>
      <p
        style={{
          margin: '0 0 10px',
          fontSize: 13.5,
          lineHeight: 1.55,
          color: '#0D0D12',
        }}
      >
        You&apos;ve sent {totalSent} {typeLabelPlural} with Intelligence, and only
        edited {sentEdited} of them before sending. Want me to start sending
        these automatically? You&apos;ll still have 10 seconds to pull each
        one back before it goes.
      </p>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button
          data-testid="auto-send-offer-enable"
          onClick={async () => {
            setBusy('enable');
            try { await onEnable(); } finally { setBusy(null); }
          }}
          disabled={busy !== null}
          className="agent-tappable"
          style={{
            padding: '8px 14px',
            background: 'linear-gradient(135deg, #C49B2A, #E8C84A)',
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            fontSize: 12.5,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {busy === 'enable' ? 'Turning on...' : 'Turn on auto-send'}
        </button>
        <button
          data-testid="auto-send-offer-dismiss"
          onClick={async () => {
            setBusy('dismiss');
            try { await onDismiss(); } finally { setBusy(null); }
          }}
          disabled={busy !== null}
          className="agent-tappable"
          style={{
            padding: '8px 12px',
            background: 'transparent',
            color: '#6B7280',
            border: '0.5px solid rgba(0,0,0,0.12)',
            borderRadius: 10,
            fontSize: 12.5,
            fontWeight: 500,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Not yet
        </button>
      </div>
      <p
        style={{
          margin: '8px 0 0',
          fontSize: 11,
          color: '#9CA3AF',
          letterSpacing: '0.005em',
        }}
      >
        You can change this anytime in settings.
      </p>
    </div>
  );
}
