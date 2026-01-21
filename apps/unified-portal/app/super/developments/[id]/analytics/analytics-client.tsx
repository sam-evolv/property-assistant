'use client';

import { useState, useEffect } from 'react';
import { LineChart } from '@/components/admin-enterprise/charts/LineChart';
import { BarChart } from '@/components/admin-enterprise/charts/BarChart';

interface DevelopmentAnalytics {
  timeline: {
    messageVolume30d: Array<{ date: string; count: number }>;
    messageVolume60d: Array<{ date: string; count: number }>;
    messageVolume90d: Array<{ date: string; count: number }>;
    messageVolume180d: Array<{ date: string; count: number }>;
    documentUploads: Array<{ date: string; count: number; doc_names: string[] }>;
    homeownerOnboarding: Array<{ date: string; count: number; homeowner_names: string[] }>;
    milestones: Array<{ date: string; event: string; description: string }>;
  };
}

export default function DevelopmentAnalyticsClient({
  developmentId,
  developmentName,
}: {
  developmentId: string;
  developmentName: string;
}) {
  const [activeTab, setActiveTab] = useState<'timeline' | 'units' | 'homeowners' | 'documents' | 'rag' | 'chat' | 'maps' | 'errors'>('timeline');
  const [timeRange, setTimeRange] = useState<30 | 60 | 90 | 180>(30);
  const [analytics, setAnalytics] = useState<DevelopmentAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        const response = await fetch(`/api/super/developments/${developmentId}/analytics?tab=${activeTab}`);
        const data = await response.json();
        setAnalytics(data);
      } catch (error) {
        console.error('Failed to fetch development analytics:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchAnalytics();
  }, [developmentId, activeTab]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-gold border-r-transparent"></div>
          <p className="mt-4 text-gray-400">Loading analytics...</p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'timeline', name: 'Timeline', icon: null },
    { id: 'units', name: 'Units', icon: null },
    { id: 'homeowners', name: 'Homeowners', icon: null },
    { id: 'documents', name: 'Documents', icon: null },
    { id: 'rag', name: 'RAG Index', icon: null },
    { id: 'chat', name: 'Chat Analytics', icon: null },
    { id: 'maps', name: 'Maps', icon: null },
    { id: 'errors', name: 'System Health', icon: null },
  ] as const;

  const messageVolumeData = analytics?.timeline?.[`messageVolume${timeRange}d` as keyof typeof analytics.timeline] as Array<{ date: string; count: number }> || [];
  const chartData = messageVolumeData.map(d => ({
    name: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    value: d.count
  }));

  const documentData = (analytics?.timeline?.documentUploads || []).map(d => ({
    name: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    value: d.count
  }));

  const homeownerData = (analytics?.timeline?.homeownerOnboarding || []).map(d => ({
    name: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    value: d.count
  }));

  return (
    <div className="min-h-screen bg-black p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2 bg-gradient-to-r from-white via-gold to-white bg-clip-text text-transparent">
            {developmentName} Analytics
          </h1>
          <p className="text-gray-400">Deep-dive development intelligence and insights</p>
        </div>

        <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 border border-gray-700 rounded-xl p-2 mb-8">
          <div className="flex overflow-x-auto space-x-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`px-6 py-3 rounded-lg text-sm font-medium transition-all duration-300 whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-gold-400 to-gold-600 text-black shadow-lg shadow-gold-500/30'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.name}
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'timeline' && (
          <div className="space-y-8">
            <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 border border-gray-700 rounded-xl p-6 shadow-xl">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                  <span className="h-1 w-8 bg-gradient-to-r from-gold-400 to-gold-600 rounded"></span>
                  Message Volume
                </h2>
                <div className="flex gap-2">
                  {[30, 60, 90, 180].map((days) => (
                    <button
                      key={days}
                      onClick={() => setTimeRange(days as typeof timeRange)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        timeRange === days
                          ? 'bg-gold text-black'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      {days}d
                    </button>
                  ))}
                </div>
              </div>
              <LineChart
                data={chartData}
                xKey="name"
                lines={[{ key: 'value', color: '#D4AF37', name: 'Messages' }]}
                height={300}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 border border-gray-700 rounded-xl p-6 shadow-xl">
                <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
                  <span className="h-1 w-8 bg-gradient-to-r from-gold-400 to-gold-600 rounded"></span>
                  Document Upload Timeline
                </h2>
                <LineChart
                  data={documentData}
                  xKey="name"
                  lines={[{ key: 'value', color: '#3B82F6', name: 'Documents' }]}
                  height={250}
                />
              </div>

              <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 border border-gray-700 rounded-xl p-6 shadow-xl">
                <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
                  <span className="h-1 w-8 bg-gradient-to-r from-gold-400 to-gold-600 rounded"></span>
                  Homeowner Onboarding
                </h2>
                <BarChart
                  data={homeownerData}
                  xKey="name"
                  bars={[{ key: 'value', color: '#10B981', name: 'Homeowners' }]}
                  height={250}
                />
              </div>
            </div>

            <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 border border-gray-700 rounded-xl p-6 shadow-xl">
              <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
                <span className="h-1 w-8 bg-gradient-to-r from-gold-400 to-gold-600 rounded"></span>
                Milestones & Events
              </h2>
              <div className="space-y-4">
                {(analytics?.timeline?.milestones || []).map((milestone, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-4 p-4 bg-gray-800/50 rounded-lg border border-gray-700 hover:border-gold/50 transition-all"
                  >
                    <div className="flex-shrink-0 w-24 text-sm text-gray-400">
                      {new Date(milestone.date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-white font-semibold mb-1">{milestone.event}</h3>
                      <p className="text-gray-400 text-sm">{milestone.description}</p>
                    </div>
                  </div>
                ))}
                {(!analytics?.timeline?.milestones || analytics.timeline.milestones.length === 0) && (
                  <p className="text-center text-gray-500 py-8">No milestones recorded</p>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab !== 'timeline' && (
          <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 border border-gray-700 rounded-xl p-12 text-center">
            <div className="text-6xl mb-4">{tabs.find(t => t.id === activeTab)?.icon}</div>
            <h3 className="text-2xl font-bold text-white mb-2">{tabs.find(t => t.id === activeTab)?.name}</h3>
            <p className="text-gray-400">This tab is under construction. Coming soon!</p>
          </div>
        )}
      </div>
    </div>
  );
}
