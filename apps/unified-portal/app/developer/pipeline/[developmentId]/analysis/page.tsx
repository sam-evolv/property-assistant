'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  TrendingUp,
  Clock,
  AlertCircle,
  DollarSign,
  Calendar,
  BarChart3,
  Zap,
  AlertTriangle,
  MessageCircle,
  Building2,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

const tokens = {
  gold: '#D4AF37',
  goldLight: '#F5D874',
  goldDark: '#B8934C',
  dark: '#111827',
  cream: '#f9fafb',
  warmGray: '#f3f4f6',
  success: '#22c55e',
  warning: '#f97316',
  danger: '#ef4444',
  slate: '#4A5568',
  border: '#e5e7eb',
};

type TabKey = 'overview' | 'velocity' | 'pipeline' | 'revenue' | 'forecasting';

const tabs: { key: TabKey; label: string; icon: any }[] = [
  { key: 'overview', label: 'Overview', icon: BarChart3 },
  { key: 'velocity', label: 'Velocity', icon: Zap },
  { key: 'pipeline', label: 'Pipeline', icon: TrendingUp },
  { key: 'revenue', label: 'Revenue', icon: DollarSign },
  { key: 'forecasting', label: 'Forecasting', icon: Calendar },
];

function formatEuro(value: number): string {
  if (value >= 1000000) return `€${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `€${(value / 1000).toFixed(0)}K`;
  return `€${value.toLocaleString()}`;
}

function formatDays(days: number): string {
  if (days === 1) return '1 day';
  return `${days} days`;
}

interface AnalyticsData {
  overview: {
    totalUnits: number;
    privateUnits: number;
    socialUnits: number;
    unitsWithPrice: number;
    completedUnits: number;
    inProgress: number;
  };
  velocity: {
    stageMetrics: { stage: string; label: string; avgDays: number; count: number }[];
    totalCycleAvg: number;
    totalCycleCount: number;
    velocityTrend: { month: string; count: number; revenue: number }[];
    fastestSale: { unitNumber: string; purchaserName: string | null; days: number } | null;
    slowestSale: { unitNumber: string; purchaserName: string | null; days: number } | null;
    fastestCompletion: { unitNumber: string; purchaserName: string | null; days: number } | null;
    slowestCompletion: { unitNumber: string; purchaserName: string | null; days: number } | null;
  };
  pipelineHealth: {
    funnel: { stage: string; label: string; count: number; percentage: number }[];
    bottleneck: { stage: string; avgDays: number };
    attentionUnits: { id: string; unitNumber: string; currentStage: string; daysAtStage: number; lastActivity: string | null; purchaserName: string | null }[];
    queries: {
      total: number;
      resolved: number;
      open: number;
      avgResponseTime: string | null;
      fastestResponse: number | null;
      slowestResponse: number | null;
      sameDayResponses: number;
    };
  };
  revenue: {
    totalRevenueSold: number;
    projectedRevenue: number;
    totalPortfolioValue: number;
    priceByType: { type: string; typeName: string; beds: number; units: number; avgPrice: number; minPrice: number; maxPrice: number; totalRevenue: number; avgSqFt: number | null; avgPricePerSqFt: number | null }[];
    overallStats: { avgPrice: number; avgSqFt: number | null; pricePerSqFt: number | null };
  };
  forecasting: {
    upcomingHandovers: { period: string; units: number; projectedRevenue: number; unitList: { unitNumber: string; purchaserName: string | null; date: string; price: number | null }[] }[];
    cashFlowTrend: { month: string; completed: number; projected: number }[];
  };
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 p-6 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

function CardTitle({ children, icon: Icon }: { children: React.ReactNode; icon?: any }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      {Icon && <Icon className="w-5 h-5 text-gray-900" />}
      <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">{children}</h3>
    </div>
  );
}

function MetricBox({ label, value, subtext, color = 'gray' }: { label: string; value: string | number; subtext?: string; color?: string }) {
  const colorClasses: Record<string, string> = {
    gray: 'text-gray-900',
    gold: 'text-amber-600',
    green: 'text-green-600',
    red: 'text-red-600',
    blue: 'text-blue-600',
  };
  return (
    <div>
      <p className="text-xs font-medium text-gray-900 uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${colorClasses[color] || colorClasses.gray}`}>{value}</p>
      {subtext && <p className="text-xs text-gray-900 mt-1">{subtext}</p>}
    </div>
  );
}

