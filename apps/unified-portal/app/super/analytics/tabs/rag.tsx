'use client';

import { Suspense } from 'react';
import { Zap } from 'lucide-react';
import { useRAGPerformance, useRAGLatency } from '@/hooks/useAnalyticsV2';
import { MetricPulseCard } from '@/components/analytics/premium/MetricPulseCard';
import { TrendStream } from '@/components/analytics/premium/TrendStream';

interface RAGTabProps {
  tenantId: string;
  developmentId?: string;
  days: number;
}

function RAGPerformanceContent({ tenantId, developmentId, days }: RAGTabProps) {
  const { data: performance, isLoading: perfLoading } = useRAGPerformance({ tenantId, developmentId, days });
  const { data: latencyData, isLoading: latencyLoading } = useRAGLatency({ tenantId, developmentId, days });

  if (perfLoading || latencyLoading || !performance || !latencyData) {
    return <div className="h-96 bg-gray-100 rounded-xl animate-pulse" />;
  }

  const ragLatency = latencyData.ragLatency;

  const latencyTrend = ragLatency.map(d => d.avgLatency);

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricPulseCard
          title="Avg Retrieval Time"
          value={`${performance.avgRetrievalTime.toFixed(0)}ms`}
          trend={performance.avgRetrievalTime < 100 ? 'up' : 'neutral'}
          pulse={performance.avgRetrievalTime < 100}
        />
        <MetricPulseCard
          title="Embedding Accuracy"
          value={`${(performance.avgEmbeddingAccuracy * 100).toFixed(1)}%`}
          trend="up"
        />
        <MetricPulseCard
          title="Total Retrievals"
          value={performance.totalRetrievals.toLocaleString()}
          trend="neutral"
        />
        <MetricPulseCard
          title="Failure Rate"
          value={`${(performance.failureRate * 100).toFixed(2)}%`}
          trend={performance.failureRate < 0.05 ? 'up' : 'down'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Latency Trend</h3>
          <TrendStream data={latencyTrend} label="Avg Latency (ms)" color="#fbbf24" />
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-sm text-gray-600">Current Avg</div>
              <div className="text-xl font-bold text-gray-900">{performance.avgRetrievalTime.toFixed(0)}ms</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-600">Coverage</div>
              <div className="text-xl font-bold text-green-600">{performance.coveragePercent.toFixed(1)}%</div>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">RAG Health Metrics</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-gray-200">
              <span className="text-gray-700">Coverage</span>
              <span className="font-bold text-green-600">{performance.coveragePercent.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between items-center pb-3 border-b border-gray-200">
              <span className="text-gray-700">Avg Accuracy</span>
              <span className="font-bold text-gold-500">{(performance.avgEmbeddingAccuracy * 100).toFixed(1)}%</span>
            </div>
            <div className="flex justify-between items-center pb-3 border-b border-gray-200">
              <span className="text-gray-700">Success Rate</span>
              <span className="font-bold text-green-600">{((1 - performance.failureRate) * 100).toFixed(2)}%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-700">Total Retrievals</span>
              <span className="font-bold text-gray-900">{performance.totalRetrievals.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {ragLatency.length > 0 && (
        <div className="mt-6 bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Detailed Latency Breakdown</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-sm font-semibold text-gray-900">Date</th>
                  <th className="px-4 py-2 text-right text-sm font-semibold text-gray-900">Avg Latency</th>
                  <th className="px-4 py-2 text-right text-sm font-semibold text-gray-900">Retrievals</th>
                  <th className="px-4 py-2 text-right text-sm font-semibold text-gray-900">Failure Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {ragLatency.map((row, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-sm text-gray-900">{row.date}</td>
                    <td className="px-4 py-2 text-sm text-right text-gray-900">{row.avgLatency.toFixed(0)}ms</td>
                    <td className="px-4 py-2 text-sm text-right text-gray-900">{row.retrievalCount}</td>
                    <td className="px-4 py-2 text-sm text-right">
                      <span className={`font-medium ${row.failureRate > 0.05 ? 'text-red-600' : 'text-green-600'}`}>
                        {(row.failureRate * 100).toFixed(2)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

export function RAGTab({ tenantId, developmentId, days }: RAGTabProps) {
  return (
    <div className="space-y-8 animate-fadeIn">
      <section>
        <div className="flex items-center gap-2 mb-6">
          <Zap className="w-5 h-5 text-gray-700" />
          <h2 className="text-2xl font-bold text-gray-900">RAG System Performance</h2>
        </div>
        
        <Suspense fallback={<div className="h-96 bg-gray-100 rounded-xl animate-pulse" />}>
          <RAGPerformanceContent tenantId={tenantId} developmentId={developmentId} days={days} />
        </Suspense>
      </section>
    </div>
  );
}
