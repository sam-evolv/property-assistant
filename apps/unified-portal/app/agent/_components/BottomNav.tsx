'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { useDraftsCount } from '../_hooks/useDraftsCount';
import { useApplicantsCount } from '../_hooks/useApplicantsCount';

type TabId = 'home' | 'pipeline' | 'applicants' | 'viewings' | 'docs';

const TABS: { id: TabId; label: string; href: string }[] = [
  { id: 'home', label: 'Home', href: '/agent/home' },
  { id: 'pipeline', label: 'Pipeline', href: '/agent/pipeline' },
  // Intelligence FAB sits between the two clusters.
  // Right cluster leans lettings-heavy: Applicants + Viewings + Docs.
  // Drafts was removed from the bottom nav in Session 5B; access is via
  // the FAB badge, the Home tile, or the Intelligence greeting.
  { id: 'applicants', label: 'Applicants', href: '/agent/applicants' },
  { id: 'viewings', label: 'Viewings', href: '/agent/viewings' },
  { id: 'docs', label: 'Docs', href: '/agent/docs' },
];

function TabIcon({ id, active }: { id: TabId; active: boolean }) {
  const color = active ? '#0D0D12' : '#B0B8C4';
  const sw = '1.6';

  switch (id) {
    case 'home':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          <polyline points="9,22 9,12 15,12 15,22" />
        </svg>
      );
    case 'pipeline':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
      );
    case 'applicants':
      // Lucide Users glyph.
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case 'viewings':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2.5" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      );
    case 'docs':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <polyline points="14,2 14,8 20,8" />
        </svg>
      );
  }
}

export default function BottomNav() {
  const pathname = usePathname();
  const isActive = (href: string) => pathname.startsWith(href);
  const intelActive = pathname.startsWith('/agent/intelligence');
  const { count: draftsCount } = useDraftsCount();
  const { count: applicantsCount } = useApplicantsCount();

  const leftTabs = TABS.slice(0, 2);
  const rightTabs = TABS.slice(2);

  return (
    <nav
      style={{
        minHeight: 76,
        background: 'rgba(250, 250, 248, 0.92)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: '0.5px solid rgba(0, 0, 0, 0.08)',
        display: 'flex',
        alignItems: 'flex-end',
        paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
        flexShrink: 0,
        position: 'relative',
        zIndex: 50,
      }}
    >
      {/* Left tabs: Home, Pipeline */}
      {leftTabs.map((tab) => {
        const active = isActive(tab.href);
        return (
          <Link
            key={tab.id}
            href={tab.href}
            className="agent-tappable"
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              textDecoration: 'none',
              position: 'relative',
            }}
          >
            {active && <GoldIndicator />}
            <div style={{ position: 'relative' }}>
              <TabIcon id={tab.id} active={active} />
            </div>
            <span
              style={{
                fontSize: 9.5,
                fontWeight: active ? 600 : 500,
                letterSpacing: '0.01em',
                color: active ? '#0D0D12' : '#B0B8C4',
              }}
            >
              {tab.label}
            </span>
          </Link>
        );
      })}

      {/* ── Intelligence FAB — dark circle protruding above nav ── */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          position: 'relative',
        }}
      >
        {/* Notch arch — masks the nav border behind the FAB */}
        <div
          style={{
            position: 'absolute',
            top: -2,
            width: 100,
            height: 16,
            background: '#FAFAF8',
            borderRadius: '50% 50% 0 0',
            boxShadow: 'inset 0 0.5px 0 rgba(0,0,0,0.08)',
          }}
        />

        {/* The FAB — 80px dark circle with OH logo */}
        <Link
          href="/agent/intelligence"
          style={{
            position: 'absolute',
            bottom: 0,
            width: 80,
            height: 80,
            borderRadius: 40,
            background: '#0D0D12',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'visible',
            boxShadow: intelActive
              ? `0 0 0 1px rgba(255,255,255,0.10) inset,
                 0 0 0 2.5px #C49B2A,
                 0 8px 24px rgba(0,0,0,0.35),
                 0 2px 6px rgba(0,0,0,0.20)`
              : `0 0 0 1px rgba(255,255,255,0.10) inset,
                 0 8px 24px rgba(0,0,0,0.35),
                 0 2px 6px rgba(0,0,0,0.20)`,
            transition:
              'box-shadow 0.22s cubic-bezier(0.2, 0.8, 0.2, 1), transform 0.15s ease',
            WebkitTapHighlightColor: 'transparent',
            userSelect: 'none',
            textDecoration: 'none',
          }}
        >
          <div style={{ width: 80, height: 80, borderRadius: 40, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Image
              src="/oh-logo-icon.png"
              alt="OpenHouse Intelligence"
              width={80}
              height={80}
              style={{ objectFit: 'contain' }}
              priority
            />
          </div>
          {draftsCount > 0 && <FabDraftsBadge count={draftsCount} />}
        </Link>

        {/* Intelligence nav label */}
        <span
          style={{
            fontSize: 9.5,
            fontWeight: intelActive ? 600 : 500,
            letterSpacing: '0.01em',
            color: intelActive ? '#0D0D12' : '#B0B8C4',
            marginTop: 'auto',
            paddingBottom: 0,
          }}
        >
          Intelligence
        </span>
      </div>

      {/* Right tabs: Applicants, Viewings, Docs */}
      {rightTabs.map((tab) => {
        const active = isActive(tab.href);
        return (
          <Link
            key={tab.id}
            href={tab.href}
            className="agent-tappable"
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              textDecoration: 'none',
              position: 'relative',
            }}
          >
            {active && <GoldIndicator />}
            <div style={{ position: 'relative' }}>
              <TabIcon id={tab.id} active={active} />
              {tab.id === 'applicants' && applicantsCount > 0 && (
                <TabBadge count={applicantsCount} testId="applicants-badge" />
              )}
            </div>
            <span
              style={{
                fontSize: 9.5,
                fontWeight: active ? 600 : 500,
                letterSpacing: '0.01em',
                color: active ? '#0D0D12' : '#B0B8C4',
              }}
            >
              {tab.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

function FabDraftsBadge({ count }: { count: number }) {
  return (
    <span
      data-testid="fab-drafts-badge"
      style={{
        position: 'absolute',
        top: 2,
        right: 2,
        minWidth: 18,
        height: 18,
        padding: '0 5px',
        borderRadius: 9,
        background: '#D4AF37',
        color: '#0b0c0f',
        fontSize: 10,
        fontWeight: 700,
        lineHeight: '18px',
        textAlign: 'center',
        boxShadow: '0 1px 4px rgba(0,0,0,0.35), 0 0 0 1.5px #0D0D12',
      }}
    >
      {count > 9 ? '9+' : count}
    </span>
  );
}

function TabBadge({ count, testId = 'tab-badge' }: { count: number; testId?: string }) {
  return (
    <span
      data-testid={testId}
      style={{
        position: 'absolute',
        top: -4,
        right: -8,
        minWidth: 16,
        height: 16,
        padding: '0 4px',
        borderRadius: 8,
        background: '#D4AF37',
        color: '#0b0c0f',
        fontSize: 9.5,
        fontWeight: 700,
        lineHeight: '16px',
        textAlign: 'center',
        boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
      }}
    >
      {count > 9 ? '9+' : count}
    </span>
  );
}

function GoldIndicator() {
  return (
    <div
      style={{
        position: 'absolute',
        top: -12,
        width: 20,
        height: 2,
        borderRadius: '0 0 2px 2px',
        background: 'linear-gradient(90deg, #B8960C, #E8C84A)',
      }}
    />
  );
}