'use client';

import { useEffect, useState, memo, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Plus, Users, Building2, MessageSquare, TrendingUp, ArrowRight, FileText, Settings } from 'lucide-react';
import Link from 'next/link';
import { ChartLoadingSkeleton } from '@/components/ui/ChartLoadingSkeleton';

const DashboardBarChart = dynamic(
  () => import('./dashboard-charts').then(mod => ({ default: mod.DashboardBarChart })),
  { ssr: false, loading: () => <ChartLoadingSkeleton height={250} /> }
);

const DashboardPieChart = dynamic(
  () => import('./dashboard-charts').then(mod => ({ default: mod.DashboardPieChart })),
  { ssr: false, loading: () => <ChartLoadingSkeleton height={250} /> }
);

interface DashboardStats {
  activeDevelopments: number;
  totalUnits: number;
  activeHomeowners: number;
  chatSessionsWeek: number;
  developmentGrowth: number;
  homeownerGrowth: number;
  totalMessages: number;
  totalDocuments: number;
}

const mockChartData = [
  { date: 'Mon', chats: 24, messages: 12 },
  { date: 'Tue', chats: 32, messages: 18 },
  { date: 'Wed', chats: 28, messages: 15 },
  { date: 'Thu', chats: 41, messages: 22 },
  { date: 'Fri', chats: 35, messages: 19 },
  { date: 'Sat', chats: 18, messages: 10 },
  { date: 'Sun', chats: 12, messages: 8 },
];

const mockOnboardingData = [
  { name: 'Completed', value: 245, color: '#D4AF37' },
  { name: 'In Progress', value: 38, color: '#93C5FD' },
  { name: 'Pending', value: 17, color: '#D1D5DB' },
];

