'use client';

import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import {
  BarChart3,
  MessageSquare,
  AlertCircle,
  RefreshCw,
  TrendingUp,
  Building2,
  HelpCircle,
  Lightbulb,
  Loader2,
} from 'lucide-react';
import {
  PageHeader,
  Card,
  CardHeader,
  CardContent,
  Button,
  Badge,
} from '@/components/ui/premium';

type Tab = 'overview' | 'questions' | 'gaps';

interface AnalyticsData {
  overview: {
    totalQuestions: number;
    questionsInRange: number;
    range: string;
    avgQuestionsPerDay: number;
  };
  recentQuestions: Array<{
    id: string;
    question: string;
    topic: string;
    timestamp: string;
  }>;
  questionsByDevelopment: Array<{
    development_id: string;
    name: string;
    count: number;
  }>;
  topQuestions: Array<{
    topic: string;
    count: number;
  }>;
  knowledgeGaps: Array<{
    topic: string;
    mentions: number;
    suggestion: string;
  }>;
}

export default function AnalyticsClient() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [range, setRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/super/analytics?range=${range}`);
      if (!res.ok) throw new Error('Failed to fetch analytics');

      const result = await res.json();
      setData(result);
    } catch (err) {
      console.error('Analytics fetch error:', err);
      setError('Failed to load analytics data');
    } finally {
      setIsLoading(false);
    }
  }, [range]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'questions', label: 'Recent Questions', icon: MessageSquare },
    { id: 'gaps', label: 'Knowledge Gaps', icon: Lightbulb },
  ];

  const ranges = [
    { value: '7d', label: '7 Days' },
    { value: '30d', label: '30 Days' },
    { value: '90d', label: '90 Days' },
  ];

  return (
    <div className="p-6 lg:p-8 min-h-screen bg-neutral-50">
      <div className="max-w-7xl mx-auto space-y-6">
        <PageHeader
          title="Platform Analytics"
          subtitle="Insights into platform usage and user questions"
          icon={BarChart3}
          actions={
            <div className="flex items-center gap-3">
              <div className="flex items-center bg-white rounded-lg border border-neutral-200 p-1">
                {ranges.map((r) => (
                  <button
                    key={r.value}
                    onClick={() => setRange(r.value as any)}
                    className={cn(
                      'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                      range === r.value
                        ? 'bg-neutral-900 text-white'
                        : 'text-neutral-600 hover:text-neutral-900'
                    )}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                leftIcon={RefreshCw}
                onClick={fetchAnalytics}
                disabled={isLoading}
                className={cn(isLoading && '[&_svg]:animate-spin')}
              >
                Refresh
              </Button>
            </div>
          }
        />

        <div className="flex items-center gap-2 border-b border-neutral-200 pb-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as Tab)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                activeTab === tab.id
                  ? 'bg-amber-100 text-amber-800'
                  : 'text-neutral-600 hover:bg-neutral-100'
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="py-20 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
          </div>
        ) : error ? (
          <Card>
            <CardContent className="py-12 text-center">
              <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
              <p className="text-neutral-600">{error}</p>
              <Button variant="outline" onClick={fetchAnalytics} className="mt-4">
                Try Again
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="py-6 text-center">
                      <p className="text-sm text-neutral-500">Total Questions</p>
                      <p className="text-4xl font-bold text-neutral-900 mt-2">
                        {data?.overview.totalQuestions.toLocaleString() || 0}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="py-6 text-center">
                      <p className="text-sm text-neutral-500">Questions ({range})</p>
                      <p className="text-4xl font-bold text-amber-600 mt-2">
                        {data?.overview.questionsInRange.toLocaleString() || 0}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="py-6 text-center">
                      <p className="text-sm text-neutral-500">Avg/Day</p>
                      <p className="text-4xl font-bold text-neutral-900 mt-2">
                        {data?.overview.avgQuestionsPerDay || 0}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <h3 className="text-lg font-semibold text-neutral-900 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-amber-500" />
                        Top Question Topics
                      </h3>
                    </CardHeader>
                    <CardContent>
                      {data?.topQuestions && data.topQuestions.length > 0 ? (
                        <div className="space-y-3">
                          {data.topQuestions.map((q, idx) => (
                            <div key={idx} className="flex items-center justify-between">
                              <span className="text-sm text-neutral-700">{q.topic}</span>
                              <Badge variant="neutral" size="sm">{q.count}</Badge>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-neutral-500 text-sm">No topic data available</p>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <h3 className="text-lg font-semibold text-neutral-900 flex items-center gap-2">
                        <Building2 className="w-5 h-5 text-amber-500" />
                        Questions by Development
                      </h3>
                    </CardHeader>
                    <CardContent>
                      {data?.questionsByDevelopment && data.questionsByDevelopment.length > 0 ? (
                        <div className="space-y-3">
                          {data.questionsByDevelopment.map((d, idx) => (
                            <div key={idx} className="flex items-center justify-between">
                              <span className="text-sm text-neutral-700">{d.name}</span>
                              <Badge variant="neutral" size="sm">{d.count}</Badge>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-neutral-500 text-sm">No development data available</p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {activeTab === 'questions' && (
              <Card>
                <CardHeader>
                  <h3 className="text-lg font-semibold text-neutral-900">Recent Questions</h3>
                </CardHeader>
                <CardContent>
                  {data?.recentQuestions && data.recentQuestions.length > 0 ? (
                    <div className="space-y-4">
                      {data.recentQuestions.map((q) => (
                        <div key={q.id} className="p-4 border border-neutral-100 rounded-lg">
                          <p className="text-sm text-neutral-800">{q.question || 'No question text'}</p>
                          <div className="flex items-center gap-3 mt-2">
                            {q.topic && <Badge variant="info" size="sm">{q.topic}</Badge>}
                            <span className="text-xs text-neutral-400">
                              {q.timestamp ? new Date(q.timestamp).toLocaleString() : 'Recently'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-neutral-500 text-sm py-8 text-center">No recent questions</p>
                  )}
                </CardContent>
              </Card>
            )}

            {activeTab === 'gaps' && (
              <Card>
                <CardHeader>
                  <h3 className="text-lg font-semibold text-neutral-900 flex items-center gap-2">
                    <Lightbulb className="w-5 h-5 text-amber-500" />
                    Knowledge Gaps
                  </h3>
                  <p className="text-sm text-neutral-500 mt-1">
                    Topics where users frequently ask questions but may lack documentation
                  </p>
                </CardHeader>
                <CardContent>
                  {data?.knowledgeGaps && data.knowledgeGaps.length > 0 ? (
                    <div className="space-y-4">
                      {data.knowledgeGaps.map((gap, idx) => (
                        <div key={idx} className="p-4 border border-orange-100 bg-orange-50 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-neutral-900">{gap.topic}</span>
                            <Badge variant="warning" size="sm">{gap.mentions} mentions</Badge>
                          </div>
                          <p className="text-sm text-neutral-600">
                            <HelpCircle className="w-4 h-4 inline mr-1 text-orange-500" />
                            {gap.suggestion}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-neutral-500 text-sm py-8 text-center">No knowledge gaps identified</p>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
