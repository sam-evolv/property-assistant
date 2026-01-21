'use client';

import { cn, formatRelativeTime } from '@/lib/utils';
import {
  Mail,
  FileText,
  CheckCircle,
  Users,
  AlertCircle,
  MessageSquare,
  Upload,
  Download,
  Settings,
  Home,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';

export type ActivityType =
  | 'email'
  | 'document'
  | 'completion'
  | 'user'
  | 'alert'
  | 'message'
  | 'upload'
  | 'download'
  | 'settings'
  | 'home';

export interface ActivityItem {
  id: string;
  type: ActivityType;
  title: string;
  description?: string;
  timestamp: Date | string;
  actor?: string;
  link?: string;
  metadata?: Record<string, string | number>;
}

interface ActivityFeedProps {
  activities: ActivityItem[];
  title?: string;
  maxItems?: number;
  showViewAll?: boolean;
  viewAllLink?: string;
  className?: string;
  groupByDate?: boolean;
}

const activityConfig: Record<
  ActivityType,
  { icon: LucideIcon; color: string; bgColor: string }
> = {
  email: {
    icon: Mail,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
  },
  document: {
    icon: FileText,
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
  },
  completion: {
    icon: CheckCircle,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
  },
  user: {
    icon: Users,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-100',
  },
  alert: {
    icon: AlertCircle,
    color: 'text-amber-600',
    bgColor: 'bg-amber-100',
  },
  message: {
    icon: MessageSquare,
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-100',
  },
  upload: {
    icon: Upload,
    color: 'text-teal-600',
    bgColor: 'bg-teal-100',
  },
  download: {
    icon: Download,
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
  },
  settings: {
    icon: Settings,
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
  },
  home: {
    icon: Home,
    color: 'text-rose-600',
    bgColor: 'bg-rose-100',
  },
};

function ActivityItemRow({ activity }: { activity: ActivityItem }) {
  const config = activityConfig[activity.type] || activityConfig.message;
  const Icon = config.icon;

  const content = (
    <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
      <div className={cn('p-2 rounded-lg', config.bgColor)}>
        <Icon className={cn('w-4 h-4', config.color)} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-900">{activity.title}</p>
        {activity.description && (
          <p className="text-xs text-gray-500 mt-0.5 truncate">
            {activity.description}
          </p>
        )}
        <div className="flex items-center gap-2 mt-1">
          {activity.actor && (
            <span className="text-xs text-gray-500">{activity.actor}</span>
          )}
          {activity.actor && (
            <span className="text-xs text-gray-300">·</span>
          )}
          <span className="text-xs text-gray-400">
            {formatRelativeTime(activity.timestamp)}
          </span>
        </div>
      </div>
    </div>
  );

  if (activity.link) {
    return (
      <Link href={activity.link} className="block">
        {content}
      </Link>
    );
  }

  return content;
}

function groupActivitiesByDate(activities: ActivityItem[]) {
  const groups: { label: string; activities: ActivityItem[] }[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const dateMap = new Map<string, ActivityItem[]>();

  activities.forEach((activity) => {
    const activityDate = new Date(activity.timestamp);
    activityDate.setHours(0, 0, 0, 0);

    let label: string;
    if (activityDate.getTime() === today.getTime()) {
      label = 'Today';
    } else if (activityDate.getTime() === yesterday.getTime()) {
      label = 'Yesterday';
    } else {
      label = activityDate.toLocaleDateString('en-IE', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      });
    }

    const existing = dateMap.get(label) || [];
    existing.push(activity);
    dateMap.set(label, existing);
  });

  dateMap.forEach((activities, label) => {
    groups.push({ label, activities });
  });

  return groups;
}

// Type alias for backwards compatibility
export type Activity = ActivityItem;

export function ActivityFeed({
  activities,
  title = 'Recent Activity',
  maxItems = 10,
  showViewAll = true,
  viewAllLink,
  className,
  groupByDate = true,
}: ActivityFeedProps) {
  const displayActivities = activities.slice(0, maxItems);

  if (activities.length === 0) {
    return (
      <div
        className={cn(
          'bg-white rounded-xl border border-gray-200 p-6',
          className
        )}
      >
        <h3 className="text-sm font-semibold text-gray-900 mb-4">{title}</h3>
        <div className="text-center py-8">
          <MessageSquare className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No recent activity</p>
        </div>
      </div>
    );
  }

  const groupedActivities = groupByDate
    ? groupActivitiesByDate(displayActivities)
    : [{ label: '', activities: displayActivities }];

  return (
    <div
      className={cn(
        'bg-white rounded-xl border border-gray-200 overflow-hidden',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        {showViewAll && viewAllLink && (
          <Link
            href={viewAllLink}
            className="text-xs font-medium text-gold-600 hover:text-gold-700"
          >
            View all
          </Link>
        )}
      </div>

      {/* Activity List */}
      <div className="divide-y divide-gray-50">
        {groupedActivities.map((group, groupIndex) => (
          <div key={groupIndex}>
            {group.label && groupByDate && (
              <div className="px-4 py-2 bg-gray-50">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {group.label}
                </p>
              </div>
            )}
            <div className="px-1">
              {group.activities.map((activity) => (
                <ActivityItemRow key={activity.id} activity={activity} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* View All Footer */}
      {showViewAll && !viewAllLink && activities.length > maxItems && (
        <div className="px-4 py-3 border-t border-gray-100 text-center">
          <button className="text-xs font-medium text-gold-600 hover:text-gold-700">
            View all {activities.length} activities
          </button>
        </div>
      )}
    </div>
  );
}

// Widget alias for backwards compatibility
export const ActivityFeedWidget = ActivityFeed;

export default ActivityFeed;
