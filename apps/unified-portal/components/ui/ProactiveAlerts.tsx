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
  ChevronRight,
  ArrowRight,
  X,
  Users,
  FileText,
  Clock,
} from 'lucide-react';
import Link from 'next/link';

export type AlertPriority = 'critical' | 'warning' | 'info' | 'ready';

export interface AlertItem {
  id: string;
  label: string;
  sublabel?: string;
  link?: string;
  action?: () => void;
}

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
  items?: AlertItem[]; // Individual items within alert
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

function ExpandableAlertCard({
  alert,
  onDismiss,
}: {
  alert: Alert;
  onDismiss?: (alertId: string) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const config = priorityConfig[alert.priority];
  const Icon = config.icon;
  const hasItems = alert.items && alert.items.length > 0;

  return (
    <div
      className={cn(
        'rounded-lg border transition-all overflow-hidden',
        config.bgColor,
        config.borderColor,
        'hover:shadow-sm'
      )}
    >
      {/* Header - clickable to expand */}
      <button
        onClick={() => hasItems && setIsExpanded(!isExpanded)}
        className={cn(
          'w-full flex items-start gap-3 p-3 text-left',
          hasItems && 'cursor-pointer hover:bg-black/5'
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
          {!hasItems && (
            <div className="flex items-center gap-3 mt-2">
              {alert.link && (
                <Link
                  href={alert.link}
                  className={cn(
                    'text-xs font-medium inline-flex items-center gap-1 hover:underline',
                    config.textColor
                  )}
                  onClick={(e) => e.stopPropagation()}
                >
                  {alert.linkLabel || 'View'}
                  <ArrowRight className="w-3 h-3" />
                </Link>
              )}
              {alert.action && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    alert.action?.();
                  }}
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
          )}
        </div>
        <div className="flex items-center gap-2">
          {alert.dismissible && onDismiss && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDismiss(alert.id);
              }}
              className="p-1 rounded hover:bg-black/10 transition-colors"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          )}
          {hasItems && (
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

      {/* Expanded items list */}
      {hasItems && isExpanded && (
        <div className="border-t border-current/10 bg-white/50">
          <div className="divide-y divide-gray-100">
            {alert.items!.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <Users className="w-4 h-4 text-gray-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {item.label}
                    </p>
                    {item.sublabel && (
                      <p className="text-xs text-gray-500 truncate">{item.sublabel}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {item.action && (
                    <button
                      onClick={item.action}
                      className={cn(
                        'text-xs font-medium px-2.5 py-1 rounded-md transition-colors',
                        config.textColor,
                        'bg-white border border-current/20 hover:bg-current/5'
                      )}
                    >
                      Action
                    </button>
                  )}
                  {item.link && (
                    <Link
                      href={item.link}
                      className="p-1.5 rounded-md hover:bg-gray-100 transition-colors"
                    >
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
          {/* Footer action */}
          {alert.link && (
            <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50">
              <Link
                href={alert.link}
                className={cn(
                  'text-xs font-medium inline-flex items-center gap-1 hover:underline',
                  config.textColor
                )}
              >
                {alert.linkLabel || 'View All'}
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          )}
        </div>
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
            <ExpandableAlertCard key={alert.id} alert={alert} onDismiss={onDismiss} />
          ))}
          {/* Warning alerts */}
          {groupedAlerts.warning.map((alert) => (
            <ExpandableAlertCard key={alert.id} alert={alert} onDismiss={onDismiss} />
          ))}
          {/* Info alerts */}
          {groupedAlerts.info.map((alert) => (
            <ExpandableAlertCard key={alert.id} alert={alert} onDismiss={onDismiss} />
          ))}
          {/* Ready alerts (success) */}
          {groupedAlerts.ready.map((alert) => (
            <ExpandableAlertCard key={alert.id} alert={alert} onDismiss={onDismiss} />
          ))}
        </div>
      )}
    </div>
  );
}

export default ProactiveAlertsWidget;
