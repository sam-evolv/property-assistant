'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export interface SidebarItem {
  id: string;
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: string | number;
  adminOnly?: boolean;
}

interface DeveloperSidebarProps {
  items: SidebarItem[];
  isAdmin?: boolean;
  className?: string;
}

export function DeveloperSidebar({ items, isAdmin = false, className = '' }: DeveloperSidebarProps) {
  const pathname = usePathname();
  
  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };
  
  const filteredItems = items.filter(item => !item.adminOnly || isAdmin);
  
  return (
    <aside className={`w-64 bg-black border-r border-grey-800 flex flex-col ${className}`}>
      {/* Logo/Header */}
      <div className="p-6 border-b border-grey-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-gold-500 to-gold-600 rounded-lg flex items-center justify-center">
            <svg className="w-6 h-6 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </div>
          <div>
            <h2 className="text-white font-semibold text-lg">OpenHouse</h2>
            <p className="text-grey-400 text-xs">Developer Portal</p>
          </div>
        </div>
      </div>
      
      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {filteredItems.map((item) => {
          const active = isActive(item.href);
          
          return (
            <Link
              key={item.id}
              href={item.href}
              className={`
                flex items-center gap-3 px-4 py-3 rounded-lg
                transition-all duration-premium group
                ${active
                  ? 'bg-gold-500 text-black'
                  : 'text-grey-300 hover:bg-grey-900 hover:text-white'
                }
              `}
            >
              <span className={`
                text-xl transition-transform duration-premium
                ${active ? 'scale-110' : 'group-hover:scale-110'}
              `}>
                {item.icon}
              </span>
              
              <span className="flex-1 font-medium">
                {item.label}
              </span>
              
              {item.badge && (
                <span className={`
                  px-2 py-0.5 rounded-full text-xs font-semibold
                  ${active
                    ? 'bg-black/20 text-black'
                    : 'bg-gold-500/20 text-gold-500'
                  }
                `}>
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      
      {/* Footer */}
      <div className="p-4 border-t border-grey-800">
        <div className="px-4 py-3 bg-grey-900 rounded-lg">
          <p className="text-grey-400 text-xs mb-1">Need help?</p>
          <a href="/support" className="text-gold-500 text-sm font-medium hover:text-gold-400 transition-colors">
            Contact Support
          </a>
        </div>
      </div>
    </aside>
  );
}
