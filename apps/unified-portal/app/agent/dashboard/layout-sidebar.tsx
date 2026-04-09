'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  GitBranch,
  Home,
  Calendar,
  Lightbulb,
  FolderArchive,
  BarChart3,
  Settings,
  Smartphone,
  LogOut,
} from 'lucide-react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

interface AgentProfile {
  id: string;
  display_name: string;
  agency_name: string;
  agent_type: 'scheme' | 'independent' | 'hybrid';
}

const NAV_ITEMS = [
  { label: 'Overview',       href: '/agent/dashboard/overview',     icon: LayoutDashboard },
  { label: 'Pipeline',       href: '/agent/dashboard/pipeline',     icon: GitBranch },
  { label: 'My Listings',    href: '/agent/dashboard/listings',     icon: Home,         independentOnly: true },
  { label: 'Viewings',       href: '/agent/dashboard/viewings',     icon: Calendar },
  { label: 'Intelligence',   href: '/agent/dashboard/intelligence', icon: Lightbulb },
  { label: 'Documents',      href: '/agent/dashboard/documents',    icon: FolderArchive },
  { label: 'Analytics',      href: '/agent/dashboard/analytics',    icon: BarChart3 },
  { label: 'Settings',       href: '/agent/dashboard/settings',     icon: Settings },
];

export function AgentDashboardSidebar({ profile }: { profile: AgentProfile }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClientComponentClient();

  const isActive = (href: string) => pathname.startsWith(href);
  const isIndependent = profile.agent_type !== 'scheme';

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/login/agent');
  }

  // Filter nav items based on agent type
  const visibleItems = NAV_ITEMS.filter(item =>
    !item.independentOnly || isIndependent
  );

  return (
    <aside style={{
      width: 240,
      flexShrink: 0,
      height: '100vh',
      background: '#ffffff',
      borderRight: '1px solid rgba(0,0,0,0.06)',
      display: 'flex',
      flexDirection: 'column',
      overflowY: 'auto',
      overflowX: 'hidden',
    }}>

      {/* Logo + agency */}
      <div style={{
        padding: '20px 20px 0',
        marginBottom: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <Image
            src="/oh-logo.png"
            alt="OpenHouse"
            width={28}
            height={28}
            style={{ objectFit: 'contain', mixBlendMode: 'multiply' }}
          />
          <div>
            <p style={{
              color: '#0D0D12',
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: '-0.02em',
              margin: 0,
              lineHeight: 1.2,
            }}>
              {profile.agency_name || 'OpenHouse Agent'}
            </p>
            <p style={{ color: '#A0A8B0', fontSize: 11, margin: 0 }}>
              {profile.display_name}
            </p>
          </div>
        </div>

        {/* Section label */}
        <p style={{
          color: '#C0C8D0',
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '0.07em',
          textTransform: 'uppercase',
          margin: '0 0 6px',
          paddingLeft: 2,
        }}>
          Dashboard
        </p>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '0 12px' }}>
        {visibleItems.map(({ label, href, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 10px',
                borderRadius: 8,
                marginBottom: 2,
                textDecoration: 'none',
                background: active
                  ? 'rgba(196,155,42,0.08)'
                  : 'transparent',
                transition: 'background 0.12s ease',
              }}
            >
              <Icon
                size={16}
                color={active ? '#C49B2A' : '#9CA3AF'}
                strokeWidth={active ? 2 : 1.6}
              />
              <span style={{
                color: active ? '#C49B2A' : '#374151',
                fontSize: 13,
                fontWeight: active ? 600 : 500,
                letterSpacing: '-0.01em',
              }}>
                {label}
              </span>
              {active && (
                <div style={{
                  marginLeft: 'auto',
                  width: 4,
                  height: 4,
                  borderRadius: 2,
                  background: 'linear-gradient(135deg, #B8960C, #E8C84A)',
                }}/>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div style={{
        padding: '12px',
        borderTop: '1px solid rgba(0,0,0,0.06)',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}>

        {/* Switch to mobile app */}
        <Link
          href="/agent/home"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 10px',
            borderRadius: 8,
            textDecoration: 'none',
          }}
        >
          <Smartphone size={15} color="#9CA3AF" strokeWidth={1.6} />
          <span style={{ color: '#6B7280', fontSize: 13, fontWeight: 500 }}>
            Switch to mobile app
          </span>
        </Link>

        {/* Sign out */}
        <button
          onClick={handleSignOut}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 10px',
            borderRadius: 8,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            width: '100%',
            fontFamily: 'inherit',
          }}
        >
          <LogOut size={15} color="#EF4444" strokeWidth={1.6} />
          <span style={{ color: '#EF4444', fontSize: 13, fontWeight: 500 }}>
            Sign out
          </span>
        </button>
      </div>
    </aside>
  );
}
