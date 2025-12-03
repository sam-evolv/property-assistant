'use client';

import { Suspense } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useKnowledgeGaps, useRepeatedQuestions, useTopQuestions } from '@/hooks/useAnalyticsV2';
import { HeatMatrix } from '@/components/analytics/premium/HeatMatrix';

interface KnowledgeTabProps {
  tenantId: string;
  developmentId?: string;
  days: number;
}

function KnowledgeGapsContent({ tenantId, developmentId, days }: KnowledgeTabProps) {
  const { data: gapsData, isLoading: gapsLoading } = useKnowledgeGaps({ tenantId, developmentId, days });
  const { data: repeatedData, isLoading: repeatedLoading } = useRepeatedQuestions({ tenantId, developmentId, days, limit: 10 });
  const { data: topData, isLoading: topLoading } = useTopQuestions({ tenantId, developmentId, days, limit: 10 });

  if (gapsLoading || repeatedLoading || topLoading || !gapsData || !repeatedData || !topData) {
    return <div className="h-96 bg-gray-100 rounded-xl animate-pulse" />;
  }

  const gaps = gapsData.gaps;
  const repeatedQuestions = repeatedData.repeatedQuestions;
  const topQuestions = topData.topQuestions;

  const heatmapData = gaps.map((gap, idx) => ({
    x: gap.category,
    y: gap.gapSeverity,
    value: gap.questionCount,
  }));

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
        {gaps.slice(0, 3).map((gap, idx) => (
          <div
            key={idx}
            className={`bg-white border-2 rounded-xl p-6 shadow-sm ${
              gap.gapSeverity === 'high' ? 'border-red-300' : gap.gapSeverity === 'medium' ? 'border-yellow-300' : 'border-green-300'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold text-gray-900">{gap.category}</h4>
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                gap.gapSeverity === 'high' ? 'bg-red-100 text-red-800' : 
                gap.gapSeverity === 'medium' ? 'bg-yellow-100 text-yellow-800' : 
                'bg-green-100 text-green-800'
              }`}>
                {gap.gapSeverity.toUpperCase()}
              </span>
            </div>
            <div className="text-2xl font-bold text-gray-900 mb-1">{gap.questionCount}</div>
            <div className="text-sm text-gray-600 mb-2">questions</div>
            <div className="text-xs text-gray-500 truncate">{gap.topQuestion}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Repeated Questions (Knowledge Gaps)</h3>
          <div className="space-y-3">
            {repeatedQuestions.map((q, idx) => (
              <div key={idx} className="border-l-4 border-gold-400 pl-4 py-2">
                <div className="font-medium text-gray-900">{q.question}</div>
                <div className="text-sm text-gray-600 mt-1">
                  Repeated {q.occurrences} times over {q.daysRepeated} days
                  {q.isGap && <span className="ml-2 text-red-600 font-medium">⚠ Gap</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Questions</h3>
          <div className="space-y-3">
            {topQuestions.map((q, idx) => (
              <div key={idx} className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-gold-400 to-gold-600 text-white flex items-center justify-center font-bold text-sm">
                  {idx + 1}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{q.question}</div>
                  <div className="text-sm text-gray-600">Asked {q.count} times</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {heatmapData.length > 0 && (
        <div className="mt-6 bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Knowledge Gap Heatmap</h3>
          <HeatMatrix data={heatmapData} title="" />
        </div>
      )}
    </>
  );
}

export function KnowledgeTab({ tenantId, developmentId, days }: KnowledgeTabProps) {
  return (
    <div className="space-y-8 animate-fadeIn">
      <section>
        <div className="flex items-center gap-2 mb-6">
          <AlertTriangle className="w-5 h-5 text-gray-700" />
          <h2 className="text-2xl font-bold text-gray-900">Knowledge Gap Analysis</h2>
        </div>
        
        <Suspense fallback={<div className="h-96 bg-gray-100 rounded-xl animate-pulse" />}>
          <KnowledgeGapsContent tenantId={tenantId} developmentId={developmentId} days={days} />
        </Suspense>
      </section>
    </div>
  );
}
