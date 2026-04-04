'use client';

import type { Buyer } from './types';
import StatusBadge from './StatusBadge';
import TimelineTrack from './TimelineTrack';

interface BuyerCardProps {
  buyer: Buyer;
}

export default function BuyerCard({ buyer }: BuyerCardProps) {
  const isUrgent = buyer.isUrgent && buyer.daysOverdue > 0;

  return (
    <div
      className="agent-tappable"
      style={{
        background: '#FFFFFF',
        borderRadius: 18,
        padding: '16px 18px',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: isUrgent
          ? '0 2px 12px rgba(239, 68, 68, 0.08), 0 1px 3px rgba(239, 68, 68, 0.05)'
          : '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05), 0 0 0 0.5px rgba(0,0,0,0.04)',
      }}
    >
      {/* Urgent left bar */}
      {isUrgent && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 3,
            background: 'linear-gradient(180deg, #EF4444, #DC2626)',
            borderRadius: '3px 0 0 3px',
          }}
        />
      )}

      <div style={{ paddingLeft: isUrgent ? 8 : 0 }}>
        {/* Overdue chip */}
        {isUrgent && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '4px 10px',
              background: '#FEF2F2',
              border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 20,
              marginBottom: 12,
            }}
          >
            <span
              style={{
                color: '#DC2626',
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.03em',
              }}
            >
              {buyer.daysOverdue} days overdue
            </span>
          </div>
        )}

        {/* Name row: avatar + name/unit + badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 14,
          }}
        >
          {/* Avatar */}
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #FFFBEB, #FEF3C7)',
              border: '1px solid rgba(212, 175, 55, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <span
              style={{
                color: '#92400E',
                fontSize: 14,
                fontWeight: 700,
                lineHeight: 1,
              }}
            >
              {buyer.initials}
            </span>
          </div>

          {/* Name + unit */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 15,
                fontWeight: 600,
                letterSpacing: '-0.025em',
                color: '#0D0D12',
                lineHeight: 1.2,
              }}
            >
              {buyer.name}
            </div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 400,
                letterSpacing: '0.005em',
                color: '#A0A8B0',
                marginTop: 2,
              }}
            >
              {buyer.unit}
            </div>
          </div>

          {/* Status badge */}
          <StatusBadge status={buyer.status} />
        </div>

        {/* Timeline track */}
        <TimelineTrack
          depositDate={buyer.depositDate}
          contractsDate={buyer.contractsDate}
          signedDate={buyer.signedDate}
          closingDate={buyer.closingDate}
        />

        {/* Price pill */}
        <div style={{ marginTop: 12, display: 'flex' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              background: '#F5F5F3',
              border: '0.5px solid rgba(0,0,0,0.07)',
              borderRadius: 20,
            }}
          >
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.05em',
                color: '#A0A8B0',
                textTransform: 'uppercase' as const,
              }}
            >
              PRICE
            </span>
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: '-0.02em',
                color: '#0D0D12',
              }}
            >
              {formatPrice(buyer.price)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatPrice(n: number): string {
  return '€' + n.toLocaleString('en-IE');
}
