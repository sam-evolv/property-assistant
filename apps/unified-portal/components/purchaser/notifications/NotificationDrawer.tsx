'use client';

import { useEffect, useRef } from 'react';
import {
  X,
  CheckCheck,
  AlertTriangle,
  FileText,
  Home,
  Wrench,
  MessageSquare,
  Info,
  Bell,
  Sparkles,
  Star,
} from 'lucide-react';

interface Notification {
  id: string;
  title: string;
  body: string;
  category: string;
  action_url: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: Notification[];
  unreadCount: number;
  onMarkAsRead: (ids: string[]) => void;
  onMarkAllAsRead: () => void;
  onNotificationTap?: (notification: Notification) => void;
  isDarkMode?: boolean;
}

const CATEGORY_ICONS: Record<string, { icon: any; color: string }> = {
  broadcast: { icon: MessageSquare, color: 'text-purple-500' },
  pipeline_update: { icon: Star, color: 'text-amber-500' },
  document_uploaded: { icon: FileText, color: 'text-blue-500' },
  snag_update: { icon: Wrench, color: 'text-orange-500' },
  handover: { icon: Home, color: 'text-emerald-500' },
  compliance: { icon: FileText, color: 'text-indigo-500' },
  ai_followup: { icon: Sparkles, color: 'text-gold-500' },
  maintenance: { icon: Wrench, color: 'text-blue-500' },
  community: { icon: MessageSquare, color: 'text-purple-500' },
  system: { icon: Info, color: 'text-gray-500' },
  urgent: { icon: AlertTriangle, color: 'text-red-500' },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-IE', {
    day: 'numeric',
    month: 'short',
  });
}

export function NotificationDrawer({
  isOpen,
  onClose,
  notifications,
  unreadCount,
  onMarkAsRead,
  onMarkAllAsRead,
  onNotificationTap,
  isDarkMode,
}: NotificationDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose]);

  // Close on Escape
  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      return () => document.removeEventListener('keydown', handleEsc);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.is_read) {
      onMarkAsRead([notification.id]);
    }
    onNotificationTap?.(notification);
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm" />

      {/* Drawer */}
      <div
        ref={drawerRef}
        className={`fixed top-0 right-0 z-50 h-full w-full max-w-md shadow-2xl transform transition-transform duration-300 ${
          isDarkMode ? 'bg-gray-900' : 'bg-white'
        }`}
      >
        {/* Header */}
        <div className={`flex items-center justify-between p-4 border-b ${
          isDarkMode ? 'border-gray-700' : 'border-gray-200'
        }`}>
          <div className="flex items-center gap-2">
            <Bell className={`w-5 h-5 ${isDarkMode ? 'text-gold-400' : 'text-gold-500'}`} />
            <h2 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Notifications
            </h2>
            {unreadCount > 0 && (
              <span className="inline-flex items-center justify-center px-2 py-0.5 bg-gold-500 text-white text-xs font-bold rounded-full">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={onMarkAllAsRead}
                className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                  isDarkMode
                    ? 'text-gold-400 hover:bg-gray-800'
                    : 'text-gold-600 hover:bg-gold-50'
                }`}
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all read
              </button>
            )}
            <button
              onClick={onClose}
              className={`p-1.5 rounded-lg transition ${
                isDarkMode ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
              }`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Notification List */}
        <div className="flex-1 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 64px)' }}>
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6">
              <Bell className={`w-12 h-12 mb-4 ${isDarkMode ? 'text-gray-600' : 'text-gray-300'}`} />
              <p className={`text-base font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                No notifications yet
              </p>
              <p className={`text-sm mt-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                You&apos;ll receive updates about your property here
              </p>
            </div>
          ) : (
            <div className={`divide-y ${isDarkMode ? 'divide-gray-800' : 'divide-gray-100'}`}>
              {notifications.map((notification) => {
                const catConfig = CATEGORY_ICONS[notification.category] || CATEGORY_ICONS.system;
                const Icon = catConfig.icon;

                return (
                  <button
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`w-full text-left p-4 transition ${
                      !notification.is_read
                        ? isDarkMode
                          ? 'bg-gold-500/5'
                          : 'bg-gold-50/50'
                        : ''
                    } ${
                      isDarkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex gap-3">
                      {/* Icon */}
                      <div className={`flex-shrink-0 mt-0.5 p-1.5 rounded-lg ${
                        isDarkMode ? 'bg-gray-800' : 'bg-gray-100'
                      }`}>
                        <Icon className={`w-4 h-4 ${catConfig.color}`} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className={`text-sm font-semibold truncate ${
                            isDarkMode ? 'text-white' : 'text-gray-900'
                          } ${!notification.is_read ? '' : 'font-medium'}`}>
                            {notification.title}
                          </h3>
                          {!notification.is_read && (
                            <span className="flex-shrink-0 w-2 h-2 bg-gold-500 rounded-full mt-1.5" />
                          )}
                        </div>
                        <p className={`text-sm mt-0.5 line-clamp-2 ${
                          isDarkMode ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                          {notification.body}
                        </p>
                        <p className={`text-xs mt-1 ${
                          isDarkMode ? 'text-gray-500' : 'text-gray-400'
                        }`}>
                          {timeAgo(notification.created_at)}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
