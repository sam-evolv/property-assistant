'use client';

import { useEffect, useState } from 'react';
import { MessageSquare, TrendingUp, Clock, BarChart3 } from 'lucide-react';

interface QuestionAnalysisData {
  topQuestions: Array<{
    question: string;
    count: number;
    avgResponseTime: number;
  }>;
  questionsByDevelopment: Array<{
    development_name: string;
    question: string;
    count: number;
  }>;
  questionsByTimeOfDay: Array<{
    hour: number;
    count: number;
  }>;
  avgQuestionLength: number;
  totalQuestions: number;
  categories: Array<{
    category: string;
    count: number;
  }>;
}

interface QuestionsTabProps {
  tenantId: string;
  days: number;
}

export function QuestionsTab({ tenantId, days }: QuestionsTabProps) {
  const [data, setData] = useState<QuestionAnalysisData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const res = await fetch(`/api/analytics-v2/question-analysis?tenantId=${tenantId}&days=${days}&limit=20`);
        const json = await res.json();
        setData(json);
      } catch (error) {
        console.error('Failed to load question analysis:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [tenantId, days]);

  if (loading || !data) {
    return <div className="h-96 bg-gray-100 rounded-xl animate-pulse" />;
  }

  const peakHour = data.questionsByTimeOfDay.reduce((max, curr) => 
    curr.count > max.count ? curr : max, data.questionsByTimeOfDay[0]);

  return (
    <div className="space-y-8 animate-fadeIn">
      <section>
        <div className="flex items-center gap-2 mb-6">
          <MessageSquare className="w-5 h-5 text-gray-700" />
          <h2 className="text-2xl font-bold text-gray-900">Question Analysis</h2>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="text-sm text-gray-600 mb-1">Total Questions</div>
            <div className="text-3xl font-bold text-gray-900">{data.totalQuestions.toLocaleString()}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="text-sm text-gray-600 mb-1">Unique Questions</div>
            <div className="text-3xl font-bold text-gray-900">{data.topQuestions.length}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="text-sm text-gray-600 mb-1">Avg Length</div>
            <div className="text-3xl font-bold text-gray-900">{data.avgQuestionLength} chars</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="text-sm text-gray-600 mb-1">Peak Hour</div>
            <div className="text-3xl font-bold text-gray-900">{peakHour?.hour || 0}:00</div>
          </div>
        </div>

        {/* Categories */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-gold-500" />
            Question Categories
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {data.categories.map((cat) => (
              <div key={cat.category} className="border border-gray-200 rounded-lg p-4">
                <div className="text-sm text-gray-600">{cat.category}</div>
                <div className="text-2xl font-bold text-gray-900">{cat.count}</div>
                <div className="text-xs text-gray-500">
                  {((cat.count / data.totalQuestions) * 100).toFixed(1)}% of total
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Questions */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-gold-500" />
            Most Frequent Questions
          </h3>
          <div className="space-y-3">
            {data.topQuestions.slice(0, 15).map((q, idx) => (
              <div key={idx} className="border-b border-gray-100 pb-3 last:border-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">{q.question}</div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" />
                        Asked {q.count}x
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Avg {q.avgResponseTime}ms response
                      </span>
                    </div>
                  </div>
                  <div className="text-lg font-bold text-gold-600">{q.count}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Questions by Development */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Questions by Development</h3>
          <div className="space-y-3">
            {data.questionsByDevelopment.slice(0, 10).map((item, idx) => (
              <div key={idx} className="border-b border-gray-100 pb-3 last:border-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="text-xs text-gold-600 font-semibold mb-1">{item.development_name}</div>
                    <div className="text-sm text-gray-900">{item.question}</div>
                  </div>
                  <div className="text-sm font-bold text-gray-900">{item.count}x</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
