'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

interface AutoSendCountdownProps {
  label: string;
  countdownSeconds: number;
  onElapsed: () => void;
  onCancel: () => void;
  active: boolean;
}

/**
 * Thin banner that sits at the top of the confirmation card while an
 * auto-send is pending. Ticks down once per second from the server-supplied
 * countdown, fires onElapsed at zero, or onCancel when the user taps the
 * X. `active` stops the countdown externally (e.g. after success/failure).
 */
export default function AutoSendCountdown({
  label,
  countdownSeconds,
  onElapsed,
  onCancel,
  active,
}: AutoSendCountdownProps) {
  const [remaining, setRemaining] = useState(countdownSeconds);
  const elapsedFired = useRef(false);

  useEffect(() => {
    if (!active) return;
    if (remaining <= 0) {
      if (!elapsedFired.current) {
        elapsedFired.current = true;
        onElapsed();
      }
      return;
    }
    const id = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(id);
  }, [remaining, active, onElapsed]);

  if (!active) return null;

  return (
    <div
      data-testid="auto-send-countdown"
      data-remaining={remaining}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 14px',
        background: 'linear-gradient(135deg, rgba(196,155,42,0.08), rgba(232,200,74,0.12))',
        border: '0.5px solid rgba(196,155,42,0.35)',
        borderRadius: 12,
        marginBottom: 12,
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          background: 'linear-gradient(135deg, #C49B2A, #E8C84A)',
          color: '#fff',
          fontSize: 12,
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {remaining}
      </div>
      <span
        style={{
          flex: 1,
          fontSize: 13,
          fontWeight: 500,
          color: '#0D0D12',
          lineHeight: 1.4,
        }}
      >
        {label} in {remaining}s
      </span>
      <button
        data-testid="auto-send-cancel"
        onClick={onCancel}
        aria-label="Cancel auto-send"
        className="agent-tappable"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '6px 10px',
          background: 'transparent',
          color: '#DC2626',
          border: '0.5px solid rgba(220,38,38,0.25)',
          borderRadius: 999,
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        <X size={12} />
        Cancel
      </button>
    </div>
  );
}
