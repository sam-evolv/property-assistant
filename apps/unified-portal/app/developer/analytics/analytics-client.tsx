'use client';

import { useEffect, useState, memo, useMemo, useCallback } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Building2, Users, MessageSquare, TrendingUp, ArrowLeft, BarChart3, Clock, Activity, Zap } from 'lucide-react';
import { useOverviewMetrics, useHomeownerMetrics } from '@/hooks/useAnalyticsV2';
import { ChartLoadingSkeleton } from '@/components/ui/ChartLoadingSkeleton';
import { useCurrentContext } from '@/contexts/CurrentContext';
import { isAllSchemes } from '@/lib/archive-scope';

const ActivityChart = dynamic(
  () => import('./optimized-charts').then(mod => ({ default: mod.ActivityChart })),
  { ssr: false, loading: () => <ChartLoadingSkeleton height={280} /> }
);

const ResponseTimeChart = dynamic(
  () => import('./optimized-charts').then(mod => ({ default: mod.ResponseTimeChart })),
  { ssr: false, loading: () => <ChartLoadingSkeleton height={200} /> }
);

interface QuestionAnalysisData {
  topQuestions: Array<{
    question: string;
    count: number;
    avgResponseTime: number;
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

const mockActivityData = [
  { date: 'Mon', chats: 24, messages: 12 },
  { date: 'Tue', chats: 32, messages: 18 },
  { date: 'Wed', chats: 28, messages: 15 },
  { date: 'Thu', chats: 41, messages: 22 },
  { date: 'Fri', chats: 35, messages: 19 },
  { date: 'Sat', chats: 18, messages: 10 },
  { date: 'Sun', chats: 12, messages: 8 },
];

// Mock response time data over 30 days
const mockResponseTimeData = [
  { date: 'Day 1', avgTime: 245, maxTime: 512 },
  { date: 'Day 2', avgTime: 238, maxTime: 498 },
  { date: 'Day 3', avgTime: 251, maxTime: 535 },
  { date: 'Day 4', avgTime: 229, maxTime: 468 },
  { date: 'Day 5', avgTime: 242, maxTime: 520 },
  { date: 'Day 6', avgTime: 235, maxTime: 490 },
  { date: 'Day 7', avgTime: 248, maxTime: 545 },
  { date: 'Day 8', avgTime: 226, maxTime: 451 },
];

interface AnalyticsClientProps {
  tenantId: string;
}

type DateRange = '7' | '30' | '90' | 'custom';

export default function AnalyticsClient({ tenantId }: AnalyticsClientProps) {
  const { archiveScope, developmentId } = useCurrentContext();
  const effectiveDevelopmentId = isAllSchemes(archiveScope) ? undefined : developmentId || undefined;
  const [schemeName, setSchemeName] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>('30');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  
  const daysToQuery = useMemo(() => {
    if (dateRange === 'custom') {
      if (!customStartDate || !customEndDate) {
        return 30; // Default fallback while dates are being selected
      }
      const start = new Date(customStartDate);
      const end = new Date(customEndDate);
      if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) {
        return 30; // Invalid range, use default
      }
      // Add 1 to include both start and end date
      const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      return Math.max(1, days); // Ensure at least 1 day
    }
    return parseInt(dateRange);
  }, [dateRange, customStartDate, customEndDate]);
  
  const { data: metrics, isLoading: metricsLoading } = useOverviewMetrics({ 
    tenantId, 
    developmentId: effectiveDevelopmentId,
    days: daysToQuery 
  });
  const { data: homeowners, isLoading: homeownersLoading } = useHomeownerMetrics({ 
    tenantId, 
    developmentId: effectiveDevelopmentId,
    days: daysToQuery 
  });
  const [questionData, setQuestionData] = useState<QuestionAnalysisData | null>(null);
  const [questionsLoading, setQuestionsLoading] = useState(true);
  
  useEffect(() => {
    async function fetchDevelopmentName() {
      if (!effectiveDevelopmentId) {
        setSchemeName(null);
        return;
      }
      try {
        const res = await fetch('/api/developer/developments');
        if (res.ok) {
          const data = await res.json();
          const dev = data.developments?.find((d: any) => d.id === effectiveDevelopmentId);
          setSchemeName(dev?.name || null);
        }
      } catch {
        setSchemeName(null);
      }
    }
    fetchDevelopmentName();
  }, [effectiveDevelopmentId]);

  useEffect(() => {
    async function loadQuestions() {
      setQuestionsLoading(true);
      try {
        const devIdParam = effectiveDevelopmentId ? `&developmentId=${effectiveDevelopmentId}` : '';
        const res = await fetch(`/api/analytics-v2/question-analysis?tenantId=${tenantId}&days=${daysToQuery}&limit=20${devIdParam}`);
        if (res.ok) {
          const data = await res.json();
          setQuestionData(data);
        }
      } catch (error) {
        console.error('Failed to load questions:', error);
      } finally {
        setQuestionsLoading(false);
      }
    }
    loadQuestions();
  }, [tenantId, effectiveDevelopmentId, daysToQuery]);

  const isLoading = metricsLoading || homeownersLoading || questionsLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-grey-50 to-white p-8">
        <div className="max-w-7xl mx-auto">
          <div className="h-12 bg-grey-200 rounded-lg animate-pulse mb-8" />
          <div className="grid grid-cols-4 gap-4 mb-8">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-grey-200 rounded-lg animate-pulse" />)}
          </div>
        </div>
      </div>
    );
  }

  const bgColor = 'bg-gradient-to-br from-grey-50 to-white';
  const cardBg = 'bg-white/80 border-gold-200/30';
  const textColor = 'text-grey-900';
  const secondaryText = 'text-grey-600';

  const peakHour = questionData?.questionsByTimeOfDay?.reduce((max, curr) => 
    curr.count > max.count ? curr : max, questionData?.questionsByTimeOfDay[0]) || { hour: 0, count: 0 };

  return (
    <div className={`min-h-screen ${bgColor}`}>
      {/* Header */}
      <div className={`border-b border-gold-200/30 px-8 py-6 backdrop-blur-sm`}>
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <Link href="/developer" className="text-gold-500 hover:text-gold-600 flex items-center gap-1 mb-2">
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm">Back to Dashboard</span>
            </Link>
            <h1 className={`text-3xl font-bold ${textColor}`}>
              Analytics & Insights {schemeName ? `— ${schemeName}` : '— All Schemes'}
            </h1>
            <p className={`${secondaryText} text-sm mt-1`}>Deep dive into your development metrics and homeowner engagement</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-white rounded-lg border border-gold-200/50 shadow-sm">
              <button
                onClick={() => setDateRange('7')}
                className={`px-3 py-2 text-sm font-medium transition ${
                  dateRange === '7' ? 'bg-gold-500 text-white rounded-l-lg' : 'text-grey-600 hover:bg-grey-50 rounded-l-lg'
                }`}
              >
                7 days
              </button>
              <button
                onClick={() => setDateRange('30')}
                className={`px-3 py-2 text-sm font-medium border-l border-gold-200/50 transition ${
                  dateRange === '30' ? 'bg-gold-500 text-white' : 'text-grey-600 hover:bg-grey-50'
                }`}
              >
                30 days
              </button>
              <button
                onClick={() => setDateRange('90')}
                className={`px-3 py-2 text-sm font-medium border-l border-gold-200/50 transition ${
                  dateRange === '90' ? 'bg-gold-500 text-white' : 'text-grey-600 hover:bg-grey-50'
                }`}
              >
                90 days
              </button>
              <button
                onClick={() => setDateRange('custom')}
                className={`px-3 py-2 text-sm font-medium border-l border-gold-200/50 transition rounded-r-lg ${
                  dateRange === 'custom' ? 'bg-gold-500 text-white' : 'text-grey-600 hover:bg-grey-50'
                }`}
              >
                Custom
              </button>
            </div>
            {dateRange === 'custom' && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className={`px-2 py-1.5 text-sm border rounded-lg text-grey-900 ${
                    !customStartDate ? 'border-amber-300 bg-amber-50' : 'border-gold-200/50'
                  }`}
                  max={customEndDate || undefined}
                />
                <span className="text-grey-400">to</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className={`px-2 py-1.5 text-sm border rounded-lg text-grey-900 ${
                    !customEndDate ? 'border-amber-300 bg-amber-50' : 'border-gold-200/50'
                  }`}
                  min={customStartDate || undefined}
                />
                {(!customStartDate || !customEndDate) && (
                  <span className="text-xs text-amber-600">Select dates</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-8 py-8">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Overview KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className={`rounded-lg border p-6 backdrop-blur-sm transition hover:shadow-md ${cardBg}`}>
              <div className="flex items-center justify-between mb-4">
                <MessageSquare className="w-5 h-5 text-gold-500" />
                <span className="text-xs font-semibold text-green-600 bg-green-500/10 px-2 py-1 rounded-full">+12%</span>
              </div>
              <p className={`${secondaryText} text-xs uppercase tracking-wide mb-1`}>Total Messages</p>
              <p className={`text-3xl font-bold ${textColor}`}>{metrics?.totalMessages?.toLocaleString() || 0}</p>
              <p className={`${secondaryText} text-xs mt-2`}>Last {daysToQuery} days</p>
            </div>

            <div className={`rounded-lg border p-6 backdrop-blur-sm transition hover:shadow-md ${cardBg}`}>
              <div className="flex items-center justify-between mb-4">
                <Users className="w-5 h-5 text-blue-500" />
                <span className="text-xs font-semibold text-green-600 bg-green-500/10 px-2 py-1 rounded-full">+5%</span>
              </div>
              <p className={`${secondaryText} text-xs uppercase tracking-wide mb-1`}>Active Users</p>
              <p className={`text-3xl font-bold ${textColor}`}>{metrics?.activeUsers?.toLocaleString() || 0}</p>
              <p className={`${secondaryText} text-xs mt-2`}>This month</p>
            </div>

            <div className={`rounded-lg border p-6 backdrop-blur-sm transition hover:shadow-md ${cardBg}`}>
              <div className="flex items-center justify-between mb-4">
                <Activity className="w-5 h-5 text-purple-500" />
                <span className="text-xs font-semibold text-green-600 bg-green-500/10 px-2 py-1 rounded-full">{homeowners?.engagementRate ? Math.round(homeowners.engagementRate * 100) : 0}%</span>
              </div>
              <p className={`${secondaryText} text-xs uppercase tracking-wide mb-1`}>Engagement Rate</p>
              <p className={`text-3xl font-bold ${textColor}`}>{homeowners?.engagementRate ? `${(homeowners.engagementRate * 100).toFixed(1)}%` : '0%'}</p>
              <p className={`${secondaryText} text-xs mt-2`}>Homeowner activity</p>
            </div>

            <div className={`rounded-lg border p-6 backdrop-blur-sm transition hover:shadow-md ${cardBg}`}>
              <div className="flex items-center justify-between mb-4">
                <Zap className="w-5 h-5 text-pink-500" />
                <span className="text-xs font-semibold text-green-600 bg-green-500/10 px-2 py-1 rounded-full">-8%</span>
              </div>
              <p className={`${secondaryText} text-xs uppercase tracking-wide mb-1`}>Avg Response</p>
              <p className={`text-3xl font-bold ${textColor}`}>{metrics?.avgResponseTime || 0}ms</p>
              <p className={`${secondaryText} text-xs mt-2`}>Performance target</p>
            </div>
          </div>

          {/* Charts & Performance */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* Activity Chart */}
              <div className={`rounded-lg border p-6 backdrop-blur-sm ${cardBg}`}>
                <h2 className={`text-lg font-semibold ${textColor} mb-4`}>Chat Activity</h2>
                <ActivityChart data={mockActivityData} height={280} />
              </div>

              {/* Response Time Performance */}
              <div className={`rounded-lg border p-6 backdrop-blur-sm ${cardBg}`}>
                <h2 className={`text-lg font-semibold ${textColor} mb-4`}>Response Time Performance</h2>
                <ResponseTimeChart data={mockResponseTimeData} height={200} />
                <div className="mt-4 grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-grey-50 rounded-lg">
                    <p className="text-xs text-grey-600">Avg Response Time</p>
                    <p className="text-xl font-bold text-grey-900 mt-1">245ms</p>
                  </div>
                  <div className="text-center p-3 bg-gold-50 rounded-lg">
                    <p className="text-xs text-grey-600">Peak Response Time</p>
                    <p className="text-xl font-bold text-gold-500 mt-1">545ms</p>
                  </div>
                </div>
              </div>
            </div>

            {/* API Health & Questions Summary */}
            <div className="space-y-6">
              {/* API Health */}
              <div className={`rounded-lg border p-6 backdrop-blur-sm ${cardBg}`}>
                <h2 className={`text-lg font-semibold ${textColor} mb-4`}>API Health</h2>
                <div className="space-y-4">
                  <div className="pb-3 border-b border-grey-200">
                    <p className={`${secondaryText} text-xs`}>Uptime This Month</p>
                    <p className={`text-xl font-bold ${textColor} mt-1`}>99.8%</p>
                  </div>
                  <div className="pb-3 border-b border-grey-200">
                    <p className={`${secondaryText} text-xs`}>Avg Tokens/Message</p>
                    <p className={`text-xl font-bold ${textColor} mt-1`}>347</p>
                  </div>
                  <div>
                    <p className={`${secondaryText} text-xs`}>API Calls/Min</p>
                    <p className={`text-xl font-bold ${textColor} mt-1`}>285</p>
                  </div>
                </div>
              </div>

              {/* Questions Summary */}
              <div className={`rounded-lg border p-6 backdrop-blur-sm ${cardBg}`}>
                <h2 className={`text-lg font-semibold ${textColor} mb-4 flex items-center gap-2`}>
                  <MessageSquare className="w-5 h-5 text-gold-500" />
                  Questions
                </h2>
                <div className="space-y-3">
                  <div className="pb-2 border-b border-grey-200">
                    <p className={`${secondaryText} text-xs`}>Total Questions</p>
                    <p className={`text-lg font-bold ${textColor} mt-1`}>{questionData?.totalQuestions || 0}</p>
                  </div>
                  <div className="pb-2 border-b border-grey-200">
                    <p className={`${secondaryText} text-xs`}>Avg Length</p>
                    <p className={`text-lg font-bold ${textColor} mt-1`}>{questionData?.avgQuestionLength || 0} chars</p>
                  </div>
                  <div>
                    <p className={`${secondaryText} text-xs`}>Peak Hour</p>
                    <p className={`text-lg font-bold ${textColor} mt-1`}>{peakHour?.hour || 0}:00</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Question Analysis Section */}
          {questionData && (
            <>
              {/* Question Categories */}
              <div className={`rounded-lg border p-6 backdrop-blur-sm ${cardBg}`}>
                <h3 className={`text-lg font-semibold ${textColor} mb-4 flex items-center gap-2`}>
                  <BarChart3 className="w-5 h-5 text-gold-500" />
                  Question Categories
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {questionData.categories.map((cat) => (
                    <div key={cat.category} className={`border border-gold-200/30 rounded-lg p-4`}>
                      <p className={`text-sm ${textColor} font-medium`}>{cat.category}</p>
                      <p className={`text-2xl font-bold ${textColor} mt-2`}>{cat.count}</p>
                      <p className={`text-xs ${secondaryText} mt-1`}>{((cat.count / (questionData.totalQuestions || 1)) * 100).toFixed(1)}% of total</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Most Frequent Questions */}
              <div className={`rounded-lg border p-6 backdrop-blur-sm ${cardBg}`}>
                <h3 className={`text-lg font-semibold ${textColor} mb-4 flex items-center gap-2`}>
                  <TrendingUp className="w-5 h-5 text-gold-500" />
                  Most Frequent Questions
                </h3>
                <div className="space-y-3">
                  {questionData.topQuestions.slice(0, 8).map((q, idx) => (
                    <div key={idx} className="border-b border-grey-100 pb-3 last:border-0">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <p className={`text-sm font-medium ${textColor}`}>{q.question}</p>
                          <div className={`flex items-center gap-4 mt-1 text-xs ${secondaryText}`}>
                            <span className="flex items-center gap-1">
                              <MessageSquare className="w-3 h-3" />
                              Asked {q.count}x
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {q.avgResponseTime}ms
                            </span>
                          </div>
                        </div>
                        <div className="text-lg font-bold text-gold-500">{q.count}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Placeholder Notice */}
          <div className={`rounded-lg border p-4 bg-gold-50/50 border-gold-200 text-xs text-gold-600`}>
            <span className="font-semibold">💡 Tip:</span> These analytics are scoped to your tenant account. All metrics reflect your developments and homeowner engagement across the platform.
          </div>
        </div>
      </div>
    </div>
  );
}
