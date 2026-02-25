'use client';

import { Bell } from 'lucide-react';
import OHLogo from '../shared/OHLogo';
import BreathingDot from '../shared/BreathingDot';

interface HeaderProps {
  title: string;
  unreadCount?: number;
  onNotificationTap?: () => void;
  rightContent?: React.ReactNode;
  showLogo?: boolean;
}

export default function Header({
  title,
  unreadCount = 0,
  onNotificationTap,
  rightContent,
  showLogo = true,
}: HeaderProps) {
  return (
    <header
      className="sticky top-0 z-30 border-b frosted-glass-light"
      style={{
        borderColor: '#f3f4f6',
        paddingTop: 'calc(12px + var(--safe-top, env(safe-area-inset-top, 0px)))',
        paddingBottom: '12px',
      }}
    >
      <div className="flex items-center justify-between px-4">
        <div className="flex items-center gap-2.5">
          {showLogo && <OHLogo size={24} variant="icon-gold" />}
          <h1
            className="font-extrabold text-[#111827]"
            style={{ fontSize: 22, letterSpacing: '-0.03em' }}
          >
            {title}
          </h1>
        </div>

        <div className="flex items-center gap-2 header-actions">
          {rightContent}
          {onNotificationTap && (
            <button
              onClick={onNotificationTap}
              className="relative flex h-9 w-9 items-center justify-center rounded-full border border-[#f3f4f6] bg-white shadow-sm transition active:scale-95"
              aria-label="Notifications"
            >
              <Bell size={18} className="text-[#6b7280]" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5">
                  <BreathingDot color="#dc2626" size={8} />
                </span>
              )}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
