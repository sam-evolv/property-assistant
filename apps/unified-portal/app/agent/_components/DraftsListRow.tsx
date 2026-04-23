'use client';

import { useEffect, useRef, useState } from 'react';
import { MailCheck, Trash2, Send as SendIcon } from 'lucide-react';
import {
  draftTypeLabel,
  relativeTimestamp,
  type DraftRecord,
} from '@/lib/agent-intelligence/drafts';

const SWIPE_REVEAL = 84;
const SWIPE_TRIGGER = 60;

interface DraftsListRowProps {
  draft: DraftRecord;
  onOpen: (draft: DraftRecord) => void;
  onDiscard: (draft: DraftRecord) => Promise<void> | void;
  onQuickSend: (draft: DraftRecord) => Promise<void> | void;
}

/**
 * Single draft row. Mobile-first with iOS-style swipe gestures.
 *   - Swipe left reveals the red Discard action
 *   - Swipe right reveals the gold Send action
 * Desktop users just tap the row; the swipe handlers no-op on pointer types
 * that aren't touch.
 */
export default function DraftsListRow({
  draft,
  onOpen,
  onDiscard,
  onQuickSend,
}: DraftsListRowProps) {
  const [dragX, setDragX] = useState(0);
  const startX = useRef<number | null>(null);
  const [busy, setBusy] = useState<'send' | 'discard' | null>(null);

  const preview = (draft.body || '').split('\n').slice(0, 2).join(' ').slice(0, 180);
  const methodLabel = draft.sendMethod === 'whatsapp'
    ? 'WhatsApp'
    : draft.sendMethod === 'sms'
      ? 'SMS'
      : 'Email';

  // Reset swipe state whenever this row's draft identity changes. Without
  // this, React row reuse across list re-renders can leave the button
  // half-translated, leaving the Send/Discard backdrop orphaned on-screen
  // (the bug Orla reported: gold "Send" visible on an unswiped row).
  useEffect(() => {
    setDragX(0);
    startX.current = null;
    setBusy(null);
  }, [draft.id]);

  const resetSwipe = () => {
    startX.current = null;
    setDragX(0);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (startX.current == null) return;
    const dx = e.touches[0].clientX - startX.current;
    const clamped = Math.max(-SWIPE_REVEAL, Math.min(SWIPE_REVEAL, dx));
    setDragX(clamped);
  };
  const handleTouchEnd = async () => {
    const dx = dragX;
    startX.current = null;
    if (dx <= -SWIPE_TRIGGER) {
      setBusy('discard');
      try { await onDiscard(draft); } finally { setBusy(null); setDragX(0); }
      return;
    }
    if (dx >= SWIPE_TRIGGER) {
      setBusy('send');
      try { await onQuickSend(draft); } finally { setBusy(null); setDragX(0); }
      return;
    }
    setDragX(0);
  };
  // iOS fires touchcancel when a gesture is interrupted (vertical scroll
  // takeover, modal opening mid-swipe, the system taking touch focus).
  // Without handling it, `dragX` stays at its last touchmove value and the
  // backdrop stays exposed.
  const handleTouchCancel = () => {
    resetSwipe();
  };

  return (
    <div
      data-testid="drafts-list-row"
      style={{
        position: 'relative',
        background: '#FFFFFF',
        borderRadius: 14,
        overflow: 'hidden',
        border: '0.5px solid rgba(0,0,0,0.06)',
        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
        // Let vertical scroll pass through without fighting the horizontal
        // swipe gesture — iOS honours this and cancels the swipe cleanly.
        touchAction: 'pan-y',
      }}
    >
      {/* Swipe action backdrops. While the button is at translateX(0) these
          must be visually below AND unreachable — otherwise a tap on the
          edge of a row lands on the hidden Send button instead of opening
          the draft. */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'stretch',
          pointerEvents: dragX === 0 ? 'none' : 'auto',
        }}
      >
        <div
          style={{
            width: SWIPE_REVEAL,
            background: 'linear-gradient(135deg, #C49B2A, #E8C84A)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            gap: 6,
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          <SendIcon size={16} /> Send
        </div>
        <div
          style={{
            width: SWIPE_REVEAL,
            background: '#DC2626',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            gap: 6,
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          <Trash2 size={16} /> Discard
        </div>
      </div>

      <button
        type="button"
        onClick={() => {
          // If the row is partway through a swipe, a tap should snap the
          // button back rather than open the draft — matches Mail.app.
          if (dragX !== 0) {
            resetSwipe();
            return;
          }
          onOpen(draft);
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
        className="agent-tappable"
        style={{
          position: 'relative',
          display: 'block',
          width: '100%',
          textAlign: 'left',
          background: '#FFFFFF',
          border: 'none',
          padding: '14px 16px',
          cursor: 'pointer',
          fontFamily: 'inherit',
          transform: `translateX(${dragX}px)`,
          transition: startX.current == null ? 'transform 0.15s ease' : 'none',
          opacity: busy ? 0.6 : 1,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 4,
            gap: 8,
          }}
        >
          <span
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: '#0D0D12',
              letterSpacing: '-0.01em',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '60%',
            }}
          >
            {draft.recipient.name || 'Unknown recipient'}
          </span>
          <span
            style={{
              fontSize: 11,
              color: '#9CA3AF',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {relativeTimestamp(draft.createdAt)}
          </span>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 6,
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: '#8A6E1F',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <MailCheck size={12} />
            {draftTypeLabel(draft.draftType)}
          </span>
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 500,
              color: '#6B7280',
              background: 'rgba(0,0,0,0.05)',
              padding: '2px 7px',
              borderRadius: 999,
            }}
          >
            {methodLabel}
          </span>
        </div>
        <p
          style={{
            fontSize: 13,
            lineHeight: 1.45,
            color: '#6B7280',
            margin: 0,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            maskImage:
              preview.length > 140
                ? 'linear-gradient(to bottom, #000 80%, transparent 100%)'
                : undefined,
            WebkitMaskImage:
              preview.length > 140
                ? 'linear-gradient(to bottom, #000 80%, transparent 100%)'
                : undefined,
          }}
        >
          {preview || 'No preview'}
        </p>
      </button>
    </div>
  );
}
