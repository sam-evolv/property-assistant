'use client';

import Link from 'next/link';
import { ChevronRight, FileText } from 'lucide-react';

/**
 * Session 6C — Docs entry point on the agent Home screen.
 * Replaces the bottom-nav Docs tab. Tap navigates to /agent/docs.
 *
 * Visual: same card shape as DraftsHomeTile. A neutral grey-tinted icon
 * circle signals this is an informational shelf (browsing), not an action
 * bucket like Drafts (which has the gold accent because items demand
 * review).
 */
export default function DocsHomeTile() {
  return (
    <Link
      href="/agent/docs"
      data-testid="home-docs-tile"
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
            background: 'rgba(13,13,18,0.05)',
            border: '1px solid rgba(13,13,18,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <FileText size={18} color="#6B7280" strokeWidth={1.8} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 600, color: '#0D0D12', letterSpacing: '-0.01em', lineHeight: 1.25 }}>
            Docs
          </div>
          <div style={{ fontSize: 12, color: '#A0A8B0', marginTop: 2 }}>
            Browse properties, certs and more
          </div>
        </div>
        <ChevronRight size={18} color="#B0B8C4" />
      </div>
    </Link>
  );
}
