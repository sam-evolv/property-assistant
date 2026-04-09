'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import NotificationPanel from './NotificationPanel';
import type { Notification } from './NotificationPanel';
import { BUYERS, AGENT_STATS } from '@/lib/agent/demo-data';

interface UserContext {
  id: string;
  product: string;
  context_type: string;
  context_id: string;
  display_name: string;
  display_subtitle: string | null;
  display_icon: string | null;
  last_active_at: string | null;
}

/* ─── Build notifications from demo data ─── */

function buildNotifications(): Notification[] {
  const notifs: Notification[] = [];

  // Contract overdue notifications — from urgent buyers
  const urgent = BUYERS.filter((b) => b.urgent)
    .sort((a, b) => (b.daysSinceIssued ?? 0) - (a.daysSinceIssued ?? 0));

  urgent.forEach((b) => {
    const days = b.daysSinceIssued ?? 0;
    notifs.push({
      id: `contract-${b.id}`,
      type: 'contract_overdue',
      title: `${b.name.split(' ').slice(0, 2).join(' ')}`,
      body: `Contracts issued ${days} days ago for ${b.unit}, ${b.scheme}. No signature received.`,
      time: days > 100 ? `${days}d overdue` : `${days}d ago`,
      read: days < 70,
      actionLabel: 'View buyer',
      actionHref: '/agent/pipeline/riverside',
      urgency: days > 120 ? 'critical' : days > 80 ? 'high' : 'normal',
      buyerInitials: b.initials,
    });
  });

  // Viewing notifications
  notifs.push({
    id: 'viewing-1',
    type: 'viewing_upcoming',
    title: 'Viewing today at 10:00',
    body: 'Sarah & Michael Kelly — Riverside Gardens, Unit 12. Second viewing.',
    time: '2h from now',
    read: false,
    actionLabel: 'View schedule',
    actionHref: '/agent/viewings',
    urgency: 'normal',
  });

  notifs.push({
    id: 'viewing-2',
    type: 'viewing_upcoming',
    title: '3 viewings scheduled tomorrow',
    body: 'Meadow View (2) and Harbour View (1). All confirmed.',
    time: 'Tomorrow',
    read: true,
    actionLabel: 'View schedule',
    actionHref: '/agent/viewings',
    urgency: 'normal',
  });

  // Document notification
  notifs.push({
    id: 'doc-1',
    type: 'document_pending',
    title: 'BER certs updated',
    body: 'Riverside Gardens BER certificate pack has been updated. Review required.',
    time: '3h ago',
    read: false,
    actionLabel: 'View docs',
    actionHref: '/agent/docs',
    urgency: 'normal',
  });

  // Milestone
  notifs.push({
    id: 'milestone-1',
    type: 'milestone',
    title: 'Meadow View — 75% sold',
    body: '39 of 52 units now progressed. Revenue: €17.3m.',
    time: 'Yesterday',
    read: true,
    actionLabel: 'View scheme',
    actionHref: '/agent/pipeline/meadow',
    urgency: 'normal',
  });

  notifs.push({
    id: 'milestone-2',
    type: 'milestone',
    title: 'Rory O\'Connor — sale closed',
    body: 'Unit 15, Meadow View handed over successfully.',
    time: '2 days ago',
    read: true,
    actionLabel: 'View pipeline',
    actionHref: '/agent/pipeline/meadow',
    urgency: 'normal',
  });

  return notifs;
}

interface StatusBarProps {
  agentName?: string;
  urgentCount?: number;
}

function getContextRoute(ctx: UserContext): string {
  switch (ctx.product) {
    case 'homeowner': return `/homes/${ctx.context_id}`;
    case 'care': return `/care/${ctx.context_id}`;
    case 'developer': return '/developer/overview';
    case 'agent': return '/agent/home';
    default: return '/';
  }
}

function getContextEmoji(ctx: UserContext): string {
  switch (ctx.product) {
    case 'homeowner': return '\u{1F3E0}';
    case 'care': return '\u2600\uFE0F';
    case 'developer': return '\u{1F3D7}\uFE0F';
    case 'agent': return '\u{1F454}';
    default: return '\u{1F4BC}';
  }
}

