'use client';

import { memo } from 'react';
import { cn } from '@/lib/utils';

// ============================================================================
// BASE SKELETON
// ============================================================================
interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Animation style */
  animation?: 'pulse' | 'wave' | 'none';
  /** Border radius */
  rounded?: 'none' | 'sm' | 'md' | 'lg' | 'full';
}

export const Skeleton = memo(function Skeleton({
  animation = 'pulse',
  rounded = 'md',
  className,
  ...props
}: SkeletonProps) {
  const roundedStyles = {
    none: 'rounded-none',
    sm: 'rounded',
    md: 'rounded-md',
    lg: 'rounded-lg',
    full: 'rounded-full',
  };

  const animationStyles = {
    pulse: 'animate-pulse',
    wave: 'animate-shimmer bg-gradient-to-r from-neutral-200 via-neutral-100 to-neutral-200 bg-[length:200%_100%]',
    none: '',
  };

  return (
    <div
      className={cn(
        'bg-neutral-200',
        roundedStyles[rounded],
        animationStyles[animation],
        className
      )}
      {...props}
    />
  );
});

// ============================================================================
// SKELETON TEXT
// ============================================================================
interface SkeletonTextProps extends SkeletonProps {
  /** Number of lines */
  lines?: number;
  /** Last line width */
  lastLineWidth?: 'full' | '3/4' | '2/3' | '1/2' | '1/3';
  /** Line spacing */
  spacing?: 'tight' | 'normal' | 'relaxed';
}

export const SkeletonText = memo(function SkeletonText({
  lines = 3,
  lastLineWidth = '2/3',
  spacing = 'normal',
  animation = 'pulse',
  className,
  ...props
}: SkeletonTextProps) {
  const spacingStyles = {
    tight: 'space-y-1.5',
    normal: 'space-y-2',
    relaxed: 'space-y-3',
  };

  const lastWidthStyles = {
    full: 'w-full',
    '3/4': 'w-3/4',
    '2/3': 'w-2/3',
    '1/2': 'w-1/2',
    '1/3': 'w-1/3',
  };

  return (
    <div className={cn(spacingStyles[spacing], className)} {...props}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          animation={animation}
          className={cn(
            'h-4',
            i === lines - 1 ? lastWidthStyles[lastLineWidth] : 'w-full'
          )}
        />
      ))}
    </div>
  );
});

// ============================================================================
// SKELETON CIRCLE
// ============================================================================
interface SkeletonCircleProps extends SkeletonProps {
  /** Size in pixels or Tailwind class */
  size?: number | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

export const SkeletonCircle = memo(function SkeletonCircle({
  size = 'md',
  animation = 'pulse',
  className,
  ...props
}: SkeletonCircleProps) {
  const sizeStyles = {
    xs: 'w-6 h-6',
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
  };

  const sizeClass = typeof size === 'number' ? undefined : sizeStyles[size];
  const sizeStyle = typeof size === 'number' ? { width: size, height: size } : undefined;

  return (
    <Skeleton
      animation={animation}
      rounded="full"
      className={cn(sizeClass, className)}
      style={sizeStyle}
      {...props}
    />
  );
});

// ============================================================================
// PRESET SKELETONS
// ============================================================================

/** Card skeleton */
export const SkeletonCard = memo(function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('bg-white rounded-xl border border-neutral-200 p-5', className)}>
      <div className="flex items-start justify-between mb-4">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>
      <Skeleton className="h-8 w-28 mb-4" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
});

/** Table row skeleton */
export const SkeletonTableRow = memo(function SkeletonTableRow({
  columns = 4,
}: {
  columns?: number;
}) {
  return (
    <tr className="animate-pulse">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton
            className={cn(
              'h-4',
              i === 0 ? 'w-40' : i === columns - 1 ? 'w-16' : 'w-24'
            )}
          />
        </td>
      ))}
    </tr>
  );
});

/** Avatar with text skeleton */
export const SkeletonAvatarWithText = memo(function SkeletonAvatarWithText({
  className,
}: {
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <SkeletonCircle size="md" />
      <div className="space-y-1.5">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  );
});

/** List item skeleton */
export const SkeletonListItem = memo(function SkeletonListItem({
  className,
}: {
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-4 p-4 border-b border-neutral-100',
        className
      )}
    >
      <SkeletonCircle size="sm" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <Skeleton className="h-6 w-16 rounded-full" />
    </div>
  );
});

export default Skeleton;
