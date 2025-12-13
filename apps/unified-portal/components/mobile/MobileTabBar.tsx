'use client';

import { useEffect, useRef } from 'react';
import { MessageCircle, Map, Bell, FileText, Home } from 'lucide-react';

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
  }, []);

  return (
    <nav
      ref={navRef} 
      className={`
        fixed bottom-0 left-0 right-0 z-50
        md:hidden
        border-t
        ${isDarkMode 
          ? 'bg-[#1A1A1A]/90 border-white/10' 
          : 'bg-white/90 border-black/5'
        }
        backdrop-blur-xl
        safe-area-bottom
      `}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-center justify-around h-16 px-2">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`
                flex flex-col items-center justify-center
                flex-1 h-full
                transition-all duration-150 ease-out
                active:scale-95
                no-select
                ${isActive 
                  ? 'text-[#D4AF37]' 
                  : isDarkMode 
                    ? 'text-gray-400 active:text-gray-300' 
                    : 'text-gray-500 active:text-gray-700'
                }
              `}
            >
              <Icon 
                className={`w-6 h-6 mb-1 transition-transform duration-150 ${isActive ? 'scale-110' : ''}`}
                strokeWidth={isActive ? 2.5 : 2}
              />
              <span className={`text-[10px] font-medium tracking-wide ${isActive ? 'font-semibold' : ''}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export default MobileTabBar;