function StageFunnel({ metrics }: { metrics: { stage: string; label: string; avgDays: number; count: number }[] }) {
  const maxDays = Math.max(...metrics.map(m => m.avgDays), 1);
  return (
    <div className="space-y-3">
      {metrics.map((m) => (
        <div key={m.stage} className="flex items-center gap-4">
          <div className="w-40 text-xs text-gray-900 text-right">{m.label}</div>
          <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden relative">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.max((m.avgDays / maxDays) * 100, 5)}%`,
                background: `linear-gradient(90deg, ${tokens.gold}, ${tokens.goldLight})`,
              }}
            />
            <span className="absolute inset-y-0 right-3 flex items-center text-xs font-medium text-gray-900">
              {m.avgDays > 0 ? formatDays(m.avgDays) : 'N/A'}
            </span>
          </div>
          <div className="w-16 text-xs text-gray-900 text-right">{m.count} units</div>
        </div>
      ))}
    </div>
  );
}

function SalesFunnel({ funnel }: { funnel: { stage: string; label: string; count: number; percentage: number }[] }) {
  return (
    <div className="space-y-2">
      {funnel.map((f, i) => (
        <div key={f.stage} className="flex items-center gap-3">
          <div className="w-32 text-xs text-gray-900 text-right">{f.label}</div>
          <div className="flex-1 h-7 bg-gray-100 rounded overflow-hidden relative">
            <div
              className="h-full transition-all"
              style={{
                width: `${f.percentage}%`,
                background: i === funnel.length - 1
                  ? tokens.success
                  : `linear-gradient(90deg, ${tokens.gold}, ${tokens.goldLight})`,
              }}
            />
          </div>
          <div className="w-12 text-sm font-semibold text-gray-900 text-right">{f.count}</div>
        </div>
      ))}
    </div>
  );
}

