'use client';

import { memo, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Activity,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react';
import { Button } from './Button';

// ============================================================================
// STATUS BADGE
// ============================================================================
type StatusType = 'healthy' | 'warning' | 'error' | 'info' | 'neutral';

const statusConfig: Record<StatusType, { icon: LucideIcon; bg: string; text: string; dot: string }> = {
  healthy: {
    icon: CheckCircle2,
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    dot: 'bg-emerald-500',
  },
  warning: {
    icon: AlertTriangle,
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    dot: 'bg-amber-500',
  },
  error: {
    icon: XCircle,
    bg: 'bg-red-50',
    text: 'text-red-700',
    dot: 'bg-red-500',
  },
  info: {
    icon: Activity,
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    dot: 'bg-blue-500',
  },
  neutral: {
    icon: Activity,
    bg: 'bg-neutral-100',
    text: 'text-neutral-600',
    dot: 'bg-neutral-400',
  },
};

interface StatusBadgeProps {
  status: StatusType;
  label?: string;
  showIcon?: boolean;
  showDot?: boolean;
  size?: 'sm' | 'md';
}

export const StatusBadge = memo(function StatusBadge({
  status,
  label,
  showIcon = true,
  showDot = false,
  size = 'sm',
}: StatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-medium rounded-full',
        config.bg,
        config.text,
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'
      )}
    >
      {showDot && <span className={cn('w-1.5 h-1.5 rounded-full', config.dot)} />}
      {showIcon && !showDot && <Icon className={cn(size === 'sm' ? 'w-3 h-3' : 'w-4 h-4')} />}
      {label || status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
});

// ============================================================================
// DATA CARD
// ============================================================================
interface DataCardProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  status?: StatusType;
  statusLabel?: string;
  children: ReactNode;
  onViewAll?: () => void;
  viewAllLabel?: string;
  className?: string;
  headerActions?: ReactNode;
}

export const DataCard = memo(function DataCard({
  title,
  subtitle,
  icon: Icon,
  status,
  statusLabel,
  children,
  onViewAll,
  viewAllLabel = 'View All',
  className,
  headerActions,
}: DataCardProps) {
  return (
    <div
      className={cn(
        'bg-white rounded-xl border border-neutral-200 shadow-card hover:shadow-cardHover transition-shadow',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between p-6 pb-0">
        <div className="flex items-start gap-3">
          {Icon && (
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-neutral-100 flex items-center justify-center">
              <Icon className="w-5 h-5 text-neutral-600" />
            </div>
          )}
          <div>
            <h3 className="text-base font-semibold text-neutral-900">{title}</h3>
            {subtitle && <p className="text-sm text-neutral-500 mt-0.5">{subtitle}</p>}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {status && <StatusBadge status={status} label={statusLabel} />}
          {headerActions}
          {onViewAll && (
            <Button variant="ghost" size="xs" rightIcon={ChevronRight} onClick={onViewAll}>
              {viewAllLabel}
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">{children}</div>
    </div>
  );
});

// ============================================================================
// DATA ROW
// ============================================================================
interface DataRowProps {
  label: string;
  value: string | number | ReactNode;
  status?: StatusType;
  valueClassName?: string;
  className?: string;
}

export const DataRow = memo(function DataRow({
  label,
  value,
  status,
  valueClassName,
  className,
}: DataRowProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between py-3 border-b border-neutral-100 last:border-0',
        className
      )}
    >
      <span className="text-sm text-neutral-600">{label}</span>
      <div className="flex items-center gap-2">
        {typeof value === 'string' || typeof value === 'number' ? (
          <span className={cn('text-sm font-medium text-neutral-900', valueClassName)}>{value}</span>
        ) : (
          value
        )}
        {status && (
          <span
            className={cn(
              'w-2 h-2 rounded-full',
              status === 'healthy' && 'bg-emerald-500',
              status === 'warning' && 'bg-amber-500',
              status === 'error' && 'bg-red-500',
              status === 'info' && 'bg-blue-500',
              status === 'neutral' && 'bg-neutral-400'
            )}
          />
        )}
      </div>
    </div>
  );
});

// ============================================================================
// STAT GRID
// ============================================================================
interface StatGridItemProps {
  label: string;
  value: string | number;
  status?: StatusType;
  className?: string;
}

export const StatGridItem = memo(function StatGridItem({
  label,
  value,
  status,
  className,
}: StatGridItemProps) {
  return (
    <div
      className={cn(
        'p-4 rounded-lg text-center',
        status === 'healthy' && 'bg-emerald-50',
        status === 'warning' && 'bg-amber-50',
        status === 'error' && 'bg-red-50',
        status === 'info' && 'bg-blue-50',
        (!status || status === 'neutral') && 'bg-neutral-50',
        className
      )}
    >
      <div
        className={cn(
          'text-2xl font-bold',
          status === 'healthy' && 'text-emerald-600',
          status === 'warning' && 'text-amber-600',
          status === 'error' && 'text-red-600',
          status === 'info' && 'text-blue-600',
          (!status || status === 'neutral') && 'text-neutral-900'
        )}
      >
        {value}
      </div>
      <div className="text-xs text-neutral-500 mt-1">{label}</div>
    </div>
  );
});

// ============================================================================
// QUICK LINK
// ============================================================================
interface QuickLinkProps {
  href: string;
  icon: LucideIcon;
  label: string;
  iconColor?: string;
  iconBg?: string;
}

export const QuickLink = memo(function QuickLink({
  href,
  icon: Icon,
  label,
  iconColor = 'text-neutral-600',
  iconBg = 'bg-neutral-100',
}: QuickLinkProps) {
  return (
    <a
      href={href}
      className="flex items-center justify-between p-3 rounded-lg hover:bg-neutral-50 transition-colors group"
    >
      <div className="flex items-center gap-3">
        <div className={cn('p-2 rounded-lg', iconBg)}>
          <Icon className={cn('w-4 h-4', iconColor)} />
        </div>
        <span className="text-sm font-medium text-neutral-700">{label}</span>
      </div>
      <ChevronRight className="w-4 h-4 text-neutral-400 group-hover:text-neutral-600 transition-colors" />
    </a>
  );
});

export default DataCard;
