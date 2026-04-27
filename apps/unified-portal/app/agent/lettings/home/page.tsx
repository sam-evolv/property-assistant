'use client';

import Link from 'next/link';
import AgentShell from '../../_components/AgentShell';

// Always renders the empty-state CTA for now. The previous redirect-when-
// properties-exist path sent the agent into /agent/lettings/properties,
// which is still a "Coming soon" placeholder until Session 9 ships the real
// dashboard — a broken redirect is worse than no redirect.
export default function LettingsHomePage() {
  return (
    <AgentShell>
      <div
        style={{
          minHeight: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 32px 80px',
          textAlign: 'center',
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 18,
            background: 'rgba(212,175,55,0.10)',
            border: '0.5px solid rgba(212,175,55,0.22)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 24,
          }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#C49B2A" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="m21 2-9.6 9.6" />
            <circle cx="7.5" cy="15.5" r="5.5" />
            <path d="m21 2-2 2" />
            <path d="m18 5 3 3" />
            <path d="m15 8 3 3" />
          </svg>
        </div>

        <h1
          style={{
            color: '#0D0D12',
            fontSize: 24,
            fontWeight: 600,
            letterSpacing: '-0.01em',
            margin: '0 0 8px',
          }}
        >
          No properties yet
        </h1>

        <p
          style={{
            color: '#6B7280',
            fontSize: 15,
            lineHeight: 1.5,
            margin: '0 0 28px',
            maxWidth: 280,
          }}
        >
          Add your first property to get started. We&rsquo;ll fill in most of it for you.
        </p>

        <Link
          href="/agent/lettings/properties/new"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: '12px 22px',
            borderRadius: 12,
            background: 'linear-gradient(135deg, #D4AF37, #C49B2A)',
            color: '#0D0D12',
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: '-0.01em',
            textDecoration: 'none',
            boxShadow: '0 1px 2px rgba(0,0,0,0.06), 0 6px 18px rgba(196,155,42,0.32)',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0D0D12" strokeWidth="2" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add a property
        </Link>

        <Link
          href="/agent/lettings/properties/import"
          style={{
            marginTop: 14,
            color: '#A0A8B0',
            fontSize: 13,
            textDecoration: 'none',
          }}
        >
          Or import from a spreadsheet
        </Link>
      </div>
    </AgentShell>
  );
}
