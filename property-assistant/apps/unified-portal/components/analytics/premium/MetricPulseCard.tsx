'use client';

import { ReactNode } from 'react';

interface MetricPulseCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon?: ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  pulse?: boolean;
}

export function MetricPulseCard({ title, value, change, icon, trend = 'neutral', pulse = false }: MetricPulseCardProps) {
  const trendColor = trend === 'up' ? 'text-green-400' : trend === 'down' ? 'text-red-400' : 'text-gray-400';
  const trendIcon = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '−';

  return (
    <div className={`relative overflow-hidden rounded-lg border border-gray-800 bg-black p-6 transition-all hover:border-yellow-500/50 ${pulse ? 'animate-pulse-slow' : ''}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-400">{title}</p>
          <p className="mt-2 text-3xl font-bold text-white">{value}</p>
          {change !== undefined && (
            <p className={`mt-1 text-sm font-medium ${trendColor}`}>
              {trendIcon} {Math.abs(change)}% {trend === 'up' ? 'increase' : trend === 'down' ? 'decrease' : 'change'}
            </p>
          )}
        </div>
        {icon && <div className="text-yellow-500 opacity-50">{icon}</div>}
      </div>
      {pulse && (
        <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/0 via-yellow-500/10 to-yellow-500/0 animate-shimmer" />
      )}
    </div>
  );
}
