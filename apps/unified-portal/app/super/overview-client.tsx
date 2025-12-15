'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Users, Building2, Home, FileText, MessageSquare, TrendingUp, Activity, ArrowRight, AlertTriangle, Layers, FileUp, Info } from 'lucide-react';
import { InsightCard } from '@/components/admin-enterprise/InsightCard';
import { SectionHeader } from '@/components/admin-enterprise/SectionHeader';
import { LoadingSkeleton } from '@/components/admin-enterprise/LoadingSkeleton';
import { LineChart } from '@/components/admin-enterprise/charts/LineChart';
import { BarChart } from '@/components/admin-enterprise/charts/BarChart';
import { useProjectContext } from '@/contexts/ProjectContext';

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

interface ProjectStatus {
  unitTypesCount: number;
  unitsCount: number;
  setupRequired: boolean;
}

function DisabledCard({ title, icon }: { title: string; icon: React.ReactNode }) {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 opacity-60">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-500">{title}</span>
        <div className="text-gray-400">{icon}</div>
      </div>
      <div className="text-3xl font-bold text-gray-400 mb-1">-</div>
      <p className="text-xs text-gray-400">Not available in project view</p>
    </div>
  );
}

function DisabledChartPanel({ title, icon }: { title: string; icon: React.ReactNode }) {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 opacity-60">
      <div className="flex items-center gap-2 mb-4">
        <div className="text-gray-400">{icon}</div>
        <h3 className="text-lg font-semibold text-gray-400">{title}</h3>
      </div>
      <div className="h-48 flex items-center justify-center">
        <div className="text-center">
          <Info className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400">Available in All Schemes view</p>
        </div>
      </div>
    </div>
  );
}

function DisabledMetricsPanel({ title }: { title: string }) {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 opacity-60">
      <h3 className="text-lg font-semibold text-gray-400 mb-4">{title}</h3>
      <div className="h-40 flex items-center justify-center">
        <div className="text-center">
          <Info className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400">Available in All Schemes view</p>
        </div>
      </div>
    </div>
  );
}

