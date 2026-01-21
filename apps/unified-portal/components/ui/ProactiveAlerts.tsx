'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  X,
} from 'lucide-react';
import Link from 'next/link';

export type AlertPriority = 'critical' | 'warning' | 'info' | 'ready';

export interface Alert {
  id: string;
  title: string;
  description?: string;
  priority: AlertPriority;
  count?: number;
  link?: string;
  linkLabel?: string;
  action?: () => void;
  actionLabel?: string;
  dismissible?: boolean;
}

interface ProactiveAlertsWidgetProps {
  alerts: Alert[];
  title?: string;
  collapsible?: boolean;
  defaultExpanded?: boolean;
  onDismiss?: (alertId: string) => void;
  className?: string;
}

const priorityConfig = {
  critical: {
    icon: AlertCircle,
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    iconColor: 'text-red-500',
    textColor: 'text-red-700',
    badgeColor: 'bg-red-500',
    label: 'Critical',
  },
  warning: {
    icon: AlertTriangle,
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    iconColor: 'text-amber-500',
    textColor: 'text-amber-700',
    badgeColor: 'bg-amber-500',
    label: 'Warning',
  },
  info: {
    icon: Info,
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    iconColor: 'text-blue-500',
    textColor: 'text-blue-700',
    badgeColor: 'bg-blue-500',
    label: 'Info',
  },
  ready: {
    icon: CheckCircle,
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    iconColor: 'text-green-500',
    textColor: 'text-green-700',
    badgeColor: 'bg-green-500',
    label: 'Ready',
  },
};

function AlertItem({
  alert,
  onDismiss,
}: {
  alert: Alert;
  onDismiss?: (alertId: string) => void;
}) {
  const config = priorityConfig[alert.priority];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-3 rounded-lg border transition-all',
        config.bgColor,
        config.borderColor,
        'hover:shadow-sm'
      )}
    >
      <Icon className={cn('w-5 h-5 flex-shrink-0 mt-0.5', config.iconColor)} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={cn('text-sm font-medium', config.textColor)}>
            {alert.title}
          </p>
          {alert.count && alert.count > 1 && (
            <span
              className={cn(
                'text-xs font-medium px-1.5 py-0.5 rounded-full text-white',
                config.badgeColor
              )}
            >
              {alert.count}
            </span>
          )}
        </div>
        {alert.description && (
          <p className="text-xs text-gray-600 mt-1">{alert.description}</p>
        )}
        <div className="flex items-center gap-3 mt-2">
          {alert.link && (
            <Link
              href={alert.link}
              className={cn(
                'text-xs font-medium inline-flex items-center gap-1 hover:underline',
                config.textColor
              )}
            >
              {alert.linkLabel || 'View'}
              <ArrowRight className="w-3 h-3" />
            </Link>
          )}
          {alert.action && (
            <button
              onClick={alert.action}
              className={cn(
                'text-xs font-medium inline-flex items-center gap-1 hover:underline',
                config.textColor
              )}
            >
              {alert.actionLabel || 'Take Action'}
              <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
      {alert.dismissible && onDismiss && (
        <button
          onClick={() => onDismiss(alert.id)}
          className="p-1 rounded hover:bg-black/5 transition-colors"
        >
          <X className="w-4 h-4 text-gray-400" />
        </button>
      )}
    </div>
  );
}

export function ProactiveAlertsWidget({
  alerts,
  title = 'Needs Attention',
  collapsible = true,
  defaultExpanded = true,
  onDismiss,
  className,
}: ProactiveAlertsWidgetProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Group alerts by priority
  const groupedAlerts = {
    critical: alerts.filter((a) => a.priority === 'critical'),
    warning: alerts.filter((a) => a.priority === 'warning'),
    info: alerts.filter((a) => a.priority === 'info'),
    ready: alerts.filter((a) => a.priority === 'ready'),
  };

  const totalCount =
    groupedAlerts.critical.length +
    groupedAlerts.warning.length +
    groupedAlerts.info.length;

  if (alerts.length === 0) {
    return (
      <div
        className={cn(
          'bg-white rounded-xl border border-gray-200 p-6',
          className
        )}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-green-100">
            <CheckCircle className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">All Clear</h3>
            <p className="text-xs text-gray-500">
              No items require your attention
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'bg-white rounded-xl border border-gray-200 overflow-hidden',
        className
      )}
    >
      {/* Header */}
      <button
        onClick={() => collapsible && setIsExpanded(!isExpanded)}
        className={cn(
          'w-full flex items-center justify-between p-4 text-left',
          collapsible && 'hover:bg-gray-50 cursor-pointer',
          'border-b border-gray-100'
        )}
        disabled={!collapsible}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-100">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
            <p className="text-xs text-gray-500">
              {totalCount} item{totalCount !== 1 ? 's' : ''} need attention
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {groupedAlerts.critical.length > 0 && (
            <span className="text-xs font-medium px-2 py-1 rounded-full bg-red-500 text-white">
              {groupedAlerts.critical.length} critical
            </span>
          )}
          {collapsible && (
            <span className="p-1">
              {isExpanded ? (
                <ChevronUp className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              )}
            </span>
          )}
        </div>
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="p-4 space-y-3">
          {/* Critical alerts first */}
          {groupedAlerts.critical.map((alert) => (
            <AlertItem key={alert.id} alert={alert} onDismiss={onDismiss} />
          ))}
          {/* Warning alerts */}
          {groupedAlerts.warning.map((alert) => (
            <AlertItem key={alert.id} alert={alert} onDismiss={onDismiss} />
          ))}
          {/* Info alerts */}
          {groupedAlerts.info.map((alert) => (
            <AlertItem key={alert.id} alert={alert} onDismiss={onDismiss} />
          ))}
          {/* Ready alerts (success) */}
          {groupedAlerts.ready.map((alert) => (
            <AlertItem key={alert.id} alert={alert} onDismiss={onDismiss} />
          ))}
        </div>
      )}
    </div>
  );
}

export default ProactiveAlertsWidget;
