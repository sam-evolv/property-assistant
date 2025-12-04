'use client';

import { memo } from 'react';
import { ArrowUpIcon, ArrowDownIcon } from 'lucide-react';
import { AnimatedNumber } from './AnimatedNumber';

interface InsightCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: number;
    label: string;
  };
  icon?: React.ReactNode;
  premium?: boolean;
}

const InsightCardComponent = ({ title, value, subtitle, trend, icon, premium = true }: InsightCardProps) => {
  const isPositive = trend && trend.value > 0;
  const isNegative = trend && trend.value < 0;
  const numericValue = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.-]/g, ''));
  const isNumeric = !isNaN(numericValue);

  return (
    <div className={`bg-white rounded-lg p-6 hover:shadow-xl transition-all duration-200 ${
      premium 
        ? 'border-2 border-amber-200 hover:border-amber-300 shadow-sm' 
        : 'border border-gray-200 hover:shadow-lg'
    }`}>
      <div className="flex items-start justify-between mb-3">
        <h3 className={`text-sm font-medium ${premium ? 'text-gray-700' : 'text-gray-600'}`}>{title}</h3>
        {icon && <div className={premium ? 'text-amber-500' : 'text-gray-400'}>{icon}</div>}
      </div>
      
      <div className="flex items-baseline gap-2">
        {isNumeric ? (
          <p className="text-3xl font-bold text-gray-900">
            <AnimatedNumber value={numericValue} />
          </p>
        ) : (
          <p className="text-3xl font-bold text-gray-900">{value}</p>
        )}
        
        {trend && (
          <div className={`flex items-center gap-1 text-sm font-medium ${
            isPositive ? 'text-green-600' : isNegative ? 'text-red-600' : 'text-gray-600'
          }`}>
            {isPositive && <ArrowUpIcon className="w-4 h-4" />}
            {isNegative && <ArrowDownIcon className="w-4 h-4" />}
            <span>{Math.abs(trend.value)}%</span>
          </div>
        )}
      </div>
      
      {subtitle && (
        <p className="mt-2 text-sm text-gray-500">{subtitle}</p>
      )}
      
      {trend && (
        <p className="mt-1 text-xs text-gray-400">{trend.label}</p>
      )}
    </div>
  );
};

export const InsightCard = memo(InsightCardComponent);