export default function StatusBar({
  agentName = 'Sam',
}: StatusBarProps) {
  const [panelOpen, setPanelOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>(() =>
    buildNotifications()
  );
  const [contexts, setContexts] = useState<UserContext[]>([]);
  const [showSwitcher, setShowSwitcher] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const hasEnv = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) && Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    if (!hasEnv) return;

    async function fetchContexts() {
      const supabase = createClientComponentClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('user_contexts')
        .select('id, product, context_type, context_id, display_name, display_subtitle, display_icon, last_active_at')
        .eq('auth_user_id', user.id)
        .order('last_active_at', { ascending: false });

      setContexts(data || []);
    }
    fetchContexts();
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  const handleMarkAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  return (
    <>
      <header
        style={{
          height: 54,
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'transparent',
          flexShrink: 0,
          zIndex: 10,
        }}
      >
        {/* Brand wordmark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span
            style={{
              background: 'linear-gradient(135deg, #B8960C, #E8C84A, #C4A020)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '0.18em',
            }}
          >
            OPENHOUSE
          </span>
          <span
            style={{
              width: 1,
              height: 8,
              background: 'rgba(0,0,0,0.12)',
              display: 'inline-block',
            }}
          />
          <span
            onClick={() => setShowSwitcher(!showSwitcher)}
            style={{
              color: '#A0A8B0',
              fontSize: 11,
              fontWeight: 400,
              letterSpacing: '0.04em',
              cursor: 'pointer',
            }}
          >
            {agentName} &#9662;
          </span>
        </div>

        {/* Bell — opens notification panel */}
        <button
          onClick={() => setPanelOpen((prev) => !prev)}
          className="agent-tappable"
          style={{
            position: 'relative',
            display: 'flex',
            background: 'none',
            border: 'none',
            padding: 4,
            margin: -4,
            cursor: 'pointer',
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#2A2A2A"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 01-3.46 0" />
          </svg>
          {unreadCount > 0 && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                width: 16,
                height: 16,
                borderRadius: 8,
                background: 'linear-gradient(135deg, #EF4444, #DC2626)',
                border: '2px solid #FAFAF8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 6px rgba(220, 38, 38, 0.4)',
              }}
            >
              <span
                style={{
                  color: '#fff',
                  fontSize: 8,
                  fontWeight: 800,
                  lineHeight: 1,
                  letterSpacing: '-0.02em',
                }}
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            </div>
          )}
        </button>
      </header>

      {/* Context switcher bottom sheet */}
      {showSwitcher && (
        <div
          onClick={() => setShowSwitcher(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            zIndex: 200,
            display: 'flex',
            alignItems: 'flex-end',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              background: '#fff',
              borderRadius: '28px 28px 0 0',
              padding: '0 0 32px',
              boxShadow: '0 -4px 32px rgba(0,0,0,0.12)',
              animation: 'slideUp 300ms cubic-bezier(.2,.8,.2,1)',
            }}
          >
            {/* Handle */}
            <div style={{ width: 40, height: 4, background: '#E0E0DC', borderRadius: 2, margin: '14px auto 20px' }} />

            {/* Header */}
            <div style={{ padding: '0 24px 16px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
              <p style={{ color: '#9EA8B5', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 2px' }}>
                Your OpenHouse
              </p>
              <p style={{ color: '#A0A8B0', fontSize: 13, margin: 0 }}>
                Switch between your products
              </p>
            </div>

            {/* Context list */}
            {contexts.map((ctx, i) => {
              const isActive = ctx.product === 'agent';
              const iconColor = isActive ? '#C49B2A' : '#6B7280';
              const icons: Record<string, JSX.Element> = {
                home: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>,
                briefcase: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/></svg>,
                building: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="12" y2="14"/></svg>,
                sun: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><polygon points="13,2 3,14 12,14 11,22 21,10 12,10 13,2"/></svg>,
              };
              const icon = icons[ctx.display_icon || ''] || icons.home;

              return (
                <div
                  key={ctx.id}
                  onClick={() => {
                    setShowSwitcher(false);
                    if (!isActive) router.push(getContextRoute(ctx));
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: '15px 24px',
                    borderBottom: i < contexts.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none',
                    cursor: isActive ? 'default' : 'pointer',
                    background: isActive ? 'rgba(212,175,55,0.04)' : '#fff',
                  }}
                >
                  <div style={{
                    width: 38, height: 38, borderRadius: 11,
                    background: isActive ? 'rgba(212,175,55,0.12)' : '#F5F5F3',
                    border: isActive ? '1px solid rgba(212,175,55,0.25)' : '0.5px solid rgba(0,0,0,0.06)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    {icon}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      color: isActive ? '#C49B2A' : '#0D0D12',
                      fontSize: 14, fontWeight: 600, margin: '0 0 2px',
                      letterSpacing: '-0.01em', overflow: 'hidden',
                      textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {ctx.display_name}
                    </p>
                    <p style={{ color: '#A0A8B0', fontSize: 12, margin: 0 }}>
                      {ctx.display_subtitle || ctx.product}
                    </p>
                  </div>

                  {isActive ? (
                    <span style={{
                      padding: '3px 10px', borderRadius: 20,
                      background: 'rgba(212,175,55,0.12)',
                      border: '1px solid rgba(212,175,55,0.25)',
                      color: '#C49B2A', fontSize: 10, fontWeight: 700,
                      letterSpacing: '0.04em',
                    }}>
                      ACTIVE
                    </span>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.2)" strokeWidth="2" strokeLinecap="round"><polyline points="9,18 15,12 9,6"/></svg>
                  )}
                </div>
              );
            })}

            {/* Open desktop dashboard */}
            <a
              href="/agent/dashboard"
              onClick={() => setShowSwitcher(false)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '14px 24px',
                borderTop: '1px solid rgba(0,0,0,0.04)',
                textDecoration: 'none',
                cursor: 'pointer',
              }}
            >
              <div style={{
                width: 38, height: 38, borderRadius: 11,
                background: '#F5F5F3',
                border: '0.5px solid rgba(0,0,0,0.06)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                  stroke="#6B7280" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="3" width="20" height="14" rx="2"/>
                  <line x1="8" y1="21" x2="16" y2="21"/>
                  <line x1="12" y1="17" x2="12" y2="21"/>
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ color: '#0D0D12', fontSize: 14, fontWeight: 600, margin: '0 0 2px', letterSpacing: '-0.01em' }}>
                  Open desktop dashboard
                </p>
                <p style={{ color: '#A0A8B0', fontSize: 12, margin: 0 }}>
                  Analytics, documents & full pipeline
                </p>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="rgba(0,0,0,0.2)" strokeWidth="2" strokeLinecap="round">
                <polyline points="9,18 15,12 9,6"/>
              </svg>
            </a>

            {/* Add another product */}
            <div
              onClick={() => { setShowSwitcher(false); router.push('/login'); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '14px 24px',
                borderTop: '1px solid rgba(0,0,0,0.04)',
                cursor: 'pointer',
              }}
            >
              <div style={{
                width: 38, height: 38, borderRadius: 11,
                background: '#F5F5F3', border: '0.5px solid rgba(0,0,0,0.06)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.8" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </div>
              <p style={{ color: '#9CA3AF', fontSize: 14, fontWeight: 500, margin: 0 }}>
                Connect another product
              </p>
            </div>

            {/* Sign out */}
            <div style={{ padding: '16px 24px 0', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
              <button
                onClick={async () => {
                  setShowSwitcher(false);
                  const supabase = createClientComponentClient();
                  await supabase.auth.signOut();
                  router.push('/login/agent');
                }}
                style={{
                  width: '100%', padding: '14px', borderRadius: 14,
                  background: '#fff', border: '0.5px solid rgba(0,0,0,0.08)',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                  color: '#EF4444', fontSize: 14, fontWeight: 500,
                  cursor: 'pointer', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
                  <polyline points="16,17 21,12 16,7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>

      {/* Notification panel */}
      <NotificationPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        notifications={notifications}
        onMarkRead={handleMarkRead}
        onMarkAllRead={handleMarkAllRead}
      />
    </>
  );
}
