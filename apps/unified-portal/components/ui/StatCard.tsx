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

interface SparklineProps {
  data: SparklineData[];
  color?: string;
  height?: number;
  showGradient?: boolean;
  className?: string;
}

function Sparkline({
  data,
  color,
  height = 36,
  showGradient = true,
  className
}: SparklineProps) {
  if (!data || data.length < 2) return null;

  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const width = 100; // percentage-based for responsiveness
  const padding = 2;

  // Calculate points as percentages
  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * 100;
    const y = height - padding - ((value - min) / range) * (height - padding * 2);
    return { x, y };
  });

  const pointsString = points.map(p => `${p.x},${p.y}`).join(' ');

  // Determine color based on trend if not provided
  const isPositive = values[values.length - 1] >= values[0];
  const strokeColor = color || (isPositive ? '#f5b800' : '#ef4444');

  // Generate unique ID for gradient
  const gradientId = `sparkline-gradient-${Math.random().toString(36).substr(2, 9)}`;

  // Create polygon points for gradient fill (close the shape at bottom)
  const polygonPoints = `0,${height} ${pointsString} 100,${height}`;

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 100 ${height}`}
      preserveAspectRatio="none"
      className={cn('overflow-visible', className)}
    >
      {showGradient && (
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.2" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
          </linearGradient>
        </defs>
      )}

      {/* Gradient fill area */}
      {showGradient && (
        <polygon
          points={polygonPoints}
          fill={`url(#${gradientId})`}
        />
      )}

      {/* Line */}
      <polyline
        points={pointsString}
        fill="none"
        stroke={strokeColor}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />

      {/* End dot */}
      <circle
        cx={points[points.length - 1].x}
        cy={points[points.length - 1].y}
        r="3"
        fill={strokeColor}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

// Standalone sparkline export for use outside StatCard
export function StatSparkline({
  data,
  color = '#f5b800',
  height = 36
}: {
  data: SparklineData[];
  color?: string;
  height?: number;
}) {
  return <Sparkline data={data} color={color} height={height} showGradient={true} />;
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

      {/* Value */}
      <p className={cn('font-bold text-gray-900', styles.valueSize)}>
        {value}
        {suffix && (
          <span className="text-lg font-normal text-gray-500 ml-0.5">
            {suffix}
          </span>
        )}
      </p>

      {/* Sparkline - full width */}
      {sparklineData && sparklineData.length > 1 && (
        <div className="mt-3">
          <Sparkline data={sparklineData} height={36} />
        </div>
      )}

      {/* Description / Trend Label */}
      {(description || trendLabel) && (
        <p className="text-xs text-gray-500 mt-2">
          {description || trendLabel}
        </p>
      )}
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
