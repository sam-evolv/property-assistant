'use client';

import { useState } from 'react';
import { Home, FileText, MessageSquare, Menu, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  badge?: boolean;
}

const navItems: NavItem[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'docs', label: 'Docs', icon: FileText },
  { id: 'chat', label: 'Chat', icon: MessageSquare, badge: true },
  { id: 'more', label: 'More', icon: Menu },
];

export function BottomNav() {
  const [activeTab, setActiveTab] = useState('home');

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-[#D4AF37]/10 z-30
        shadow-[0_-4px_24px_rgba(12,12,12,0.04)]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 24px)' }}
    >
      <div className="flex items-center justify-around py-2 px-4 max-w-md mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                'relative flex flex-col items-center gap-1 py-2 px-5 rounded-2xl transition-all duration-[250ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]',
                isActive && 'bg-gradient-to-b from-[#D4AF37]/10 to-[#D4AF37]/5'
              )}
            >
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-1 rounded-full 
                  bg-gradient-to-r from-[#D4AF37] to-[#FACC15] shadow-[0_0_8px_rgba(212,175,55,0.4)]" />
              )}
              <div className="relative">
                <Icon
                  className={cn(
                    'w-6 h-6 transition-all duration-[250ms]',
                    isActive ? 'text-[#D4AF37] scale-110' : 'text-gray-400'
                  )}
                />
                {item.badge && (
                  <span className={cn(
                    'absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full transition-all duration-[250ms]',
                    isActive 
                      ? 'bg-gradient-to-br from-[#FACC15] to-[#D4AF37] shadow-[0_0_6px_rgba(212,175,55,0.5)]' 
                      : 'bg-[#D4AF37]'
                  )} />
                )}
              </div>
              <span
                className={cn(
                  'text-xs transition-all duration-[250ms]',
                  isActive ? 'text-[#D4AF37] font-semibold' : 'text-gray-400 font-medium'
                )}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