export default function AnalysisPage() {
  const params = useParams();
  const router = useRouter();
  const developmentId = params.developmentId as string;

  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [developmentName, setDevelopmentName] = useState('');

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/pipeline/${developmentId}/analytics`);
      if (!response.ok) throw new Error('Failed to fetch analytics');
      const data = await response.json();
      setAnalytics(data.analytics);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [developmentId]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  useEffect(() => {
    const fetchDevelopment = async () => {
      try {
        const res = await fetch(`/api/developer/development/${developmentId}`);
        const data = await res.json();
        setDevelopmentName(data.development?.name || data.project?.name || 'Development');
      } catch {
        setDevelopmentName('Development');
      }
    };
    fetchDevelopment();
  }, [developmentId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 rounded-full border-3 border-amber-500 border-t-transparent animate-spin mx-auto" style={{ borderWidth: 3 }} />
          <p className="text-sm text-gray-900 mt-4">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (error || !analytics) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Failed to load analytics</h2>
          <p className="text-sm text-gray-900 mb-6">{error}</p>
          <button onClick={fetchAnalytics} className="px-4 py-2 bg-amber-500 text-black font-medium rounded-lg hover:bg-amber-600 transition-colors">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const { overview, velocity, pipelineHealth, revenue, forecasting } = analytics;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push(`/developer/pipeline/${developmentId}`)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-900" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Sales Pipeline Analysis</h1>
                <p className="text-sm text-gray-900">{developmentName}</p>
              </div>
            </div>
          </div>

          <div className="flex gap-1 mt-4 -mb-px overflow-x-auto">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.key
                    ? 'border-amber-500 text-amber-600'
                    : 'border-transparent text-gray-900 hover:text-gray-900 hover:border-gray-300'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <Card><MetricBox label="Total Units" value={overview.totalUnits} /></Card>
              <Card><MetricBox label="Private Units" value={overview.privateUnits} /></Card>
              <Card><MetricBox label="Social Units" value={overview.socialUnits} /></Card>
              <Card><MetricBox label="Completed" value={overview.completedUnits} color="green" /></Card>
              <Card><MetricBox label="In Progress" value={overview.inProgress} color="gold" /></Card>
              <Card><MetricBox label="Priced Units" value={overview.unitsWithPrice} /></Card>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardTitle icon={TrendingUp}>Sales Funnel</CardTitle>
                <SalesFunnel funnel={pipelineHealth.funnel} />
              </Card>

              <Card>
                <CardTitle icon={DollarSign}>Revenue Summary</CardTitle>
                <div className="grid grid-cols-2 gap-6">
                  <MetricBox label="Total Revenue" value={formatEuro(revenue.totalRevenueSold)} color="green" subtext={`${overview.completedUnits} sold units`} />
                  <MetricBox label="Projected" value={formatEuro(revenue.projectedRevenue)} color="gold" subtext="Agreed, not complete" />
                  <MetricBox label="Portfolio Value" value={formatEuro(revenue.totalPortfolioValue)} />
                  <MetricBox label="Avg Price" value={formatEuro(revenue.overallStats.avgPrice)} />
                </div>
              </Card>
            </div>

            <Card>
              <CardTitle icon={Zap}>Sales Velocity Trend</CardTitle>
              {velocity.velocityTrend.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={velocity.velocityTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#111827' }} stroke="#374151" />
                      <YAxis tick={{ fontSize: 12, fill: '#111827' }} stroke="#374151" />
                      <Tooltip
                        contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: 8 }}
                        formatter={(value: number, name: string) => [name === 'count' ? `${value} units` : formatEuro(value), name === 'count' ? 'Sales Agreed' : 'Revenue']}
                      />
                      <Line type="monotone" dataKey="count" stroke={tokens.gold} strokeWidth={2} dot={{ fill: tokens.gold, r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-gray-900">
                  <p>No velocity data available</p>
                </div>
              )}
            </Card>
          </div>
        )}

        {activeTab === 'velocity' && (
          <div className="space-y-6">
            <Card>
              <CardTitle icon={Clock}>Average Sales Cycle</CardTitle>
              <StageFunnel metrics={velocity.stageMetrics} />
              <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-900">Total Cycle (Release → Handover)</span>
                <div className="text-right">
                  <span className="text-xl font-bold" style={{ color: tokens.gold }}>{velocity.totalCycleAvg} days</span>
                  <span className="text-xs text-gray-900 ml-2">({velocity.totalCycleCount} units)</span>
                </div>
              </div>
            </Card>

            <Card>
              <CardTitle icon={Zap}>Sales Velocity Trend</CardTitle>
              {velocity.velocityTrend.length > 0 ? (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={velocity.velocityTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#111827' }} stroke="#374151" />
                      <YAxis tick={{ fontSize: 11, fill: '#111827' }} stroke="#374151" />
                      <Tooltip
                        contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: 8 }}
                        formatter={(value: number) => [`${value} units`, 'Sales Agreed']}
                      />
                      <Bar dataKey="count" fill={tokens.gold} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-72 flex items-center justify-center text-gray-900">
                  <p>No velocity data available</p>
                </div>
              )}
            </Card>

            <Card>
              <CardTitle icon={TrendingUp}>Fastest & Slowest Sales</CardTitle>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-3 px-3 text-xs font-semibold text-gray-900 uppercase">Metric</th>
                      <th className="text-left py-3 px-3 text-xs font-semibold text-gray-900 uppercase">Unit</th>
                      <th className="text-right py-3 px-3 text-xs font-semibold text-gray-900 uppercase">Days</th>
                      <th className="text-left py-3 px-3 text-xs font-semibold text-gray-900 uppercase">Purchaser</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {velocity.fastestSale && (
                      <tr>
                        <td className="py-3 px-3 text-green-600 font-medium">Fastest Sale</td>
                        <td className="py-3 px-3 font-medium">{velocity.fastestSale.unitNumber}</td>
                        <td className="py-3 px-3 text-right font-mono text-green-600">{velocity.fastestSale.days}</td>
                        <td className="py-3 px-3 text-gray-900">{velocity.fastestSale.purchaserName || '—'}</td>
                      </tr>
                    )}
                    {velocity.slowestSale && (
                      <tr>
                        <td className="py-3 px-3 text-red-600 font-medium">Slowest Sale</td>
                        <td className="py-3 px-3 font-medium">{velocity.slowestSale.unitNumber}</td>
                        <td className="py-3 px-3 text-right font-mono text-red-600">{velocity.slowestSale.days}</td>
                        <td className="py-3 px-3 text-gray-900">{velocity.slowestSale.purchaserName || '—'}</td>
                      </tr>
                    )}
                    {velocity.fastestCompletion && (
                      <tr>
                        <td className="py-3 px-3 text-green-600 font-medium">Fastest Completion</td>
                        <td className="py-3 px-3 font-medium">{velocity.fastestCompletion.unitNumber}</td>
                        <td className="py-3 px-3 text-right font-mono text-green-600">{velocity.fastestCompletion.days}</td>
                        <td className="py-3 px-3 text-gray-900">{velocity.fastestCompletion.purchaserName || '—'}</td>
                      </tr>
                    )}
                    {velocity.slowestCompletion && (
                      <tr>
                        <td className="py-3 px-3 text-red-600 font-medium">Slowest Completion</td>
                        <td className="py-3 px-3 font-medium">{velocity.slowestCompletion.unitNumber}</td>
                        <td className="py-3 px-3 text-right font-mono text-red-600">{velocity.slowestCompletion.days}</td>
                        <td className="py-3 px-3 text-gray-900">{velocity.slowestCompletion.purchaserName || '—'}</td>
                      </tr>
                    )}
                    {!velocity.fastestSale && !velocity.slowestSale && (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-gray-900">No completed sales data available</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'pipeline' && (
          <div className="space-y-6">
            <Card>
              <CardTitle icon={TrendingUp}>Sales Funnel</CardTitle>
              <SalesFunnel funnel={pipelineHealth.funnel} />
            </Card>

            {pipelineHealth.bottleneck.avgDays > 0 && (
              <Card className="border-amber-200 bg-amber-50/50">
                <CardTitle icon={AlertTriangle}>Bottleneck Analysis</CardTitle>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-gray-900">
                      {pipelineHealth.bottleneck.stage} averages {pipelineHealth.bottleneck.avgDays} days
                    </p>
                    <p className="text-sm text-gray-900">This is the longest stage in your pipeline</p>
                  </div>
                </div>
              </Card>
            )}

            {pipelineHealth.attentionUnits.length > 0 && (
              <Card className="border-red-200">
                <CardTitle icon={AlertCircle}>Units Needing Attention</CardTitle>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left py-3 px-3 text-xs font-semibold text-gray-900 uppercase">Unit</th>
                        <th className="text-left py-3 px-3 text-xs font-semibold text-gray-900 uppercase">Current Stage</th>
                        <th className="text-right py-3 px-3 text-xs font-semibold text-gray-900 uppercase">Days at Stage</th>
                        <th className="text-left py-3 px-3 text-xs font-semibold text-gray-900 uppercase">Purchaser</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {pipelineHealth.attentionUnits.map(u => (
                        <tr key={u.id} className="hover:bg-gray-50">
                          <td className="py-3 px-3 font-medium">{u.unitNumber}</td>
                          <td className="py-3 px-3 text-gray-900">{u.currentStage}</td>
                          <td className="py-3 px-3 text-right font-mono text-red-600">{u.daysAtStage} days</td>
                          <td className="py-3 px-3 text-gray-900">{u.purchaserName || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            <Card>
              <CardTitle icon={MessageCircle}>Queries Performance</CardTitle>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <MetricBox label="Total Queries" value={pipelineHealth.queries.total} />
                <MetricBox label="Resolved" value={pipelineHealth.queries.resolved} color="green" />
                <MetricBox label="Open" value={pipelineHealth.queries.open} color={pipelineHealth.queries.open > 0 ? 'red' : 'gray'} />
                <MetricBox
                  label="Avg Response"
                  value={pipelineHealth.queries.avgResponseTime ? `${pipelineHealth.queries.avgResponseTime} days` : 'N/A'}
                />
              </div>
              <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-gray-100">
                <div className="text-center">
                  <p className="text-xs text-gray-900">Same Day</p>
                  <p className="text-lg font-semibold text-green-600">{pipelineHealth.queries.sameDayResponses}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-900">Fastest</p>
                  <p className="text-lg font-semibold">{pipelineHealth.queries.fastestResponse !== null ? `${pipelineHealth.queries.fastestResponse} days` : 'N/A'}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-900">Slowest</p>
                  <p className="text-lg font-semibold text-red-600">{pipelineHealth.queries.slowestResponse !== null ? `${pipelineHealth.queries.slowestResponse} days` : 'N/A'}</p>
                </div>
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'revenue' && (
          <div className="space-y-6">
            <div className="grid md:grid-cols-4 gap-4">
              <Card><MetricBox label="Total Revenue (Sold)" value={formatEuro(revenue.totalRevenueSold)} color="green" /></Card>
              <Card><MetricBox label="Projected Revenue" value={formatEuro(revenue.projectedRevenue)} color="gold" subtext="Agreed, not complete" /></Card>
              <Card><MetricBox label="Portfolio Value" value={formatEuro(revenue.totalPortfolioValue)} /></Card>
              <Card><MetricBox label="Avg Price" value={formatEuro(revenue.overallStats.avgPrice)} /></Card>
            </div>

            <Card>
              <CardTitle icon={Building2}>Price by Property Type</CardTitle>
              {revenue.priceByType.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-3 text-xs font-semibold text-gray-900 uppercase">Type</th>
                        <th className="text-right py-3 px-3 text-xs font-semibold text-gray-900 uppercase">Units</th>
                        <th className="text-right py-3 px-3 text-xs font-semibold text-gray-900 uppercase">Avg Price</th>
                        <th className="text-right py-3 px-3 text-xs font-semibold text-gray-900 uppercase">Min</th>
                        <th className="text-right py-3 px-3 text-xs font-semibold text-gray-900 uppercase">Max</th>
                        <th className="text-right py-3 px-3 text-xs font-semibold text-gray-900 uppercase">Total Revenue</th>
                        {revenue.priceByType.some(p => p.avgSqFt) && (
                          <>
                            <th className="text-right py-3 px-3 text-xs font-semibold text-gray-900 uppercase">Avg Sq Ft</th>
                            <th className="text-right py-3 px-3 text-xs font-semibold text-gray-900 uppercase">€/Sq Ft</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {revenue.priceByType.map(p => (
                        <tr key={p.type} className="hover:bg-gray-50">
                          <td className="py-3 px-3 font-medium text-gray-900">{p.typeName}</td>
                          <td className="py-3 px-3 text-right text-gray-800">{p.units}</td>
                          <td className="py-3 px-3 text-right font-mono" style={{ color: tokens.gold }}>{formatEuro(p.avgPrice)}</td>
                          <td className="py-3 px-3 text-right font-mono text-gray-900">{formatEuro(p.minPrice)}</td>
                          <td className="py-3 px-3 text-right font-mono text-gray-900">{formatEuro(p.maxPrice)}</td>
                          <td className="py-3 px-3 text-right font-mono font-semibold">{formatEuro(p.totalRevenue)}</td>
                          {revenue.priceByType.some(pt => pt.avgSqFt) && (
                            <>
                              <td className="py-3 px-3 text-right text-gray-900">{p.avgSqFt || '—'}</td>
                              <td className="py-3 px-3 text-right text-gray-900">{p.avgPricePerSqFt ? `€${p.avgPricePerSqFt}` : '—'}</td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-8 text-center text-gray-900">No pricing data available</div>
              )}
            </Card>

            {revenue.overallStats.pricePerSqFt && (
              <Card>
                <CardTitle icon={BarChart3}>Price Per Square Foot</CardTitle>
                <div className="grid grid-cols-3 gap-6">
                  <MetricBox label="Avg Sq Ft" value={revenue.overallStats.avgSqFt?.toLocaleString() || 'N/A'} />
                  <MetricBox label="Avg Price" value={formatEuro(revenue.overallStats.avgPrice)} />
                  <MetricBox label="€ per Sq Ft" value={`€${revenue.overallStats.pricePerSqFt}`} color="gold" />
                </div>
              </Card>
            )}
          </div>
        )}

        {activeTab === 'forecasting' && (
          <div className="space-y-6">
            <Card>
              <CardTitle icon={Calendar}>Upcoming Handovers</CardTitle>
              <div className="grid md:grid-cols-3 gap-4">
                {forecasting.upcomingHandovers.map(h => (
                  <div key={h.period} className="p-4 bg-gray-50 rounded-xl">
                    <p className="text-sm font-medium text-gray-900">{h.period}</p>
                    <p className="text-2xl font-bold mt-1">{h.units}</p>
                    <p className="text-sm font-mono mt-1" style={{ color: tokens.gold }}>{formatEuro(h.projectedRevenue)}</p>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <CardTitle icon={DollarSign}>Cash Flow Projection</CardTitle>
              {forecasting.cashFlowTrend.length > 0 ? (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={forecasting.cashFlowTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#111827' }} stroke="#374151" />
                      <YAxis tick={{ fontSize: 11, fill: '#111827' }} stroke="#374151" tickFormatter={(v) => formatEuro(v)} />
                      <Tooltip
                        contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: 8 }}
                        formatter={(value: number, name: string) => [formatEuro(value), name === 'completed' ? 'Completed' : 'Projected']}
                      />
                      <Legend />
                      <Bar dataKey="completed" name="Completed" fill={tokens.success} stackId="a" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="projected" name="Projected" fill={tokens.gold} stackId="a" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-72 flex items-center justify-center text-gray-900">
                  <p>No cash flow data available</p>
                </div>
              )}
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
