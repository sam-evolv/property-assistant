'use client';

import { memo, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================
interface SparklinePoint {
  value: number;
  label?: string;
}

type MetricVariant = 'default' | 'highlighted' | 'warning' | 'success' | 'error';
type MetricSize = 'sm' | 'md' | 'lg' | 'xl';

interface MetricCardProps {
  /** Metric label/title */
  label: string;
  /** Main value to display */
  value: string | number;
  /** Optional suffix (%, units, etc.) */
  suffix?: string;
  /** Optional prefix ($, €, etc.) */
  prefix?: string;
  /** Icon to display */
  icon?: LucideIcon;
  /** Trend percentage (positive = up, negative = down) */
  trend?: number;
  /** Custom trend label */
  trendLabel?: string;
  /** Sparkline data points */
  sparklineData?: SparklinePoint[];
  /** Additional description text */
  description?: string;
  /** Card variant */
  variant?: MetricVariant;
  /** Card size */
  size?: MetricSize;
  /** Click handler */
  onClick?: () => void;
  /** Additional class names */
  className?: string;
  /** Loading state */
  loading?: boolean;
  /** Comparison value (for showing change) */
  comparison?: {
    value: number;
    label: string;
  };
}

// ============================================================================
// SPARKLINE COMPONENT
// ============================================================================
const Sparkline = memo(function Sparkline({
  data,
  color = '#F5B800',
  height = 40,
}: {
  data: SparklinePoint[];
  color?: string;
  height?: number;
}) {
  if (!data || data.length < 2) return null;

  const values = data.map(d => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const padding = 2;

  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * 100;
    const y = height - padding - ((value - min) / range) * (height - padding * 2);
    return { x, y };
  });

  const pointsString = points.map(p => `${p.x},${p.y}`).join(' ');
  const gradientId = `sparkline-${Math.random().toString(36).slice(2, 9)}`;
  const areaPoints = `0,${height} ${pointsString} 100,${height}`;

  return (
    <div className="animate-in fade-in duration-500">
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 100 ${height}`}
        preserveAspectRatio="none"
        className="overflow-visible"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={areaPoints} fill={`url(#${gradientId})`} />
        <polyline
          points={pointsString}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        <circle
          cx={points[points.length - 1].x}
          cy={points[points.length - 1].y}
          r="4"
          fill={color}
          vectorEffect="non-scaling-stroke"
          className="animate-pulse"
        />
      </svg>
    </div>
  );
});

// ============================================================================
// TREND INDICATOR
// ============================================================================
const TrendIndicator = memo(function TrendIndicator({
  value,
  label,
  size = 'md',
}: {
  value: number;
  label?: string;
  size?: MetricSize;
}) {
  const isPositive = value > 0;
  const isNeutral = value === 0;

  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5 gap-0.5',
    md: 'text-xs px-2 py-1 gap-1',
    lg: 'text-sm px-2.5 py-1 gap-1',
    xl: 'text-sm px-3 py-1.5 gap-1.5',
  };

  const iconSizes = {
    sm: 'w-2.5 h-2.5',
    md: 'w-3 h-3',
    lg: 'w-3.5 h-3.5',
    xl: 'w-4 h-4',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center font-semibold rounded-full transition-all',
        sizeClasses[size],
        isPositive && 'text-emerald-700 bg-emerald-50 border border-emerald-200/50',
        !isPositive && !isNeutral && 'text-red-700 bg-red-50 border border-red-200/50',
        isNeutral && 'text-neutral-600 bg-neutral-100 border border-neutral-200/50'
      )}
    >
      {isPositive ? (
        <ArrowUpRight className={iconSizes[size]} />
      ) : isNeutral ? (
        <Minus className={iconSizes[size]} />
      ) : (
        <ArrowDownRight className={iconSizes[size]} />
      )}
      <span>
        {isPositive ? '+' : ''}{value}%
      </span>
      {label && <span className="text-neutral-500 ml-1">{label}</span>}
    </span>
  );
});

// ============================================================================
// LOADING SKELETON
// ============================================================================
const MetricSkeleton = memo(function MetricSkeleton({ size = 'md' }: { size?: MetricSize }) {
  const heights = {
    sm: 'h-5',
    md: 'h-7',
    lg: 'h-9',
    xl: 'h-11',
  };

  return (
    <div className="animate-pulse space-y-3">
      <div className="flex items-center justify-between">
        <div className="h-3 w-20 bg-neutral-200 rounded" />
        <div className="h-6 w-6 bg-neutral-200 rounded-lg" />
      </div>
      <div className={cn('w-24 bg-neutral-200 rounded', heights[size])} />
      <div className="h-10 w-full bg-neutral-100 rounded" />
    </div>
  );
});

