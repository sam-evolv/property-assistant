'use client';

import { Suspense, memo } from 'react';
import dynamic from 'next/dynamic';
import { TrendingUp } from 'lucide-react';
import { useTrendMetrics, useCostModel } from '@/hooks/useAnalyticsV2';

const MetricPulseCard = dynamic(
  () => import('@/components/analytics/premium/MetricPulseCard').then(mod => ({ default: mod.MetricPulseCard })),
  { ssr: false, loading: () => <div className="h-24 bg-gray-100 rounded-xl animate-pulse" /> }
);

const CostTrajectory = dynamic(
  () => import('@/components/analytics/premium/CostTrajectory').then(mod => ({ default: mod.CostTrajectory })),
  { ssr: false, loading: () => <div className="h-48 bg-gray-100 rounded-xl animate-pulse" /> }
);

interface TrendsTabProps {
  tenantId: string;
  developmentId?: string;
  days: number;
}

function TrendsContent({ tenantId, developmentId, days }: TrendsTabProps) {
  const { data: trends, isLoading: trendsLoading } = useTrendMetrics({ tenantId, developmentId, days });
  const { data: costData, isLoading: costLoading } = useCostModel({ tenantId, developmentId, days });

  if (trendsLoading || costLoading || !trends || !costData) {
    return <div className="h-96 bg-gray-100 rounded-xl animate-pulse" />;
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricPulseCard
          title="Message Growth"
          value={`${trends.messageGrowthRate > 0 ? '+' : ''}${trends.messageGrowthRate.toFixed(1)}%`}
          change={trends.messageGrowthRate}
          trend={trends.messageGrowthRate > 0 ? 'up' : 'down'}
          pulse={trends.messageGrowthRate > 5}
        />
        <MetricPulseCard
          title="User Growth"
          value={`${trends.userGrowthRate > 0 ? '+' : ''}${trends.userGrowthRate.toFixed(1)}%`}
          change={trends.userGrowthRate}
          trend={trends.userGrowthRate > 0 ? 'up' : 'down'}
        />
        <MetricPulseCard
          title="Document Growth"
          value={`${trends.documentGrowthRate > 0 ? '+' : ''}${trends.documentGrowthRate.toFixed(1)}%`}
          change={trends.documentGrowthRate}
          trend={trends.documentGrowthRate > 0 ? 'up' : 'neutral'}
        />
        <MetricPulseCard
          title="Cost Trend"
          value={trends.costTrend.charAt(0).toUpperCase() + trends.costTrend.slice(1)}
          trend={trends.costTrend === 'decreasing' ? 'up' : trends.costTrend === 'increasing' ? 'down' : 'neutral'}
        />
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Cost Trajectory Over Time</h3>
        <CostTrajectory data={costData.costTrajectory.map(d => ({
          date: d.date,
          actual: d.actualCost,
          projected: d.projectedCost
        }))} />
        <div className="mt-6 grid grid-cols-3 gap-4 border-t border-gray-200 pt-4">
          <div className="text-center">
            <div className="text-sm text-gray-600">Actual Spend</div>
            <div className="text-2xl font-bold text-gray-900">
              ${costData.totalActualCost.toFixed(2)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-sm text-gray-600">Monthly Projection</div>
            <div className="text-2xl font-bold text-gold-600">
              ${costData.monthlyProjection.toFixed(2)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-sm text-gray-600">Growth Rate</div>
            <div className={`text-2xl font-bold ${trends.costTrend === 'increasing' ? 'text-red-600' : 'text-green-600'}`}>
              {trends.costTrend === 'increasing' ? '↑' : trends.costTrend === 'decreasing' ? '↓' : '→'}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export function TrendsTab({ tenantId, developmentId, days }: TrendsTabProps) {
  return (
    <div className="space-y-8 animate-fadeIn">
      <section>
        <div className="flex items-center gap-2 mb-6">
          <TrendingUp className="w-5 h-5 text-gray-700" />
          <h2 className="text-2xl font-bold text-gray-900">Trend Analysis</h2>
        </div>
        
        <Suspense fallback={<div className="h-96 bg-gray-100 rounded-xl animate-pulse" />}>
          <TrendsContent tenantId={tenantId} developmentId={developmentId} days={days} />
        </Suspense>
      </section>
    </div>
  );
}
