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
        .select('*')
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
        {/* Time */}
        <span
          style={{
            color: '#0D0D12',
            fontSize: 15,
            fontWeight: 600,
            letterSpacing: '-0.02em',
          }}
        >
          {new Date().toLocaleTimeString('en-IE', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: false,
          })}
        </span>

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
            onClick={() => contexts.length > 1 && setShowSwitcher(!showSwitcher)}
            style={{
              color: '#A0A8B0',
              fontSize: 11,
              fontWeight: 400,
              letterSpacing: '0.04em',
              cursor: contexts.length > 1 ? 'pointer' : 'default',
            }}
          >
            {agentName}
            {contexts.length > 1 && ' \u25BE'}
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

      {/* Context switcher */}
      {showSwitcher && contexts.length > 1 && (
        <>
          <div
            onClick={() => setShowSwitcher(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.3)',
              zIndex: 40,
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: 54,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 280,
              background: '#1a1a1f',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 14,
              padding: '8px 0',
              zIndex: 50,
              boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
            }}
          >
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', padding: '8px 16px 4px', margin: 0 }}>
              SWITCH CONTEXT
            </p>
            {contexts.map((ctx) => (
              <button
                key={ctx.id}
                onClick={() => {
                  setShowSwitcher(false);
                  router.push(getContextRoute(ctx));
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  padding: '10px 16px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'inherit',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
              >
                <span style={{ fontSize: 16 }}>{getContextEmoji(ctx)}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ color: '#f5f5f4', fontSize: 13, fontWeight: 500, margin: 0 }}>{ctx.display_name}</p>
                  <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, margin: 0 }}>{ctx.display_subtitle || ctx.product}</p>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

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
