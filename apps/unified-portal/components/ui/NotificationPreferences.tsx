'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Bell,
  Mail,
  MessageSquare,
  AlertTriangle,
  FileText,
  Users,
  Calendar,
  CheckCircle,
  Settings,
  Smartphone,
  Globe,
} from 'lucide-react';

export interface NotificationChannel {
  id: 'email' | 'push' | 'in-app' | 'sms';
  label: string;
  icon: typeof Bell;
  enabled: boolean;
}

export interface NotificationCategory {
  id: string;
  label: string;
  description: string;
  icon: typeof Bell;
  channels: {
    email?: boolean;
    push?: boolean;
    inApp?: boolean;
    sms?: boolean;
  };
}

interface NotificationPreferencesProps {
  categories: NotificationCategory[];
  channels: NotificationChannel[];
  onSave?: (categories: NotificationCategory[]) => void;
  className?: string;
}

const defaultChannels: NotificationChannel[] = [
  { id: 'email', label: 'Email', icon: Mail, enabled: true },
  { id: 'push', label: 'Push', icon: Smartphone, enabled: true },
  { id: 'in-app', label: 'In-App', icon: Globe, enabled: true },
];

const defaultCategories: NotificationCategory[] = [
  {
    id: 'alerts',
    label: 'Alerts & Warnings',
    description: 'Critical issues, overdue items, and urgent matters',
    icon: AlertTriangle,
    channels: { email: true, push: true, inApp: true },
  },
  {
    id: 'documents',
    label: 'Documents',
    description: 'New uploads, document requests, and compliance updates',
    icon: FileText,
    channels: { email: true, push: false, inApp: true },
  },
  {
    id: 'homeowners',
    label: 'Homeowner Activity',
    description: 'New registrations, chat messages, and engagement',
    icon: Users,
    channels: { email: false, push: false, inApp: true },
  },
  {
    id: 'schedule',
    label: 'Scheduled Events',
    description: 'Reminders for handovers, inspections, and deadlines',
    icon: Calendar,
    channels: { email: true, push: true, inApp: true },
  },
  {
    id: 'system',
    label: 'System Updates',
    description: 'Platform updates, maintenance, and new features',
    icon: Settings,
    channels: { email: true, push: false, inApp: true },
  },
];

function Toggle({
  checked,
  onChange,
  disabled,
  size = 'md',
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
}) {
  const sizes = {
    sm: { track: 'w-8 h-4', thumb: 'w-3 h-3', translate: 'translate-x-4' },
    md: { track: 'w-10 h-5', thumb: 'w-4 h-4', translate: 'translate-x-5' },
  };

  const s = sizes[size];

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      className={cn(
        'relative inline-flex items-center rounded-full transition-colors',
        s.track,
        checked ? 'bg-gold-500' : 'bg-gray-200',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      <span
        className={cn(
          'inline-block rounded-full bg-white shadow transform transition-transform',
          s.thumb,
          checked ? s.translate : 'translate-x-0.5'
        )}
      />
    </button>
  );
}

export function NotificationPreferences({
  categories = defaultCategories,
  channels = defaultChannels,
  onSave,
  className,
}: NotificationPreferencesProps) {
  const [prefs, setPrefs] = useState(categories);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleToggle = (categoryId: string, channelId: string, value: boolean) => {
    setPrefs((prev) =>
      prev.map((cat) =>
        cat.id === categoryId
          ? {
              ...cat,
              channels: {
                ...cat.channels,
                [channelId === 'in-app' ? 'inApp' : channelId]: value,
              },
            }
          : cat
      )
    );
    setIsDirty(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave?.(prefs);
      setIsDirty(false);
    } finally {
      setIsSaving(false);
    }
  };

  const enabledChannels = channels.filter((c) => c.enabled);

  return (
    <div className={cn('bg-white rounded-xl border border-gray-200', className)}>
      {/* Header */}
      <div className="p-5 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gold-50">
            <Bell className="w-5 h-5 text-gold-600" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900">
              Notification Preferences
            </h3>
            <p className="text-sm text-gray-500">
              Choose how you want to be notified
            </p>
          </div>
        </div>
      </div>

      {/* Table Header */}
      <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
        <div className="flex items-center">
          <div className="flex-1">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Notification Type
            </span>
          </div>
          <div className="flex items-center gap-6">
            {enabledChannels.map((channel) => (
              <div key={channel.id} className="w-16 text-center">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {channel.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Categories */}
      <div className="divide-y divide-gray-100">
        {prefs.map((category) => {
          const Icon = category.icon;

          return (
            <div
              key={category.id}
              className="flex items-center px-5 py-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex-1 flex items-start gap-3">
                <div className="p-2 rounded-lg bg-gray-100">
                  <Icon className="w-4 h-4 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {category.label}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {category.description}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                {enabledChannels.map((channel) => {
                  const channelKey = channel.id === 'in-app' ? 'inApp' : channel.id;
                  const isEnabled = category.channels[channelKey as keyof typeof category.channels] ?? false;

                  return (
                    <div key={channel.id} className="w-16 flex justify-center">
                      <Toggle
                        checked={isEnabled}
                        onChange={(val) => handleToggle(category.id, channel.id, val)}
                        size="sm"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      {isDirty && (
        <div className="flex items-center justify-end gap-3 p-4 bg-gray-50 border-t border-gray-100">
          <button
            onClick={() => {
              setPrefs(categories);
              setIsDirty(false);
            }}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Discard
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gold-500 rounded-lg transition-colors',
              isSaving ? 'opacity-50' : 'hover:bg-gold-600'
            )}
          >
            {isSaving ? (
              <>Saving...</>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                Save Changes
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

export default NotificationPreferences;
