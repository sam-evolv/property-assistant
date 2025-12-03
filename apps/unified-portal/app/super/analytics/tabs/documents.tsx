'use client';

import { Suspense } from 'react';
import { FileText } from 'lucide-react';
import { useDocumentHealth, useDocumentMetrics } from '@/hooks/useAnalyticsV2';
import { HealthGauge } from '@/components/analytics/premium/HealthGauge';
import { MetricPulseCard } from '@/components/analytics/premium/MetricPulseCard';

interface DocumentsTabProps {
  tenantId: string;
  developmentId?: string;
  days: number;
}

function DocumentHealthContent({ tenantId, developmentId, days }: DocumentsTabProps) {
  const { data: healthData, isLoading: healthLoading } = useDocumentHealth({ tenantId, developmentId, days, limit: 20 });
  const { data: metrics, isLoading: metricsLoading } = useDocumentMetrics({ tenantId, developmentId, days });

  if (healthLoading || metricsLoading || !healthData || !metrics) {
    return <div className="h-96 bg-gray-100 rounded-xl animate-pulse" />;
  }

  const { documentHealth, statusCounts, avgHealthScore } = healthData;

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricPulseCard
          title="Total Documents"
          value={metrics.totalDocuments.toLocaleString()}
          trend="neutral"
        />
        <MetricPulseCard
          title="Avg Health Score"
          value={metrics.avgHealthScore.toFixed(1)}
          change={metrics.avgHealthScore}
          trend={metrics.avgHealthScore > 70 ? 'up' : metrics.avgHealthScore > 50 ? 'neutral' : 'down'}
        />
        <MetricPulseCard
          title="Healthy Docs"
          value={(statusCounts.healthy || 0).toLocaleString()}
          trend="up"
        />
        <MetricPulseCard
          title="Needs Attention"
          value={(statusCounts['under-used'] || 0) + (statusCounts.outdated || 0)}
          trend={statusCounts['under-used'] + statusCounts.outdated > 0 ? 'down' : 'neutral'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-8">
        <HealthGauge value={statusCounts.healthy || 0} label="Healthy" max={metrics.totalDocuments} />
        <HealthGauge value={statusCounts['under-used'] || 0} label="Under-used" max={metrics.totalDocuments} />
        <HealthGauge value={statusCounts.outdated || 0} label="Outdated" max={metrics.totalDocuments} />
        <HealthGauge value={statusCounts.unused || 0} label="Unused" max={metrics.totalDocuments} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Accessed Documents</h3>
          <div className="space-y-3">
            {metrics.topAccessedDocs.map((doc, idx) => (
              <div key={idx} className="flex items-center justify-between pb-2 border-b border-gray-200">
                <span className="text-sm text-gray-900 truncate flex-1">{doc.name}</span>
                <span className="text-sm font-bold text-gold-600 ml-2">{doc.accessCount} views</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Document Health Details</h3>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {documentHealth.map((doc, idx) => (
              <div key={idx} className="border-l-4 pl-3 py-2" style={{
                borderColor: doc.status === 'healthy' ? '#10b981' : 
                             doc.status === 'under-used' ? '#f59e0b' : 
                             doc.status === 'outdated' ? '#ef4444' : '#6b7280'
              }}>
                <div className="font-medium text-gray-900 text-sm truncate">{doc.documentName}</div>
                <div className="text-xs text-gray-600 mt-1">
                  Health: {doc.healthScore.toFixed(1)}/100 • {doc.embeddingCount} chunks • 
                  {doc.lastAccessed ? ` Last accessed ${new Date(doc.lastAccessed).toLocaleDateString()}` : ' Never accessed'}
                </div>
                <div className={`text-xs font-medium mt-1 ${
                  doc.status === 'healthy' ? 'text-green-600' : 
                  doc.status === 'under-used' ? 'text-gold-600' : 
                  doc.status === 'outdated' ? 'text-red-600' : 'text-gray-600'
                }`}>
                  {doc.status.toUpperCase()}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

export function DocumentsTab({ tenantId, developmentId, days }: DocumentsTabProps) {
  return (
    <div className="space-y-8 animate-fadeIn">
      <section>
        <div className="flex items-center gap-2 mb-6">
          <FileText className="w-5 h-5 text-gray-700" />
          <h2 className="text-2xl font-bold text-gray-900">Document Health & Analytics</h2>
        </div>
        
        <Suspense fallback={<div className="h-96 bg-gray-100 rounded-xl animate-pulse" />}>
          <DocumentHealthContent tenantId={tenantId} developmentId={developmentId} days={days} />
        </Suspense>
      </section>
    </div>
  );
}
