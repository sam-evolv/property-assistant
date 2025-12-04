'use client';

import { Suspense, useState, useEffect, memo } from 'react';
import dynamic from 'next/dynamic';
import { TrendingUp, DollarSign, Users, FileText, Zap, Clock } from 'lucide-react';
import { useOverviewMetrics, useCostModel, fetchInsight } from '@/hooks/useAnalyticsV2';

const MetricPulseCard = dynamic(
  () => import('@/components/analytics/premium/MetricPulseCard').then(mod => ({ default: mod.MetricPulseCard })),
  { ssr: false, loading: () => <div className="h-24 bg-gray-100 rounded-xl animate-pulse" /> }
);

const InsightBanner = dynamic(
  () => import('@/components/analytics/premium/InsightBanner').then(mod => ({ default: mod.InsightBanner })),
  { ssr: false, loading: () => <div className="h-16 bg-gray-100 rounded-xl animate-pulse" /> }
);

const CostTrajectory = dynamic(
  () => import('@/components/analytics/premium/CostTrajectory').then(mod => ({ default: mod.CostTrajectory })),
  { ssr: false, loading: () => <div className="h-48 bg-gray-100 rounded-xl animate-pulse" /> }
);

interface OverviewTabProps {
  tenantId: string;
  developmentId?: string;
  days: number;
}

function OverviewMetrics({ tenantId, developmentId, days }: OverviewTabProps) {
  const { data: metrics, isLoading: metricsLoading } = useOverviewMetrics({ tenantId, developmentId, days });
  const { data: costData, isLoading: costLoading } = useCostModel({ tenantId, developmentId, days });

  if (metricsLoading || costLoading || !metrics || !costData) {
    return <div className="h-96 bg-gray-100 rounded-xl animate-pulse" />;
  }

  const messageGrowth = Math.round((metrics.totalMessages / days) * 7);
  const userTrend = metrics.activeUsers > 0 ? 'up' : 'neutral';

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricPulseCard
          title="Total Messages"
          value={metrics.totalMessages.toLocaleString()}
          change={messageGrowth}
          trend={messageGrowth > 0 ? 'up' : 'neutral'}
          pulse={true}
        />
        <MetricPulseCard
          title="Active Users"
          value={metrics.activeUsers.toLocaleString()}
          trend={userTrend}
        />
        <MetricPulseCard
          title="Avg Response Time"
          value={`${metrics.avgResponseTime}ms`}
          trend={metrics.avgResponseTime < 500 ? 'up' : 'neutral'}
        />
        <MetricPulseCard
          title="Total Documents"
          value={metrics.totalDocuments.toLocaleString()}
          trend="neutral"
        />
        <MetricPulseCard
          title="Cost/Message"
          value={`$${metrics.avgCostPerMessage.toFixed(4)}`}
          trend="neutral"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-gold-500" />
            Cost Trajectory
          </h3>
          <CostTrajectory data={costData.costTrajectory.map(d => ({
            date: d.date,
            actual: d.actualCost,
            projected: d.projectedCost
          }))} />
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-sm text-gray-600">Total Actual</div>
              <div className="text-xl font-bold text-gray-900">
                ${costData.totalActualCost.toFixed(2)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-600">Monthly Projection</div>
              <div className="text-xl font-bold text-gold-600">
                ${costData.monthlyProjection.toFixed(2)}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-gold-500" />
            Performance Overview
          </h3>
          <div className="space-y-4">
            <div>
              <div className="text-sm text-gray-600">Peak Usage Hour</div>
              <div className="text-2xl font-bold text-gray-900">
                {metrics.peakUsageHour}:00 {metrics.peakUsageHour >= 12 ? 'PM' : 'AM'}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Top Development</div>
              <div className="text-lg font-semibold text-gray-900">
                {metrics.topDevelopment || 'N/A'}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600">RAG Coverage</div>
              <div className="text-2xl font-bold text-green-600">
                {metrics.embeddingChunks.toLocaleString()} chunks
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function AIInsights({ tenantId, developmentId, days }: OverviewTabProps) {
  const [insight, setInsight] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadInsight() {
      setLoading(true);
      const metrics = { tenantId, developmentId, days };
      const result = await fetchInsight('overview', metrics, tenantId);
      setInsight(result);
      setLoading(false);
    }
    loadInsight();
  }, [tenantId, developmentId, days]);

  return <InsightBanner insight={insight} loading={loading} />;
}

export function OverviewTab({ tenantId, developmentId, days }: OverviewTabProps) {
  return (
    <div className="space-y-8 animate-fadeIn">
      <section>
        <div className="flex items-center gap-2 mb-6">
          <TrendingUp className="w-5 h-5 text-gray-700" />
          <h2 className="text-2xl font-bold text-gray-900">Executive Summary</h2>
        </div>
        
        <Suspense fallback={<div className="h-32 bg-gray-100 rounded-xl animate-pulse" />}>
          <AIInsights tenantId={tenantId} developmentId={developmentId} days={days} />
        </Suspense>
        
        <div className="mt-6">
          <Suspense fallback={<div className="h-64 bg-gray-100 rounded-xl animate-pulse" />}>
            <OverviewMetrics tenantId={tenantId} developmentId={developmentId} days={days} />
          </Suspense>
        </div>
      </section>
    </div>
  );
}
