'use client';

import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

type BadgeVariant =
  | 'default'
  | 'success'
  | 'error'
  | 'warning'
  | 'info'
  | 'gold'
  | 'outline';

type BadgeSize = 'sm' | 'md' | 'lg';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  icon?: LucideIcon;
  dot?: boolean;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-gray-100 text-gray-700 border-gray-200',
  success: 'bg-green-50 text-green-700 border-green-200',
  error: 'bg-red-50 text-red-700 border-red-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  info: 'bg-blue-50 text-blue-700 border-blue-200',
  gold: 'bg-gold-50 text-gold-700 border-gold-200',
  outline: 'bg-transparent text-gray-700 border-gray-300',
};

const dotColors: Record<BadgeVariant, string> = {
  default: 'bg-gray-500',
  success: 'bg-green-500',
  error: 'bg-red-500',
  warning: 'bg-amber-500',
  info: 'bg-blue-500',
  gold: 'bg-gold-500',
  outline: 'bg-gray-500',
};

const sizeStyles: Record<BadgeSize, { badge: string; icon: string; dot: string }> = {
  sm: {
    badge: 'text-xs px-1.5 py-0.5',
    icon: 'w-3 h-3',
    dot: 'w-1.5 h-1.5',
  },
  md: {
    badge: 'text-xs px-2 py-1',
    icon: 'w-3.5 h-3.5',
    dot: 'w-2 h-2',
  },
  lg: {
    badge: 'text-sm px-2.5 py-1',
    icon: 'w-4 h-4',
    dot: 'w-2 h-2',
  },
};

export function Badge({
  children,
  variant = 'default',
  size = 'md',
  icon: Icon,
  dot,
  className,
}: BadgeProps) {
  const styles = sizeStyles[size];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-medium rounded-full border',
        variantStyles[variant],
        styles.badge,
        className
      )}
    >
      {dot && (
        <span
          className={cn('rounded-full flex-shrink-0', dotColors[variant], styles.dot)}
        />
      )}
      {Icon && <Icon className={cn('flex-shrink-0', styles.icon)} />}
      {children}
    </span>
  );
}

// Status-specific badges
export function StatusBadge({
  status,
  className,
}: {
  status: 'active' | 'inactive' | 'pending' | 'complete' | 'overdue' | 'in-progress';
  className?: string;
}) {
  const statusConfig: Record<
    string,
    { label: string; variant: BadgeVariant; dot?: boolean }
  > = {
    active: { label: 'Active', variant: 'success', dot: true },
    inactive: { label: 'Inactive', variant: 'default', dot: true },
    pending: { label: 'Pending', variant: 'warning', dot: true },
    complete: { label: 'Complete', variant: 'success' },
    overdue: { label: 'Overdue', variant: 'error', dot: true },
    'in-progress': { label: 'In Progress', variant: 'info', dot: true },
  };

  const config = statusConfig[status] || statusConfig.pending;

  return (
    <Badge variant={config.variant} dot={config.dot} className={className}>
      {config.label}
    </Badge>
  );
}

// Pipeline stage badge
export function StageBadge({
  stage,
  className,
}: {
  stage: 'available' | 'reserved' | 'contracts-out' | 'signed' | 'complete';
  className?: string;
}) {
  const stageConfig: Record<string, { label: string; variant: BadgeVariant }> = {
    available: { label: 'Available', variant: 'default' },
    reserved: { label: 'Reserved', variant: 'info' },
    'contracts-out': { label: 'Contracts Out', variant: 'warning' },
    signed: { label: 'Signed', variant: 'success' },
    complete: { label: 'Complete', variant: 'success' },
  };

  const config = stageConfig[stage] || stageConfig.available;

  return (
    <Badge variant={config.variant} className={className}>
      {config.label}
    </Badge>
  );
}

// Count badge (for notifications, etc.)
export function CountBadge({
  count,
  max = 99,
  variant = 'error',
  className,
}: {
  count: number;
  max?: number;
  variant?: BadgeVariant;
  className?: string;
}) {
  if (count <= 0) return null;

  const displayCount = count > max ? `${max}+` : count.toString();

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center min-w-[18px] h-[18px] text-xs font-bold rounded-full',
        variant === 'error' && 'bg-red-500 text-white',
        variant === 'warning' && 'bg-amber-500 text-white',
        variant === 'info' && 'bg-blue-500 text-white',
        variant === 'gold' && 'bg-gold-500 text-white',
        variant === 'default' && 'bg-gray-500 text-white',
        className
      )}
    >
      {displayCount}
    </span>
  );
}

export default Badge;
