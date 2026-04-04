'use client';

import Link from 'next/link';

interface StatusBarProps {
  agentName?: string;
  urgentCount?: number;
}

export default function StatusBar({
  agentName = 'Sam',
  urgentCount = 0,
}: StatusBarProps) {
  return (
    <header
      style={{
        height: 54,
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'transparent',
        flexShrink: 0,
        zIndex: 10,
      }}
    >
      {/* Time */}
      <span
        style={{
          color: '#0D0D12',
          fontSize: 15,
          fontWeight: 600,
          letterSpacing: '-0.02em',
        }}
      >
        {new Date().toLocaleTimeString('en-IE', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: false,
        })}
      </span>

      {/* Brand wordmark — gold gradient text */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <span
          style={{
            background: 'linear-gradient(135deg, #B8960C, #E8C84A, #C4A020)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: '0.18em',
          }}
        >
          OPENHOUSE
        </span>
        <span
          style={{
            width: 1,
            height: 8,
            background: 'rgba(0,0,0,0.12)',
            display: 'inline-block',
          }}
        />
        <span
          style={{
            color: '#A0A8B0',
            fontSize: 11,
            fontWeight: 400,
            letterSpacing: '0.04em',
          }}
        >
          {agentName}
        </span>
      </div>

      {/* Bell with live urgent badge */}
      <Link
        href="/agent/intelligence"
        className="agent-tappable"
        style={{ position: 'relative', display: 'flex' }}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#2A2A2A"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 01-3.46 0" />
        </svg>
        {urgentCount > 0 && (
          <div
            style={{
              position: 'absolute',
              top: -4,
              right: -4,
              width: 16,
              height: 16,
              borderRadius: 8,
              background: 'linear-gradient(135deg, #EF4444, #DC2626)',
              border: '2px solid #FAFAF8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 6px rgba(220, 38, 38, 0.4)',
            }}
          >
            <span
              style={{
                color: '#fff',
                fontSize: 8,
                fontWeight: 800,
                lineHeight: 1,
                letterSpacing: '-0.02em',
              }}
            >
              {urgentCount > 9 ? '9+' : urgentCount}
            </span>
          </div>
        )}
      </Link>
    </header>
  );
}
