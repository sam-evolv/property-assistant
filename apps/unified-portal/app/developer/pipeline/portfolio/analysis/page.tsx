'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
  Users,
  Home,
  CheckCircle2,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
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

function formatEuro(value: number): string {
  if (value >= 1000000) return `€${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `€${(value / 1000).toFixed(0)}K`;
  return `€${value.toLocaleString()}`;
}

function formatDays(days: number): string {
  if (days === 1) return '1 day';
  return `${days} days`;
}

export default function PortfolioAnalysisPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<string>('overview');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/pipeline/portfolio/analytics');
        if (!response.ok) {
          throw new Error('Failed to fetch portfolio analytics');
        }
        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error loading data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: tokens.gold, borderTopColor: 'transparent' }} />
          <p className="text-sm text-gray-900">Loading portfolio analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600">{error}</p>
          <button
            onClick={() => router.back()}
            className="mt-4 px-4 py-2 bg-gray-100 rounded-lg text-sm"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const tabs = [
    { key: 'overview', label: 'Overview', icon: BarChart3 },
    { key: 'comparison', label: 'Comparison', icon: Building2 },
    { key: 'velocity', label: 'Velocity', icon: Zap },
    { key: 'pipeline', label: 'Pipeline', icon: TrendingUp },
    { key: 'revenue', label: 'Revenue', icon: DollarSign },
    { key: 'alerts', label: 'Alerts', icon: AlertTriangle },
  ];

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/developer/pipeline')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-900" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Portfolio Analytics</h1>
              <p className="text-sm text-gray-900 mt-0.5">
                Combined analysis across {data?.portfolioOverview?.totalDevelopments || 0} developments
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-2 mb-8 border-b border-gray-200 pb-4 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  activeTab === tab.key
                    ? 'text-white'
                    : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                }`}
                style={activeTab === tab.key ? { backgroundColor: tokens.gold, color: tokens.dark } : {}}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {activeTab === 'overview' && <OverviewTab data={data} />}
        {activeTab === 'comparison' && <ComparisonTab data={data} />}
        {activeTab === 'velocity' && <VelocityTab data={data} />}
        {activeTab === 'pipeline' && <PipelineTab data={data} />}
        {activeTab === 'revenue' && <RevenueTab data={data} />}
        {activeTab === 'alerts' && <AlertsTab data={data} />}
      </div>
    </div>
  );
}

