'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect, useMemo } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import {
  BarChart3, Users, Lightbulb, BookOpen, Menu, X, Home, Ruler,
  FolderArchive, MessageSquare, Shield, Sparkles,
  Layers, ShieldCheck, GitBranch, Mail,
  CalendarCheck, Building2, Wrench, Dumbbell, BookOpen as Welcome,
  Plug, Megaphone, HardDrive, LogOut, UserPlus, ClipboardList, Calendar,
  Sun, ChevronDown,
} from 'lucide-react';
import { isDeveloperDashboardEnabled, isBuilderSnagAppEnabled, isHomeownerIssuesEnabled, isScheduleEnabled } from '@/lib/feature-flags';
import { ScopeSwitcher } from '@/components/developer/ScopeSwitcher';
import { CommandPalette } from '@/components/ui/CommandPalette';
import { HomeownersBadge } from '@/components/developer/HomeownersBadge';
import { useCurrentContext } from '@/contexts/CurrentContext';
import { useSafeAuth } from '@/contexts/AuthContext';

interface SidebarMenuProps {
  children: React.ReactNode;
}

interface NavItem {
  label: string;
  href: string;
  icon: any;
  rightAccessory?: 'homeowners_badge';
}

const MORE_OPEN_KEY = 'oh-nav-more-open';

// The product is five words. Everything else lives under More until it is
// absorbed into one of the five surfaces or deleted (see docs/NORTH_STAR.md).
function buildPrimaryNav(): NavItem[] {
  const snagsHref = isDeveloperDashboardEnabled() ? '/developer/issues' : '/developer/snagging';
  const homesItem: NavItem = { label: 'Homes', href: '/developer/homeowners', icon: Home };
  if (isHomeownerIssuesEnabled()) {
    homesItem.rightAccessory = 'homeowners_badge';
  }
  return [
    { label: 'Today', href: '/developer', icon: Sun },
    homesItem,
    { label: 'Documents', href: '/developer/archive', icon: FolderArchive },
    { label: 'Snags', href: snagsHref, icon: ClipboardList },
    { label: 'Intelligence', href: '/developer/scheme-intelligence', icon: Sparkles },
  ];
}

function buildMoreNav(opts: { isAdmin: boolean }): NavItem[] {
  const items: NavItem[] = [
    { label: 'Sales Pipeline', href: '/developer/pipeline', icon: GitBranch },
    { label: 'Pre-Handover Portal', href: '/developer/pre-handover-settings', icon: CalendarCheck },
    { label: 'Kitchen Selections', href: '/developer/kitchen-selections', icon: Layers },
    { label: 'Compliance', href: '/developer/compliance', icon: ShieldCheck },
    { label: 'Communications', href: '/developer/communications', icon: Mail },
    { label: 'Broadcasts', href: '/developer/broadcasts', icon: Megaphone },
    { label: 'Noticeboard', href: '/developer/noticeboard', icon: MessageSquare },
    { label: 'Moderation', href: '/developer/moderation', icon: Shield },
  ];
  if (isBuilderSnagAppEnabled()) {
    items.push({ label: 'Snag Team', href: '/developer/snaggers', icon: UserPlus });
  }
  if (isScheduleEnabled()) {
    items.push({ label: 'Schedule', href: '/developer/schedule', icon: Calendar });
  }
  items.push(
    { label: 'Data Hub', href: '/developer/data-hub', icon: HardDrive },
    { label: 'Room Dimensions', href: '/developer/room-dimensions', icon: Ruler },
    { label: 'Analytics', href: '/developer/analytics', icon: BarChart3 },
    { label: 'AI Insights', href: '/developer/insights', icon: Lightbulb },
    { label: 'Knowledge Base', href: '/developer/knowledge-base', icon: BookOpen },
    { label: 'Integrations', href: '/developer/integrations', icon: Plug },
  );
  if (isHomeownerIssuesEnabled() && opts.isAdmin) {
    items.push({ label: 'Notifications', href: '/developer/settings/notifications', icon: Mail });
  }
  return items;
}

function buildBtrNav(developmentId: string): NavItem[] {
  return [
    { label: 'BTR Overview', href: `/developer/btr/${developmentId}/overview`, icon: Building2 },
    { label: 'BTR Units', href: `/developer/btr/${developmentId}/units`, icon: Home },
    { label: 'Maintenance', href: `/developer/btr/${developmentId}/maintenance`, icon: Wrench },
    { label: 'BTR Compliance', href: `/developer/btr/${developmentId}/compliance`, icon: ShieldCheck },
    { label: 'Amenities', href: `/developer/btr/${developmentId}/amenities`, icon: Dumbbell },
    { label: 'Welcome Sequence', href: `/developer/btr/${developmentId}/welcome`, icon: Welcome },
  ];
}

