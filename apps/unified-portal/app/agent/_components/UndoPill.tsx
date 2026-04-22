'use client';

import { useEffect, useState } from 'react';
import { Undo2 } from 'lucide-react';

interface UndoPillProps {
  batchId: string;
  createdAt: number;
  onUndo: () => void;
  onExpire: () => void;
}

/**
 * 60-second undo affordance that floats above the input bar after an approval.
 * Expires silently after the countdown or when dismissed.
 */
export default function UndoPill({ batchId, createdAt, onUndo, onExpire }: UndoPillProps) {
  const [remaining, setRemaining] = useState(() => Math.max(0, 60 - Math.floor((Date.now() - createdAt) / 1000)));

  useEffect(() => {
    if (remaining <= 0) {
      onExpire();
      return;
    }
    const interval = setInterval(() => {
      const next = Math.max(0, 60 - Math.floor((Date.now() - createdAt) / 1000));
      setRemaining(next);
      if (next <= 0) {
        clearInterval(interval);
        onExpire();
      }
    }, 500);
    return () => clearInterval(interval);
  }, [createdAt, remaining, onExpire]);

  if (remaining <= 0) return null;

  return (
    <div
      data-testid="voice-undo-pill"
      data-batch-id={batchId}
      style={{
        position: 'absolute',
        bottom: 96,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 50,
        pointerEvents: 'auto',
      }}
    >
      <button
        onClick={onUndo}
        className="agent-tappable"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: '#0D0D12',
          color: '#fff',
          border: 'none',
          borderRadius: 999,
          padding: '10px 16px',
          fontSize: 12.5,
          fontWeight: 600,
          fontFamily: 'inherit',
          cursor: 'pointer',
          boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
          letterSpacing: '0.01em',
        }}
      >
        <Undo2 size={14} />
        Undo last actions
        <span
          style={{
            fontSize: 11,
            color: '#E8C84A',
            fontWeight: 500,
          }}
        >
          {remaining}s
        </span>
      </button>
    </div>
  );
}
