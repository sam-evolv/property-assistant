'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { BarChart3, Users, Lightbulb, BookOpen, Menu, X, Home, Ruler, FolderArchive, MessageSquare, Shield, AlertTriangle, Settings } from 'lucide-react';
import { DevelopmentSwitcher } from '@/components/developer/DevelopmentSwitcher';

interface SidebarMenuProps {
  children: React.ReactNode;
}

interface NavSection {
  title: string;
  items: Array<{
    label: string;
    href: string;
    icon: any;
  }>;
}

const navSections: NavSection[] = [
  {
    title: 'Main',
    items: [
      { label: 'Overview', href: '/developer', icon: Home },
    ],
  },
  {
    title: 'Management',
    items: [
      { label: 'Scheme Setup', href: '/developer/scheme-setup', icon: Settings },
      { label: 'Homeowners', href: '/developer/homeowners', icon: Users },
      { label: 'Smart Archive', href: '/developer/archive', icon: FolderArchive },
      { label: 'Room Dimensions', href: '/developer/room-dimensions', icon: Ruler },
    ],
  },
  {
    title: 'Communication',
    items: [
      { label: 'Noticeboard', href: '/developer/noticeboard', icon: MessageSquare },
      { label: 'Moderation', href: '/developer/moderation', icon: Shield },
    ],
  },
  {
    title: 'Insights',
    items: [
      { label: 'Analytics', href: '/developer/analytics', icon: BarChart3 },
      { label: 'AI Insights', href: '/developer/insights', icon: Lightbulb },
      { label: 'Knowledge Base', href: '/developer/knowledge-base', icon: BookOpen },
      { label: 'Error Dashboard', href: '/developer/errors', icon: AlertTriangle },
    ],
  },
];

export function DeveloperLayoutWithSidebar({ children }: SidebarMenuProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (href: string) => {
    if (href === '/developer') {
      return pathname === '/developer';
    }
    return pathname?.startsWith(href);
  };

  return (
    <div className="flex h-screen bg-white">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex flex-col w-64 bg-black border-r border-gold-900/20">
        {/* Header */}
        <div className="p-6 border-b border-gold-900/20 flex items-center justify-center">
          <Image
            src="/branding/openhouse-logo.png"
            alt="OpenHouse AI"
            width={220}
            height={80}
            className="h-20 w-auto object-contain"
            priority
          />
        </div>

        {/* Development Switcher */}
        <DevelopmentSwitcher />

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-8 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {navSections.map((section, idx) => (
            <div key={idx}>
              <p className="px-4 py-2 text-xs font-semibold text-grey-500 uppercase tracking-wider">
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
                          : 'text-grey-400 hover:bg-gold-500/10 hover:text-gold-300'
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
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-gold-900/20">
          <div className="px-4 py-2 text-xs text-grey-600 text-center">
            <p className="font-medium text-grey-500">OpenHouseAi</p>
            <p className="text-grey-600 mt-0.5">v1.0.0</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile Header */}
        <div className="md:hidden border-b border-gold-200/30 px-4 py-4 flex items-center justify-between bg-white/50 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-gold-500 to-gold-600 flex items-center justify-center text-white font-bold text-xs">
              OH
            </div>
            <h1 className="text-grey-900 font-bold">Developer</h1>
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
            {navSections.map((section, idx) => (
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
