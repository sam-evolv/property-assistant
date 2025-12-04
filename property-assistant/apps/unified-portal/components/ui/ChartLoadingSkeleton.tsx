'use client';

import React from 'react';

interface ChartLoadingSkeletonProps {
  height?: number;
  className?: string;
}

export function ChartLoadingSkeleton({ height = 250, className = '' }: ChartLoadingSkeletonProps) {
  return (
    <div 
      className={`animate-pulse bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded-lg ${className}`}
      style={{ height }}
    >
      <div className="h-full flex items-center justify-center">
        <div className="text-gray-400 text-sm opacity-60">Loading chart...</div>
      </div>
    </div>
  );
}

export function MapLoadingSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-gradient-to-br from-gray-200 via-gray-100 to-gray-200 rounded-xl ${className}`} style={{ minHeight: 500 }}>
      <div className="h-full flex flex-col items-center justify-center gap-3">
        <div className="w-12 h-12 rounded-full bg-gray-300 animate-pulse" />
        <div className="text-gray-400 text-sm opacity-60">Loading map...</div>
      </div>
    </div>
  );
}

export function TableLoadingSkeleton({ rows = 5, className = '' }: { rows?: number; className?: string }) {
  return (
    <div className={`animate-pulse space-y-3 ${className}`}>
      <div className="h-10 bg-gray-200 rounded-lg" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-12 bg-gray-100 rounded-lg" />
      ))}
    </div>
  );
}

export function DashboardLoadingSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`space-y-6 ${className}`}>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-24 bg-gray-200 rounded-lg animate-pulse" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-64 bg-gray-200 rounded-lg animate-pulse" />
        <div className="h-64 bg-gray-200 rounded-lg animate-pulse" />
      </div>
    </div>
  );
}