export default function DeveloperDashboardClient({ developerName = 'Developer', isDarkMode = false, tenantId }: { developerName?: string; isDarkMode?: boolean; tenantId?: string }) {
  const [stats, setStats] = useState<DashboardStats>({
    activeDevelopments: 0,
    totalUnits: 0,
    activeHomeowners: 0,
    chatSessionsWeek: 0,
    developmentGrowth: 0,
    homeownerGrowth: 0,
    totalMessages: 0,
    totalDocuments: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Fetch platform stats - this endpoint doesn't require tenantId filtering
        const response = await fetch(`/api/analytics/platform/overview`);
        if (response.ok) {
          const data = await response.json();
          setStats({
            activeDevelopments: data.total_developments || 0,
            totalUnits: data.total_units || 0,
            activeHomeowners: data.active_homeowners_7d || 0,
            chatSessionsWeek: data.total_messages || 0,
            developmentGrowth: 12,
            homeownerGrowth: 18,
            totalMessages: data.total_messages || 0,
            totalDocuments: data.total_documents || 0,
          });
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const bgColor = isDarkMode ? 'bg-gray-900' : 'bg-gradient-to-br from-gray-50 to-white';
  const cardBg = isDarkMode ? 'bg-gray-800/50 border-gray-700' : 'bg-white/80 border-gray-200';
  const textColor = isDarkMode ? 'text-white' : 'text-gray-900';
  const secondaryText = isDarkMode ? 'text-gray-300' : 'text-gray-600';

  if (loading) {
    return (
      <div className={`min-h-full flex flex-col ${bgColor}`}>
        <div className="px-8 py-8 flex-1">
          <div className="max-w-7xl mx-auto space-y-8">
            <div className="h-12 bg-gray-300 rounded-lg animate-pulse" />
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-gray-300 rounded-lg animate-pulse" />)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-full flex flex-col ${bgColor}`}>
      {/* Header */}
      <div className={`border-b ${isDarkMode ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-white/50'} px-8 py-6 backdrop-blur-sm`}>
        <div className="max-w-7xl mx-auto">
          <h1 className={`text-3xl font-bold ${textColor}`}>Developer Dashboard</h1>
          <p className={`${secondaryText} text-sm mt-1`}>Welcome back! Here's your property development overview.</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-8 py-8 flex-1">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className={`rounded-lg border p-6 backdrop-blur-sm transition hover:shadow-md ${cardBg}`}>
              <div className="flex items-center justify-between mb-4">
                <Building2 className="w-5 h-5 text-gold-500" />
                <span className="text-xs font-semibold text-green-600 bg-green-500/10 px-2 py-1 rounded-full">+12%</span>
              </div>
              <p className={`${secondaryText} text-xs uppercase tracking-wide mb-1`}>Active Developments</p>
              <p className={`text-3xl font-bold ${textColor}`}>{stats.activeDevelopments}</p>
              <p className={`${secondaryText} text-xs mt-2`}>Longview Estates & more</p>
            </div>

            <div className={`rounded-lg border p-6 backdrop-blur-sm transition hover:shadow-md ${cardBg}`}>
              <div className="flex items-center justify-between mb-4">
                <Users className="w-5 h-5 text-blue-500" />
                <span className="text-xs font-semibold text-green-600 bg-green-500/10 px-2 py-1 rounded-full">+8%</span>
              </div>
              <p className={`${secondaryText} text-xs uppercase tracking-wide mb-1`}>Total Units</p>
              <p className={`text-3xl font-bold ${textColor}`}>{stats.totalUnits}</p>
              <p className={`${secondaryText} text-xs mt-2`}>Active properties</p>
            </div>

            <div className={`rounded-lg border p-6 backdrop-blur-sm transition hover:shadow-md ${cardBg}`}>
              <div className="flex items-center justify-between mb-4">
                <MessageSquare className="w-5 h-5 text-purple-500" />
                <span className="text-xs font-semibold text-green-600 bg-green-500/10 px-2 py-1 rounded-full">+24%</span>
              </div>
              <p className={`${secondaryText} text-xs uppercase tracking-wide mb-1`}>Total Messages</p>
              <p className={`text-3xl font-bold ${textColor}`}>{stats.totalMessages}</p>
              <p className={`${secondaryText} text-xs mt-2`}>Last 30 days</p>
            </div>

            <div className={`rounded-lg border p-6 backdrop-blur-sm transition hover:shadow-md ${cardBg}`}>
              <div className="flex items-center justify-between mb-4">
                <TrendingUp className="w-5 h-5 text-pink-500" />
                <span className="text-xs font-semibold text-green-600 bg-green-500/10 px-2 py-1 rounded-full">+18%</span>
              </div>
              <p className={`${secondaryText} text-xs uppercase tracking-wide mb-1`}>Active Homeowners</p>
              <p className={`text-3xl font-bold ${textColor}`}>{stats.activeHomeowners}</p>
              <p className={`${secondaryText} text-xs mt-2`}>This week</p>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className={`rounded-lg border p-6 backdrop-blur-sm ${cardBg}`}>
              <h2 className={`text-lg font-semibold ${textColor} mb-4`}>Chat Activity</h2>
              <DashboardBarChart data={mockChartData} isDarkMode={isDarkMode} height={250} />
            </div>

            <div className={`rounded-lg border p-6 backdrop-blur-sm ${cardBg}`}>
              <h2 className={`text-lg font-semibold ${textColor} mb-4`}>Onboarding Progress</h2>
              <DashboardPieChart data={mockOnboardingData} height={250} />
            </div>
          </div>

          {/* Quick Actions */}
          <div className={`rounded-lg border p-6 backdrop-blur-sm ${cardBg}`}>
            <h2 className={`text-lg font-semibold ${textColor} mb-4`}>Quick Actions</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Link href="/developer/analytics">
                <button className={`w-full flex items-center justify-between p-3 rounded-lg border transition ${
                  isDarkMode
                    ? 'border-gray-600 text-gray-300 hover:bg-gray-700'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-100'
                }`}>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    <span className="text-sm">Full Analytics</span>
                  </div>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </Link>

              <Link href="/developer/insights">
                <button className={`w-full flex items-center justify-between p-3 rounded-lg border transition ${
                  isDarkMode
                    ? 'border-gray-600 text-gray-300 hover:bg-gray-700'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-100'
                }`}>
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    <span className="text-sm">AI Insights & FAQs</span>
                  </div>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </Link>

              <button className={`w-full flex items-center justify-between p-3 rounded-lg border transition ${
                isDarkMode
                  ? 'border-gray-600 text-gray-300 hover:bg-gray-700'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-100'
              }`}>
                <div className="flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  <span className="text-sm">Settings</span>
                </div>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
