'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export interface BottomNavItem {
  id: string;
  label: string;
  href: string;
  icon: React.ReactNode;
  activeIcon?: React.ReactNode;
}

interface TenantBottomNavProps {
  items: BottomNavItem[];
  developmentId: string;
  className?: string;
}

export function TenantBottomNav({ items, developmentId, className = '' }: TenantBottomNavProps) {
  const pathname = usePathname();
  
  const isActive = (href: string) => {
    // Handle the base development URL
    const basePath = `/d/${developmentId}`;
    if (href === basePath && pathname === basePath) return true;
    if (href === basePath && pathname === `${basePath}/`) return true;
    
    // Handle other routes
    if (href !== basePath) {
      return pathname.startsWith(href);
    }
    
    return false;
  };
  
  return (
    <nav 
      className={`
        fixed bottom-0 left-0 right-0 bg-white border-t-2 border-grey-200 
        safe-area-bottom z-50 ${className}
      `}
      style={{
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div className="flex items-center justify-around max-w-2xl mx-auto">
        {items.map((item) => {
          const active = isActive(item.href);
          
          return (
            <Link
              key={item.id}
              href={item.href}
              className={`
                relative flex flex-col items-center justify-center gap-1 py-3 px-4 min-w-[72px]
                transition-all duration-premium
                ${active ? 'text-gold-500' : 'text-grey-500'}
                hover:text-gold-500 active:scale-95
              `}
            >
              <span className={`
                text-2xl transition-all duration-premium
                ${active ? 'scale-110 drop-shadow-lg' : ''}
              `}>
                {active && item.activeIcon ? item.activeIcon : item.icon}
              </span>
              
              <span className={`
                text-xs font-medium transition-all duration-premium
                ${active ? 'font-semibold' : ''}
              `}>
                {item.label}
              </span>
              
              {active && (
                <div 
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-gradient-to-r from-gold-400 via-gold-500 to-gold-600 rounded-b-full"
                  style={{
                    animation: 'slideDown 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)',
                  }}
                />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
