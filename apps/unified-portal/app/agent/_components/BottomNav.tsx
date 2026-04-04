'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';

type TabId = 'home' | 'pipeline' | 'viewings' | 'docs';

const TABS: { id: TabId; label: string; href: string }[] = [
  { id: 'home', label: 'Home', href: '/agent/home' },
  { id: 'pipeline', label: 'Pipeline', href: '/agent/pipeline' },
  // Intelligence is the FAB — handled separately
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

  const leftTabs = TABS.slice(0, 2);
  const rightTabs = TABS.slice(2);

  return (
    <nav
      style={{
        height: 76,
        background: 'rgba(250, 250, 248, 0.92)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: '0.5px solid rgba(0, 0, 0, 0.08)',
        display: 'flex',
        alignItems: 'flex-end',
        paddingBottom: 12,
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
            <TabIcon id={tab.id} active={active} />
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

      {/* ── Intelligence FAB — the centrepiece ── */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          position: 'relative',
        }}
      >
        {/* Intelligence logo — bare, no dark circle */}
        <Link
          href="/agent/intelligence"
          className="agent-tappable"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textDecoration: 'none',
            marginBottom: 2,
          }}
        >
          <Image
            src="/oh-logo.png"
            alt="Intelligence"
            width={52}
            height={52}
            style={{
              objectFit: 'contain',
              display: 'block',
              mixBlendMode: 'multiply',
              filter: intelActive
                ? 'drop-shadow(0 0 8px rgba(196, 155, 42, 0.6))'
                : 'none',
              transition: 'filter 0.22s ease',
            }}
            priority
          />
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

      {/* Right tabs: Viewings, Docs */}
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
            <TabIcon id={tab.id} active={active} />
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
