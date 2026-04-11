'use client';

import type { BadgeStatus } from './types';

const BADGE_CONFIG: Record<BadgeStatus, { bg: string; border: string; dot: string; text: string; label: string }> = {
  contracts_out: { bg: '#FEF2F2', border: 'rgba(239,68,68,0.2)',  dot: '#EF4444', text: '#B91C1C', label: 'CONTRACTS OUT' },
  reserved:      { bg: '#EFF6FF', border: 'rgba(59,130,246,0.2)',  dot: '#3B82F6', text: '#1D4ED8', label: 'RESERVED'      },
  exchanged:     { bg: '#F5F3FF', border: 'rgba(124,58,237,0.2)',  dot: '#7C3AED', text: '#5B21B6', label: 'EXCHANGED'     },
  available:     { bg: '#ECFDF5', border: 'rgba(16,185,129,0.2)',  dot: '#10B981', text: '#065F46', label: 'AVAILABLE'     },
  confirmed:     { bg: '#ECFDF5', border: 'rgba(16,185,129,0.2)',  dot: '#10B981', text: '#065F46', label: 'CONFIRMED'     },
  pending:       { bg: '#FFFBEB', border: 'rgba(245,158,11,0.2)',  dot: '#F59E0B', text: '#92400E', label: 'PENDING'       },
  completed:     { bg: '#F0FDF4', border: 'rgba(34,197,94,0.2)',   dot: '#22C55E', text: '#166534', label: 'COMPLETED'     },
  cancelled:     { bg: '#F5F5F5', border: 'rgba(163,163,163,0.2)', dot: '#A3A3A3', text: '#525252', label: 'CANCELLED'     },
  no_show:       { bg: '#FEF2F2', border: 'rgba(239,68,68,0.2)',   dot: '#EF4444', text: '#B91C1C', label: 'NO SHOW'       },
};

interface StatusBadgeProps {
  status: BadgeStatus;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const c = BADGE_CONFIG[status];

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '3px 10px',
        borderRadius: 20,
        background: c.bg,
        border: `1px solid ${c.border}`,
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: '50%',
          background: c.dot,
          flexShrink: 0,
        }}
      />
      <span
        style={{
          fontSize: 9.5,
          fontWeight: 700,
          letterSpacing: '0.06em',
          color: c.text,
          textTransform: 'uppercase' as const,
          lineHeight: 1,
        }}
      >
        {c.label}
      </span>
    </span>
  );
}