// ============================================================================
// METRIC CARD COMPONENT
// ============================================================================
export const MetricCard = memo(function MetricCard({
  label,
  value,
  suffix,
  prefix,
  icon: Icon,
  trend,
  trendLabel,
  sparklineData,
  description,
  variant = 'default',
  size = 'md',
  onClick,
  className,
  loading = false,
  comparison,
}: MetricCardProps) {
  // Style configurations
  const sizeConfig = useMemo(
    () => ({
      sm: {
        padding: 'p-4',
        labelSize: 'text-[10px]',
        valueSize: 'text-xl',
        iconSize: 'w-4 h-4',
        iconWrapper: 'p-1.5',
        sparklineHeight: 32,
      },
      md: {
        padding: 'p-5',
        labelSize: 'text-xs',
        valueSize: 'text-2xl',
        iconSize: 'w-5 h-5',
        iconWrapper: 'p-2',
        sparklineHeight: 40,
      },
      lg: {
        padding: 'p-6',
        labelSize: 'text-xs',
        valueSize: 'text-3xl',
        iconSize: 'w-5 h-5',
        iconWrapper: 'p-2.5',
        sparklineHeight: 48,
      },
      xl: {
        padding: 'p-8',
        labelSize: 'text-sm',
        valueSize: 'text-4xl',
        iconSize: 'w-6 h-6',
        iconWrapper: 'p-3',
        sparklineHeight: 56,
      },
    }),
    []
  );

  const variantConfig = useMemo(
    () => ({
      default: {
        container: 'bg-white border-neutral-200 hover:border-neutral-300',
        icon: 'bg-neutral-100 text-neutral-500',
        sparklineColor: '#F5B800',
      },
      highlighted: {
        container: 'bg-gradient-to-br from-amber-50 to-white border-amber-200 hover:border-amber-300 ring-1 ring-amber-100',
        icon: 'bg-amber-100 text-amber-600',
        sparklineColor: '#F5B800',
      },
      success: {
        container: 'bg-gradient-to-br from-emerald-50 to-white border-emerald-200 hover:border-emerald-300',
        icon: 'bg-emerald-100 text-emerald-600',
        sparklineColor: '#10B981',
      },
      warning: {
        container: 'bg-gradient-to-br from-amber-50 to-white border-amber-200 hover:border-amber-300',
        icon: 'bg-amber-100 text-amber-600',
        sparklineColor: '#F59E0B',
      },
      error: {
        container: 'bg-gradient-to-br from-red-50 to-white border-red-200 hover:border-red-300',
        icon: 'bg-red-100 text-red-600',
        sparklineColor: '#EF4444',
      },
    }),
    []
  );

  const config = sizeConfig[size];
  const variantStyles = variantConfig[variant];

  if (loading) {
    return (
      <div
        className={cn(
          'rounded-xl border transition-all',
          config.padding,
          variantStyles.container,
          className
        )}
      >
        <MetricSkeleton size={size} />
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-xl border transition-all duration-200',
        'shadow-card hover:shadow-cardHover',
        config.padding,
        variantStyles.container,
        onClick && 'cursor-pointer active:scale-[0.98]',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <p
            className={cn(
              'uppercase tracking-wider font-semibold text-neutral-500 truncate',
              config.labelSize
            )}
          >
            {label}
          </p>
        </div>

        <div className="flex items-center gap-2 ml-3">
          {trend !== undefined && <TrendIndicator value={trend} label={trendLabel} size={size} />}
          {Icon && (
            <div className={cn('rounded-lg', config.iconWrapper, variantStyles.icon)}>
              <Icon className={config.iconSize} />
            </div>
          )}
        </div>
      </div>

      {/* Value */}
      <div className="flex items-baseline gap-1">
        {prefix && (
          <span className={cn('font-medium text-neutral-400', size === 'sm' ? 'text-sm' : 'text-lg')}>
            {prefix}
          </span>
        )}
        <p className={cn('font-bold text-neutral-900 tracking-tight', config.valueSize)}>
          {value}
        </p>
        {suffix && (
          <span className={cn('font-medium text-neutral-400', size === 'sm' ? 'text-xs' : 'text-sm')}>
            {suffix}
          </span>
        )}
      </div>

      {/* Comparison */}
      {comparison && (
        <p className="text-xs text-neutral-500 mt-1">
          <span className="font-medium">{comparison.value}</span> {comparison.label}
        </p>
      )}

      {/* Sparkline */}
      {sparklineData && sparklineData.length > 1 && (
        <div className="mt-4">
          <Sparkline
            data={sparklineData}
            color={variantStyles.sparklineColor}
            height={config.sparklineHeight}
          />
        </div>
      )}

      {/* Description */}
      {description && (
        <p className="text-xs text-neutral-500 mt-3 leading-relaxed">{description}</p>
      )}
    </div>
  );
});

// ============================================================================
// METRIC CARD GRID
// ============================================================================
interface MetricCardGridProps {
  children: React.ReactNode;
  columns?: 2 | 3 | 4 | 5 | 6;
  className?: string;
}

export function MetricCardGrid({ children, columns = 4, className }: MetricCardGridProps) {
  const gridCols = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
    5: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5',
    6: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6',
  };

  return (
    <div className={cn('grid gap-4', gridCols[columns], className)}>
      {children}
    </div>
  );
}

export default MetricCard;
