'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import {
  LayoutDashboard,
  GitBranch,
  Sparkles,
  Users,
  MessageSquare,
  CalendarCheck,
  FolderArchive,
  BarChart3,
  BookOpen,
  Plug,
  Settings,
  Smartphone,
  LogOut,
  ChevronDown,
  Check,
  Building2,
  Layers,
  Menu,
  X,
} from 'lucide-react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useAgentDashboard } from './layout-provider';

interface NavItem {
  label: string;
  href: string;
  icon: any;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const agentNavSections: NavSection[] = [
  {
    title: 'Main',
    items: [
      { label: 'Overview', href: '/agent/dashboard/overview', icon: LayoutDashboard },
      { label: 'Sales Pipeline', href: '/agent/dashboard/pipeline', icon: GitBranch },
      { label: 'OpenHouse Intelligence', href: '/agent/dashboard/intelligence', icon: Sparkles },
    ],
  },
  {
    title: 'Agent Tools',
    items: [
      { label: 'Clients & Buyers', href: '/agent/dashboard/clients', icon: Users },
      { label: 'Communications', href: '/agent/dashboard/communications', icon: MessageSquare },
      { label: 'Viewings', href: '/agent/dashboard/viewings', icon: CalendarCheck },
      { label: 'Documents', href: '/agent/dashboard/documents', icon: FolderArchive },
      { label: 'Analytics', href: '/agent/dashboard/analytics', icon: BarChart3 },
    ],
  },
  {
    title: 'Intelligence Tools',
    items: [
      { label: 'Knowledge Base', href: '/agent/dashboard/knowledge-base', icon: BookOpen },
      { label: 'Data & Integrations', href: '/agent/dashboard/data-integrations', icon: Plug },
    ],
  },
  {
    title: 'Settings',
    items: [
      { label: 'Settings', href: '/agent/dashboard/settings', icon: Settings },
    ],
  },
];

export function AgentDashboardSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClientComponentClient();
  const { profile, developments, selectedSchemeId, setSelectedSchemeId } = useAgentDashboard();

