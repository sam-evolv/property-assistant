'use client';

import { useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Buyer } from './types';

interface Notification {
  id: string;
  type: 'contract_overdue' | 'viewing_upcoming' | 'document_pending' | 'milestone';
  title: string;
  body: string;
  time: string;
  read: boolean;
  actionLabel: string;
  actionHref: string;
  urgency: 'critical' | 'high' | 'normal';
  buyerInitials?: string;
}

interface NotificationPanelProps {
  open: boolean;
  onClose: () => void;
  notifications: Notification[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
}

export type { Notification };

export default function NotificationPanel({
  open,
  onClose,
  notifications,
  onMarkRead,
  onMarkAllRead,
}: NotificationPanelProps) {
  const router = useRouter();

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [open, handleKeyDown]);

  if (!open) return null;

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleAction = (notif: Notification) => {
    onMarkRead(notif.id);
    onClose();
    router.push(notif.actionHref);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="sheet-backdrop-enter"
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.3)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          zIndex: 100,
        }}
      />

      {/* Panel */}
      <div
        style={{
          position: 'fixed',
          top: 54,
          right: 12,
          left: 12,
          maxHeight: '70dvh',
          background: '#FFFFFF',
          borderRadius: 20,
          boxShadow:
            '0 8px 40px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08), 0 0 0 0.5px rgba(0,0,0,0.06)',
          zIndex: 101,
          overflowY: 'auto',
          overflowX: 'hidden',
          scrollbarWidth: 'none',
          animation: 'slideDown 0.25s cubic-bezier(0.2, 0.8, 0.2, 1) forwards',
        }}
        className="[&::-webkit-scrollbar]:hidden"
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '18px 20px 12px',
            borderBottom: '1px solid rgba(0,0,0,0.05)',
            position: 'sticky',
            top: 0,
            background: '#FFFFFF',
            zIndex: 1,
            borderRadius: '20px 20px 0 0',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h3
              style={{
                fontSize: 17,
                fontWeight: 700,
                letterSpacing: '-0.03em',
                color: '#0D0D12',
                margin: 0,
              }}
            >
              Notifications
            </h3>
            {unreadCount > 0 && (
              <span
                style={{
                  background: 'linear-gradient(135deg, #EF4444, #DC2626)',
                  color: '#fff',
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '2px 7px',
                  borderRadius: 10,
                  lineHeight: 1.2,
                }}
              >
                {unreadCount}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={onMarkAllRead}
              style={{
                background: 'none',
                border: 'none',
                fontSize: 12,
                fontWeight: 600,
                color: '#C49B2A',
                cursor: 'pointer',
                fontFamily: 'inherit',
                letterSpacing: '-0.01em',
                padding: '4px 0',
              }}
            >
              Mark all read
            </button>
          )}
        </div>

        {/* Notification list */}
        {notifications.length === 0 ? (
          <div
            style={{
              padding: '40px 20px',
              textAlign: 'center',
              color: '#A0A8B0',
            }}
          >
            <svg
              width={28}
              height={28}
              viewBox="0 0 24 24"
              fill="none"
              stroke="#D0D8E0"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ margin: '0 auto 10px' }}
            >
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 01-3.46 0" />
            </svg>
            <p style={{ fontSize: 13, fontWeight: 500 }}>No notifications</p>
          </div>
        ) : (
          <div>
            {notifications.map((notif, i) => (
              <div
                key={notif.id}
                onClick={() => handleAction(notif)}
                className="agent-tappable"
                style={{
                  display: 'flex',
                  gap: 12,
                  padding: '14px 20px',
                  borderBottom:
                    i < notifications.length - 1
                      ? '1px solid rgba(0,0,0,0.04)'
                      : 'none',
                  background: notif.read ? 'transparent' : 'rgba(196,155,42,0.03)',
                  position: 'relative',
                }}
              >
                {/* Unread dot */}
                {!notif.read && (
                  <div
                    style={{
                      position: 'absolute',
                      left: 8,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      background:
                        notif.urgency === 'critical'
                          ? '#EF4444'
                          : notif.urgency === 'high'
                            ? '#F59E0B'
                            : '#3B82F6',
                    }}
                  />
                )}

                {/* Icon / Avatar */}
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 11,
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    ...getIconStyle(notif),
                  }}
                >
                  {notif.buyerInitials ? (
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: getIconTextColor(notif),
                      }}
                    >
                      {notif.buyerInitials}
                    </span>
                  ) : (
                    getIcon(notif)
                  )}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: notif.read ? 500 : 600,
                      color: '#0D0D12',
                      letterSpacing: '-0.01em',
                      lineHeight: 1.3,
                      marginBottom: 3,
                    }}
                  >
                    {notif.title}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: '#8B95A2',
                      lineHeight: 1.4,
                      marginBottom: 6,
                    }}
                  >
                    {notif.body}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        color: '#B0B8C4',
                        letterSpacing: '0.005em',
                      }}
                    >
                      {notif.time}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: '#C49B2A',
                        letterSpacing: '-0.01em',
                      }}
                    >
                      {notif.actionLabel} &rsaquo;
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}

/* ─── Helpers ─── */

function getIconStyle(notif: Notification): React.CSSProperties {
  switch (notif.type) {
    case 'contract_overdue':
      return {
        background: '#FEF2F2',
        border: '1px solid rgba(239,68,68,0.15)',
      };
    case 'viewing_upcoming':
      return {
        background: 'rgba(59,130,246,0.08)',
        border: '1px solid rgba(59,130,246,0.15)',
      };
    case 'document_pending':
      return {
        background: 'rgba(124,58,237,0.08)',
        border: '1px solid rgba(124,58,237,0.15)',
      };
    case 'milestone':
      return {
        background: 'rgba(16,185,129,0.08)',
        border: '1px solid rgba(16,185,129,0.15)',
      };
  }
}

function getIconTextColor(notif: Notification): string {
  switch (notif.type) {
    case 'contract_overdue':
      return '#B91C1C';
    case 'viewing_upcoming':
      return '#1D4ED8';
    case 'document_pending':
      return '#5B21B6';
    case 'milestone':
      return '#065F46';
  }
}

function getIcon(notif: Notification): React.ReactNode {
  const color = getIconTextColor(notif);
  switch (notif.type) {
    case 'contract_overdue':
      return (
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12,6 12,12 16,14" />
        </svg>
      );
    case 'viewing_upcoming':
      return (
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      );
    case 'document_pending':
      return (
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <polyline points="14,2 14,8 20,8" />
        </svg>
      );
    case 'milestone':
      return (
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
          <polyline points="22,4 12,14.01 9,11.01" />
        </svg>
      );
  }
}
