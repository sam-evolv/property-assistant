'use client';

import { useState, useEffect, useCallback } from 'react';

interface Notification {
  id: string;
  title: string;
  body: string;
  category: string;
  action_url: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
  broadcast_id: string | null;
}

interface UseNotificationsReturn {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  markAsRead: (notificationIds: string[]) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useNotifications(unitUid: string, token: string | null): UseNotificationsReturn {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    if (!unitUid || !token) {
      setLoading(false);
      return;
    }

    try {
      const params = new URLSearchParams({
        unitUid,
        token,
        limit: '50',
      });

      const res = await fetch(`/api/notifications?${params}`);
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unread_count || 0);
      }
    } catch (error) {
      console.error('[useNotifications] Failed to fetch:', error);
    } finally {
      setLoading(false);
    }
  }, [unitUid, token]);

  useEffect(() => {
    fetchNotifications();

    // Poll every 30 seconds for new notifications
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const markAsRead = useCallback(async (notificationIds: string[]) => {
    if (!unitUid || !token || !notificationIds.length) return;

    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          unitUid,
          notification_ids: notificationIds,
        }),
      });

      // Optimistic update
      setNotifications(prev =>
        prev.map(n =>
          notificationIds.includes(n.id)
            ? { ...n, is_read: true, read_at: new Date().toISOString() }
            : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - notificationIds.length));
    } catch (error) {
      console.error('[useNotifications] Failed to mark as read:', error);
    }
  }, [unitUid, token]);

  const markAllAsRead = useCallback(async () => {
    if (!unitUid || !token) return;

    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          unitUid,
          mark_all_read: true,
        }),
      });

      // Optimistic update
      setNotifications(prev =>
        prev.map(n => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch (error) {
      console.error('[useNotifications] Failed to mark all as read:', error);
    }
  }, [unitUid, token]);

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    refresh: fetchNotifications,
  };
}
