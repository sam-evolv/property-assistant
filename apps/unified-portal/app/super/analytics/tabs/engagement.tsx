'use client';

import { Suspense } from 'react';
import { Users } from 'lucide-react';
import { useHomeownerMetrics, useUserFunnel } from '@/hooks/useAnalyticsV2';
import { MetricPulseCard } from '@/components/analytics/premium/MetricPulseCard';
import { PersonaSplitChart } from '@/components/analytics/premium/PersonaSplitChart';

interface EngagementTabProps {
  tenantId: string;
  developmentId?: string;
  days: number;
}

function EngagementContent({ tenantId, developmentId, days }: EngagementTabProps) {
  const { data: homeowners, isLoading: homeownersLoading } = useHomeownerMetrics({ tenantId, developmentId, days });
  const { data: funnelData, isLoading: funnelLoading } = useUserFunnel({ tenantId, developmentId, days });

  if (homeownersLoading || funnelLoading || !homeowners || !funnelData) {
    return <div className="h-96 bg-gray-100 rounded-xl animate-pulse" />;
  }

  const { funnelMetrics, overallConversionRate } = funnelData;

  const engagementData = funnelMetrics.map(stage => ({
    label: stage.stage,
    value: stage.count,
    percentage: stage.conversionRate * 100,
  }));

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricPulseCard
          title="Total Homeowners"
          value={homeowners.totalHomeowners.toLocaleString()}
          trend="neutral"
        />
        <MetricPulseCard
          title="Active Homeowners"
          value={homeowners.activeHomeowners.toLocaleString()}
          change={homeowners.engagementRate * 100}
          trend={homeowners.engagementRate > 0.3 ? 'up' : 'neutral'}
          pulse={homeowners.engagementRate > 0.5}
        />
        <MetricPulseCard
          title="Engagement Rate"
          value={`${(homeowners.engagementRate * 100).toFixed(1)}%`}
          trend={homeowners.engagementRate > 0.3 ? 'up' : 'neutral'}
        />
        <MetricPulseCard
          title="Avg Messages/User"
          value={(homeowners.avgMessagesPerHomeowner ?? 0).toFixed(1)}
          trend={(homeowners.avgMessagesPerHomeowner ?? 0) > 5 ? 'up' : 'neutral'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">User Engagement Funnel</h3>
          <PersonaSplitChart 
            data={engagementData}
            title=""
          />
          <div className="mt-4 text-center">
            <div className="text-sm text-gray-600">Overall Conversion Rate</div>
            <div className="text-2xl font-bold text-gold-600">
              {(overallConversionRate * 100).toFixed(1)}%
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Funnel Breakdown</h3>
          <div className="space-y-4">
            {funnelMetrics.map((stage, idx) => (
              <div key={idx} className="pb-3 border-b border-gray-200 last:border-0">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium text-gray-900">{stage.stage}</span>
                  <span className="text-sm font-bold text-gold-600">
                    {(stage.conversionRate * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="text-sm text-gray-600">{stage.description}</div>
                <div className="text-lg font-bold text-gray-900 mt-1">{stage.count.toLocaleString()} users</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {homeowners.topEngagedDevelopment && (
        <div className="bg-gradient-to-r from-gold-50 to-white border border-gold-200 rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Top Engaged Development</h3>
          <div className="text-2xl font-bold text-gold-600">{homeowners.topEngagedDevelopment}</div>
          <div className="text-sm text-gray-600 mt-1">
            This development shows the highest homeowner engagement
          </div>
        </div>
      )}
    </>
  );
}

export function EngagementTab({ tenantId, developmentId, days }: EngagementTabProps) {
  return (
    <div className="space-y-8 animate-fadeIn">
      <section>
        <div className="flex items-center gap-2 mb-6">
          <Users className="w-5 h-5 text-gray-700" />
          <h2 className="text-2xl font-bold text-gray-900">Homeowner Engagement Analytics</h2>
        </div>
        
        <Suspense fallback={<div className="h-96 bg-gray-100 rounded-xl animate-pulse" />}>
          <EngagementContent tenantId={tenantId} developmentId={developmentId} days={days} />
        </Suspense>
      </section>
    </div>
  );
}