export function DeveloperLayoutWithSidebar({ children }: SidebarMenuProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClientComponentClient();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [signingOut, setSigningOut] = useState(false);
  const { developmentId, projectType: contextProjectType } = useCurrentContext();
  const [fetchedProjectType, setFetchedProjectType] = useState<string | null>(null);
  const { userRole } = useSafeAuth();
  const isAdmin = userRole === 'admin' || userRole === 'super_admin';
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    if (!developmentId) {
      setFetchedProjectType(null);
      return;
    }
    if (contextProjectType) {
      setFetchedProjectType(null);
      return;
    }
    fetch(`/api/developments/${developmentId}`)
      .then(res => res.json())
      .then(data => {
        const pt = data?.development?.project_type || data?.project_type || 'bts';
        setFetchedProjectType(pt);
      })
      .catch(() => setFetchedProjectType('bts'));
  }, [developmentId, contextProjectType]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  const handleSignOut = async () => {
    setSigningOut(true);
    await supabase.auth.signOut();
    router.push('/login');
  };

  const effectiveProjectType = contextProjectType || fetchedProjectType || 'bts';

  const primaryNav = useMemo(() => buildPrimaryNav(), []);
  const moreNav = useMemo(() => {
    const items = buildMoreNav({ isAdmin });
    if (developmentId && (effectiveProjectType === 'btr' || effectiveProjectType === 'mixed')) {
      items.push(...buildBtrNav(developmentId));
    }
    return items;
  }, [developmentId, effectiveProjectType, isAdmin]);

  const isActive = (href: string) => {
    if (href === '/developer') {
      return pathname === '/developer';
    }
    return pathname?.startsWith(href);
  };

  const moreHasActive = moreNav.some((item) => isActive(item.href));

  // Restore the More toggle, and always reveal it when the current page lives there.
  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem(MORE_OPEN_KEY) : null;
    if (stored === 'true') setMoreOpen(true);
  }, []);

  useEffect(() => {
    if (moreHasActive) setMoreOpen(true);
  }, [moreHasActive]);

  const toggleMore = () => {
    setMoreOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(MORE_OPEN_KEY, String(next));
      } catch {}
      return next;
    });
  };

  const renderItem = (item: NavItem, onNavigate?: () => void, mobile = false) => {
    const Icon = item.icon;
    const active = isActive(item.href);
    if (mobile) {
      return (
        <Link
          key={item.href}
          href={item.href}
          onClick={onNavigate}
          className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-sm font-medium ${
            active ? 'bg-gold-500 text-white' : 'text-grey-700 hover:bg-gold-50'
          }`}
        >
          <Icon className="w-4 h-4 flex-shrink-0" />
          <span>{item.label}</span>
          {item.rightAccessory === 'homeowners_badge' && <HomeownersBadge />}
        </Link>
      );
    }
    return (
      <Link
        key={item.href}
        href={item.href}
        className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all text-sm font-medium ${
          active ? 'bg-gold-500 text-white shadow-lg' : 'hover:bg-gold-500/10 hover:text-gold-300'
        }`}
        style={active ? undefined : { color: '#F9FAFB' }}
      >
        <Icon className="w-4 h-4 flex-shrink-0" />
        <span>{item.label}</span>
        {item.rightAccessory === 'homeowners_badge' && <HomeownersBadge />}
      </Link>
    );
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

        {/* Scope Switcher (Developer + Scheme dropdowns) */}
        <ScopeSwitcher />

        {/* Navigation: five surfaces, then everything else under More */}
        <nav className="flex-1 overflow-y-auto py-6 px-3 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          <div className="space-y-1">
            {primaryNav.map((item) => renderItem(item))}
          </div>

          <div className="mt-8">
            <button
              onClick={toggleMore}
              className="w-full flex items-center justify-between px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors hover:text-gold-300"
              style={{ color: '#9CA3AF' }}
            >
              <span>More</span>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform ${moreOpen ? '' : '-rotate-90'}`}
              />
            </button>
            {moreOpen && (
              <div className="mt-1 space-y-1">
                {moreNav.map((item) => renderItem(item))}
              </div>
            )}
          </div>
        </nav>

        {/* Footer */}
        <div className="px-3 pb-4 border-t border-gold-900/20 pt-3">
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
                {(user?.user_metadata?.full_name?.[0] || user?.email?.[0] || 'U').toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-medium text-white truncate">
                {user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Account'}
              </p>
              {user?.email && (
                <p className="text-xs truncate" style={{ color: '#9CA3AF' }}>{user.email}</p>
              )}
            </div>
            <LogOut className="w-4 h-4 flex-shrink-0 text-gray-500 group-hover:text-white transition-colors" />
          </button>
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

        {/* Mobile Menu — the five surfaces live in the bottom tab bar; this holds the rest */}
        {mobileMenuOpen && (
          <div className="md:hidden border-b border-gold-200/30 bg-white/80 backdrop-blur-sm px-4 py-4 overflow-y-auto max-h-[60vh]">
            <p className="px-2 py-1.5 text-xs font-semibold text-grey-500 uppercase tracking-wider mb-2">
              More
            </p>
            <div className="space-y-1">
              {moreNav.map((item) => renderItem(item, () => setMobileMenuOpen(false), true))}
            </div>
          </div>
        )}

        {/* Content Area — bottom padding clears the mobile tab bar */}
        <div className="flex-1 overflow-auto bg-gradient-to-br from-white via-grey-50 to-white pb-24 md:pb-0">
          {children}
        </div>

        {/* Mobile bottom tab bar — the five surfaces, always one thumb away */}
        <nav
          className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-gold-900/20 bg-black"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="grid grid-cols-5">
            {primaryNav.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              const tabLabel =
                item.label === 'Intelligence' ? 'Ask' :
                item.label === 'Documents' ? 'Docs' : item.label;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex flex-col items-center gap-1 py-2.5"
                >
                  <Icon className={`h-5 w-5 ${active ? 'text-gold-400' : 'text-gray-400'}`} />
                  <span className={`text-[10px] font-medium leading-none ${active ? 'text-gold-400' : 'text-gray-400'}`}>
                    {tabLabel}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>

      {/* Global Command Palette - accessible with Cmd+K */}
      <CommandPalette />
    </div>
  );
}
