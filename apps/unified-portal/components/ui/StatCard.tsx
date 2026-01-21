'use client';

import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface SparklineData {
  value: number;
  date?: string;
}

interface StatCardProps {
  label: string;
  value: string | number;
  suffix?: string;
  icon?: LucideIcon;
  iconColor?: string;
  trend?: number; // percentage change
  trendLabel?: string;
  sparklineData?: SparklineData[];
  description?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

function Sparkline({ data, className }: { data: SparklineData[]; className?: string }) {
  if (!data || data.length < 2) return null;

  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const width = 80;
  const height = 24;
  const padding = 2;

  const points = values.map((value, index) => {
    const x = padding + (index / (values.length - 1)) * (width - padding * 2);
    const y = height - padding - ((value - min) / range) * (height - padding * 2);
    return `${x},${y}`;
  });

  const pathD = `M ${points.join(' L ')}`;

  // Determine color based on trend
  const isPositive = values[values.length - 1] >= values[0];
  const strokeColor = isPositive ? '#10b981' : '#ef4444';

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn('overflow-visible', className)}
    >
      <path
        d={pathD}
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* End dot */}
      <circle
        cx={points[points.length - 1].split(',')[0]}
        cy={points[points.length - 1].split(',')[1]}
        r="2"
        fill={strokeColor}
      />
    </svg>
  );
}

export function StatCard({
  label,
  value,
  suffix,
  icon: Icon,
  iconColor = 'text-gray-400',
  trend,
  trendLabel,
  sparklineData,
  description,
  className,
  size = 'md',
}: StatCardProps) {
  const sizeStyles = {
    sm: {
      padding: 'p-4',
      labelSize: 'text-xs',
      valueSize: 'text-xl',
      iconSize: 'w-4 h-4',
      iconPadding: 'p-1.5',
    },
    md: {
      padding: 'p-5',
      labelSize: 'text-xs',
      valueSize: 'text-2xl',
      iconSize: 'w-5 h-5',
      iconPadding: 'p-2',
    },
    lg: {
      padding: 'p-6',
      labelSize: 'text-sm',
      valueSize: 'text-3xl',
      iconSize: 'w-6 h-6',
      iconPadding: 'p-2.5',
    },
  };

  const styles = sizeStyles[size];

  return (
    <div
      className={cn(
        'bg-white rounded-xl border border-gray-200 transition-all',
        'hover:shadow-md hover:border-gray-300',
        styles.padding,
        className
      )}
    >
      {/* Header with icon and trend */}
      <div className="flex items-start justify-between mb-3">
        {Icon && (
          <div className={cn('rounded-lg bg-gray-100', styles.iconPadding)}>
            <Icon className={cn(styles.iconSize, iconColor)} />
          </div>
        )}
        {trend !== undefined && trend !== 0 && (
          <div
            className={cn(
              'flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full',
              trend > 0
                ? 'text-green-700 bg-green-50'
                : trend < 0
                ? 'text-red-700 bg-red-50'
                : 'text-gray-700 bg-gray-50'
            )}
          >
            {trend > 0 ? (
              <TrendingUp className="w-3 h-3" />
            ) : trend < 0 ? (
              <TrendingDown className="w-3 h-3" />
            ) : (
              <Minus className="w-3 h-3" />
            )}
            <span>
              {trend > 0 ? '+' : ''}
              {trend}%
            </span>
          </div>
        )}
      </div>

      {/* Label */}
      <p
        className={cn(
          'uppercase tracking-wide text-gray-500 font-semibold mb-1',
          styles.labelSize
        )}
      >
        {label}
      </p>

      {/* Value and Sparkline */}
      <div className="flex items-end justify-between">
        <div>
          <p className={cn('font-bold text-gray-900', styles.valueSize)}>
            {value}
            {suffix && (
              <span className="text-lg font-normal text-gray-500 ml-0.5">
                {suffix}
              </span>
            )}
          </p>
          {description && (
            <p className="text-xs text-gray-500 mt-1">{description}</p>
          )}
          {trendLabel && (
            <p className="text-xs text-gray-500 mt-1">{trendLabel}</p>
          )}
        </div>
        {sparklineData && sparklineData.length > 1 && (
          <Sparkline data={sparklineData} className="ml-4" />
        )}
      </div>
    </div>
  );
}

// Grid wrapper for stat cards
export function StatCardGrid({
  children,
  columns = 5,
  className,
}: {
  children: React.ReactNode;
  columns?: 2 | 3 | 4 | 5;
  className?: string;
}) {
  const gridCols = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
    5: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5',
  };

  return (
    <div className={cn('grid gap-4', gridCols[columns], className)}>
      {children}
    </div>
  );
}

export default StatCard;
