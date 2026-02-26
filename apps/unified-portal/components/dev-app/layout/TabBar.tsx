'use client';

import { PulseIcon, BuildingIcon, BrainIcon, ClockIcon } from '../shared/Icons';
import { GOLD, TEXT_3, BORDER_LIGHT, EASE_PREMIUM } from '@/lib/dev-app/design-system';

const TABS = [
  { id: 'overview' as const, label: 'Overview', Icon: PulseIcon },
  { id: 'developments' as const, label: 'Devs', Icon: BuildingIcon },
  { id: 'intelligence' as const, label: 'Intel', Icon: BrainIcon },
  { id: 'activity' as const, label: 'Activity', Icon: ClockIcon },
];

interface TabBarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  unreadActivity?: number;
}

export default function TabBar({ activeTab, onTabChange, unreadActivity = 0 }: TabBarProps) {
  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        borderTop: `1px solid ${BORDER_LIGHT}`,
        background: 'rgba(255,255,255,0.88)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          height: 56,
          paddingLeft: 8,
          paddingRight: 8,
        }}
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              style={{
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                flex: 1,
                paddingTop: 4,
                paddingBottom: 4,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                transform: isActive ? 'scale(1.05)' : 'scale(0.95)',
                opacity: isActive ? 1 : 0.5,
                transition: `all 200ms ${EASE_PREMIUM}`,
              }}
            >
              <div style={{ position: 'relative' }}>
                <tab.Icon active={isActive} />
                {tab.id === 'activity' && unreadActivity > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: -4,
                      right: -6,
                      minWidth: 14,
                      height: 14,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '50%',
                      background: '#dc2626',
                      color: '#ffffff',
                      fontSize: 9,
                      fontWeight: 700,
                      paddingLeft: 2,
                      paddingRight: 2,
                      lineHeight: 1,
                    }}
                  >
                    {unreadActivity > 99 ? '99+' : unreadActivity}
                  </span>
                )}
              </div>
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 500,
                  color: isActive ? GOLD : TEXT_3,
                  transition: `all 200ms ${EASE_PREMIUM}`,
                }}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
