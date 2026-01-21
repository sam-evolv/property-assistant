'use client';

import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

// Simple Progress Bar
interface ProgressBarProps {
  value: number; // 0-100
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'success' | 'warning' | 'error';
  showLabel?: boolean;
  className?: string;
}

export function ProgressBar({
  value,
  max = 100,
  size = 'md',
  variant = 'default',
  showLabel = false,
  className,
}: ProgressBarProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  const sizeStyles = {
    sm: 'h-1.5',
    md: 'h-2',
    lg: 'h-3',
  };

  const variantStyles = {
    default: 'bg-gold-500',
    success: 'bg-green-500',
    warning: 'bg-amber-500',
    error: 'bg-red-500',
  };

  return (
    <div className={cn('w-full', className)}>
      <div
        className={cn(
          'w-full bg-gray-200 rounded-full overflow-hidden',
          sizeStyles[size]
        )}
      >
        <div
          className={cn(
            'h-full rounded-full transition-all duration-300 ease-out',
            variantStyles[variant]
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showLabel && (
        <p className="text-xs text-gray-500 mt-1">{Math.round(percentage)}%</p>
      )}
    </div>
  );
}

// Stage Indicator (Journey Visualization)
interface Stage {
  id: string;
  label: string;
  completed?: boolean;
  current?: boolean;
}

interface StageIndicatorProps {
  stages: Stage[];
  currentStageId?: string;
  size?: 'sm' | 'md';
  className?: string;
}

export function StageIndicator({
  stages,
  currentStageId,
  size = 'md',
  className,
}: StageIndicatorProps) {
  const currentIndex = stages.findIndex(
    (s) => s.id === currentStageId || s.current
  );

  const sizeStyles = {
    sm: {
      dot: 'w-3 h-3',
      check: 'w-2 h-2',
      text: 'text-xs',
      line: 'h-0.5',
    },
    md: {
      dot: 'w-4 h-4',
      check: 'w-2.5 h-2.5',
      text: 'text-sm',
      line: 'h-0.5',
    },
  };

  const styles = sizeStyles[size];

  return (
    <div className={cn('flex items-center', className)}>
      {stages.map((stage, index) => {
        const isCompleted = stage.completed || index < currentIndex;
        const isCurrent = index === currentIndex;
        const isLast = index === stages.length - 1;

        return (
          <div key={stage.id} className="flex items-center">
            {/* Stage dot/check */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'rounded-full flex items-center justify-center transition-all',
                  styles.dot,
                  isCompleted
                    ? 'bg-green-500'
                    : isCurrent
                    ? 'bg-gold-500'
                    : 'bg-gray-200'
                )}
              >
                {isCompleted && (
                  <Check className={cn('text-white', styles.check)} />
                )}
              </div>
              <span
                className={cn(
                  'mt-1.5 whitespace-nowrap',
                  styles.text,
                  isCurrent
                    ? 'font-medium text-gray-900'
                    : isCompleted
                    ? 'text-gray-600'
                    : 'text-gray-400'
                )}
              >
                {stage.label}
              </span>
            </div>

            {/* Connector line */}
            {!isLast && (
              <div
                className={cn(
                  'w-8 mx-2',
                  styles.line,
                  isCompleted ? 'bg-green-500' : 'bg-gray-200'
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// Unit Progress Card (Combines bar + stages)
interface UnitProgressCardProps {
  unitNumber: string;
  purchaserName?: string;
  currentStage: string;
  stages: Stage[];
  completionPercentage: number;
  daysInStage?: number;
  isOverdue?: boolean;
  onClick?: () => void;
  className?: string;
}

export function UnitProgressCard({
  unitNumber,
  purchaserName,
  currentStage,
  stages,
  completionPercentage,
  daysInStage,
  isOverdue,
  onClick,
  className,
}: UnitProgressCardProps) {
  return (
    <div
      className={cn(
        'bg-white rounded-xl border border-gray-200 p-4 transition-all',
        onClick && 'cursor-pointer hover:shadow-md hover:border-gray-300',
        className
      )}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="text-sm font-semibold text-gray-900">
            Unit {unitNumber}
          </h4>
          {purchaserName && (
            <p className="text-xs text-gray-500">{purchaserName}</p>
          )}
        </div>
        <div className="text-right">
          <span
            className={cn(
              'text-xs font-medium px-2 py-1 rounded-full',
              isOverdue
                ? 'bg-red-50 text-red-700'
                : 'bg-gray-100 text-gray-700'
            )}
          >
            {currentStage}
          </span>
          {daysInStage !== undefined && (
            <p
              className={cn(
                'text-xs mt-1',
                isOverdue ? 'text-red-500' : 'text-gray-400'
              )}
            >
              {daysInStage} day{daysInStage !== 1 ? 's' : ''}{' '}
              {isOverdue ? 'overdue' : 'in stage'}
            </p>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <ProgressBar
        value={completionPercentage}
        variant={isOverdue ? 'error' : completionPercentage >= 100 ? 'success' : 'default'}
        size="sm"
        className="mb-3"
      />

      {/* Stage indicator */}
      <StageIndicator stages={stages} currentStageId={currentStage} size="sm" />
    </div>
  );
}

// Circular Progress
interface CircularProgressProps {
  value: number;
  size?: 'sm' | 'md' | 'lg';
  strokeWidth?: number;
  className?: string;
  showValue?: boolean;
}

export function CircularProgress({
  value,
  size = 'md',
  strokeWidth = 3,
  className,
  showValue = true,
}: CircularProgressProps) {
  const percentage = Math.min(100, Math.max(0, value));

  const sizeMap = {
    sm: 32,
    md: 48,
    lg: 64,
  };

  const dimension = sizeMap[size];
  const radius = (dimension - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      <svg
        width={dimension}
        height={dimension}
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={dimension / 2}
          cy={dimension / 2}
          r={radius}
          fill="none"
          stroke="#e5e5e5"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <circle
          cx={dimension / 2}
          cy={dimension / 2}
          r={radius}
          fill="none"
          stroke={percentage >= 100 ? '#10b981' : '#f5b800'}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-500 ease-out"
        />
      </svg>
      {showValue && (
        <span
          className={cn(
            'absolute font-semibold text-gray-900',
            size === 'sm' ? 'text-xs' : size === 'md' ? 'text-sm' : 'text-base'
          )}
        >
          {Math.round(percentage)}%
        </span>
      )}
    </div>
  );
}

export default ProgressBar;
