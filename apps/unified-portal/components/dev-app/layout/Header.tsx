'use client';

import OHLogo from '../shared/OHLogo';
import { BellIcon, BackIcon } from '../shared/Icons';
import BreathingDot from '../shared/BreathingDot';
import { TEXT_1, TEXT_2, TEXT_3, BORDER_LIGHT, SURFACE_2, EASE_PREMIUM } from '@/lib/dev-app/design-system';

interface HeaderProps {
  title: string;
  showBack?: boolean;
  onBack?: () => void;
  unreadCount?: number;
  onNotificationTap?: () => void;
  rightContent?: React.ReactNode;
  showLogo?: boolean;
}

export default function Header({
  title,
  showBack = false,
  onBack,
  unreadCount = 0,
  onNotificationTap,
  rightContent,
  showLogo = true,
}: HeaderProps) {
  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 30,
        background: 'rgba(255,255,255,0.88)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        borderBottom: `1px solid ${BORDER_LIGHT}`,
        paddingTop: 'calc(12px + env(safe-area-inset-top, 0px))',
        paddingBottom: 12,
        paddingLeft: 20,
        paddingRight: 20,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {showBack ? (
            <button
              onClick={onBack}
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: SURFACE_2,
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: `all 200ms ${EASE_PREMIUM}`,
              }}
              onMouseDown={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.95)';
              }}
              onMouseUp={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
              }}
              aria-label="Go back"
            >
              <BackIcon />
            </button>
          ) : (
            showLogo && <OHLogo size={36} />
          )}
          <h1
            style={{
              fontSize: 22,
              fontWeight: 800,
              letterSpacing: '-0.03em',
              color: TEXT_1,
              margin: 0,
              lineHeight: 1.2,
            }}
          >
            {title}
          </h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {rightContent}
          {onNotificationTap && (
            <button
              onClick={onNotificationTap}
              style={{
                position: 'relative',
                display: 'flex',
                width: 36,
                height: 36,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
                border: `1px solid ${BORDER_LIGHT}`,
                background: '#ffffff',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                cursor: 'pointer',
                transition: `all 200ms ${EASE_PREMIUM}`,
              }}
              onMouseDown={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.95)';
              }}
              onMouseUp={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
              }}
              aria-label="Notifications"
            >
              <BellIcon />
              {unreadCount > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: -2,
                    right: -2,
                  }}
                >
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
