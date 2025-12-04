'use client';

import { Sparkles } from 'lucide-react';

interface InsightBannerProps {
  insight: string;
  loading?: boolean;
}

export function InsightBanner({ insight, loading = false }: InsightBannerProps) {
  if (loading) {
    return (
      <div className="rounded-lg border border-yellow-500/30 bg-gradient-to-r from-yellow-500/5 to-yellow-500/10 p-6 animate-pulse">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <Sparkles className="h-5 w-5 text-yellow-500 animate-spin" />
          </div>
          <div className="flex-1">
            <div className="h-4 bg-gray-700 rounded w-3/4 mb-2"></div>
            <div className="h-4 bg-gray-700 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-yellow-500/30 bg-gradient-to-r from-yellow-500/5 to-yellow-500/10 p-6">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0">
          <Sparkles className="h-5 w-5 text-yellow-500" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-yellow-500 mb-2">AI Insight</p>
          <p className="text-gray-300 leading-relaxed">{insight}</p>
        </div>
      </div>
    </div>
  );
}
