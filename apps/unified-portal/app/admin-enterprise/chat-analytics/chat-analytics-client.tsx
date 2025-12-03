'use client';

import { useEffect, useState } from 'react';
import { MessageSquare, TrendingUp, AlertCircle, DollarSign, Clock, Zap } from 'lucide-react';
import { InsightCard } from '@/components/admin-enterprise/InsightCard';
import { SectionHeader } from '@/components/admin-enterprise/SectionHeader';
import { LoadingSkeleton } from '@/components/admin-enterprise/LoadingSkeleton';
import { LineChart } from '@/components/admin-enterprise/charts/LineChart';
import { BarChart } from '@/components/admin-enterprise/charts/BarChart';

interface ChatMetrics {
  total_messages: number;
  message_count_by_day: Array<{
    date: string;
    count: number;
  }>;
  avg_response_latency_ms: number;
  total_tokens_used: number;
  total_cost_usd: number;
  cost_by_day: Array<{
    date: string;
    cost: number;
  }>;
  top_questions_global: Array<{
    question: string;
    count: number;
  }>;
}

export function ChatAnalytics() {
  const [data, setData] = useState<ChatMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/admin/analytics/chat?days=${days}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch chat analytics');
        return res.json();
      })
      .then(setData)
      .catch((err) => {
        console.error('Chat analytics error:', err);
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [days]);

  if (loading) {
    return (
      <div className="p-8 bg-gray-50 min-h-screen">
        <LoadingSkeleton />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 bg-gray-50 min-h-screen">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <p className="text-red-600 font-medium">Failed to load chat analytics</p>
          <p className="text-red-500 text-sm mt-2">{error || 'Unknown error'}</p>
        </div>
      </div>
    );
  }

  const messageVolumeData = data.message_count_by_day.map((d) => ({
    date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    messages: d.count,
  }));

  const topQuestionsData = data.top_questions_global.slice(0, 10).map((q) => ({
    question: q.question.length > 30 ? q.question.substring(0, 30) + '...' : q.question,
    count: q.count,
  }));

  const costByDayData = data.cost_by_day.map((d) => ({
    date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    cost: parseFloat(d.cost.toFixed(4)),
  }));

  const avgMessagesPerDay =
    data.message_count_by_day.length > 0
      ? Math.round(
          data.message_count_by_day.reduce((sum, d) => sum + d.count, 0) /
            data.message_count_by_day.length
        )
      : 0;

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <SectionHeader
        title="Chat Analytics"
        description={`Insights from ${data.total_messages.toLocaleString()} chat messages`}
        action={
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-gold-500 transition-all font-medium"
          >
            <option value={7}>Last 7 Days</option>
            <option value={30}>Last 30 Days</option>
            <option value={90}>Last 90 Days</option>
          </select>
        }
      />

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <InsightCard
          title="Total Messages"
          value={data.total_messages}
          subtitle={`~${avgMessagesPerDay}/day average`}
          icon={<MessageSquare className="w-5 h-5" />}
        />
        <InsightCard
          title="Avg Latency"
          value={`${data.avg_response_latency_ms}ms`}
          subtitle="Response time"
          icon={<Clock className="w-5 h-5" />}
        />
        <InsightCard
          title="Total Tokens"
          value={data.total_tokens_used.toLocaleString()}
          subtitle="All conversations"
          icon={<Zap className="w-5 h-5" />}
        />
        <InsightCard
          title="Total Cost"
          value={`$${data.total_cost_usd.toFixed(2)}`}
          subtitle={`${days} days period`}
          icon={<DollarSign className="w-5 h-5" />}
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Daily Message Volume */}
        <div className="bg-white border border-gold-100 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-gold-600" />
            <h3 className="text-lg font-semibold text-gray-900">Daily Message Volume</h3>
          </div>
          <LineChart
            data={messageVolumeData}
            xKey="date"
            lines={[{ key: 'messages', color: '#D4AF37', name: 'Messages' }]}
            height={280}
          />
        </div>

        {/* Cost Trend */}
        <div className="bg-white border border-gold-100 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 mb-4">
            <DollarSign className="w-5 h-5 text-gold-600" />
            <h3 className="text-lg font-semibold text-gray-900">Daily Cost Trend</h3>
          </div>
          <LineChart
            data={costByDayData}
            xKey="date"
            lines={[{ key: 'cost', color: '#B8934C', name: 'Cost (USD)' }]}
            height={280}
          />
        </div>
      </div>

      {/* Top Questions Chart */}
      <div className="bg-white border border-gold-100 rounded-lg p-6 mb-8 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare className="w-5 h-5 text-gold-600" />
          <h3 className="text-lg font-semibold text-gray-900">Top 10 Questions</h3>
        </div>
        <BarChart
          data={topQuestionsData}
          xKey="question"
          bars={[{ key: 'count', color: '#8b5cf6', name: 'Frequency' }]}
          height={320}
        />
      </div>

      {/* Detailed Top Questions List */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">All Top Questions</h3>
        <div className="space-y-2">
          {data.top_questions_global.slice(0, 20).map((q, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between py-3 px-4 border-b border-gray-100 hover:bg-gray-50 transition-colors last:border-0"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-gold-50 text-gold-500 text-sm font-bold flex items-center justify-center">
                  {idx + 1}
                </span>
                <span className="text-gray-700 text-sm truncate">{q.question}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gold-500 font-semibold">{q.count}</span>
                <span className="text-gray-500 text-sm">times</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
