'use client';

import { useState } from 'react';
import { Home, FileText, MessageSquare, Menu, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  badge?: boolean;
  sheet?: string;
}

const navItems: NavItem[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'docs', label: 'Docs', icon: FileText, sheet: 'docs' },
  { id: 'chat', label: 'Chat', icon: MessageSquare, badge: true, sheet: 'chat' },
  { id: 'more', label: 'More', icon: Menu, sheet: 'more' },
];

interface BottomNavProps {
  onOpenSheet?: (sheetName: string) => void;
}

export function BottomNav({ onOpenSheet }: BottomNavProps) {
  const [activeTab, setActiveTab] = useState('home');

  const handleTabClick = (item: NavItem) => {
    setActiveTab(item.id);
    if (item.sheet && onOpenSheet) {
      onOpenSheet(item.sheet);
    }
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-white/98 backdrop-blur-2xl border-t border-[#D4AF37]/15 z-30
        shadow-[0_-4px_16px_rgba(12,12,12,0.04)]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}
    >
      <div className="flex items-center justify-around py-1.5 px-2 max-w-md mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleTabClick(item)}
              className={cn(
                'relative flex flex-col items-center gap-0.5 py-1.5 px-4 rounded-xl transition-all duration-200',
                isActive && 'bg-gradient-to-b from-[#D4AF37]/10 to-[#D4AF37]/5'
              )}
            >
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full 
                  bg-gradient-to-r from-[#D4AF37] to-[#FACC15] shadow-[0_0_8px_rgba(212,175,55,0.4)]" />
              )}
              <div className="relative">
                <Icon
                  className={cn(
                    'w-5 h-5 transition-all duration-200',
                    isActive ? 'text-[#D4AF37] scale-105' : 'text-gray-400'
                  )}
                />
                {item.badge && (
                  <span className={cn(
                    'absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full transition-all duration-200',
                    isActive 
                      ? 'bg-gradient-to-br from-[#FACC15] to-[#D4AF37] shadow-[0_0_6px_rgba(212,175,55,0.5)]' 
                      : 'bg-[#D4AF37]'
                  )} />
                )}
              </div>
              <span
                className={cn(
                  'text-[10px] transition-all duration-200',
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
