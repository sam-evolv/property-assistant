'use client';

import { memo } from 'react';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  RefreshCw,
  Download,
  CalendarRange,
} from 'lucide-react';
import { Button, ButtonGroup } from '@/components/ui/premium';

// ============================================================================
// TYPES
// ============================================================================
type TimeRange = '7d' | '30d' | '90d';

interface OverviewHeaderProps {
  userName?: string;
  timeRange: TimeRange;
  onTimeRangeChange: (range: TimeRange) => void;
  onRefresh: () => void;
  onExport?: () => void;
  isRefreshing?: boolean;
  className?: string;
}

// ============================================================================
// GREETING HELPER
// ============================================================================
function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

// ============================================================================
// OVERVIEW HEADER
// ============================================================================
export const OverviewHeader = memo(function OverviewHeader({
  userName = 'there',
  timeRange,
  onTimeRangeChange,
  onRefresh,
  onExport,
  isRefreshing = false,
  className,
}: OverviewHeaderProps) {
  const timeRanges: { value: TimeRange; label: string }[] = [
    { value: '7d', label: '7 days' },
    { value: '30d', label: '30 days' },
    { value: '90d', label: '90 days' },
  ];

  return (
    <div className={cn('flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8', className)}>
      {/* Left side - Greeting */}
      <div className="min-w-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center">
            <LayoutDashboard className="w-5 h-5 text-brand-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">
              {getGreeting()}, {userName}
            </h1>
            <p className="text-sm text-neutral-500 mt-0.5">
              Here's what's happening with your developments
            </p>
          </div>
        </div>
      </div>

      {/* Right side - Controls */}
      <div className="flex items-center gap-3 flex-shrink-0">
        {/* Time Range Selector */}
        <div className="flex items-center gap-1 bg-white rounded-lg border border-neutral-200 p-1">
          {timeRanges.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => onTimeRangeChange(value)}
              className={cn(
                'px-3 py-1.5 text-sm font-medium rounded-md transition-all',
                timeRange === value
                  ? 'bg-neutral-900 text-white shadow-sm'
                  : 'text-neutral-600 hover:bg-neutral-50'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Export Button */}
        {onExport && (
          <Button variant="outline" size="sm" leftIcon={Download} onClick={onExport}>
            Export
          </Button>
        )}

        {/* Refresh Button */}
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
      </div>
    </div>
  );
});

export default OverviewHeader;
