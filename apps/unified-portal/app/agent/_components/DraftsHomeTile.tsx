'use client';

import Link from 'next/link';
import { ChevronRight, MailCheck } from 'lucide-react';
import { useDraftsCount } from '../_hooks/useDraftsCount';

/**
 * Session 5B — Drafts entry point on the agent Home screen.
 * Replaces the bottom-nav Drafts tab. Tap navigates to /agent/drafts.
 */
export default function DraftsHomeTile() {
  const { count } = useDraftsCount();
  const subtitle = count > 0
    ? `${count} waiting for review`
    : 'No drafts waiting. Nice.';

  return (
    <Link
      href="/agent/drafts"
      data-testid="home-drafts-tile"
      style={{ textDecoration: 'none', display: 'block', marginBottom: 20 }}
    >
      <div
        className="agent-tappable"
        style={{
          background: '#FFFFFF',
          borderRadius: 18,
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05), 0 0 0 0.5px rgba(0,0,0,0.04)',
        }}
      >
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            background: 'rgba(196,155,42,0.10)',
            border: '1px solid rgba(196,155,42,0.22)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <MailCheck size={18} color="#B8960C" strokeWidth={1.8} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 600, color: '#0D0D12', letterSpacing: '-0.01em', lineHeight: 1.25 }}>
            Drafts
          </div>
          <div style={{ fontSize: 12, color: count > 0 ? '#8A6E1F' : '#A0A8B0', marginTop: 2 }}>
            {subtitle}
          </div>
        </div>
        {count > 0 && (
          <span
            data-testid="home-drafts-tile-count"
            style={{
              minWidth: 22,
              height: 22,
              padding: '0 7px',
              borderRadius: 11,
              background: 'linear-gradient(135deg, #C49B2A, #E8C84A)',
              color: '#FFFFFF',
              fontSize: 11,
              fontWeight: 700,
              lineHeight: '22px',
              textAlign: 'center',
              flexShrink: 0,
            }}
          >
            {count > 99 ? '99+' : count}
          </span>
        )}
        <ChevronRight size={18} color="#B0B8C4" />
      </div>
    </Link>
  );
}
