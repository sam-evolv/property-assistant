'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import {
  LayoutDashboard,
  GitBranch,
  Zap,
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
} from 'lucide-react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useAgentDashboard } from './layout-provider';

interface NavItem {
  label: string;
  href: string;
  icon: any;
  badge?: number | null;
  badgeColor?: string;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

export function AgentDashboardSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClientComponentClient();
  const { profile, developments, selectedSchemeId, setSelectedSchemeId } = useAgentDashboard();

  const [schemeSwitcherOpen, setSchemeSwitcherOpen] = useState(false);
  const [overdueCount, setOverdueCount] = useState(0);
  const switcherRef = useRef<HTMLDivElement>(null);

  const isActive = (href: string) => {
    if (href === '/agent/dashboard/overview') return pathname === '/agent/dashboard/overview' || pathname === '/agent/dashboard';
    return pathname.startsWith(href);
  };

  const selectedSchemeName = selectedSchemeId
    ? developments.find(d => d.id === selectedSchemeId)?.name ?? 'Unknown'
    : 'All Schemes';

  // Fetch badge counts from pipeline data
  useEffect(() => {
    async function fetchBadges() {
      try {
        const res = await fetch('/api/agent/pipeline-data');
        if (!res.ok) return;
        const data = await res.json();
        const pipeline = data.pipeline ?? [];
        const overdue = pipeline.filter((p: any) =>
          p.dates?.contractsIssued && !p.dates?.contractsSigned &&
          new Date(p.dates.contractsIssued) < new Date(Date.now() - 21 * 86400000)
        ).length;
        setOverdueCount(overdue);
      } catch { /* silent */ }
    }
    fetchBadges();
  }, []);

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
    await supabase.auth.signOut();
    router.push('/login/agent');
  }

  const sections: NavSection[] = [
    {
      label: 'MAIN',
      items: [
        { label: 'Overview', href: '/agent/dashboard/overview', icon: LayoutDashboard },
        { label: 'Sales Pipeline', href: '/agent/dashboard/pipeline', icon: GitBranch, badge: overdueCount > 0 ? overdueCount : null, badgeColor: '#ef4444' },
        { label: 'Intelligence', href: '/agent/dashboard/intelligence', icon: Zap },
      ],
    },
    {
      label: 'AGENT TOOLS',
      items: [
        { label: 'Clients & Buyers', href: '/agent/dashboard/clients', icon: Users },
        { label: 'Communications', href: '/agent/dashboard/communications', icon: MessageSquare },
        { label: 'Viewings', href: '/agent/dashboard/viewings', icon: CalendarCheck },
        { label: 'Documents', href: '/agent/dashboard/documents', icon: FolderArchive },
        { label: 'Analytics', href: '/agent/dashboard/analytics', icon: BarChart3 },
      ],
    },
    {
      label: 'INTELLIGENCE TOOLS',
      items: [
        { label: 'Knowledge Base', href: '/agent/dashboard/knowledge-base', icon: BookOpen },
        { label: 'Data & Integrations', href: '/agent/dashboard/data-integrations', icon: Plug },
      ],
    },
    {
      label: 'ACCOUNT',
      items: [
        { label: 'Settings', href: '/agent/dashboard/settings', icon: Settings },
      ],
    },
  ];

  return (
    <aside style={{
      width: 220,
      flexShrink: 0,
      height: '100vh',
      background: '#0b0c0f',
      display: 'flex',
      flexDirection: 'column',
      overflowY: 'auto',
      overflowX: 'hidden',
    }}>
      {/* Logo + agency */}
      <div style={{ padding: '16px 14px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <Image
            src="/oh-logo.png"
            alt="OpenHouse"
            width={24}
            height={24}
            style={{ objectFit: 'contain', filter: 'brightness(0) invert(1)' }}
          />
          <div>
            <p style={{
              color: '#fff',
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: '-0.02em',
              margin: 0,
              lineHeight: 1.2,
            }}>
              {profile.agency_name || 'OpenHouse Agent'}
            </p>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, margin: 0 }}>
              {profile.display_name}
            </p>
          </div>
        </div>

        {/* Scheme switcher */}
        <div ref={switcherRef} style={{ position: 'relative', marginBottom: 14 }}>
          <button
            onClick={() => setSchemeSwitcherOpen(!schemeSwitcherOpen)}
            style={{
              width: '100%',
              padding: '8px 10px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 8,
              cursor: 'pointer',
              textAlign: 'left',
              fontFamily: 'inherit',
            }}
          >
            <p style={{
              color: 'rgba(255,255,255,0.22)',
              fontSize: 9.5,
              fontWeight: 700,
              letterSpacing: '0.09em',
              textTransform: 'uppercase' as const,
              margin: '0 0 3px',
            }}>
              CURRENT SCHEME
            </p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ color: '#fff', fontSize: 12.5, fontWeight: 600, letterSpacing: '-0.01em' }}>
                {selectedSchemeName}
              </span>
              <ChevronDown size={13} color="rgba(255,255,255,0.4)" style={{ transition: 'transform 0.15s', transform: schemeSwitcherOpen ? 'rotate(180deg)' : 'none' }} />
            </div>
          </button>

          {schemeSwitcherOpen && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              marginTop: 4,
              background: '#1a1b1f',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8,
              padding: '4px 0',
              zIndex: 50,
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
              maxHeight: 280,
              overflowY: 'auto',
            }}>
              <button
                onClick={() => { setSelectedSchemeId(null); setSchemeSwitcherOpen(false); }}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: !selectedSchemeId ? 'rgba(200,150,10,0.12)' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span style={{
                  color: !selectedSchemeId ? '#e8c84a' : 'rgba(255,255,255,0.7)',
                  fontSize: 12.5,
                  fontWeight: !selectedSchemeId ? 600 : 400,
                }}>
                  All Schemes
                </span>
                {!selectedSchemeId && <Check size={13} color="#e8c84a" />}
              </button>
              {developments.map(dev => (
                <button
                  key={dev.id}
                  onClick={() => { setSelectedSchemeId(dev.id); setSchemeSwitcherOpen(false); }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: selectedSchemeId === dev.id ? 'rgba(200,150,10,0.12)' : 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontFamily: 'inherit',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{
                    color: selectedSchemeId === dev.id ? '#e8c84a' : 'rgba(255,255,255,0.7)',
                    fontSize: 12.5,
                    fontWeight: selectedSchemeId === dev.id ? 600 : 400,
                  }}>
                    {dev.name}
                  </span>
                  {selectedSchemeId === dev.id && <Check size={13} color="#e8c84a" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Navigation sections */}
      <nav style={{ flex: 1, padding: '0 8px' }}>
        {sections.map((section) => (
          <div key={section.label} style={{ marginBottom: 14 }}>
            <p style={{
              color: 'rgba(255,255,255,0.22)',
              fontSize: 9.5,
              fontWeight: 700,
              letterSpacing: '0.09em',
              textTransform: 'uppercase' as const,
              margin: '0 0 4px',
              paddingLeft: 8,
            }}>
              {section.label}
            </p>
            {section.items.map(({ label, href, icon: Icon, badge, badgeColor }) => {
              const active = isActive(href);
              return (
                <Link
                  key={href}
                  href={href}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 9,
                    padding: '7px 10px',
                    borderRadius: 7,
                    marginBottom: 1,
                    textDecoration: 'none',
                    background: active ? 'rgba(200,150,10,0.12)' : 'transparent',
                    transition: 'background 0.12s ease',
                  }}
                  onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; }}
                  onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <Icon
                    size={15}
                    color={active ? '#e8c84a' : 'rgba(255,255,255,0.45)'}
                    strokeWidth={active ? 2 : 1.6}
                  />
                  <span style={{
                    color: active ? '#e8c84a' : 'rgba(255,255,255,0.45)',
                    fontSize: 13,
                    fontWeight: active ? 600 : 400,
                    letterSpacing: '-0.01em',
                    flex: 1,
                  }}>
                    {label}
                  </span>
                  {badge != null && (
                    <span style={{
                      minWidth: 18,
                      height: 18,
                      padding: '0 5px',
                      borderRadius: 9,
                      background: badgeColor ?? '#ef4444',
                      color: '#fff',
                      fontSize: 10,
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      lineHeight: 1,
                    }}>
                      {badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Bottom section */}
      <div style={{
        padding: '10px 8px',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}>
        <Link
          href="/agent/home"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 9,
            padding: '7px 10px',
            borderRadius: 7,
            textDecoration: 'none',
          }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
        >
          <Smartphone size={14} color="rgba(255,255,255,0.45)" strokeWidth={1.6} />
          <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12.5, fontWeight: 400 }}>
            Switch to mobile app
          </span>
        </Link>
        <button
          onClick={handleSignOut}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 9,
            padding: '7px 10px',
            borderRadius: 7,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            width: '100%',
            fontFamily: 'inherit',
          }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
        >
          <LogOut size={14} color="#ef4444" strokeWidth={1.6} />
          <span style={{ color: '#ef4444', fontSize: 12.5, fontWeight: 500 }}>
            Sign out
          </span>
        </button>
      </div>
    </aside>
  );
}
