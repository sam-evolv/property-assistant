'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  Sparkles, FolderArchive, MessageSquare, LayoutDashboard,
  ChevronLeft, ChevronRight, Settings,
} from 'lucide-react';

const tokens = {
  gold: '#D4AF37',
  goldDark: '#B8934C',
};

const NAV_ITEMS = [
  { href: '/care-dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/care-dashboard/intelligence', label: 'Intelligence', icon: Sparkles },
  { href: '/care-dashboard/archive', label: 'Archive', icon: FolderArchive },
  { href: '/care-dashboard/communications', label: 'Communications', icon: MessageSquare },
];

export default function CareDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Sidebar */}
      <aside
        className="flex flex-col flex-shrink-0 border-r border-[#1a1d23] transition-all duration-200"
        style={{
          width: collapsed ? '64px' : '240px',
          backgroundColor: '#0f1115',
        }}
      >
        {/* Logo */}
        <div className="p-4 border-b border-[#1a1d23]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl overflow-hidden flex-shrink-0">
              <Image src="/icon-192.png" alt="OpenHouse Care" width={36} height={36} className="w-9 h-9 object-cover rounded-xl" />
            </div>
            {!collapsed && (
              <div>
                <h1 className="text-sm font-semibold text-white tracking-tight">OpenHouse Care</h1>
                <p className="text-[10px] text-[#9ca8bc]">Solar Aftercare</p>
              </div>
            )}
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-2 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href ||
              (item.href !== '/care-dashboard' && pathname?.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 border-l-[3px] ${
                  isActive
                    ? 'bg-[#D4AF37]/10 text-[#D4AF37] border-[#D4AF37]'
                    : 'text-[#9ca8bc] hover:text-white hover:bg-white/5 border-transparent'
                }`}
                title={collapsed ? item.label : undefined}
              >
                <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-[#D4AF37]' : ''}`} />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Collapse Toggle */}
        <div className="p-2 border-t border-[#1a1d23]">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-[#9ca8bc]
              hover:text-white hover:bg-white/5 transition-all duration-150"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            {!collapsed && <span className="text-xs">Collapse</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-h-screen overflow-auto">
        {children}
      </main>
    </div>
  );
}
