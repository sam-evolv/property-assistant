'use client';

import { useEffect, useRef, useState } from 'react';
import { MessageCircle, Map, Bell, FileText } from 'lucide-react';

interface MobileTabBarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  isDarkMode: boolean;
}

const TABS = [
  { id: 'chat', label: 'Chat', icon: MessageCircle },
  { id: 'maps', label: 'Map', icon: Map },
  { id: 'noticeboard', label: 'News', icon: Bell },
  { id: 'documents', label: 'Docs', icon: FileText },
];

export function MobileTabBar({ activeTab, onTabChange, isDarkMode }: MobileTabBarProps) {
  const navRef = useRef<HTMLElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const el = navRef.current;
    if (!el) return;

    const updateHeight = () => {
      document.documentElement.style.setProperty(
        '--mobile-tab-bar-h',
        `${el.offsetHeight}px`
      );
    };

    const ro = new ResizeObserver(updateHeight);
    ro.observe(el);
    updateHeight();

    return () => ro.disconnect();
  }, [mounted]);

  // ALWAYS RENDER - no conditional checks that could fail during SSR
  // Use inline styles as fallback to ensure visibility regardless of Tailwind purging
  const navStyles: React.CSSProperties = {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    borderTopWidth: '1px',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    backgroundColor: isDarkMode ? 'rgba(17, 24, 39, 0.95)' : 'rgba(255, 255, 255, 0.95)',
    borderTopColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(229, 231, 235, 1)',
  };

  const containerStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-around',
    height: '80px',
    paddingLeft: '8px',
    paddingRight: '8px',
    paddingBottom: '16px',
  };

  return (
    <>
      {/* Spacer to prevent content from being hidden behind fixed nav */}
      <div className="h-24 md:hidden" aria-hidden="true" />
      
      {/* Mobile Bottom Navigation - FORCED VISIBLE with inline styles as fallback */}
      <nav
        ref={navRef}
        style={navStyles}
        className="md:hidden"
        role="navigation"
        aria-label="Mobile navigation"
      >
        <div style={containerStyles}>
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            
            const buttonStyles: React.CSSProperties = {
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 1,
              height: '100%',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 150ms ease-out',
              color: isActive 
                ? '#D4AF37' 
                : isDarkMode 
                  ? 'rgba(156, 163, 175, 1)' 
                  : 'rgba(107, 114, 128, 1)',
            };

            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                style={buttonStyles}
                className="no-select active:scale-95"
                aria-label={tab.label}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon 
                  style={{
                    width: '24px',
                    height: '24px',
                    marginBottom: '4px',
                    transform: isActive ? 'scale(1.1)' : 'scale(1)',
                    transition: 'transform 150ms ease-out',
                  }}
                  strokeWidth={isActive ? 2.5 : 2}
                />
                <span style={{
                  fontSize: '10px',
                  fontWeight: isActive ? 600 : 500,
                  letterSpacing: '0.025em',
                }}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}

export default MobileTabBar;
