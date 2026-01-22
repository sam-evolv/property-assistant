'use client';

import { memo } from 'react';
import { cn } from '@/lib/utils';
import { Button } from './Button';
import type { LucideIcon } from 'lucide-react';
import {
  FileText,
  Users,
  FolderOpen,
  Search,
  AlertCircle,
  Wifi,
  Lock,
  Inbox,
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================
type EmptyStateVariant =
  | 'default'
  | 'no-results'
  | 'no-data'
  | 'error'
  | 'offline'
  | 'no-permission'
  | 'empty-inbox';

type EmptyStateSize = 'sm' | 'md' | 'lg';

interface EmptyStateProps {
  /** Variant/preset */
  variant?: EmptyStateVariant;
  /** Custom icon */
  icon?: LucideIcon;
  /** Title text */
  title?: string;
  /** Description text */
  description?: string;
  /** Simple action (shorthand for primaryAction) */
  action?: {
    label: string;
    onClick?: () => void;
    href?: string;
    icon?: LucideIcon;
  };
  /** Primary action */
  primaryAction?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
  /** Secondary action */
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  /** Size */
  size?: EmptyStateSize;
  /** Additional className */
  className?: string;
  /** Custom content below description */
  children?: React.ReactNode;
}

// ============================================================================
// PRESETS
// ============================================================================
const presets: Record<EmptyStateVariant, { icon: LucideIcon; title: string; description: string }> = {
  default: {
    icon: Inbox,
    title: 'No items yet',
    description: 'Get started by creating your first item.',
  },
  'no-results': {
    icon: Search,
    title: 'No results found',
    description: 'Try adjusting your search or filters to find what you\'re looking for.',
  },
  'no-data': {
    icon: FileText,
    title: 'No data available',
    description: 'There\'s no data to display at the moment.',
  },
  error: {
    icon: AlertCircle,
    title: 'Something went wrong',
    description: 'We couldn\'t load this content. Please try again.',
  },
  offline: {
    icon: Wifi,
    title: 'You\'re offline',
    description: 'Please check your internet connection and try again.',
  },
  'no-permission': {
    icon: Lock,
    title: 'Access restricted',
    description: 'You don\'t have permission to view this content.',
  },
  'empty-inbox': {
    icon: Inbox,
    title: 'Inbox zero!',
    description: 'You\'re all caught up. No new messages.',
  },
};

// ============================================================================
// SIZE STYLES
// ============================================================================
const sizeStyles: Record<EmptyStateSize, { icon: string; title: string; description: string; padding: string }> = {
  sm: {
    icon: 'w-10 h-10',
    title: 'text-sm',
    description: 'text-xs',
    padding: 'py-8 px-4',
  },
  md: {
    icon: 'w-12 h-12',
    title: 'text-base',
    description: 'text-sm',
    padding: 'py-12 px-6',
  },
  lg: {
    icon: 'w-16 h-16',
    title: 'text-lg',
    description: 'text-sm',
    padding: 'py-16 px-8',
  },
};

// ============================================================================
// COMPONENT
// ============================================================================
export const EmptyState = memo(function EmptyState({
  variant = 'default',
  icon,
  title,
  description,
  action,
  primaryAction,
  secondaryAction,
  size = 'md',
  className,
  children,
}: EmptyStateProps) {
  // Support both 'action' (simple) and 'primaryAction' props
  const resolvedPrimaryAction = primaryAction || (action?.onClick ? {
    label: action.label,
    onClick: action.onClick,
    icon: action.icon,
  } : undefined);
  const preset = presets[variant];
  const styles = sizeStyles[size];

  const Icon = icon || preset.icon;
  const displayTitle = title || preset.title;
  const displayDescription = description || preset.description;

  const iconColor = variant === 'error'
    ? 'text-red-300'
    : variant === 'offline'
    ? 'text-amber-300'
    : variant === 'no-permission'
    ? 'text-neutral-300'
    : 'text-neutral-300';

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        styles.padding,
        className
      )}
    >
      {/* Icon */}
      <div
        className={cn(
          'rounded-full bg-neutral-100 p-4 mb-4',
          variant === 'error' && 'bg-red-50',
          variant === 'offline' && 'bg-amber-50',
          variant === 'empty-inbox' && 'bg-emerald-50'
        )}
      >
        <Icon className={cn(styles.icon, iconColor)} />
      </div>

      {/* Title */}
      <h3 className={cn('font-semibold text-neutral-900 mb-1', styles.title)}>
        {displayTitle}
      </h3>

      {/* Description */}
      <p className={cn('text-neutral-500 max-w-sm', styles.description)}>
        {displayDescription}
      </p>

      {/* Custom content */}
      {children && <div className="mt-4">{children}</div>}

      {/* Actions */}
      {(resolvedPrimaryAction || secondaryAction || action?.href) && (
        <div className="flex items-center gap-3 mt-6">
          {secondaryAction && (
            <Button
              variant="outline"
              size={size === 'lg' ? 'md' : 'sm'}
              onClick={secondaryAction.onClick}
            >
              {secondaryAction.label}
            </Button>
          )}
          {resolvedPrimaryAction && (
            <Button
              variant="primary"
              size={size === 'lg' ? 'md' : 'sm'}
              onClick={resolvedPrimaryAction.onClick}
              leftIcon={resolvedPrimaryAction.icon}
            >
              {resolvedPrimaryAction.label}
            </Button>
          )}
          {action?.href && !resolvedPrimaryAction && (
            <a
              href={action.href}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-brand-500 rounded-lg hover:bg-brand-600 transition-colors"
            >
              {action.label}
            </a>
          )}
        </div>
      )}
    </div>
  );
});

export default EmptyState;
