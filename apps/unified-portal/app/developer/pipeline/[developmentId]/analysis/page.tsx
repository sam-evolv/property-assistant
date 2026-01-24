'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';

// =============================================================================
// Design Tokens - OpenHouse Brand
// =============================================================================

const tokens = {
  gold: '#D4A853',
  goldLight: '#e8c878',
  goldDark: '#b8923f',
  dark: '#1a1a1a',
  darker: '#0f0f0f',
  cream: '#fafaf8',
  warmGray: '#f7f6f3',
  textPrimary: '#1a1a1a',
  textSecondary: '#6b7280',
  textMuted: '#9ca3af',
  success: '#22c55e',
  warning: '#f97316',
  danger: '#ef4444',
  border: 'rgba(0,0,0,0.05)',
  borderLight: '#e5e7eb',
};

// =============================================================================
// Icons
// =============================================================================

const BackIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
  </svg>
);

const AlertIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);

const ClockIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const UsersIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);

const ChartIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

// =============================================================================
// Types
// =============================================================================

interface Development {
  id: string;
  name: string;
  code: string;
}

type TabId = 'alerts' | 'bottlenecks' | 'solicitors' | 'comparison';

// =============================================================================
// Main Page Component
// =============================================================================

export default function AnalysisPage() {
  const params = useParams();
  const router = useRouter();
  const developmentId = params.developmentId as string;

  const [development, setDevelopment] = useState<Development | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>('alerts');

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch(`/api/pipeline/${developmentId}`);
      if (!response.ok) throw new Error('Failed to fetch data');
      const data = await response.json();
      setDevelopment(data.development);
    } catch {
      // Handle error
    } finally {
      setIsLoading(false);
    }
  }, [developmentId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'alerts', label: 'Alerts', icon: <AlertIcon /> },
    { id: 'bottlenecks', label: 'Bottlenecks', icon: <ClockIcon /> },
    { id: 'solicitors', label: 'Solicitors', icon: <UsersIcon /> },
    { id: 'comparison', label: 'Comparison', icon: <ChartIcon /> },
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: tokens.cream, fontFamily: "'DM Sans', sans-serif" }}>
        <style jsx global>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap');`}</style>
        <div className="text-center">
          <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin mx-auto" style={{ borderColor: tokens.gold, borderTopColor: 'transparent' }} />
          <p className="text-sm text-gray-500 mt-3">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap');
      `}</style>

      <div className="min-h-screen" style={{ backgroundColor: tokens.cream, fontFamily: "'DM Sans', sans-serif" }}>
        <div className="p-8">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <button
              onClick={() => router.push(`/developer/pipeline/${developmentId}`)}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-gray-200/80 text-gray-500 hover:text-gray-700 hover:border-gray-300 hover:shadow-sm transition-all"
            >
              <BackIcon />
            </button>
            <div>
              <h1 className="text-2xl font-bold" style={{ color: tokens.dark }}>Pipeline Analysis</h1>
              <p className="text-sm text-gray-500 mt-0.5">{development?.name || 'Development'}</p>
            </div>
          </div>

          {/* Executive Summary */}
          <div
            className="rounded-2xl p-6 mb-8"
            style={{
              background: `linear-gradient(135deg, ${tokens.dark} 0%, #111827 100%)`,
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
            }}
          >
            <h2 className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: tokens.gold }}>Executive Summary</h2>
            <div className="grid grid-cols-4 gap-6">
              <div>
                <p className="text-2xl font-bold text-white">87%</p>
                <p className="text-xs text-gray-400 mt-1">On Track</p>
              </div>
              <div>
                <p className="text-2xl font-bold" style={{ color: tokens.warning }}>3</p>
                <p className="text-xs text-gray-400 mt-1">Stuck Units</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-white">14 days</p>
                <p className="text-xs text-gray-400 mt-1">Avg. Stage Time</p>
              </div>
              <div>
                <p className="text-2xl font-bold" style={{ color: tokens.success }}>92%</p>
                <p className="text-xs text-gray-400 mt-1">Query Resolution</p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-2 mb-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? 'text-white shadow-md'
                    : 'bg-white text-gray-600 border border-gray-200/80 hover:border-gray-300'
                }`}
                style={activeTab === tab.id ? { backgroundColor: tokens.gold, color: tokens.dark } : {}}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            {activeTab === 'alerts' && (
              <div>
                <h3 className="text-base font-bold mb-4" style={{ color: tokens.dark }}>Active Alerts</h3>
                <div className="space-y-3">
                  {[
                    { unit: 'Unit 12A', issue: 'Stuck at Contracts Issued for 28 days', severity: 'high' },
                    { unit: 'Unit 8B', issue: 'Slow solicitor response (avg 12 days)', severity: 'medium' },
                    { unit: 'Unit 15D', issue: '3 unresolved queries', severity: 'medium' },
                  ].map((alert, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-4 p-4 rounded-xl border"
                      style={{
                        borderColor: alert.severity === 'high' ? '#fecaca' : '#fde68a',
                        backgroundColor: alert.severity === 'high' ? '#fef2f2' : '#fffbeb',
                      }}
                    >
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{
                          backgroundColor: alert.severity === 'high' ? '#fee2e2' : '#fef3c7',
                          color: alert.severity === 'high' ? tokens.danger : tokens.warning,
                        }}
                      >
                        <AlertIcon />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold" style={{ color: tokens.dark }}>{alert.unit}</p>
                        <p className="text-xs text-gray-500">{alert.issue}</p>
                      </div>
                      <button
                        className="px-3 py-1.5 text-xs font-medium rounded-lg transition-all"
                        style={{ backgroundColor: tokens.gold, color: tokens.dark }}
                      >
                        View
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'bottlenecks' && (
              <div>
                <h3 className="text-base font-bold mb-4" style={{ color: tokens.dark }}>Stage Duration Analysis</h3>
                <div className="space-y-4">
                  {[
                    { stage: 'Contracts Issued → Signed', avg: 18, target: 14, units: 5 },
                    { stage: 'Deposit → Contracts', avg: 12, target: 10, units: 3 },
                    { stage: 'Snagging → Drawdown', avg: 21, target: 21, units: 2 },
                  ].map((item, i) => (
                    <div key={i} className="p-4 rounded-xl" style={{ backgroundColor: tokens.warmGray }}>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-semibold" style={{ color: tokens.dark }}>{item.stage}</p>
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded ${
                            item.avg > item.target ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          {item.avg > item.target ? `+${item.avg - item.target} days` : 'On Target'}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>Avg: {item.avg} days</span>
                        <span>Target: {item.target} days</span>
                        <span>{item.units} units affected</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'solicitors' && (
              <div>
                <h3 className="text-base font-bold mb-4" style={{ color: tokens.dark }}>Solicitor Performance</h3>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider py-3">Solicitor</th>
                      <th className="text-center text-xs font-semibold text-gray-400 uppercase tracking-wider py-3">Units</th>
                      <th className="text-center text-xs font-semibold text-gray-400 uppercase tracking-wider py-3">Avg. Days</th>
                      <th className="text-center text-xs font-semibold text-gray-400 uppercase tracking-wider py-3">Rating</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {[
                      { name: 'Smith & Partners', units: 8, avgDays: 12, rating: 'fast' },
                      { name: 'Dublin Legal Services', units: 5, avgDays: 16, rating: 'average' },
                      { name: 'O\'Brien Solicitors', units: 3, avgDays: 24, rating: 'slow' },
                    ].map((sol, i) => (
                      <tr key={i}>
                        <td className="py-3 text-sm font-medium" style={{ color: tokens.dark }}>{sol.name}</td>
                        <td className="py-3 text-sm text-center text-gray-500">{sol.units}</td>
                        <td className="py-3 text-sm text-center text-gray-500">{sol.avgDays}</td>
                        <td className="py-3 text-center">
                          <span
                            className={`text-xs font-semibold px-2 py-1 rounded ${
                              sol.rating === 'fast'
                                ? 'bg-emerald-100 text-emerald-700'
                                : sol.rating === 'average'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {sol.rating.charAt(0).toUpperCase() + sol.rating.slice(1)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'comparison' && (
              <div>
                <h3 className="text-base font-bold mb-4" style={{ color: tokens.dark }}>Development Comparison</h3>
                <p className="text-sm text-gray-500">Compare performance across all developments</p>
                <div className="mt-6 p-8 rounded-xl text-center" style={{ backgroundColor: tokens.warmGray }}>
                  <ChartIcon />
                  <p className="text-sm text-gray-500 mt-2">Comparison charts coming soon</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
