'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  Home,
  MessageSquare,
  Users,
  GitBranch,
  Sparkles,
  BookOpen,
  ShieldCheck,
  Mail,
  FolderArchive,
  Menu,
  X,
  ChevronDown,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SidebarMenuProps {
  children: React.ReactNode;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

// ---------------------------------------------------------------------------
// Navigation config
// ---------------------------------------------------------------------------

const navSections: NavSection[] = [
  {
    title: 'Main',
    items: [
      { label: 'Overview', href: '/care-dashboard', icon: Home },
      { label: 'Support Queue', href: '/care-dashboard/support-queue', icon: MessageSquare, badge: '3' },
      { label: 'Installations', href: '/care-dashboard/installations', icon: Users },
      { label: 'Diagnostic Flows', href: '/care-dashboard/diagnostic-flows', icon: GitBranch },
      { label: 'OpenHouse Intelligence', href: '/care-dashboard/intelligence', icon: Sparkles },
    ],
  },
  {
    title: 'Installer Tools',
    items: [
      { label: 'Content Manager', href: '/care-dashboard/content-manager', icon: BookOpen },
      { label: 'Warranty Tracker', href: '/care-dashboard/warranty-tracker', icon: ShieldCheck },
      { label: 'Communications', href: '/care-dashboard/communications', icon: Mail },
    ],
  },
  {
    title: 'Management',
    items: [
      { label: 'Smart Archive', href: '/care-dashboard/archive', icon: FolderArchive },
    ],
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CareLayoutWithSidebar({ children }: SidebarMenuProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [serviceTypeOpen, setServiceTypeOpen] = useState(false);
  const [selectedServiceType, setSelectedServiceType] = useState('All Services');

  const serviceTypes = ['All Services', 'Solar PV', 'Heat Pump', 'MVHR', 'EV Charger'];

  /** Determine if a nav item is the currently active route. */
  const isActive = (href: string): boolean => {
    if (href === '/care-dashboard') {
      return pathname === '/care-dashboard' || pathname === '/care-dashboard/overview';
    }
    return pathname?.startsWith(href) ?? false;
  };

  // -------------------------------------------------------------------------
  // Shared rendering helpers
  // -------------------------------------------------------------------------

  /** Render a single navigation item (used in both desktop and mobile). */
  const renderNavItem = (item: NavItem, options?: { onClick?: () => void }) => {
    const Icon = item.icon;
    const active = isActive(item.href);

    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={options?.onClick}
        className="group relative flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-all"
        style={{
          backgroundColor: active ? 'rgba(212,175,55,0.1)' : undefined,
          color: active ? '#FACC15' : '#9ca8bc',
          fontWeight: active ? 600 : 500,
        }}
        onMouseEnter={(e) => {
          if (!active) {
            e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)';
            e.currentTarget.style.color = '#d1d9e6';
          }
        }}
        onMouseLeave={(e) => {
          if (!active) {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = '#9ca8bc';
          }
        }}
      >
        {/* Gold left border indicator for active state */}
        {active && (
          <span
            className="absolute left-0 top-1/2 -translate-y-1/2 h-6 rounded-r"
            style={{ width: 3, backgroundColor: '#FACC15' }}
            aria-hidden
          />
        )}

        <Icon className="h-4 w-4 flex-shrink-0" />
        <span className="flex-1">{item.label}</span>

        {/* Badge (e.g. Support Queue count) */}
        {item.badge && (
          <span
            className="inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold leading-none"
            style={{
              backgroundColor: 'rgba(239,68,68,0.15)',
              color: '#f87171',
            }}
          >
            {item.badge}
          </span>
        )}
      </Link>
    );
  };

  /** Render a full navigation section with its title. */
  const renderNavSection = (section: NavSection, idx: number, options?: { onItemClick?: () => void }) => (
    <div key={idx}>
      <p
        className="px-4 py-2 text-xs font-semibold uppercase tracking-wider"
        style={{ color: '#6b7280' }}
      >
        {section.title}
      </p>
      <div className="space-y-0.5">
        {section.items.map((item) => renderNavItem(item, { onClick: options?.onItemClick }))}
      </div>
    </div>
  );

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="flex h-screen">
      {/* ----------------------------------------------------------------- */}
      {/* Desktop Sidebar                                                    */}
      {/* ----------------------------------------------------------------- */}
      <aside
        className="hidden md:flex flex-col w-[260px] flex-shrink-0"
        style={{ backgroundColor: '#0f1115' }}
      >
        {/* Logo */}
        <div
          className="flex items-center justify-center px-6 py-5"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        >
          <Image
            src="/branding/openhouse-logo.png"
            alt="OpenHouse AI"
            width={180}
            height={60}
            className="h-12 w-auto object-contain"
            priority
          />
        </div>

        {/* Service Type Dropdown */}
        <div className="px-4 pt-4 pb-2">
          <label
            className="block px-1 pb-1.5 text-[10px] font-semibold uppercase tracking-widest"
            style={{ color: '#6b7280' }}
          >
            Service Type
          </label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setServiceTypeOpen(!serviceTypeOpen)}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors"
              style={{
                backgroundColor: '#1a1d24',
                border: '1px solid rgba(255,255,255,0.04)',
                color: '#d1d9e6',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#1e222b';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#1a1d24';
              }}
            >
              <span>{selectedServiceType}</span>
              <ChevronDown
                className="h-4 w-4 transition-transform"
                style={{
                  color: '#6b7280',
                  transform: serviceTypeOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                }}
              />
            </button>

            {serviceTypeOpen && (
              <div
                className="absolute left-0 right-0 z-50 mt-1 rounded-lg py-1 shadow-xl"
                style={{
                  backgroundColor: '#1a1d24',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                {serviceTypes.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      setSelectedServiceType(type);
                      setServiceTypeOpen(false);
                    }}
                    className="flex w-full items-center px-3 py-2 text-sm transition-colors"
                    style={{
                      color: selectedServiceType === type ? '#FACC15' : '#9ca8bc',
                      backgroundColor: selectedServiceType === type ? 'rgba(212,175,55,0.08)' : 'transparent',
                    }}
                    onMouseEnter={(e) => {
                      if (selectedServiceType !== type) {
                        e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)';
                        e.currentTarget.style.color = '#d1d9e6';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedServiceType !== type) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = '#9ca8bc';
                      }
                    }}
                  >
                    {type}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav
          className="flex-1 overflow-y-auto px-3 py-4 space-y-6"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {navSections.map((section, idx) => renderNavSection(section, idx))}
        </nav>

        {/* Footer */}
        <div
          className="px-4 py-3 text-center"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
        >
          <p className="text-xs text-gray-600">
            OpenHouse Care &middot; v1.0.0
          </p>
        </div>
      </aside>

      {/* ----------------------------------------------------------------- */}
      {/* Main Content Column                                                */}
      {/* ----------------------------------------------------------------- */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile Header */}
        <header
          className="flex items-center justify-between border-b px-4 py-3 md:hidden"
          style={{ borderColor: 'rgba(0,0,0,0.06)', backgroundColor: '#ffffff' }}
        >
          <div className="flex items-center gap-2">
            <div
              className="flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold text-white"
              style={{
                background: 'linear-gradient(135deg, #d4af37, #b8962e)',
              }}
            >
              OH
            </div>
            <h1 className="text-sm font-bold text-gray-900">Care Dashboard</h1>
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="rounded-lg p-2 transition hover:bg-gray-100"
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5 text-gray-900" />
            ) : (
              <Menu className="h-5 w-5 text-gray-900" />
            )}
          </button>
        </header>

        {/* Mobile Menu Overlay */}
        {mobileMenuOpen && (
          <div
            className="absolute inset-0 z-40 md:hidden"
            style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden
          >
            <div
              className="h-full w-[280px] overflow-y-auto px-4 py-6 space-y-6"
              style={{ backgroundColor: '#0f1115' }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Mobile logo */}
              <div className="flex items-center justify-center pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <Image
                  src="/branding/openhouse-logo.png"
                  alt="OpenHouse AI"
                  width={160}
                  height={50}
                  className="h-10 w-auto object-contain"
                />
              </div>

              {/* Mobile Service Type */}
              <div className="px-1">
                <label
                  className="block pb-1.5 text-[10px] font-semibold uppercase tracking-widest"
                  style={{ color: '#6b7280' }}
                >
                  Service Type
                </label>
                <select
                  value={selectedServiceType}
                  onChange={(e) => setSelectedServiceType(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm font-medium"
                  style={{
                    backgroundColor: '#1a1d24',
                    border: '1px solid rgba(255,255,255,0.04)',
                    color: '#d1d9e6',
                  }}
                >
                  {serviceTypes.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              {/* Mobile navigation */}
              {navSections.map((section, idx) =>
                renderNavSection(section, idx, {
                  onItemClick: () => setMobileMenuOpen(false),
                })
              )}

              {/* Mobile footer */}
              <div className="pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <p className="text-center text-xs text-gray-600">
                  OpenHouse Care &middot; v1.0.0
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Page Content */}
        <main
          className="flex-1 overflow-y-auto"
          style={{ backgroundColor: '#f9fafb' }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
