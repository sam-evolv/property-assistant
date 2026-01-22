'use client';

import { memo, forwardRef } from 'react';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================
type BadgeVariant =
  | 'default'
  | 'primary'
  | 'secondary'
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'outline'
  | 'neutral';

export type { BadgeVariant };

type BadgeSize = 'xs' | 'sm' | 'md' | 'lg';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  icon?: LucideIcon;
  iconPosition?: 'left' | 'right';
  dot?: boolean;
  dotColor?: string;
  removable?: boolean;
  onRemove?: () => void;
}

// ============================================================================
// STYLES
// ============================================================================
const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-neutral-100 text-neutral-700 border-neutral-200',
  primary: 'bg-brand-100 text-brand-800 border-brand-200',
  secondary: 'bg-neutral-900 text-white border-neutral-800',
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  error: 'bg-red-50 text-red-700 border-red-200',
  info: 'bg-blue-50 text-blue-700 border-blue-200',
  outline: 'bg-transparent text-neutral-600 border-neutral-300',
  neutral: 'bg-neutral-100 text-neutral-600 border-neutral-200',
};

const sizeStyles: Record<BadgeSize, string> = {
  xs: 'text-[10px] px-1.5 py-0.5 gap-1',
  sm: 'text-xs px-2 py-0.5 gap-1',
  md: 'text-xs px-2.5 py-1 gap-1.5',
  lg: 'text-sm px-3 py-1 gap-1.5',
};

const iconSizes: Record<BadgeSize, string> = {
  xs: 'w-2.5 h-2.5',
  sm: 'w-3 h-3',
  md: 'w-3.5 h-3.5',
  lg: 'w-4 h-4',
};

const dotSizes: Record<BadgeSize, string> = {
  xs: 'w-1 h-1',
  sm: 'w-1.5 h-1.5',
  md: 'w-2 h-2',
  lg: 'w-2 h-2',
};

// ============================================================================
// BADGE COMPONENT
// ============================================================================
export const Badge = memo(
  forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
    {
      variant = 'default',
      size = 'sm',
      icon: Icon,
      iconPosition = 'left',
      dot,
      dotColor,
      removable,
      onRemove,
      className,
      children,
      ...props
    },
    ref
  ) {
    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center font-medium rounded-full border transition-colors',
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {/* Dot indicator */}
        {dot && (
          <span
            className={cn(
              'rounded-full shrink-0',
              dotSizes[size],
              dotColor || (variant === 'success' && 'bg-emerald-500'),
              dotColor || (variant === 'warning' && 'bg-amber-500'),
              dotColor || (variant === 'error' && 'bg-red-500'),
              dotColor || (variant === 'info' && 'bg-blue-500'),
              dotColor || (!['success', 'warning', 'error', 'info'].includes(variant) && 'bg-current')
            )}
            style={dotColor ? { backgroundColor: dotColor } : undefined}
          />
        )}

        {/* Left icon */}
        {Icon && iconPosition === 'left' && (
          <Icon className={cn(iconSizes[size], 'shrink-0')} />
        )}

        {/* Content */}
        <span className="truncate">{children}</span>

        {/* Right icon */}
        {Icon && iconPosition === 'right' && (
          <Icon className={cn(iconSizes[size], 'shrink-0')} />
        )}

        {/* Remove button */}
        {removable && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove?.();
            }}
            className={cn(
              'shrink-0 rounded-full hover:bg-black/10 transition-colors',
              size === 'xs' && 'ml-0.5 -mr-0.5 p-0.5',
              size === 'sm' && 'ml-1 -mr-1 p-0.5',
              size === 'md' && 'ml-1 -mr-1 p-0.5',
              size === 'lg' && 'ml-1.5 -mr-1 p-1'
            )}
            aria-label="Remove"
          >
            <svg
              className={iconSizes[size]}
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M4 4l6 6M10 4l-6 6" />
            </svg>
          </button>
        )}
      </span>
    );
  })
);

// ============================================================================
// STATUS BADGE (Convenience component)
// ============================================================================
type Status = 'active' | 'inactive' | 'pending' | 'completed' | 'failed' | 'draft';

const statusConfig: Record<Status, { variant: BadgeVariant; label: string; dot: boolean }> = {
  active: { variant: 'success', label: 'Active', dot: true },
  inactive: { variant: 'default', label: 'Inactive', dot: true },
  pending: { variant: 'warning', label: 'Pending', dot: true },
  completed: { variant: 'success', label: 'Completed', dot: false },
  failed: { variant: 'error', label: 'Failed', dot: false },
  draft: { variant: 'outline', label: 'Draft', dot: false },
};

interface StatusBadgeProps extends Omit<BadgeProps, 'variant' | 'dot'> {
  status: Status;
}

export const StatusBadge = memo(function StatusBadge({
  status,
  children,
  ...props
}: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <Badge variant={config.variant} dot={config.dot} {...props}>
      {children || config.label}
    </Badge>
  );
});

export default Badge;
