'use client';

import { Bell } from 'lucide-react';

interface NotificationBellProps {
  unreadCount: number;
  onClick: () => void;
  isDarkMode?: boolean;
}

export function NotificationBell({ unreadCount, onClick, isDarkMode }: NotificationBellProps) {
  return (
    <button
      onClick={onClick}
      className="relative p-2 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
      aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
    >
      <Bell
        className={`w-5 h-5 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}
      />
      {unreadCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-gold-500 text-white text-[10px] font-bold rounded-full shadow-sm">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  );
}
