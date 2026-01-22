'use client';

import { memo, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { RefreshCw, Download, Calendar, type LucideIcon } from 'lucide-react';
import { Button, ButtonGroup } from './Button';

// ============================================================================
// TYPES
// ============================================================================
type TimeRange = '7d' | '30d' | '90d' | '1y' | 'all';

interface TimeRangeOption {
  value: TimeRange;
  label: string;
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  badge?: {
    label: string;
    variant?: 'live' | 'beta' | 'new' | 'default';
  };
  timeRange?: TimeRange;
  onTimeRangeChange?: (range: TimeRange) => void;
  timeRangeOptions?: TimeRangeOption[];
  onRefresh?: () => void;
  onExport?: () => void;
  isRefreshing?: boolean;
  actions?: ReactNode;
  className?: string;
}

// ============================================================================
// BADGE VARIANTS
// ============================================================================
const badgeVariants = {
  live: 'text-emerald-700 bg-emerald-50 border-emerald-200/50',
  beta: 'text-purple-700 bg-purple-50 border-purple-200/50',
  new: 'text-blue-700 bg-blue-50 border-blue-200/50',
  default: 'text-neutral-600 bg-neutral-100 border-neutral-200/50',
};

// ============================================================================
// DEFAULT TIME RANGES
// ============================================================================
const defaultTimeRanges: TimeRangeOption[] = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
  { value: '1y', label: '1 year' },
];

// ============================================================================
// PAGE HEADER COMPONENT
// ============================================================================
export const PageHeader = memo(function PageHeader({
  title,
  subtitle,
  icon: Icon,
  badge,
  timeRange,
  onTimeRangeChange,
  timeRangeOptions = defaultTimeRanges,
  onRefresh,
  onExport,
  isRefreshing = false,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn('flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8', className)}>
      {/* Left side - Title and subtitle */}
      <div className="min-w-0">
        <div className="flex items-center gap-3 mb-1">
          {Icon && (
            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center">
              <Icon className="w-5 h-5 text-brand-600" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-neutral-900 tracking-tight truncate">
                {title}
              </h1>
              {badge && (
                <span
                  className={cn(
                    'inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border',
                    badgeVariants[badge.variant || 'default']
                  )}
                >
                  {badge.variant === 'live' && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  )}
                  {badge.label}
                </span>
              )}
            </div>
            {subtitle && (
              <p className="text-sm text-neutral-500 mt-0.5">{subtitle}</p>
            )}
          </div>
        </div>
      </div>

      {/* Right side - Controls */}
      <div className="flex items-center gap-3 flex-shrink-0">
        {/* Time Range Selector */}
        {onTimeRangeChange && timeRange && (
          <ButtonGroup attached>
            {timeRangeOptions.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => onTimeRangeChange(value)}
                className={cn(
                  'px-3 py-1.5 text-sm font-medium transition-all first:rounded-l-lg last:rounded-r-lg',
                  timeRange === value
                    ? 'bg-neutral-900 text-white shadow-sm'
                    : 'bg-white text-neutral-600 hover:bg-neutral-50 border border-neutral-200 -ml-px first:ml-0'
                )}
              >
                {label}
              </button>
            ))}
          </ButtonGroup>
        )}

        {/* Export Button */}
        {onExport && (
          <Button variant="outline" size="sm" leftIcon={Download} onClick={onExport}>
            Export
          </Button>
        )}

        {/* Refresh Button */}
        {onRefresh && (
          <Button
            variant="primary"
            size="sm"
            leftIcon={RefreshCw}
            onClick={onRefresh}
            disabled={isRefreshing}
            className={cn(isRefreshing && '[&_svg]:animate-spin')}
          >
            {isRefreshing ? 'Refreshing' : 'Refresh'}
          </Button>
        )}

        {/* Custom Actions */}
        {actions}
      </div>
    </div>
  );
});

export default PageHeader;
