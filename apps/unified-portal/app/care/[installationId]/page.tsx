'use client';

import { useCallback, useEffect, useState } from 'react';
import { useCareApp } from './care-app-provider';
import HomeScreen from './screens/HomeScreen';
import AssistantScreen from './screens/AssistantScreen';
import GuidesScreen from './screens/GuidesScreen';
import SystemScreen from './screens/SystemScreen';
import DiagnosticScreen from './screens/DiagnosticScreen';

const TABS = [
  { id: 'home', label: 'Home' },
  { id: 'assistant', label: 'Assistant' },
  { id: 'guides', label: 'Guides' },
  { id: 'system', label: 'System' },
] as const;

/* ── SVG Icon Paths ── */
const TAB_ICONS: Record<string, { viewBox: string; paths: string[] }> = {
  home: {
    viewBox: '0 0 24 24',
    paths: [
      'M3 10.5L12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-6a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v6H4a1 1 0 0 1-1-1V10.5z',
    ],
  },
  assistant: {
    viewBox: '0 0 24 24',
    paths: [
      'M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z',
    ],
  },
  guides: {
    viewBox: '0 0 24 24',
    paths: [
      'M4 19.5A2.5 2.5 0 0 1 6.5 17H20',
      'M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z',
    ],
  },
  system: {
    viewBox: '0 0 24 24',
    paths: [
      'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
      'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
    ],
  },
};

export default function CareAppPage() {
  const { activeTab, setActiveTab } = useCareApp();
  const [pressedTab, setPressedTab] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleTabPress = useCallback(
    (tabId: string) => {
      setPressedTab(tabId);
      setActiveTab(tabId);
      setTimeout(() => setPressedTab(null), 180);
    },
    [setActiveTab]
  );

  const screens = ['home', 'assistant', 'guides', 'system', 'diagnostic'];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100dvh',
        background: '#FFFFFF',
        fontFamily:
          "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        overflow: 'hidden',
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
      }}
    >
      {/* ── CSS Variables ── */}
      <style>{`
        :root {
          --gold: #D4AF37;
          --gold-700: #B8934C;
          --ease: cubic-bezier(.16, 1, .3, 1);
          --spring: cubic-bezier(.34, 1.56, .64, 1);
        }
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }
        /* Hide scrollbar globally within care app */
        .care-screen-scroll::-webkit-scrollbar { display: none; }
        .care-screen-scroll { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* ── Screen Container ── */}
      {screens.map((screenId) => (
        <div
          key={screenId}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            opacity: activeTab === screenId ? 1 : 0,
            transform:
              activeTab === screenId
                ? 'translateY(0)'
                : 'translateY(8px)',
            pointerEvents: activeTab === screenId ? 'auto' : 'none',
            transition: mounted
              ? 'opacity 450ms cubic-bezier(0.16, 1, 0.3, 1), transform 450ms cubic-bezier(0.16, 1, 0.3, 1)'
              : 'none',
            willChange: 'opacity, transform',
            zIndex: activeTab === screenId ? 1 : 0,
          }}
        >
          {screenId === 'home' && <HomeScreen />}
          {screenId === 'assistant' && <AssistantScreen />}
          {screenId === 'guides' && <GuidesScreen />}
          {screenId === 'system' && <SystemScreen />}
          {screenId === 'diagnostic' && <DiagnosticScreen />}
        </div>
      ))}

      {/* ── Tab Bar ── */}
      <nav
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: 88,
          background: 'rgba(255, 255, 255, 0.82)',
          backdropFilter: 'blur(32px) saturate(180%)',
          WebkitBackdropFilter: 'blur(32px) saturate(180%)',
          borderTop: '1px solid rgba(0, 0, 0, 0.04)',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-around',
          paddingTop: 8,
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          zIndex: 1000,
        }}
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const isPressed = pressedTab === tab.id;
          const icon = TAB_ICONS[tab.id];

          return (
            <button
              key={tab.id}
              onClick={() => handleTabPress(tab.id)}
              aria-label={tab.label}
              aria-selected={isActive}
              role="tab"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                padding: '4px 16px',
                WebkitTapHighlightColor: 'transparent',
                transform: isPressed ? 'scale(0.82)' : 'scale(1)',
                transition:
                  'transform 200ms cubic-bezier(.34, 1.56, .64, 1)',
                position: 'relative',
                minWidth: 64,
              }}
            >
              {/* Active dot */}
              <div
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: '50%',
                  background: '#D4AF37',
                  opacity: isActive ? 1 : 0,
                  transform: isActive ? 'scale(1)' : 'scale(0)',
                  transition:
                    'opacity 300ms cubic-bezier(.16, 1, .3, 1), transform 300ms cubic-bezier(.34, 1.56, .64, 1)',
                  marginBottom: 2,
                }}
              />

              {/* Icon */}
              <svg
                width={24}
                height={24}
                viewBox={icon.viewBox}
                fill="none"
                stroke={isActive ? '#B8934C' : '#c4cdd5'}
                strokeWidth={isActive ? 2.2 : 1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  transition:
                    'stroke 300ms cubic-bezier(.16, 1, .3, 1), stroke-width 300ms cubic-bezier(.16, 1, .3, 1)',
                }}
              >
                {icon.paths.map((d, i) => (
                  <path key={i} d={d} />
                ))}
              </svg>

              {/* Label */}
              <span
                style={{
                  fontSize: 10,
                  lineHeight: 1,
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? '#B8934C' : '#c4cdd5',
                  letterSpacing: isActive ? '-0.01em' : '0',
                  transition:
                    'color 300ms cubic-bezier(.16, 1, .3, 1), font-weight 300ms cubic-bezier(.16, 1, .3, 1)',
                }}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
