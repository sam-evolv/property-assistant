'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  Sparkles, FolderArchive, MessageSquare, LayoutDashboard,
  Wrench, Shield, BookOpen, ChevronLeft, ChevronRight,
  ClipboardList, BarChart3,
} from 'lucide-react';

/* ── Nav sections — mirrors Developer dashboard structure exactly ── */
const NAV_SECTIONS = [
  {
    title: 'Main',
    items: [
      { href: '/care-dashboard', label: 'Overview', icon: LayoutDashboard },
      { href: '/care-dashboard/intelligence', label: 'Intelligence', icon: Sparkles },
    ],
  },
  {
    title: 'Installer Tools',
    items: [
      { href: '/care-dashboard/installations', label: 'Installations', icon: ClipboardList },
      { href: '/care-dashboard/diagnostics', label: 'Diagnostics', icon: Wrench },
      { href: '/care-dashboard/support', label: 'Support Queue', icon: Shield },
    ],
  },
  {
    title: 'Management',
    items: [
      { href: '/care-dashboard/archive', label: 'Smart Archive', icon: FolderArchive },
      { href: '/care-dashboard/content', label: 'Content Manager', icon: BookOpen },
      { href: '/care-dashboard/warranty', label: 'Warranty Tracker', icon: BarChart3 },
    ],
  },
  {
    title: 'Communication',
    items: [
      { href: '/care-dashboard/communications', label: 'Communications', icon: MessageSquare },
    ],
  },
];

export default function CareDashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) =>
    href === '/care-dashboard'
      ? pathname === '/care-dashboard'
      : pathname?.startsWith(href);

  const SidebarContent = () => (
    <>
      {/* Logo — verbatim from developer layout: transparent PNG, centred */}
      <div className="p-6 border-b border-gold-900/20 flex items-center justify-center">
        {collapsed ? (
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gold-500 to-gold-600 flex items-center justify-center">
            <span className="text-white font-bold text-xs">OH</span>
          </div>
        ) : (
          <Image
            src="/branding/openhouse-ai-logo.png"
            alt="OpenHouse AI"
            width={120}
            height={36}
            className="h-8 w-auto object-contain brightness-0 invert"
          />
        )}
      </div>

      {/* Navigation sections — same structure as developer sidebar */}
      <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-8" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {NAV_SECTIONS.map((section, idx) => (
          <div key={idx}>
            {!collapsed && (
              <p className="px-4 py-2 text-xs font-semibold uppercase tracking-wider" style={{ color: '#9CA3AF' }}>
                {section.title}
              </p>
            )}
            <div className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all text-sm font-medium ${
                      active
                        ? 'bg-gold-500 text-white shadow-lg'
                        : 'hover:bg-gold-500/10 hover:text-gold-300'
                    } ${collapsed ? 'justify-center px-2' : ''}`}
                    style={active ? undefined : { color: '#F9FAFB' }}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    {!collapsed && <span>{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer — mirrors developer layout footer */}
      <div className="p-4 border-t border-gold-900/20">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 hover:bg-gold-500/10"
          style={{ color: '#9CA3AF' }}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed
            ? <ChevronRight className="w-4 h-4" />
            : <><ChevronLeft className="w-4 h-4" /><span className="text-xs">Collapse</span></>
          }
        </button>
        {!collapsed && (
          <div className="px-4 py-2 text-xs text-center mt-1" style={{ color: '#9CA3AF' }}>
            <p className="font-medium">OpenHouse Care</p>
          </div>
        )}
      </div>
    </>
  );

  return (
    <div className="min-h-screen flex bg-white">
      {/* Desktop Sidebar — bg-black matches Developer dashboard exactly */}
      <aside
        className={`hidden md:flex flex-col flex-shrink-0 bg-black transition-all duration-200`}
        style={{ width: collapsed ? '64px' : '256px' }}
      >
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="w-64 bg-black flex flex-col">
            <SidebarContent />
          </div>
          <div className="flex-1 bg-black/50" onClick={() => setMobileOpen(false)} />
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 min-h-screen overflow-auto bg-gradient-to-br from-white via-grey-50 to-white">
        {children}
      </main>
    </div>
  );
}
