'use client';

import { Suspense } from 'react';
import { Home } from 'lucide-react';
import { useUnitMetrics } from '@/hooks/useAnalyticsV2';
import { MetricPulseCard } from '@/components/analytics/premium/MetricPulseCard';

interface UnitsTabProps {
  tenantId: string;
  developmentId?: string;
  days: number;
}

function UnitsContent({ tenantId, developmentId, days }: UnitsTabProps) {
  const { data: units, isLoading } = useUnitMetrics({ tenantId, developmentId, days });

  if (isLoading || !units) {
    return <div className="h-96 bg-gray-100 rounded-xl animate-pulse" />;
  }

  const occupancyRate = units.totalUnits > 0 ? (units.occupiedUnits / units.totalUnits) * 100 : 0;
  const activityRate = units.totalUnits > 0 ? (units.unitsWithActivity / units.totalUnits) * 100 : 0;

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricPulseCard
          title="Total Units"
          value={units.totalUnits.toLocaleString()}
          trend="neutral"
        />
        <MetricPulseCard
          title="Occupied Units"
          value={units.occupiedUnits.toLocaleString()}
          change={occupancyRate}
          trend={occupancyRate > 70 ? 'up' : 'neutral'}
        />
        <MetricPulseCard
          title="Units with Activity"
          value={units.unitsWithActivity.toLocaleString()}
          change={activityRate}
          trend={activityRate > 50 ? 'up' : 'neutral'}
        />
        <MetricPulseCard
          title="Avg Messages/Unit"
          value={units.avgMessagesPerUnit.toFixed(1)}
          trend={units.avgMessagesPerUnit > 10 ? 'up' : 'neutral'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Occupancy Rate</h3>
          <div className="relative pt-1">
            <div className="flex mb-2 items-center justify-between">
              <div>
                <span className="text-xs font-semibold inline-block text-gold-600">
                  {occupancyRate.toFixed(1)}%
                </span>
              </div>
              <div className="text-right">
                <span className="text-xs font-semibold inline-block text-gray-600">
                  {units.occupiedUnits} / {units.totalUnits}
                </span>
              </div>
            </div>
            <div className="overflow-hidden h-4 mb-4 text-xs flex rounded bg-gray-200">
              <div 
                style={{ width: `${occupancyRate}%` }} 
                className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-gradient-to-r from-gold-400 to-gold-600"
              ></div>
            </div>
          </div>
          <div className="text-sm text-gray-600 mt-4">
            {occupancyRate > 80 ? 'Excellent occupancy rate!' :
             occupancyRate > 60 ? 'Good occupancy' :
             'Consider improving occupancy'}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Activity Rate</h3>
          <div className="relative pt-1">
            <div className="flex mb-2 items-center justify-between">
              <div>
                <span className="text-xs font-semibold inline-block text-green-600">
                  {activityRate.toFixed(1)}%
                </span>
              </div>
              <div className="text-right">
                <span className="text-xs font-semibold inline-block text-gray-600">
                  {units.unitsWithActivity} / {units.totalUnits}
                </span>
              </div>
            </div>
            <div className="overflow-hidden h-4 mb-4 text-xs flex rounded bg-gray-200">
              <div 
                style={{ width: `${activityRate}%` }} 
                className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-gradient-to-r from-green-400 to-green-600"
              ></div>
            </div>
          </div>
          <div className="text-sm text-gray-600 mt-4">
            {activityRate > 60 ? 'High engagement!' :
             activityRate > 30 ? 'Moderate engagement' :
             'Opportunity to increase engagement'}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Active Unit</h3>
          {units.topActiveUnit ? (
            <>
              <div className="text-2xl font-bold text-gold-600 mb-2">{units.topActiveUnit}</div>
              <div className="text-sm text-gray-600">Most engaged unit in this period</div>
              <div className="mt-4 text-lg font-semibold text-gray-900">
                {units.avgMessagesPerUnit.toFixed(1)} avg messages/unit
              </div>
            </>
          ) : (
            <div className="text-gray-500">No unit activity data available</div>
          )}
        </div>
      </div>

      <div className="bg-gradient-to-r from-gray-50 to-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Unit Intelligence Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <div className="text-3xl font-bold text-gray-900">{units.totalUnits}</div>
            <div className="text-sm text-gray-600 mt-1">Total Property Units</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-green-600">{units.occupiedUnits}</div>
            <div className="text-sm text-gray-600 mt-1">Occupied ({occupancyRate.toFixed(1)}%)</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-gold-600">{units.unitsWithActivity}</div>
            <div className="text-sm text-gray-600 mt-1">Active ({activityRate.toFixed(1)}%)</div>
          </div>
        </div>
      </div>
    </>
  );
}

export function UnitsTab({ tenantId, developmentId, days }: UnitsTabProps) {
  return (
    <div className="space-y-8 animate-fadeIn">
      <section>
        <div className="flex items-center gap-2 mb-6">
          <Home className="w-5 h-5 text-gray-700" />
          <h2 className="text-2xl font-bold text-gray-900">Unit Intelligence & Occupancy</h2>
        </div>
        
        <Suspense fallback={<div className="h-96 bg-gray-100 rounded-xl animate-pulse" />}>
          <UnitsContent tenantId={tenantId} developmentId={developmentId} days={days} />
        </Suspense>
      </section>
    </div>
  );
}