export default function OverviewDashboard() {
  const { selectedProjectId, selectedProject, isLoading: projectLoading } = useProjectContext();
  const [platformData, setPlatformData] = useState<PlatformMetrics | null>(null);
  const [chatData, setChatData] = useState<ChatMetrics | null>(null);
  const [projectStatus, setProjectStatus] = useState<ProjectStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);

  const isProjectScoped = Boolean(selectedProjectId);

  const fetchDashboardData = async () => {
    if (isFetching) return;
    
    setIsFetching(true);
    try {
      const projectParam = selectedProjectId ? `&projectId=${selectedProjectId}` : '';
      
      if (selectedProjectId) {
        const statusRes = await fetch(`/api/projects/${selectedProjectId}/status`);
        if (statusRes.ok) {
          const statusData = await statusRes.json();
          setProjectStatus({
            unitTypesCount: statusData.unitTypesCount || 0,
            unitsCount: statusData.unitsCount || 0,
            setupRequired: statusData.setupRequired || false,
          });
        }
      } else {
        setProjectStatus(null);
      }
      
      const fetchPromises: Promise<any>[] = [
        fetch(`/api/analytics/platform/overview?${projectParam}`).then((res) => {
          if (!res.ok) throw new Error('Failed to fetch platform metrics');
          return res.json();
        }),
      ];

      if (!isProjectScoped) {
        fetchPromises.push(
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
          })
        );
      }

      const results = await Promise.all(fetchPromises);
      const overview = results[0];

      if (!isProjectScoped) {
        const [, usage, messageVolume, topQuestions, topDevelopments] = results;

        setPlatformData({
          ...overview,
          top_5_developments_by_activity: topDevelopments?.data || topDevelopments || [],
        });
        
        const costByDay = (messageVolume?.data || messageVolume || []).map((point: any) => ({
          date: point.date,
          cost: (point.count * 0.002) / 1000,
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
      } else {
        setPlatformData({
          ...overview,
          top_5_developments_by_activity: [],
        });
        setChatData(null);
      }
      
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
    if (projectLoading) return;
    
    fetchDashboardData();

    const intervalId = setInterval(() => {
      fetchDashboardData();
    }, 5000);

    return () => clearInterval(intervalId);
  }, [selectedProjectId, projectLoading]);

  if (loading) {
    return (
      <div className="p-8 bg-gray-50 min-h-screen">
        <LoadingSkeleton />
      </div>
    );
  }

  if (error || !platformData) {
    return (
      <div className="p-8 bg-gray-50 min-h-screen">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-600 font-medium">Failed to load dashboard</p>
          <p className="text-red-500 text-sm mt-2">{error || 'Unknown error'}</p>
        </div>
      </div>
    );
  }

  const messageVolumeData = chatData?.message_count_by_day?.slice(-14).map((d) => ({
    date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    value: d.count,
  })) || [];

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
        description={selectedProject ? `Viewing: ${selectedProject.name}` : 'Enterprise control center for OpenHouse AI platform'}
      />

      {isProjectScoped && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0" />
            <p className="text-sm text-blue-700">
              Project view is active. Some account-level analytics are available in All Schemes view.
            </p>
          </div>
        </div>
      )}

      {projectStatus?.setupRequired && selectedProjectId && (
        <div className="mb-8 bg-amber-50 border border-amber-200 rounded-lg p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-amber-100 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-amber-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-amber-800 mb-2">Setup Required</h3>
              <p className="text-amber-700 text-sm mb-4">
                This project needs additional setup before it can be used. 
                {projectStatus.unitTypesCount === 0 && ' No unit types defined.'}
                {projectStatus.unitsCount === 0 && ' No units imported.'}
              </p>
              <div className="flex gap-3">
                <Link
                  href={`/super/projects/${selectedProjectId}/unit-types`}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm font-medium"
                >
                  <Layers className="w-4 h-4" />
                  Manage Unit Types
                </Link>
                <Link
                  href={`/super/projects/${selectedProjectId}/import-units`}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-amber-300 text-amber-700 rounded-lg hover:bg-amber-50 text-sm font-medium"
                >
                  <FileUp className="w-4 h-4" />
                  Import Units
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Total Developments (All Schemes) or Selected Project card (project-scoped) */}
        {isProjectScoped ? (
          <div className="bg-white border border-gold-200 rounded-lg p-6 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">Selected Project</span>
              <div className="text-gold-600"><Building2 className="w-5 h-5" /></div>
            </div>
            <div className="text-xl font-bold text-gray-900 mb-1 truncate" title={selectedProject?.name || 'Project'}>
              {selectedProject?.name || 'Project'}
            </div>
            <p className="text-xs text-gray-500 truncate" title={selectedProject?.address || ''}>
              {selectedProject?.address || 'No address'}
            </p>
          </div>
        ) : (
          <InsightCard
            title="Total Developments"
            value={platformData.total_developments}
            subtitle={`${platformData.total_developers} tenant${platformData.total_developers !== 1 ? 's' : ''}`}
            icon={<Building2 className="w-5 h-5" />}
          />
        )}
        
        {/* Supabase-backed: Total Units - always available */}
        <InsightCard
          title="Total Units"
          value={platformData.total_units}
          subtitle={isProjectScoped ? 'In this project' : `${platformData.total_homeowners} homeowners`}
          icon={<Home className="w-5 h-5" />}
        />
        
        {/* Drizzle-backed: Total Messages - disabled when project-scoped */}
        {isProjectScoped ? (
          <DisabledCard 
            title="Total Messages" 
            icon={<MessageSquare className="w-5 h-5" />} 
          />
        ) : (
          <InsightCard
            title="Total Messages"
            value={platformData.total_messages}
            subtitle="All-time conversations"
            icon={<MessageSquare className="w-5 h-5" />}
          />
        )}
        
        {/* Drizzle-backed: Active Homeowners - disabled when project-scoped */}
        {isProjectScoped ? (
          <DisabledCard 
            title="Active Homeowners" 
            icon={<Activity className="w-5 h-5" />} 
          />
        ) : (
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
        )}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Drizzle-backed: Message Volume Chart - disabled when project-scoped */}
        {isProjectScoped ? (
          <DisabledChartPanel 
            title="Message Volume (14 Days)" 
            icon={<TrendingUp className="w-5 h-5" />} 
          />
        ) : (
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
        )}

        {/* Drizzle-backed: Top Developments - disabled when project-scoped */}
        {isProjectScoped ? (
          <DisabledChartPanel 
            title="Top 5 Developments by Messages" 
            icon={<Building2 className="w-5 h-5" />} 
          />
        ) : (
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
        )}
      </div>

      {/* AI Usage & Costs - Drizzle-backed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {isProjectScoped ? (
          <DisabledMetricsPanel title="AI Usage & Costs (30 Days)" />
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">AI Usage & Costs (30 Days)</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                <span className="text-gray-600">Total Messages</span>
                <span className="text-2xl font-bold text-gray-900">
                  {chatData?.total_messages.toLocaleString() || 0}
                </span>
              </div>
              <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                <span className="text-gray-600">Total Tokens</span>
                <span className="text-lg font-semibold text-gray-700">
                  {chatData?.total_tokens_used.toLocaleString() || 0}
                </span>
              </div>
              <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                <span className="text-gray-600">Avg Latency</span>
                <span className="text-lg font-semibold text-gray-700">
                  {chatData?.avg_response_latency_ms || 0}ms
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Total Cost</span>
                <span className="text-2xl font-bold text-gold-600">
                  ${chatData?.total_cost_usd.toFixed(2) || '0.00'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Top Questions - Drizzle-backed */}
        {isProjectScoped ? (
          <DisabledMetricsPanel title="Top Questions" />
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Questions</h3>
            <div className="space-y-2">
              {(Array.isArray(chatData?.top_questions_global) ? chatData.top_questions_global : []).slice(0, 5).map((q, idx) => (
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
        )}
      </div>

      {/* Documents Summary - Supabase-backed: always available */}
      <div className="bg-white border border-gold-100 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-5 h-5 text-gold-600" />
          <h3 className="text-lg font-semibold text-gray-900">
            {isProjectScoped ? 'Project Summary' : 'Platform Summary'}
          </h3>
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
          {isProjectScoped ? (
            <>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-3xl font-bold text-gray-900">{projectStatus?.unitTypesCount || 0}</p>
                <p className="text-sm text-gray-600 mt-1">Unit Types</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-3xl font-bold text-gray-900">1</p>
                <p className="text-sm text-gray-600 mt-1">Project</p>
              </div>
            </>
          ) : (
            <>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-3xl font-bold text-gray-900">{platformData.total_homeowners}</p>
                <p className="text-sm text-gray-600 mt-1">Homeowners</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-3xl font-bold text-gray-900">{platformData.total_developments}</p>
                <p className="text-sm text-gray-600 mt-1">Developments</p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Quick Access to Developer Dashboard */}
      <Link href="/developer">
        <div className="mt-6 bg-gradient-to-r from-gold-50 to-amber-50 border border-gold-200 rounded-lg p-6 shadow-sm hover:shadow-md hover:border-gold-400 transition-all cursor-pointer">
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
