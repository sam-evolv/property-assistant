'use client';

import { memo, useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
  MessageSquare,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Bell,
  UserPlus,
  Settings,
  Mail,
  Phone,
  Calendar,
  Upload,
  Download,
  Pencil,
  Trash2,
  Eye,
  type LucideIcon,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

// ============================================================================
// TYPES
// ============================================================================
export type EventType =
  | 'message'
  | 'document'
  | 'alert'
  | 'success'
  | 'notification'
  | 'user_added'
  | 'settings'
  | 'email'
  | 'call'
  | 'meeting'
  | 'upload'
  | 'download'
  | 'edit'
  | 'delete'
  | 'view';

export interface TimelineEvent {
  id: string;
  type: EventType;
  title: string;
  description?: string;
  timestamp: Date | string;
  user?: {
    name: string;
    avatar?: string;
  };
  metadata?: Record<string, string | number>;
  status?: 'pending' | 'completed' | 'failed';
}

interface ActivityTimelineProps {
  events: TimelineEvent[];
  maxItems?: number;
  showLoadMore?: boolean;
  onLoadMore?: () => void;
  loading?: boolean;
  className?: string;
  emptyMessage?: string;
}

// ============================================================================
// ICON MAPPING
// ============================================================================
const eventIcons: Record<EventType, LucideIcon> = {
  message: MessageSquare,
  document: FileText,
  alert: AlertTriangle,
  success: CheckCircle2,
  notification: Bell,
  user_added: UserPlus,
  settings: Settings,
  email: Mail,
  call: Phone,
  meeting: Calendar,
  upload: Upload,
  download: Download,
  edit: Pencil,
  delete: Trash2,
  view: Eye,
};

const eventColors: Record<EventType, { bg: string; icon: string; ring: string }> = {
  message: { bg: 'bg-blue-100', icon: 'text-blue-600', ring: 'ring-blue-200' },
  document: { bg: 'bg-purple-100', icon: 'text-purple-600', ring: 'ring-purple-200' },
  alert: { bg: 'bg-amber-100', icon: 'text-amber-600', ring: 'ring-amber-200' },
  success: { bg: 'bg-emerald-100', icon: 'text-emerald-600', ring: 'ring-emerald-200' },
  notification: { bg: 'bg-brand-100', icon: 'text-brand-600', ring: 'ring-brand-200' },
  user_added: { bg: 'bg-indigo-100', icon: 'text-indigo-600', ring: 'ring-indigo-200' },
  settings: { bg: 'bg-neutral-100', icon: 'text-neutral-600', ring: 'ring-neutral-200' },
  email: { bg: 'bg-cyan-100', icon: 'text-cyan-600', ring: 'ring-cyan-200' },
  call: { bg: 'bg-green-100', icon: 'text-green-600', ring: 'ring-green-200' },
  meeting: { bg: 'bg-violet-100', icon: 'text-violet-600', ring: 'ring-violet-200' },
  upload: { bg: 'bg-sky-100', icon: 'text-sky-600', ring: 'ring-sky-200' },
  download: { bg: 'bg-teal-100', icon: 'text-teal-600', ring: 'ring-teal-200' },
  edit: { bg: 'bg-orange-100', icon: 'text-orange-600', ring: 'ring-orange-200' },
  delete: { bg: 'bg-red-100', icon: 'text-red-600', ring: 'ring-red-200' },
  view: { bg: 'bg-neutral-100', icon: 'text-neutral-500', ring: 'ring-neutral-200' },
};

// ============================================================================
// TIMELINE ITEM
// ============================================================================
const TimelineItem = memo(function TimelineItem({
  event,
  isLast,
}: {
  event: TimelineEvent;
  isLast: boolean;
}) {
  const Icon = eventIcons[event.type] || Bell;
  const colors = eventColors[event.type] || eventColors.notification;

  const formattedTime = useMemo(() => {
    const date = typeof event.timestamp === 'string' ? new Date(event.timestamp) : event.timestamp;
    return formatDistanceToNow(date, { addSuffix: true });
  }, [event.timestamp]);

  return (
    <div className="relative flex gap-4 pb-6 last:pb-0">
      {/* Timeline line */}
      {!isLast && (
        <div className="absolute left-[17px] top-10 h-[calc(100%-24px)] w-px bg-neutral-200" />
      )}

      {/* Icon */}
      <div
        className={cn(
          'relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-4 ring-white',
          colors.bg,
          colors.ring
        )}
      >
        <Icon className={cn('h-4 w-4', colors.icon)} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pt-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium text-neutral-900 leading-tight">{event.title}</p>
            {event.description && (
              <p className="text-sm text-neutral-500 mt-0.5 leading-relaxed">{event.description}</p>
            )}
          </div>
          <span className="text-xs text-neutral-400 whitespace-nowrap shrink-0">{formattedTime}</span>
        </div>

        {/* User attribution */}
        {event.user && (
          <div className="flex items-center gap-2 mt-2">
            {event.user.avatar ? (
              <img
                src={event.user.avatar}
                alt={event.user.name}
                className="w-5 h-5 rounded-full object-cover"
              />
            ) : (
              <div className="w-5 h-5 rounded-full bg-neutral-200 flex items-center justify-center">
                <span className="text-[10px] font-medium text-neutral-600">
                  {event.user.name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <span className="text-xs text-neutral-500">{event.user.name}</span>
          </div>
        )}

        {/* Status indicator */}
        {event.status && (
          <div className="mt-2">
            <span
              className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full',
                event.status === 'completed' && 'bg-emerald-50 text-emerald-700',
                event.status === 'pending' && 'bg-amber-50 text-amber-700',
                event.status === 'failed' && 'bg-red-50 text-red-700'
              )}
            >
              <span
                className={cn(
                  'w-1.5 h-1.5 rounded-full',
                  event.status === 'completed' && 'bg-emerald-500',
                  event.status === 'pending' && 'bg-amber-500 animate-pulse',
                  event.status === 'failed' && 'bg-red-500'
                )}
              />
              {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
});

// ============================================================================
// LOADING SKELETON
// ============================================================================
const TimelineSkeleton = memo(function TimelineSkeleton() {
  return (
    <div className="space-y-6">
      {[1, 2, 3].map(i => (
        <div key={i} className="flex gap-4 animate-pulse">
          <div className="w-9 h-9 rounded-full bg-neutral-200 shrink-0" />
          <div className="flex-1 space-y-2 pt-1">
            <div className="h-4 w-3/4 bg-neutral-200 rounded" />
            <div className="h-3 w-1/2 bg-neutral-100 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
});

// ============================================================================
// ACTIVITY TIMELINE
// ============================================================================
export const ActivityTimeline = memo(function ActivityTimeline({
  events,
  maxItems,
  showLoadMore = false,
  onLoadMore,
  loading = false,
  className,
  emptyMessage = 'No recent activity',
}: ActivityTimelineProps) {
  const displayedEvents = maxItems ? events.slice(0, maxItems) : events;

  if (loading) {
    return (
      <div className={className}>
        <TimelineSkeleton />
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className={cn('py-12 text-center', className)}>
        <Bell className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
        <p className="text-sm text-neutral-500">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="space-y-0">
        {displayedEvents.map((event, index) => (
          <TimelineItem
            key={event.id}
            event={event}
            isLast={index === displayedEvents.length - 1 && !showLoadMore}
          />
        ))}
      </div>

      {showLoadMore && onLoadMore && events.length > (maxItems || 0) && (
        <button
          onClick={onLoadMore}
          className="w-full mt-4 py-2 text-sm font-medium text-brand-600 hover:text-brand-700 hover:bg-brand-50 rounded-lg transition-colors"
        >
          Load more activity
        </button>
      )}
    </div>
  );
});

export default ActivityTimeline;