  const [schemeSwitcherOpen, setSchemeSwitcherOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const switcherRef = useRef<HTMLDivElement>(null);

  const isActive = (href: string) => {
    if (href === '/agent/dashboard/overview') {
      return pathname === '/agent/dashboard/overview' || pathname === '/agent/dashboard';
    }
    return pathname?.startsWith(href);
  };

  const selectedSchemeName = selectedSchemeId
    ? developments.find(d => d.id === selectedSchemeId)?.name ?? 'Unknown'
    : 'All Schemes';

  // Close switcher on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (switcherRef.current && !switcherRef.current.contains(e.target as Node)) {
        setSchemeSwitcherOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  async function handleSignOut() {
    setSigningOut(true);
    await supabase.auth.signOut();
    router.push('/login/agent');
  }

  const handleSchemeSelect = (id: string | null) => {
    setSelectedSchemeId(id);
    setSchemeSwitcherOpen(false);
  };

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden md:flex flex-col w-64 bg-black border-r border-gold-900/20">
        {/* Header / Logo */}
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

        {/* Scheme Switcher */}
        <div ref={switcherRef} className="relative px-4 py-3 border-b border-gold-900/20">
          <button
            onClick={() => setSchemeSwitcherOpen(!schemeSwitcherOpen)}
            className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-gold-500/10 transition-colors group"
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
              selectedSchemeId
                ? 'bg-gold-500/20 text-gold-400'
                : 'bg-grey-800 text-grey-400'
            }`}>
              {selectedSchemeId ? (
                <Building2 className="w-4 h-4" />
              ) : (
                <Layers className="w-4 h-4" />
              )}
            </div>
            <div className="flex-1 text-left">
              <div className="text-[10px] font-medium text-grey-500 uppercase tracking-wider">
                Current Scheme
              </div>
              <div className="text-sm font-semibold text-white truncate">
                {selectedSchemeName}
              </div>
            </div>
            <ChevronDown className={`w-4 h-4 text-grey-400 transition-transform ${schemeSwitcherOpen ? 'rotate-180' : ''}`} />
          </button>

          {schemeSwitcherOpen && (
            <div
              className="absolute left-4 right-4 top-full mt-1 z-50 bg-grey-900 rounded-lg shadow-lg border border-gold-900/30 py-1 max-h-64 overflow-y-auto"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              <button
                onClick={() => handleSchemeSelect(null)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gold-500/10 transition-colors ${
                  !selectedSchemeId ? 'bg-gold-500/20' : ''
                }`}
              >
                <div className="w-6 h-6 rounded-md bg-grey-800 flex items-center justify-center">
                  <Layers className="w-3.5 h-3.5 text-grey-400" />
                </div>
                <span className="flex-1 text-sm font-medium text-white">All Schemes</span>
                {!selectedSchemeId && <Check className="w-4 h-4 text-gold-500" />}
              </button>

              {developments.length > 0 && <div className="border-t border-gold-900/20 my-1" />}

              {developments.map((dev) => (
                <button
                  key={dev.id}
                  onClick={() => handleSchemeSelect(dev.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gold-500/10 transition-colors ${
                    selectedSchemeId === dev.id ? 'bg-gold-500/20' : ''
                  }`}
                >
                  <div className="w-6 h-6 rounded-md bg-green-900/50 text-green-400 flex items-center justify-center">
                    <Building2 className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate">{dev.name}</div>
                  </div>
                  {selectedSchemeId === dev.id && <Check className="w-4 h-4 text-gold-500 flex-shrink-0" />}
                </button>
              ))}

              {developments.length === 0 && (
                <div className="px-3 py-4 text-center text-sm text-grey-400">
                  No schemes assigned
                </div>
              )}
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-8" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {agentNavSections.map((section, idx) => (
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

        {/* Footer */}
        <div className="px-3 pb-4 border-t border-gold-900/20 pt-3 space-y-1">
          {/* Mobile App Link */}
          <Link
            href="/agent/home"
            className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-white/10 transition-all duration-150 group"
          >
            <Smartphone className="w-4 h-4 flex-shrink-0 text-grey-500 group-hover:text-white transition-colors" />
            <span className="text-sm font-medium text-grey-400 group-hover:text-white transition-colors">
              Mobile App
            </span>
          </Link>

          {/* Sign Out */}
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg
              hover:bg-white/10 transition-all duration-150 group
              disabled:opacity-50 disabled:pointer-events-none"
          >
            <div className="w-8 h-8 rounded-full bg-white/10 border border-white/20
              flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-semibold text-white">
                {(profile.display_name?.[0] || 'A').toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-medium text-white truncate">
                {profile.display_name || 'Agent'}
              </p>
              <p className="text-xs truncate" style={{ color: '#9CA3AF' }}>
                {profile.agency_name || 'OpenHouse Agent'}
              </p>
            </div>
            <LogOut className="w-4 h-4 flex-shrink-0 text-gray-500 group-hover:text-white transition-colors" />
          </button>
        </div>
      </div>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 border-b border-gold-200/30 px-4 py-4 flex items-center justify-between bg-white/50 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-gold-500 to-gold-600 flex items-center justify-center text-white font-bold text-xs">
            OH
          </div>
          <span className="text-sm font-semibold text-gray-900">OpenHouse Agent</span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-white pt-16">
          <nav className="p-4 space-y-6 overflow-y-auto h-full">
            {agentNavSections.map((section, idx) => (
              <div key={idx}>
                <p className="px-3 py-2 text-xs font-semibold text-grey-500 uppercase tracking-wider">
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
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                          active
                            ? 'bg-gold-500 text-white'
                            : 'text-grey-700 hover:bg-gold-50'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>
      )}
    </>
  );
}
