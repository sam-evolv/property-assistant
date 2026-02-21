'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { MessageCircle, Map, Bell, FileText } from 'lucide-react';
import { getTranslations } from '../../lib/translations';

interface MobileTabBarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  isDarkMode: boolean;
  selectedLanguage?: string;
}

// Tab IDs and their icons (labels come from translations)
const TAB_CONFIG = [
  { id: 'chat', icon: MessageCircle },
  { id: 'maps', icon: Map },
  { id: 'noticeboard', icon: Bell },
  { id: 'documents', icon: FileText },
];

export function MobileTabBar({ activeTab, onTabChange, isDarkMode, selectedLanguage = 'en' }: MobileTabBarProps) {
  const navRef = useRef<HTMLElement>(null);
  const [mounted, setMounted] = useState(false);

  // Get translations based on selected language
  const t = useMemo(() => getTranslations(selectedLanguage), [selectedLanguage]);

  // Build tabs with translated labels
  const TABS = useMemo(() => [
    { id: 'chat', label: t.navigation.assistant, icon: MessageCircle },
    { id: 'maps', label: t.navigation.maps, icon: Map },
    { id: 'noticeboard', label: t.navigation.noticeboard, icon: Bell },
    { id: 'documents', label: t.navigation.documents, icon: FileText },
  ], [t]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const el = navRef.current;
    if (!el) return;

    const updateHeight = () => {
      const height = el.offsetHeight;
      document.documentElement.style.setProperty(
        '--mobile-tab-bar-h',
        `${height}px`
      );
      document.documentElement.style.setProperty(
        '--tab-bar-h',
        `${height}px`
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
    backgroundColor: isDarkMode ? 'rgba(15, 15, 15, 0.97)' : 'rgba(255, 255, 255, 0.97)',
    borderTopColor: isDarkMode ? 'rgba(42, 42, 42, 1)' : 'rgba(229, 231, 235, 1)',
  };

  const containerStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-around',
    minHeight: '64px',
    paddingLeft: 'max(8px, env(safe-area-inset-left, 0px))',
    paddingRight: 'max(8px, env(safe-area-inset-right, 0px))',
    paddingTop: '8px',
    paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
  };

  return (
    <>
      {/* Bottom Navigation - VISIBLE ON ALL SCREEN SIZES for testing */}
      <nav
        ref={navRef}
        style={navStyles}
        className=""
        role="navigation"
        aria-label="Mobile navigation"
        data-mobile-tab-bar="true"
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
                className="no-select active:scale-95 relative"
                aria-label={tab.label}
                aria-current={isActive ? 'page' : undefined}
              >
                {isActive && (
                  <span style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '52px',
                    height: '44px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(212, 175, 55, 0.12)',
                    pointerEvents: 'none',
                  }} />
                )}
                <Icon
                  style={{
                    width: '24px',
                    height: '24px',
                    marginBottom: '4px',
                    transform: isActive ? 'scale(1.1)' : 'scale(1)',
                    transition: 'transform 150ms ease-out',
                    position: 'relative',
                    zIndex: 1,
                  }}
                  strokeWidth={isActive ? 2.5 : 2}
                />
                <span style={{
                  fontSize: '10px',
                  fontWeight: isActive ? 600 : 500,
                  letterSpacing: '0.025em',
                  position: 'relative',
                  zIndex: 1,
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
