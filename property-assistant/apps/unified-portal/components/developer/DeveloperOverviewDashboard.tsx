'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Plus, Users, Building2, MessageSquare, TrendingUp, ArrowRight, FileText, Settings, BarChart3 } from 'lucide-react';

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

export default function DeveloperOverviewDashboard({ developerName = 'Developer', isDarkMode = false, tenantId }: { developerName?: string; isDarkMode?: boolean; tenantId?: string }) {
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
      if (!tenantId) {
        setLoading(false);
        return;
      }
      
      try {
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
  }, [tenantId]);

  const bgColor = isDarkMode ? 'bg-grey-900' : 'bg-gradient-to-br from-white via-grey-50 to-white';
  const cardBg = isDarkMode ? 'bg-grey-800/50 border-grey-700' : 'bg-white/80 border-gold-200/30';
  const textColor = isDarkMode ? 'text-white' : 'text-grey-900';
  const secondaryText = isDarkMode ? 'text-grey-400' : 'text-grey-600';

  if (loading) {
    return (
      <div className={`min-h-full flex flex-col ${bgColor}`}>
        <div className="px-8 py-8 flex-1">
          <div className="max-w-7xl mx-auto space-y-8">
            <div className="h-12 bg-grey-200 rounded-lg animate-pulse" />
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-grey-200 rounded-lg animate-pulse" />)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-full flex flex-col ${bgColor}`}>
      {/* Header Section */}
      <div className={`border-b border-gold-200/30 px-8 py-6 backdrop-blur-sm bg-white/50`}>
        <div className="max-w-7xl mx-auto">
          <h1 className={`text-3xl font-bold ${textColor} mb-2`}>Welcome back, {developerName}</h1>
          <p className={`${secondaryText} text-sm`}>Manage your developments, homeowners, and monitor platform activity</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-8 py-8 flex-1">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* KPI Cards Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Active Developments */}
            <div className={`rounded-lg border p-6 backdrop-blur-sm transition hover:shadow-md ${cardBg}`}>
              <div className="flex items-center justify-between mb-4">
                <Building2 className="w-5 h-5 text-gold-500" />
                <span className="text-xs font-semibold text-gold-600 bg-gold-50 px-2 py-1 rounded-full">
                  +{stats.developmentGrowth}%
                </span>
              </div>
              <p className={`${secondaryText} text-xs uppercase tracking-wide mb-1`}>Active Developments</p>
              <p className={`text-3xl font-bold ${textColor}`}>{stats.activeDevelopments}</p>
              <p className={`${secondaryText} text-xs mt-2`}>Projects in portfolio</p>
            </div>

            {/* Total Units */}
            <div className={`rounded-lg border p-6 backdrop-blur-sm transition hover:shadow-md ${cardBg}`}>
              <div className="flex items-center justify-between mb-4">
                <TrendingUp className="w-5 h-5 text-gold-500" />
                <span className="text-xs font-semibold text-gold-600 bg-gold-50 px-2 py-1 rounded-full">
                  +8%
                </span>
              </div>
              <p className={`${secondaryText} text-xs uppercase tracking-wide mb-1`}>Total Units</p>
              <p className={`text-3xl font-bold ${textColor}`}>{stats.totalUnits}</p>
              <p className={`${secondaryText} text-xs mt-2`}>Homes onboarded</p>
            </div>

            {/* Total Messages */}
            <div className={`rounded-lg border p-6 backdrop-blur-sm transition hover:shadow-md ${cardBg}`}>
              <div className="flex items-center justify-between mb-4">
                <MessageSquare className="w-5 h-5 text-gold-500" />
                <span className="text-xs font-semibold text-gold-600 bg-gold-50 px-2 py-1 rounded-full">
                  +24%
                </span>
              </div>
              <p className={`${secondaryText} text-xs uppercase tracking-wide mb-1`}>Total Messages</p>
              <p className={`text-3xl font-bold ${textColor}`}>{stats.totalMessages}</p>
              <p className={`${secondaryText} text-xs mt-2`}>Last 30 days</p>
            </div>

            {/* Active Homeowners */}
            <div className={`rounded-lg border p-6 backdrop-blur-sm transition hover:shadow-md ${cardBg}`}>
              <div className="flex items-center justify-between mb-4">
                <Users className="w-5 h-5 text-gold-500" />
                <span className="text-xs font-semibold text-gold-600 bg-gold-50 px-2 py-1 rounded-full">
                  +{stats.homeownerGrowth}%
                </span>
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
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={mockChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#D1D5DB" />
                  <XAxis stroke="#6B7280" />
                  <YAxis stroke="#6B7280" />
                  <Tooltip contentStyle={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '8px', color: '#111827' }} />
                  <Bar dataKey="chats" fill="#D4AF37" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className={`rounded-lg border p-6 backdrop-blur-sm ${cardBg}`}>
              <h2 className={`text-lg font-semibold ${textColor} mb-4`}>Onboarding Progress</h2>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={mockOnboardingData} cx="50%" cy="50%" innerRadius={80} outerRadius={120} paddingAngle={2} dataKey="value">
                    {mockOnboardingData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Quick Actions */}
          <div className={`rounded-lg border p-6 backdrop-blur-sm ${cardBg}`}>
            <h2 className={`text-lg font-semibold ${textColor} mb-4`}>Quick Actions</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Link href="/developer/analytics">
                <button className={`w-full flex items-center justify-between p-3 rounded-lg border transition border-gold-200/30 text-grey-700 hover:bg-gold-50/50`}>
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4" />
                    <span className="text-sm">Full Analytics</span>
                  </div>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </Link>

              <Link href="/developer/insights">
                <button className={`w-full flex items-center justify-between p-3 rounded-lg border transition border-gold-200/30 text-grey-700 hover:bg-gold-50/50`}>
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    <span className="text-sm">AI Insights & FAQs</span>
                  </div>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </Link>

              <button className={`w-full flex items-center justify-between p-3 rounded-lg border transition border-gold-200/30 text-grey-700 hover:bg-gold-50/50`}>
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
