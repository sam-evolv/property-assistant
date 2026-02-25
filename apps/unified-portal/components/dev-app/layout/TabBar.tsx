'use client';

import { LayoutDashboard, Building2, Sparkles, Activity } from 'lucide-react';

const ICONS = {
  overview: LayoutDashboard,
  developments: Building2,
  intelligence: Sparkles,
  activity: Activity,
} as const;

const TABS = [
  { id: 'overview' as const, label: 'Overview' },
  { id: 'developments' as const, label: 'Devs' },
  { id: 'intelligence' as const, label: 'Intel' },
  { id: 'activity' as const, label: 'Activity' },
];

interface TabBarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  unreadActivity?: number;
}

export default function TabBar({ activeTab, onTabChange, unreadActivity = 0 }: TabBarProps) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t frosted-glass-light"
      style={{
        borderColor: '#f3f4f6',
        paddingBottom: 'calc(16px + var(--safe-bottom, env(safe-area-inset-bottom, 0px)))',
      }}
    >
      <div className="flex items-center justify-around h-14 px-2">
        {TABS.map((tab) => {
          const Icon = ICONS[tab.id];
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className="relative flex flex-col items-center justify-center gap-0.5 flex-1 py-1 transition-all duration-150"
              style={{
                transform: isActive ? 'scale(1)' : 'scale(0.95)',
                opacity: isActive ? 1 : 0.5,
              }}
            >
              <div className="relative">
                <Icon
                  size={22}
                  strokeWidth={isActive ? 2.2 : 1.8}
                  style={{ color: isActive ? '#D4AF37' : '#9ca3af' }}
                />
                {tab.id === 'activity' && unreadActivity > 0 && (
                  <span className="absolute -top-1 -right-1.5 min-w-[14px] h-[14px] flex items-center justify-center rounded-full bg-[#dc2626] text-white text-[9px] font-bold px-0.5">
                    {unreadActivity > 99 ? '99+' : unreadActivity}
                  </span>
                )}
              </div>
              <span
                className="text-[10px] font-medium"
                style={{ color: isActive ? '#D4AF37' : '#9ca3af' }}
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
