'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import {
  LayoutDashboard, Sparkles, ClipboardList, Wrench, Shield,
  FolderArchive, BookOpen, Menu, X, ChevronDown, LogOut, TrendingUp,
} from 'lucide-react';
import { ErrorBoundary } from '@/components/ErrorBoundary';

/* ── Installer brand (logo + name) — resolved per logged-in tenant ──
   Falls back to the SE Systems wordmark / "SE Systems Cork" badge when
   the tenant has no logo or name configured, so the SE Systems demo is
   unchanged while other installers (e.g. Solas Renewables) show their
   own branding. Mirrors the fallback pattern used at
   apps/unified-portal/app/care/[installationId]/page.tsx:71.
*/
function InstallerBrand({
  dark = true,
  logoUrl,
  name,
}: {
  dark?: boolean;
  logoUrl: string | null;
  name: string | null;
}) {
  const displayName = name ?? 'SE Systems';
  const subtitle = name ? '' : 'Cork';

  if (dark) {
    return (
      <Image
        src={logoUrl ?? '/branding/se-systems-logo.png'}
        alt={displayName}
        width={160}
        height={42}
        className="h-[38px] w-auto object-contain"
      />
    );
  }
  // Light background: tenant logo if available, otherwise SE Systems amber badge.
  if (logoUrl) {
    return (
      <div className="flex items-center gap-2.5">
        <Image
          src={logoUrl}
          alt={displayName}
          width={32}
          height={32}
          className="w-8 h-8 rounded-lg object-contain flex-shrink-0"
        />
        <p className="font-bold text-sm leading-tight text-gray-900 truncate">{displayName}</p>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center flex-shrink-0 shadow-md">
        <span className="text-white font-bold text-sm leading-none">SE</span>
      </div>
      <div>
        <p className="font-bold text-sm leading-tight text-gray-900">SE Systems</p>
        {subtitle && <p className="text-xs leading-tight text-gray-500">{subtitle}</p>}
      </div>
    </div>
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
      { href: '/care-dashboard/insights', label: 'Insights', icon: TrendingUp },
      { href: '/care-dashboard/communications', label: 'Communications', icon: BookOpen },
    ],
  },
];

export default function CareDashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClientComponentClient();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [pendingUploads, setPendingUploads] = useState(0);
  const [brand, setBrand] = useState<{ name: string | null; logoUrl: string | null }>({
    name: null,
    logoUrl: null,
  });

  // Resolve installer branding from the logged-in user's tenant. Until this
  // returns we fall back to the SE Systems wordmark in InstallerBrand, so the
  // dashboard chrome looks unchanged for SE Systems and pre-fetch state.
  useEffect(() => {
    let cancelled = false;
    fetch('/api/care-dashboard/brand')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { name?: string | null; logoUrl?: string | null } | null) => {
        if (cancelled || !d) return;
        setBrand({ name: d.name ?? null, logoUrl: d.logoUrl ?? null });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    document.title = brand.name
      ? `${brand.name} - OpenHouse Care`
      : 'SE Systems Cork - OpenHouse Care';
  }, [brand.name]);

  useEffect(() => {
    let cancelled = false;
    const fetchPending = () => {
      fetch('/api/care-dashboard/third-party?status=pending')
        .then((r) => (r.ok ? r.json() : { pendingCount: 0 }))
        .then((d) => !cancelled && setPendingUploads(d.pendingCount ?? 0))
        .catch(() => {});
    };
    fetchPending();
    const id = setInterval(fetchPending, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const handleSignOut = async () => {
    setSigningOut(true);
    await supabase.auth.signOut();
    router.push('/login');
  };

  const isActive = (href: string) =>
    href === '/care-dashboard'
      ? pathname === '/care-dashboard'
      : pathname?.startsWith(href);

  return (
    <div className="flex h-screen bg-white">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex flex-col w-64 bg-black border-r border-gold-900/20">
        {/* Installer logo — white label */}
        <div style={{ padding: '24px 20px 20px' }} className="border-b border-gold-900/20 flex items-center justify-center">
          <InstallerBrand logoUrl={brand.logoUrl} name={brand.name} />
        </div>

        {/* Installer Context Switcher */}
        <div className="px-4 py-3 border-b border-gold-900/20">
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: '#9CA3AF' }}>
            Current Installer
          </p>
          <button className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
            <span className="text-sm font-medium text-white truncate">{brand.name ?? 'SE Systems Cork'}</span>
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
                  const showDot =
                    item.href === '/care-dashboard/archive' && pendingUploads > 0;

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
                      {showDot && (
                        <span
                          className="ml-auto w-2 h-2 rounded-full bg-[#D4AF37] shadow-[0_0_6px_rgba(212,175,55,0.6)]"
                          title={`${pendingUploads} pending upload${pendingUploads === 1 ? '' : 's'}`}
                        />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="mt-auto" style={{ borderTop: '1px solid rgba(255,255,255,0.08)', padding: '12px' }}>
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg
              hover:bg-white/10 transition-all duration-150 group
              disabled:opacity-50 disabled:pointer-events-none"
          >
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-medium text-white truncate">{brand.name ?? 'SE Systems Cork'}</p>
              <p className="text-xs truncate" style={{ color: '#9CA3AF' }}>Installer account</p>
            </div>
            <LogOut className="w-4 h-4 flex-shrink-0 text-gray-500 group-hover:text-white transition-colors" />
          </button>
          <div style={{ padding: '12px 4px 4px' }}>
            <p className="text-center text-white" style={{ fontSize: '11px', opacity: 0.5, marginBottom: '6px' }}>Powered by</p>
            <div className="flex justify-center" style={{ opacity: 0.6 }}>
              <Image src="/branding/openhouse-logo.png" alt="OpenHouse AI" width={140} height={50} className="h-auto object-contain" style={{ width: '100px' }} />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile Header */}
        <div className="md:hidden border-b border-gold-200/30 px-4 py-4 flex items-center justify-between bg-white/50 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <InstallerBrand dark={false} logoUrl={brand.logoUrl} name={brand.name} />
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
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
}