function OverviewTab({ data }: { data: any }) {
  const overview = data?.portfolioOverview || {};
  const hasPcSumImpact = overview.totalPcSumDeductions < 0;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          icon={<Building2 className="w-5 h-5" />}
          label="Total Developments"
          value={overview.totalDevelopments}
          color={tokens.gold}
        />
        <MetricCard
          icon={<Home className="w-5 h-5" />}
          label="Total Units"
          value={overview.totalUnits}
          color="#3B82F6"
        />
        <MetricCard
          icon={<Users className="w-5 h-5" />}
          label="Private Units"
          value={overview.privateUnits}
          color="#10B981"
        />
        <MetricCard
          icon={<Building2 className="w-5 h-5" />}
          label="Social Units"
          value={overview.socialUnits}
          color="#8B5CF6"
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <MetricCard
          icon={<DollarSign className="w-5 h-5" />}
          label="Total Revenue (Private)"
          value={formatEuro(overview.totalRevenue || 0)}
          color={tokens.gold}
        />
        <MetricCard
          icon={<DollarSign className="w-5 h-5" />}
          label="Average Price"
          value={formatEuro(overview.avgPrice || 0)}
          color={tokens.goldDark}
        />
        <MetricCard
          icon={<CheckCircle2 className="w-5 h-5" />}
          label="Completed Sales"
          value={overview.soldUnits}
          color={tokens.success}
        />
      </div>

      {hasPcSumImpact && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="text-xl">💡</div>
            <div className="flex-1">
              <h4 className="font-semibold text-amber-900 mb-1">Kitchen Selection Impact</h4>
              <p className="text-sm text-amber-800">
                {overview.totalTakingOwnKitchen + overview.totalTakingOwnWardrobes} of {overview.totalDecided} decided purchasers ({overview.totalDecided > 0 ? Math.round(((overview.totalTakingOwnKitchen + overview.totalTakingOwnWardrobes) / overview.totalDecided) * 100) : 0}%) are taking their own kitchen/wardrobes, resulting in <span className="font-semibold text-red-600">{formatEuro(overview.totalPcSumDeductions)}</span> in PC sum deductions.
              </p>
              <p className="text-xs text-amber-700 mt-2">
                Breakdown: Kitchen {formatEuro(overview.totalPcSumKitchen)} | Wardrobes {formatEuro(overview.totalPcSumWardrobes)}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border-2 border-gray-200 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue by Development</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data?.revenueByDevelopment || []}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  dataKey="revenue"
                  nameKey="name"
                  label={({ name, percentage }) => `${name}: ${percentage}%`}
                >
                  {(data?.revenueByDevelopment || []).map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatEuro(value)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border-2 border-gray-200 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Combined Pipeline Funnel</h3>
          <div className="space-y-3">
            {(data?.funnel || []).map((stage: any, idx: number) => (
              <div key={stage.stage} className="flex items-center gap-3">
                <div className="w-32 text-sm text-gray-900">{stage.label}</div>
                <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${stage.percentage}%`,
                      backgroundColor: tokens.gold,
                      opacity: 1 - (idx * 0.12),
                    }}
                  />
                </div>
                <div className="w-16 text-right text-sm font-medium text-gray-900">
                  {stage.count}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white border-2 border-gray-200 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Social Housing Summary</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Development</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-900">Social Units</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Housing Agency</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Status</th>
              </tr>
            </thead>
            <tbody>
              {(data?.socialSummary || []).map((row: any) => (
                <tr key={row.developmentId} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4 font-medium text-gray-900">{row.developmentName}</td>
                  <td className="py-3 px-4 text-right text-gray-900">{row.socialUnits}</td>
                  <td className="py-3 px-4 text-gray-900">{row.housingAgency}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      row.status === 'Complete' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
              <tr className="bg-gray-50 font-semibold text-gray-900">
                <td className="py-3 px-4">Total</td>
                <td className="py-3 px-4 text-right text-gray-900">
                  {(data?.socialSummary || []).reduce((sum: number, r: any) => sum + r.socialUnits, 0)}
                </td>
                <td className="py-3 px-4" colSpan={2}></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ComparisonTab({ data }: { data: any }) {
  const developments = data?.developments || [];

  return (
    <div className="space-y-8">
      <div className="bg-white border-2 border-gray-200 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Development Comparison</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Development</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-900">Units</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-900">Sold</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-900">Revenue</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-900">Avg Price</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-900">PC Sums</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-900">Adjusted Rev</th>
              </tr>
            </thead>
            <tbody>
              {developments.map((dev: any) => (
                <tr key={dev.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: dev.color }} />
                      <span className="font-medium text-gray-900">{dev.name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right text-gray-900">{dev.privateUnits}</td>
                  <td className="py-3 px-4 text-right text-green-600 font-medium">{dev.sold}</td>
                  <td className="py-3 px-4 text-right font-medium" style={{ color: tokens.goldDark }}>{formatEuro(dev.revenue)}</td>
                  <td className="py-3 px-4 text-right text-gray-900">{formatEuro(dev.avgPrice)}</td>
                  <td className={`py-3 px-4 text-right ${dev.pcSumTotal < 0 ? 'text-red-500' : 'text-gray-900'}`}>
                    {dev.pcSumTotal < 0 ? formatEuro(dev.pcSumTotal) : '€0'}
                  </td>
                  <td className="py-3 px-4 text-right font-medium text-gray-900">{formatEuro(dev.adjustedRevenue)}</td>
                </tr>
              ))}
              <tr className="bg-gray-50 font-semibold border-t-2 border-gray-300 text-gray-900">
                <td className="py-3 px-4">TOTAL</td>
                <td className="py-3 px-4 text-right text-gray-900">{developments.reduce((s: number, d: any) => s + d.privateUnits, 0)}</td>
                <td className="py-3 px-4 text-right text-green-600">{developments.reduce((s: number, d: any) => s + d.sold, 0)}</td>
                <td className="py-3 px-4 text-right" style={{ color: tokens.goldDark }}>{formatEuro(developments.reduce((s: number, d: any) => s + d.revenue, 0))}</td>
                <td className="py-3 px-4 text-right text-gray-900">—</td>
                <td className={`py-3 px-4 text-right ${developments.reduce((s: number, d: any) => s + d.pcSumTotal, 0) < 0 ? 'text-red-500' : 'text-gray-900'}`}>
                  {formatEuro(developments.reduce((s: number, d: any) => s + d.pcSumTotal, 0))}
                </td>
                <td className="py-3 px-4 text-right text-gray-900">{formatEuro(developments.reduce((s: number, d: any) => s + d.adjustedRevenue, 0))}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white border-2 border-gray-200 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Benchmarks</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Metric</th>
                {developments.map((dev: any) => (
                  <th key={dev.id} className="text-right py-3 px-4 font-semibold text-gray-900">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: dev.color }} />
                      {dev.name}
                    </div>
                  </th>
                ))}
                <th className="text-right py-3 px-4 font-semibold text-green-600">Best</th>
              </tr>
            </thead>
            <tbody>
              {(data?.benchmarks || []).map((row: any) => (
                <tr key={row.metric} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4 font-medium text-gray-900">{row.metric}</td>
                  {developments.map((dev: any) => (
                    <td key={dev.id} className="py-3 px-4 text-right text-gray-900">
                      {row.metric.includes('Rate') 
                        ? `${row[dev.id]}%`
                        : row.metric.includes('Time')
                          ? `${row[dev.id]} days`
                          : row[dev.id] > 0 ? `${row[dev.id]} days` : '—'}
                    </td>
                  ))}
                  <td className="py-3 px-4 text-right text-green-600 font-medium">{row.best || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white border-2 border-gray-200 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Price Comparison by House Type</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Type</th>
                {developments.map((dev: any) => (
                  <th key={dev.id} className="text-right py-3 px-4 font-semibold text-gray-900">{dev.name}</th>
                ))}
                <th className="text-right py-3 px-4 font-semibold" style={{ color: tokens.gold }}>Overall Avg</th>
              </tr>
            </thead>
            <tbody>
              {(data?.priceComparison || []).map((row: any) => (
                <tr key={row.type} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4 font-medium text-gray-900">{row.type}</td>
                  {developments.map((dev: any) => (
                    <td key={dev.id} className="py-3 px-4 text-right text-gray-900">
                      {row[dev.id] ? formatEuro(row[dev.id]) : '—'}
                    </td>
                  ))}
                  <td className="py-3 px-4 text-right font-medium" style={{ color: tokens.goldDark }}>
                    {row.overallAvg ? formatEuro(row.overallAvg) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function VelocityTab({ data }: { data: any }) {
  const developments = data?.developments || [];

  return (
    <div className="space-y-8">
      <div className="bg-white border-2 border-gray-200 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Sales Velocity by Development</h3>
        <p className="text-sm text-gray-900 mb-4">Units sold per month across all developments</p>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data?.velocityTrend || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#111827' }} stroke="#374151" />
              <YAxis tick={{ fontSize: 12, fill: '#111827' }} stroke="#374151" />
              <Tooltip />
              <Legend />
              {developments.map((dev: any) => (
                <Bar
                  key={dev.id}
                  dataKey={dev.id}
                  name={dev.name}
                  fill={dev.color}
                  stackId="a"
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {developments.map((dev: any) => (
          <div key={dev.id} className="bg-white border-2 border-gray-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: dev.color }} />
              <h4 className="font-semibold text-gray-900">{dev.name}</h4>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-900">Avg Cycle Time</span>
                <span className="font-medium text-gray-900">{dev.avgCycle > 0 ? `${dev.avgCycle} days` : '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-900">Completion Rate</span>
                <span className="font-medium text-gray-900">
                  {dev.privateUnits > 0 ? `${Math.round((dev.sold / dev.privateUnits) * 100)}%` : '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-900">Total Sold</span>
                <span className="font-medium text-green-600">{dev.sold}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PipelineTab({ data }: { data: any }) {
  const funnel = data?.funnel || [];

  return (
    <div className="space-y-8">
      <div className="bg-white border-2 border-gray-200 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Combined Pipeline Funnel</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={funnel} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis type="number" tick={{ fontSize: 12, fill: '#111827' }} stroke="#374151" />
              <YAxis dataKey="label" type="category" tick={{ fontSize: 12, fill: '#111827' }} stroke="#374151" width={120} />
              <Tooltip formatter={(value: number) => [value, 'Units']} />
              <Bar dataKey="count" fill={tokens.gold} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border-2 border-gray-200 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Funnel Breakdown</h3>
          <div className="space-y-3">
            {funnel.map((stage: any, idx: number) => {
              const dropOff = idx > 0 ? funnel[idx - 1].count - stage.count : 0;
              return (
                <div key={stage.stage} className="flex items-center justify-between py-2 border-b border-gray-100">
                  <div>
                    <span className="font-medium text-gray-900">{stage.label}</span>
                    {dropOff > 0 && (
                      <span className="ml-2 text-xs text-red-500">-{dropOff}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-900">{stage.percentage}%</span>
                    <span className="font-semibold" style={{ color: tokens.goldDark }}>{stage.count}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white border-2 border-gray-200 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Conversion Rates</h3>
          <div className="space-y-4">
            {funnel.slice(1).map((stage: any, idx: number) => {
              const prevCount = funnel[idx].count;
              const convRate = prevCount > 0 ? Math.round((stage.count / prevCount) * 100) : 0;
              return (
                <div key={stage.stage}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-900">{funnel[idx].label} → {stage.label}</span>
                    <span className="font-medium text-gray-900">{convRate}%</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${convRate}%`, backgroundColor: convRate >= 80 ? tokens.success : convRate >= 60 ? tokens.warning : tokens.danger }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function RevenueTab({ data }: { data: any }) {
  const developments = data?.developments || [];
  const overview = data?.portfolioOverview || {};
  const hasPcSumDeductions = overview.totalPcSumDeductions < 0;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          icon={<DollarSign className="w-5 h-5" />}
          label="Total Revenue"
          value={formatEuro(overview.totalRevenue || 0)}
          color={tokens.gold}
        />
        <MetricCard
          icon={<CheckCircle2 className="w-5 h-5" />}
          label="Collected"
          value={formatEuro(Math.round((overview.totalRevenue || 0) * 0.66))}
          color={tokens.success}
        />
        <MetricCard
          icon={<Clock className="w-5 h-5" />}
          label="Outstanding"
          value={formatEuro(Math.round((overview.totalRevenue || 0) * 0.34))}
          color={tokens.warning}
        />
        <div className="bg-white border-2 border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${tokens.goldDark}20` }}>
              <DollarSign className="w-5 h-5" style={{ color: tokens.goldDark }} />
            </div>
          </div>
          <p className="text-2xl font-bold" style={{ color: tokens.goldDark }}>
            {formatEuro(overview.adjustedRevenue || overview.totalRevenue || 0)}
          </p>
          <p className="text-xs text-gray-900 mt-1">Adjusted Revenue</p>
          {hasPcSumDeductions && (
            <p className="text-xs text-red-500 mt-0.5">
              ({formatEuro(overview.totalPcSumDeductions)} PC sums)
            </p>
          )}
        </div>
      </div>

      <div className="bg-white border-2 border-gray-200 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Cash Flow by Development</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data?.cashFlowProjection || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#111827' }} stroke="#374151" />
              <YAxis tick={{ fontSize: 12, fill: '#111827' }} stroke="#374151" tickFormatter={(v) => `€${(v / 1000000).toFixed(1)}M`} />
              <Tooltip formatter={(value: number) => formatEuro(value)} />
              <Legend />
              {developments.map((dev: any) => (
                <Bar
                  key={dev.id}
                  dataKey={dev.id}
                  name={dev.name}
                  fill={dev.color}
                  stackId="a"
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
        {hasPcSumDeductions && (
          <p className="text-xs text-gray-900 mt-3">
            * Projected revenue adjusted for {formatEuro(overview.totalPcSumDeductions)} in PC sum deductions ({overview.totalTakingOwnKitchen + overview.totalTakingOwnWardrobes} units taking own kitchen/wardrobes)
          </p>
        )}
      </div>

      <div className="bg-white border-2 border-gray-200 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue Distribution</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data?.revenueByDevelopment || []}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  dataKey="revenue"
                  nameKey="name"
                >
                  {(data?.revenueByDevelopment || []).map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatEuro(value)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-4">
            {(data?.revenueByDevelopment || []).map((dev: any) => (
              <div key={dev.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded" style={{ backgroundColor: dev.color }} />
                  <span className="font-medium text-gray-900">{dev.name}</span>
                </div>
                <div className="text-right">
                  <div className="font-semibold" style={{ color: tokens.goldDark }}>{formatEuro(dev.revenue)}</div>
                  <div className="text-xs text-gray-900">{dev.percentage}% of portfolio</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function AlertsTab({ data }: { data: any }) {
  const alerts = data?.alerts || {};

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <span className="font-semibold text-red-900">Stuck Units</span>
          </div>
          <p className="text-3xl font-bold text-red-600">{alerts.totalStuck || 0}</p>
          <p className="text-sm text-red-600 mt-1">No progress in 30+ days</p>
        </div>
        <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <MessageCircle className="w-5 h-5 text-amber-600" />
            <span className="font-semibold text-amber-900">Open Queries</span>
          </div>
          <p className="text-3xl font-bold text-amber-600">{alerts.totalOpenQueries || 0}</p>
          <p className="text-sm text-amber-600 mt-1">Awaiting response</p>
        </div>
        <div className="bg-green-50 border-2 border-green-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-5 h-5 text-green-600" />
            <span className="font-semibold text-green-900">Upcoming Handovers</span>
          </div>
          <p className="text-3xl font-bold text-green-600">{alerts.totalUpcoming || 0}</p>
          <p className="text-sm text-green-600 mt-1">Next 30 days</p>
        </div>
      </div>

      {alerts.stuckUnits?.length > 0 && (
        <div className="bg-white border-2 border-red-200 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-red-900 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Stuck Units (Top 10)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 font-semibold text-gray-900">Unit</th>
                  <th className="text-left py-2 px-3 font-semibold text-gray-900">Development</th>
                  <th className="text-left py-2 px-3 font-semibold text-gray-900">Purchaser</th>
                  <th className="text-left py-2 px-3 font-semibold text-gray-900">Current Stage</th>
                  <th className="text-right py-2 px-3 font-semibold text-gray-900">Days Stuck</th>
                </tr>
              </thead>
              <tbody>
                {alerts.stuckUnits.map((unit: any) => (
                  <tr key={unit.id} className="border-b border-gray-100 hover:bg-red-50">
                    <td className="py-2 px-3 font-medium text-gray-900">{unit.unitNumber}</td>
                    <td className="py-2 px-3 text-gray-900">{unit.developmentName}</td>
                    <td className="py-2 px-3 text-gray-900">{unit.purchaserName || '—'}</td>
                    <td className="py-2 px-3 text-gray-900">{unit.currentStage}</td>
                    <td className="py-2 px-3 text-right text-red-600 font-semibold">{unit.daysStuck} days</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {alerts.openQueries?.length > 0 && (
        <div className="bg-white border-2 border-amber-200 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-amber-900 mb-4 flex items-center gap-2">
            <MessageCircle className="w-5 h-5" />
            Open Queries (Top 10)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 font-semibold text-gray-900">Unit</th>
                  <th className="text-left py-2 px-3 font-semibold text-gray-900">Development</th>
                  <th className="text-left py-2 px-3 font-semibold text-gray-900">Purchaser</th>
                  <th className="text-right py-2 px-3 font-semibold text-gray-900">Days Open</th>
                </tr>
              </thead>
              <tbody>
                {alerts.openQueries.map((query: any) => (
                  <tr key={query.id} className="border-b border-gray-100 hover:bg-amber-50">
                    <td className="py-2 px-3 font-medium text-gray-900">{query.unitNumber}</td>
                    <td className="py-2 px-3 text-gray-900">{query.developmentName}</td>
                    <td className="py-2 px-3 text-gray-900">{query.purchaserName || '—'}</td>
                    <td className="py-2 px-3 text-right text-amber-600 font-semibold">{query.daysOpen} days</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {alerts.upcomingHandovers?.length > 0 && (
        <div className="bg-white border-2 border-green-200 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-green-900 mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Upcoming Handovers (Next 30 Days)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 font-semibold text-gray-900">Unit</th>
                  <th className="text-left py-2 px-3 font-semibold text-gray-900">Development</th>
                  <th className="text-left py-2 px-3 font-semibold text-gray-900">Purchaser</th>
                  <th className="text-left py-2 px-3 font-semibold text-gray-900">Expected Date</th>
                  <th className="text-right py-2 px-3 font-semibold text-gray-900">Price</th>
                </tr>
              </thead>
              <tbody>
                {alerts.upcomingHandovers.map((handover: any) => (
                  <tr key={handover.id} className="border-b border-gray-100 hover:bg-green-50">
                    <td className="py-2 px-3 font-medium text-gray-900">{handover.unitNumber}</td>
                    <td className="py-2 px-3 text-gray-900">{handover.developmentName}</td>
                    <td className="py-2 px-3 text-gray-900">{handover.purchaserName || '—'}</td>
                    <td className="py-2 px-3 text-gray-900">{new Date(handover.expectedDate).toLocaleDateString('en-IE')}</td>
                    <td className="py-2 px-3 text-right font-semibold" style={{ color: tokens.goldDark }}>
                      {handover.price > 0 ? formatEuro(handover.price) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | number; color: string }) {
  return (
    <div className="bg-white border-2 border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2 mb-2" style={{ color }}>
        {icon}
        <span className="text-xs font-semibold text-gray-900 uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-2xl font-bold" style={{ color }}>{value}</p>
    </div>
  );
}
