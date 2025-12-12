'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Users, Building2, Home, FileText, MessageSquare, TrendingUp, Activity, ArrowRight } from 'lucide-react';
import { InsightCard } from '@/components/admin-enterprise/InsightCard';
import { SectionHeader } from '@/components/admin-enterprise/SectionHeader';
import { LoadingSkeleton } from '@/components/admin-enterprise/LoadingSkeleton';
import { LineChart } from '@/components/admin-enterprise/charts/LineChart';
import { BarChart } from '@/components/admin-enterprise/charts/BarChart';

interface PlatformMetrics {
  total_developers: number;
  total_developments: number;
  total_units: number;
  total_homeowners: number;
  total_messages: number;
  total_documents: number;
  active_homeowners_7d: number;
  top_5_developments_by_activity: Array<{
    id: string;
    name: string;
    message_count: number;
    homeowner_count: number;
  }>;
}

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

export default function OverviewDashboard() {
  const [platformData, setPlatformData] = useState<PlatformMetrics | null>(null);
  const [chatData, setChatData] = useState<ChatMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);

  const fetchDashboardData = async () => {
    // Prevent concurrent requests
    if (isFetching) return;
    
    setIsFetching(true);
    try {
      const [overview, usage, messageVolume, topQuestions, topDevelopments] = await Promise.all([
        fetch('/api/analytics/platform/overview').then((res) => {
          if (!res.ok) throw new Error('Failed to fetch platform metrics');
          return res.json();
        }),
        fetch('/api/analytics/platform/usage?days=30').then((res) => {
          if (!res.ok) throw new Error('Failed to fetch usage metrics');
          return res.json();
        }),
        fetch('/api/analytics/platform/message-volume?days=30').then((res) => {
          if (!res.ok) throw new Error('Failed to fetch message volume');
          return res.json();
        }),
        fetch('/api/analytics/platform/top-questions?days=30').then((res) => {
          if (!res.ok) throw new Error('Failed to fetch top questions');
          return res.json();
        }),
        fetch('/api/analytics/platform/top-developments?limit=5').then((res) => {
          if (!res.ok) throw new Error('Failed to fetch top developments');
          return res.json();
        }),
      ]);

      setPlatformData({
        ...overview,
        top_5_developments_by_activity: topDevelopments?.data || topDevelopments || [],
      });
      
      // Calculate cost by day from message volume
      const costByDay = (messageVolume?.data || messageVolume || []).map((point: any) => ({
        date: point.date,
        cost: (point.count * 0.002) / 1000, // Rough estimate
      }));

      setChatData({
        total_messages: usage?.total_messages || 0,
        message_count_by_day: messageVolume?.data || messageVolume || [],
        avg_response_latency_ms: usage?.avg_response_time_ms || 0,
        total_tokens_used: usage?.total_tokens || 0,
        total_cost_usd: usage?.estimated_cost_usd || 0,
        cost_by_day: costByDay,
        top_questions_global: topQuestions?.data || topQuestions || [],
      });
      
      setLoading(false);
      setError(null);
    } catch (err) {
      console.error('Dashboard error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setLoading(false);
    } finally {
      setIsFetching(false);
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchDashboardData();

    // Auto-refresh every 5 seconds for real-time updates
    const intervalId = setInterval(() => {
      fetchDashboardData();
    }, 5000);

    // Cleanup interval on unmount
    return () => clearInterval(intervalId);
  }, []);

  if (loading) {
    return (
      <div className="p-8 bg-gray-50 min-h-screen">
        <LoadingSkeleton />
      </div>
    );
  }

  if (error || !platformData || !chatData) {
    return (
      <div className="p-8 bg-gray-50 min-h-screen">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-600 font-medium">Failed to load dashboard</p>
          <p className="text-red-500 text-sm mt-2">{error || 'Unknown error'}</p>
        </div>
      </div>
    );
  }

  const messageVolumeData = chatData.message_count_by_day.slice(-14).map((d) => ({
    date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    value: d.count,
  }));

  const developmentActivityData = (platformData.top_5_developments_by_activity || [])
    .filter((d) => d && d.name)
    .map((d) => ({
      name: d.name.length > 15 ? d.name.substring(0, 15) + '...' : d.name,
      value: d.message_count || 0,
    }));

  const activeHomeownerRate =
    platformData.total_homeowners > 0
      ? Math.round((platformData.active_homeowners_7d / platformData.total_homeowners) * 100)
      : 0;

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <SectionHeader
        title="Overview Dashboard"
        description="Enterprise control center for OpenHouse AI platform"
      />

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <InsightCard
          title="Total Developments"
          value={platformData.total_developments}
          subtitle={`${platformData.total_developers} tenant${platformData.total_developers !== 1 ? 's' : ''}`}
          icon={<Building2 className="w-5 h-5" />}
        />
        <InsightCard
          title="Total Units"
          value={platformData.total_units}
          subtitle={`${platformData.total_homeowners} homeowners`}
          icon={<Home className="w-5 h-5" />}
        />
        <InsightCard
          title="Total Messages"
          value={platformData.total_messages}
          subtitle="All-time conversations"
          icon={<MessageSquare className="w-5 h-5" />}
        />
        <InsightCard
          title="Active Homeowners"
          value={platformData.active_homeowners_7d}
          subtitle={`${activeHomeownerRate}% activity rate (7d)`}
          icon={<Activity className="w-5 h-5" />}
          trend={{
            value: activeHomeownerRate,
            label: 'Last 7 days',
          }}
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Message Volume Chart */}
        <div className="bg-white border border-gold-100 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-gold-600" />
            <h3 className="text-lg font-semibold text-gray-900">Message Volume (14 Days)</h3>
          </div>
          <LineChart
            data={messageVolumeData}
            dataKey="value"
            xAxisKey="date"
          />
        </div>

        {/* Top Developments */}
        <div className="bg-white border border-gold-100 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="w-5 h-5 text-gold-600" />
            <h3 className="text-lg font-semibold text-gray-900">Top 5 Developments by Messages</h3>
          </div>
          <BarChart
            data={developmentActivityData}
            dataKey="value"
            xAxisKey="name"
          />
        </div>
      </div>

      {/* AI Usage & Costs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">AI Usage & Costs (30 Days)</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-gray-200">
              <span className="text-gray-600">Total Messages</span>
              <span className="text-2xl font-bold text-gray-900">
                {chatData.total_messages.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center pb-3 border-b border-gray-200">
              <span className="text-gray-600">Total Tokens</span>
              <span className="text-lg font-semibold text-gray-700">
                {chatData.total_tokens_used.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center pb-3 border-b border-gray-200">
              <span className="text-gray-600">Avg Latency</span>
              <span className="text-lg font-semibold text-gray-700">
                {chatData.avg_response_latency_ms}ms
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Total Cost</span>
              <span className="text-2xl font-bold text-gold-600">
                ${chatData.total_cost_usd.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Top Questions */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Questions</h3>
          <div className="space-y-2">
            {(Array.isArray(chatData.top_questions_global) ? chatData.top_questions_global : []).slice(0, 5).map((q, idx) => (
              <div key={idx} className="flex items-start gap-3 pb-2 border-b border-gray-100 last:border-0">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gold-100 text-gold-700 text-xs font-bold flex items-center justify-center">
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 truncate">{q.question}</p>
                  <p className="text-xs text-gray-500">{q.count} times</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Documents Summary */}
      <div className="bg-white border border-gold-100 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-5 h-5 text-gold-600" />
          <h3 className="text-lg font-semibold text-gray-900">Platform Summary</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <p className="text-3xl font-bold text-gray-900">{platformData.total_documents}</p>
            <p className="text-sm text-gray-600 mt-1">Total Documents</p>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <p className="text-3xl font-bold text-gray-900">{platformData.total_units}</p>
            <p className="text-sm text-gray-600 mt-1">Properties</p>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <p className="text-3xl font-bold text-gray-900">{platformData.total_homeowners}</p>
            <p className="text-sm text-gray-600 mt-1">Homeowners</p>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <p className="text-3xl font-bold text-gray-900">{platformData.total_developments}</p>
            <p className="text-sm text-gray-600 mt-1">Developments</p>
          </div>
        </div>
      </div>

      {/* Quick Access to Developer Dashboard */}
      <Link href="/developer">
        <div className="bg-gradient-to-r from-gold-50 to-amber-50 border border-gold-200 rounded-lg p-6 shadow-sm hover:shadow-md hover:border-gold-400 transition-all cursor-pointer">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gold-100 rounded-lg">
                <Building2 className="w-6 h-6 text-gold-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Developer Dashboard</h3>
                <p className="text-sm text-gray-600 mt-1">View developer portal, developments, and team metrics</p>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-gold-600 group-hover:translate-x-1 transition" />
          </div>
        </div>
      </Link>
    </div>
  );
}
