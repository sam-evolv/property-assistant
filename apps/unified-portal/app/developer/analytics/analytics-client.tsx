'use client';

import { useEffect, useState, memo, useMemo, useCallback } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Building2, Users, MessageSquare, TrendingUp, ArrowLeft, BarChart3, Clock, Activity, Zap, Download, FileSpreadsheet, FileText } from 'lucide-react';
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

interface ActivityData {
  date: string;
  chats: number;
  messages: number;
}

interface ResponseTimeData {
  date: string;
  avgTime: number;
  maxTime: number;
}

interface ApiHealthData {
  uptimePercent: number;
  avgTokensPerMessage: number;
  apiCallsPerMinute: number;
}

interface AnalyticsClientProps {
  tenantId: string;
}

type DateRange = '7' | '30' | '90' | 'custom';

const PRIMARY_PROJECT_ID = '57dc3919-2725-4575-8046-9179075ac88e';

export default function AnalyticsClient({ tenantId }: AnalyticsClientProps) {
  const { archiveScope, developmentId } = useCurrentContext();
  // When viewing Longview Park (primary project), show all tenant data since messages may be stored with different dev IDs
  const isPrimaryDevelopment = developmentId === PRIMARY_PROJECT_ID;
  const effectiveDevelopmentId = isAllSchemes(archiveScope) || isPrimaryDevelopment ? undefined : developmentId || undefined;
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
  const [activityData, setActivityData] = useState<ActivityData[]>([]);
  const [responseTimeData, setResponseTimeData] = useState<ResponseTimeData[]>([]);
  const [apiHealth, setApiHealth] = useState<ApiHealthData>({ uptimePercent: 100, avgTokensPerMessage: 0, apiCallsPerMinute: 0 });
  const [responseTimeStats, setResponseTimeStats] = useState({ avgOverall: 0, maxOverall: 0 });
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Export functions
  const generateCSVContent = useCallback(() => {
    const rows: string[][] = [];
    const dateRangeLabel = dateRange === 'custom'
      ? `${customStartDate} to ${customEndDate}`
      : `Last ${daysToQuery} days`;

    // Header info
    rows.push(['OpenHouse AI Analytics Report']);
    rows.push([`Generated: ${new Date().toLocaleString()}`]);
    rows.push([`Date Range: ${dateRangeLabel}`]);
    rows.push([`Scheme: ${schemeName || 'All Schemes'}`]);
    rows.push([]);

    // Overview Metrics
    rows.push(['=== OVERVIEW METRICS ===']);
    rows.push(['Metric', 'Value']);
    rows.push(['Total Messages', String(metrics?.totalMessages || 0)]);
    rows.push(['Active Users', String(metrics?.activeUsers || 0)]);
    rows.push(['Engagement Rate', `${homeowners?.engagementRate ? (homeowners.engagementRate * 100).toFixed(1) : 0}%`]);
    rows.push(['Avg Response Time (ms)', String(metrics?.avgResponseTime || 0)]);
    rows.push([]);

    // API Health
    rows.push(['=== API HEALTH ===']);
    rows.push(['Metric', 'Value']);
    rows.push(['Uptime', `${apiHealth.uptimePercent}%`]);
    rows.push(['Avg Tokens/Message', String(apiHealth.avgTokensPerMessage)]);
    rows.push(['API Calls/Min', String(apiHealth.apiCallsPerMinute)]);
    rows.push([]);

    // Daily Activity
    if (activityData.length > 0) {
      rows.push(['=== DAILY ACTIVITY ===']);
      rows.push(['Date', 'Chats', 'Messages']);
      activityData.forEach(day => {
        rows.push([day.date, String(day.chats), String(day.messages)]);
      });
      rows.push([]);
    }

    // Response Times
    if (responseTimeData.length > 0) {
      rows.push(['=== RESPONSE TIMES ===']);
      rows.push(['Date', 'Avg Time (ms)', 'Max Time (ms)']);
      responseTimeData.forEach(day => {
        rows.push([day.date, String(day.avgTime), String(day.maxTime)]);
      });
      rows.push([]);
    }

    // Question Categories
    if (questionData?.categories && questionData.categories.length > 0) {
      rows.push(['=== QUESTION CATEGORIES ===']);
      rows.push(['Category', 'Count', 'Percentage']);
      questionData.categories.forEach(cat => {
        const pct = ((cat.count / (questionData.totalQuestions || 1)) * 100).toFixed(1);
        rows.push([cat.category, String(cat.count), `${pct}%`]);
      });
      rows.push([]);
    }

    // Top Questions
    if (questionData?.topQuestions && questionData.topQuestions.length > 0) {
      rows.push(['=== TOP QUESTIONS ===']);
      rows.push(['Question', 'Count', 'Avg Response Time (ms)']);
      questionData.topQuestions.forEach(q => {
        rows.push([`"${q.question.replace(/"/g, '""')}"`, String(q.count), String(q.avgResponseTime)]);
      });
    }

    // Convert to CSV string
    return rows.map(row => row.join(',')).join('\n');
  }, [metrics, homeowners, apiHealth, activityData, responseTimeData, questionData, dateRange, daysToQuery, customStartDate, customEndDate, schemeName]);

  const exportToCSV = useCallback(() => {
    setExporting(true);
    try {
      const csvContent = generateCSVContent();
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const filename = `openhouse-analytics-${schemeName?.toLowerCase().replace(/\s+/g, '-') || 'all-schemes'}-${new Date().toISOString().split('T')[0]}.csv`;
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export CSV:', error);
    } finally {
      setExporting(false);
      setShowExportMenu(false);
    }
  }, [generateCSVContent, schemeName]);

  const exportToPDF = useCallback(async () => {
    setExporting(true);
    try {
      // Create a simple HTML-based PDF using print
      const dateRangeLabel = dateRange === 'custom'
        ? `${customStartDate} to ${customEndDate}`
        : `Last ${daysToQuery} days`;

      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        alert('Please allow popups to export PDF');
        return;
      }

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>OpenHouse AI Analytics Report</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; color: #333; }
            h1 { color: #B8860B; border-bottom: 2px solid #B8860B; padding-bottom: 10px; }
            h2 { color: #555; margin-top: 30px; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
            .meta { color: #666; font-size: 14px; margin-bottom: 20px; }
            .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin: 20px 0; }
            .card { background: #f9f9f9; border-radius: 8px; padding: 20px; }
            .card-title { font-size: 12px; color: #666; text-transform: uppercase; }
            .card-value { font-size: 28px; font-weight: bold; color: #333; margin-top: 5px; }
            table { width: 100%; border-collapse: collapse; margin: 15px 0; }
            th, td { text-align: left; padding: 10px; border-bottom: 1px solid #eee; }
            th { background: #f5f5f5; font-weight: 600; }
            .footer { margin-top: 40px; text-align: center; color: #999; font-size: 12px; }
            @media print { body { padding: 20px; } }
          </style>
        </head>
        <body>
          <h1>📊 OpenHouse AI Analytics Report</h1>
          <div class="meta">
            <p><strong>Scheme:</strong> ${schemeName || 'All Schemes'}</p>
            <p><strong>Date Range:</strong> ${dateRangeLabel}</p>
            <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
          </div>

          <h2>Overview Metrics</h2>
          <div class="grid">
            <div class="card">
              <div class="card-title">Total Messages</div>
              <div class="card-value">${(metrics?.totalMessages || 0).toLocaleString()}</div>
            </div>
            <div class="card">
              <div class="card-title">Active Users</div>
              <div class="card-value">${(metrics?.activeUsers || 0).toLocaleString()}</div>
            </div>
            <div class="card">
              <div class="card-title">Engagement Rate</div>
              <div class="card-value">${homeowners?.engagementRate ? (homeowners.engagementRate * 100).toFixed(1) : 0}%</div>
            </div>
            <div class="card">
              <div class="card-title">Avg Response Time</div>
              <div class="card-value">${metrics?.avgResponseTime || 0}ms</div>
            </div>
          </div>

          <h2>API Health</h2>
          <div class="grid">
            <div class="card">
              <div class="card-title">Uptime</div>
              <div class="card-value">${apiHealth.uptimePercent}%</div>
            </div>
            <div class="card">
              <div class="card-title">Avg Tokens/Message</div>
              <div class="card-value">${apiHealth.avgTokensPerMessage}</div>
            </div>
          </div>

          ${questionData?.categories && questionData.categories.length > 0 ? `
          <h2>Question Categories</h2>
          <table>
            <thead>
              <tr><th>Category</th><th>Count</th><th>Percentage</th></tr>
            </thead>
            <tbody>
              ${questionData.categories.map(cat => `
                <tr>
                  <td>${cat.category}</td>
                  <td>${cat.count}</td>
                  <td>${((cat.count / (questionData.totalQuestions || 1)) * 100).toFixed(1)}%</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          ` : ''}

          ${questionData?.topQuestions && questionData.topQuestions.length > 0 ? `
          <h2>Top Questions</h2>
          <table>
            <thead>
              <tr><th>Question</th><th>Count</th><th>Response Time</th></tr>
            </thead>
            <tbody>
              ${questionData.topQuestions.slice(0, 10).map(q => `
                <tr>
                  <td>${q.question}</td>
                  <td>${q.count}</td>
                  <td>${q.avgResponseTime}ms</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          ` : ''}

          <div class="footer">
            <p>Generated by OpenHouse AI • portal.openhouseai.ie</p>
          </div>
        </body>
        </html>
      `);

      printWindow.document.close();
      printWindow.focus();

      // Give it a moment to render, then print
      setTimeout(() => {
        printWindow.print();
      }, 500);

    } catch (error) {
      console.error('Failed to export PDF:', error);
    } finally {
      setExporting(false);
      setShowExportMenu(false);
    }
  }, [metrics, homeowners, apiHealth, questionData, dateRange, daysToQuery, customStartDate, customEndDate, schemeName]);

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

  useEffect(() => {
    async function loadActivityData() {
      try {
        const projectParam = effectiveDevelopmentId ? `&project_id=${effectiveDevelopmentId}` : '';
        const res = await fetch(`/api/analytics/daily-activity?developer_id=${tenantId}&days=${daysToQuery}${projectParam}`);
        if (res.ok) {
          const data = await res.json();
          setActivityData(data.activity || []);
        }
      } catch (error) {
        console.error('Failed to load activity data:', error);
      }
    }
    loadActivityData();
  }, [tenantId, effectiveDevelopmentId, daysToQuery]);

  useEffect(() => {
    async function loadResponseTimes() {
      try {
        const projectParam = effectiveDevelopmentId ? `&project_id=${effectiveDevelopmentId}` : '';
        const res = await fetch(`/api/analytics/response-times?developer_id=${tenantId}&days=${daysToQuery}${projectParam}`);
        if (res.ok) {
          const data = await res.json();
          setResponseTimeData(data.responseTimes || []);
          setResponseTimeStats({ avgOverall: data.avgOverall || 0, maxOverall: data.maxOverall || 0 });
        }
      } catch (error) {
        console.error('Failed to load response times:', error);
      }
    }
    loadResponseTimes();
  }, [tenantId, effectiveDevelopmentId, daysToQuery]);

  useEffect(() => {
    async function loadApiHealth() {
      try {
        const projectParam = effectiveDevelopmentId ? `&project_id=${effectiveDevelopmentId}` : '';
        const res = await fetch(`/api/analytics/api-health?developer_id=${tenantId}&days=${daysToQuery}${projectParam}`);
        if (res.ok) {
          const data = await res.json();
          setApiHealth(data);
        }
      } catch (error) {
        console.error('Failed to load API health:', error);
      }
    }
    loadApiHealth();
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

            {/* Export Button */}
            <div className="relative">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                disabled={exporting}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-gold-500 to-gold-600 text-white rounded-lg hover:from-gold-600 hover:to-gold-700 transition shadow-sm disabled:opacity-50"
              >
                {exporting ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                <span className="text-sm font-medium">Export</span>
              </button>

              {showExportMenu && (
                <>
                  {/* Backdrop to close menu */}
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowExportMenu(false)}
                  />
                  {/* Dropdown menu */}
                  <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-lg border border-grey-200 z-20 py-1">
                    <button
                      onClick={exportToCSV}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-grey-700 hover:bg-grey-50 transition"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-green-600" />
                      Export to Excel/CSV
                    </button>
                    <button
                      onClick={exportToPDF}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-grey-700 hover:bg-grey-50 transition"
                    >
                      <FileText className="w-4 h-4 text-red-600" />
                      Export to PDF
                    </button>
                  </div>
                </>
              )}
            </div>
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
                {activityData.length > 0 ? (
                  <ActivityChart data={activityData} height={280} />
                ) : (
                  <div className="h-[280px] flex items-center justify-center bg-grey-50 rounded-lg">
                    <p className="text-grey-500 text-sm">No chat activity data available for this period</p>
                  </div>
                )}
              </div>

              {/* Response Time Performance */}
              <div className={`rounded-lg border p-6 backdrop-blur-sm ${cardBg}`}>
                <h2 className={`text-lg font-semibold ${textColor} mb-4`}>Response Time Performance</h2>
                {responseTimeData.length > 0 && responseTimeData.some(d => d.avgTime > 0) ? (
                  <ResponseTimeChart data={responseTimeData} height={200} />
                ) : (
                  <div className="h-[200px] flex items-center justify-center bg-grey-50 rounded-lg">
                    <p className="text-grey-500 text-sm">No response time data available for this period</p>
                  </div>
                )}
                <div className="mt-4 grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-grey-50 rounded-lg">
                    <p className="text-xs text-grey-600">Avg Response Time</p>
                    <p className="text-xl font-bold text-grey-900 mt-1">{responseTimeStats.avgOverall}ms</p>
                  </div>
                  <div className="text-center p-3 bg-gold-50 rounded-lg">
                    <p className="text-xs text-grey-600">Peak Response Time</p>
                    <p className="text-xl font-bold text-gold-500 mt-1">{responseTimeStats.maxOverall}ms</p>
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
                    <p className={`${secondaryText} text-xs`}>Uptime This Period</p>
                    <p className={`text-xl font-bold ${textColor} mt-1`}>{apiHealth.uptimePercent}%</p>
                  </div>
                  <div className="pb-3 border-b border-grey-200">
                    <p className={`${secondaryText} text-xs`}>Avg Tokens/Message</p>
                    <p className={`text-xl font-bold ${textColor} mt-1`}>{apiHealth.avgTokensPerMessage}</p>
                  </div>
                  <div>
                    <p className={`${secondaryText} text-xs`}>API Calls/Min</p>
                    <p className={`text-xl font-bold ${textColor} mt-1`}>{apiHealth.apiCallsPerMinute}</p>
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
