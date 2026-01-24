'use client';

import { useState } from 'react';
import { Home, FileText, MessageSquare, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'docs', label: 'Docs', icon: FileText },
  { id: 'chat', label: 'Chat', icon: MessageSquare, badge: true },
  { id: 'more', label: 'More', icon: Menu },
];

export function BottomNav() {
  const [activeTab, setActiveTab] = useState('home');

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-[#FAF8F3]/95 backdrop-blur-xl border-t border-white/50 z-30"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 24px)' }}
    >
      <div className="flex items-center justify-around py-2 px-4 max-w-md mx-auto">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={cn(
              'flex flex-col items-center gap-1 py-2 px-4 rounded-xl transition-all duration-200',
              activeTab === item.id && 'bg-[#D4AF37]/10'
            )}
          >
            <div className="relative">
              <item.icon
                className={cn(
                  'w-6 h-6 transition-colors',
                  activeTab === item.id ? 'text-[#D4AF37]' : 'text-gray-400'
                )}
              />
              {item.badge && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[#D4AF37]" />
              )}
            </div>
            <span
              className={cn(
                'text-xs transition-colors',
                activeTab === item.id ? 'text-[#D4AF37] font-semibold' : 'text-gray-400'
              )}
            >
              {item.label}
            </span>
          </button>
        ))}
      </div>
    </nav>
  );
}
