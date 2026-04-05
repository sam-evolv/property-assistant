'use client';

import Link from 'next/link';
import type { Scheme } from './types';

interface SchemeCardProps {
  scheme: Scheme;
  showViewBuyers?: boolean;
}

export default function SchemeCard({ scheme, showViewBuyers }: SchemeCardProps) {
  return (
    <div
      className="agent-tappable"
      style={{
        background: '#FFFFFF',
        borderRadius: 18,
        overflow: 'hidden',
        boxShadow:
          '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05), 0 0 0 0.5px rgba(0,0,0,0.04)',
      }}
    >
      <Link
        href={`/agent/pipeline/${scheme.id}`}
        style={{ textDecoration: 'none', display: 'block', padding: '16px 18px' }}
      >
        {/* Header: name + percentage */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            marginBottom: 2,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                fontSize: 15,
                fontWeight: 600,
                letterSpacing: '-0.025em',
                color: '#0D0D12',
              }}
            >
              {scheme.name}
            </span>
            {scheme.urgentCount > 0 && (
              <span
                style={{
                  background: '#FEF2F2',
                  border: '1px solid rgba(239,68,68,0.2)',
                  borderRadius: 20,
                  padding: '2px 7px',
                  fontSize: 9.5,
                  fontWeight: 700,
                  color: '#DC2626',
                  lineHeight: 1.2,
                }}
              >
                {scheme.urgentCount}
              </span>
            )}
          </div>
          <span
            style={{
              background: 'linear-gradient(135deg, #B8960C, #E8C84A)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              fontSize: 15,
              fontWeight: 700,
              letterSpacing: '-0.02em',
            }}
          >
            {scheme.percentSold}%
          </span>
        </div>

        {/* Subtitle */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 10,
          }}
        >
          <span
            style={{
              fontSize: 13,
              fontWeight: 400,
              letterSpacing: '0.005em',
              color: '#A0A8B0',
            }}
          >
            {scheme.developer} &middot; {scheme.location}
          </span>
          <span
            style={{
              fontSize: 13,
              fontWeight: 400,
              letterSpacing: '0.005em',
              color: '#A0A8B0',
            }}
          >
            {scheme.sold} of {scheme.totalUnits}
          </span>
        </div>

        {/* Progress bar */}
        <div
          style={{
            height: 3,
            background: 'rgba(0,0,0,0.05)',
            borderRadius: 2,
            overflow: 'hidden',
            marginBottom: 10,
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${scheme.percentSold}%`,
              background: 'linear-gradient(90deg, #B8960C, #E8C84A)',
              borderRadius: 2,
              transition: 'width 0.3s ease',
            }}
          />
        </div>

        {/* Status dots */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <StatusDot color="#10B981" label={`${scheme.sold} Sold`} />
          <StatusDot color="#3B82F6" label={`${scheme.reserved} Reserved`} />
          <StatusDot color="#A0A8B0" label={`${scheme.available} Available`} />
        </div>
      </Link>

      {/* Footer: View buyers */}
      {showViewBuyers && (
        <Link
          href={`/agent/pipeline/${scheme.id}`}
          className="agent-tappable"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 18px',
            borderTop: '1px solid rgba(0,0,0,0.04)',
            textDecoration: 'none',
          }}
        >
          <span
            style={{
              fontSize: 13,
              fontWeight: 400,
              color: '#A0A8B0',
              letterSpacing: '0.005em',
            }}
          >
            {scheme.activeBuyers} active buyers
          </span>
          <span
            style={{
              background: 'linear-gradient(135deg, #B8960C, #E8C84A)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: '-0.01em',
            }}
          >
            View buyers &rsaquo;
          </span>
        </Link>
      )}
    </div>
  );
}

function StatusDot({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div
        style={{
          width: 5,
          height: 5,
          borderRadius: '50%',
          background: color,
          flexShrink: 0,
        }}
      />
      <span
        style={{
          fontSize: 13,
          fontWeight: 400,
          letterSpacing: '0.005em',
          color: '#6B7280',
        }}
      >
        {label}
      </span>
    </div>
  );
}
