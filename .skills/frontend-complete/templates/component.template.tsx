/**
 * Component Template
 *
 * Usage: Copy and customize for new components
 *
 * Checklist:
 * - [ ] Props interface defined with proper types
 * - [ ] Default values for optional props
 * - [ ] Proper accessibility (aria labels, roles)
 * - [ ] Handles loading/error/empty states
 * - [ ] Uses design tokens for styling
 * - [ ] Memoized if receiving callbacks as props
 */

'use client';

import { memo, useCallback } from 'react';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

export interface ComponentNameProps {
  /** Required: Main content or value */
  value: string;

  /** Optional: Additional CSS classes */
  className?: string;

  /** Optional: Click handler */
  onClick?: () => void;

  /** Optional: Loading state */
  isLoading?: boolean;

  /** Optional: Disabled state */
  disabled?: boolean;

  /** Optional: Variant for different styles */
  variant?: 'default' | 'primary' | 'secondary';
}

// ============================================================================
// Constants
// ============================================================================

const variantStyles = {
  default: 'bg-white border-gray-200 text-gray-900',
  primary: 'bg-gold-500 border-gold-600 text-white',
  secondary: 'bg-gray-100 border-gray-300 text-gray-700',
} as const;

// ============================================================================
// Component
// ============================================================================

export const ComponentName = memo(function ComponentName({
  value,
  className,
  onClick,
  isLoading = false,
  disabled = false,
  variant = 'default',
}: ComponentNameProps) {
  // Handlers
  const handleClick = useCallback(() => {
    if (!disabled && !isLoading && onClick) {
      onClick();
    }
  }, [disabled, isLoading, onClick]);

  // Loading state
  if (isLoading) {
    return (
      <div className={cn('animate-pulse bg-gray-200 rounded-lg h-10', className)} />
    );
  }

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      onClick={handleClick}
      onKeyDown={(e) => e.key === 'Enter' && handleClick()}
      className={cn(
        'px-4 py-2 rounded-lg border transition-all duration-200',
        'focus:outline-none focus:ring-2 focus:ring-gold-500 focus:ring-offset-2',
        variantStyles[variant],
        disabled && 'opacity-50 cursor-not-allowed',
        !disabled && 'cursor-pointer hover:shadow-md',
        className
      )}
      aria-disabled={disabled}
    >
      {value}
    </div>
  );
});

// ============================================================================
// Sub-components (if needed for composition pattern)
// ============================================================================

ComponentName.displayName = 'ComponentName';

// Optional: Export sub-components for composition
// export const ComponentNameHeader = ...
// export const ComponentNameContent = ...
// export const ComponentNameFooter = ...
