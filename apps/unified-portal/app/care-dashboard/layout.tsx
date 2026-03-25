'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Sparkles, ClipboardList, Wrench, Shield,
  FolderArchive, BookOpen, Menu, X, ChevronDown,
} from 'lucide-react';

/* ── SE Systems Logo (inline SVG — no external deps) ── */
function SESystemsLogo({ width = 130 }: { width?: number }) {
  return (
    <svg width={width} height={width * (32 / 140)} viewBox="0 0 140 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="16" cy="16" rx="14" ry="6" stroke="white" strokeWidth="1.8" fill="none" transform="rotate(-30 16 16)" />
      <ellipse cx="16" cy="16" rx="14" ry="6" stroke="white" strokeWidth="1.8" fill="none" transform="rotate(30 16 16)" />
      <circle cx="16" cy="16" r="2.5" fill="white" />
      <text x="38" y="21" fontFamily="Inter, sans-serif" fontSize="13" fontWeight="700" fill="white" letterSpacing="2">SESYSTEMS</text>
    </svg>
  );
}

/* ── Nav sections ── */
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
      { href: '/care-dashboard/support-queue', label: 'Support Queue', icon: Shield },
    ],
  },
  {
    title: 'Management',
    items: [
      { href: '/care-dashboard/archive', label: 'Smart Archive', icon: FolderArchive },
      { href: '/care-dashboard/communications', label: 'Content Manager', icon: BookOpen },
    ],
  },
];

export default function CareDashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (href: string) =>
    href === '/care-dashboard'
      ? pathname === '/care-dashboard'
      : pathname?.startsWith(href);

  return (
    <div className="flex h-screen bg-white">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex flex-col w-64 bg-black border-r border-gold-900/20">
        {/* SE Systems Logo — white label */}
        <div style={{ padding: '24px 20px 20px' }} className="border-b border-gold-900/20 flex items-center justify-center">
          <SESystemsLogo width={130} />
        </div>

        {/* Installer Context Switcher */}
        <div className="px-4 py-3 border-b border-gold-900/20">
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: '#9CA3AF' }}>
            Current Installer
          </p>
          <button className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
            <span className="text-sm font-medium text-white truncate">SE Systems Cork</span>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-8 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {NAV_SECTIONS.map((section, idx) => (
            <div key={idx}>
              <p className="px-4 py-2 text-xs font-semibold uppercase tracking-wider" style={{ color: '#9CA3AF' }}>
                {section.title}
              </p>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all text-sm font-medium ${
                        active
                          ? 'bg-gold-500 text-white shadow-lg'
                          : 'hover:bg-gold-500/10 hover:text-gold-300'
                      }`}
                      style={active ? undefined : { color: '#F9FAFB' }}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer — Powered by OpenHouse AI */}
        <div className="mt-auto" style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-center mb-2" style={{ fontSize: '10px', color: '#5c6478' }}>Powered by</p>
          <div className="flex justify-center" style={{ opacity: 0.6 }}>
            <Image
              src="/branding/openhouse-logo.png"
              alt="OpenHouse AI"
              width={100}
              height={36}
              className="w-20 h-auto object-contain"
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile Header */}
        <div className="md:hidden border-b border-gold-200/30 px-4 py-4 flex items-center justify-between bg-white/50 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <SESystemsLogo width={100} />
          </div>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 hover:bg-grey-100 rounded-lg transition"
          >
            {mobileMenuOpen ? (
              <X className="w-5 h-5 text-grey-900" />
            ) : (
              <Menu className="w-5 h-5 text-grey-900" />
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-b border-gold-200/30 bg-white/80 backdrop-blur-sm px-4 py-4 space-y-6 overflow-y-auto">
            {NAV_SECTIONS.map((section, idx) => (
              <div key={idx}>
                <p className="px-2 py-1.5 text-xs font-semibold text-grey-500 uppercase tracking-wider mb-2">
                  {section.title}
                </p>
                <div className="space-y-1">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.href);

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-sm font-medium ${
                          active
                            ? 'bg-gold-500 text-white'
                            : 'text-grey-700 hover:bg-gold-50'
                        }`}
                      >
                        <Icon className="w-4 h-4 flex-shrink-0" />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 overflow-auto bg-gradient-to-br from-white via-grey-50 to-white">
          {children}
        </div>
      </div>
    </div>
  );
}
