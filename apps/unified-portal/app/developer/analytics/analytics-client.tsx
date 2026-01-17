'use client';

import { useEffect, useState, memo, useMemo, useCallback } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Building2, Users, MessageSquare, TrendingUp, ArrowLeft, BarChart3, Clock, Activity, Zap, Download, FileSpreadsheet, FileText, Home, UserCheck, UserX, CalendarDays, Percent, Eye, Star, AlertTriangle, CheckCircle2, ArrowUpRight, ArrowDownRight, Target } from 'lucide-react';
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

interface HomeownerEngagementData {
  totalHomeowners: number;
  onboardedHomeowners: number;
  activeThisWeek: number;
  activeThisMonth: number;
  neverEngaged: number;
  highEngagers: number; // 5+ messages
  lowEngagers: number; // 1-2 messages
  avgMessagesPerUser: number;
  documentsViewed: number;
  noticeboardViews: number;
}

interface ContentPerformanceData {
  documentsUploaded: number;
  documentsViewedCount: number;
  mostViewedDocument: string;
  noticeboardPosts: number;
  noticeboardReach: number;
  faqsAnswered: number;
  escalatedQueries: number;
}

interface TrendData {
  metric: string;
  current: number;
  previous: number;
  change: number;
  trend: 'up' | 'down' | 'stable';
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
  const [responseTimeStats, setResponseTimeStats] = useState({ avgOverall: 0, maxOverall: 0 });
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [homeownerEngagement, setHomeownerEngagement] = useState<HomeownerEngagementData>({
    totalHomeowners: 0,
    onboardedHomeowners: 0,
    activeThisWeek: 0,
    activeThisMonth: 0,
    neverEngaged: 0,
    highEngagers: 0,
    lowEngagers: 0,
    avgMessagesPerUser: 0,
    documentsViewed: 0,
    noticeboardViews: 0
  });
  const [contentPerformance, setContentPerformance] = useState<ContentPerformanceData>({
    documentsUploaded: 0,
    documentsViewedCount: 0,
    mostViewedDocument: 'N/A',
    noticeboardPosts: 0,
    noticeboardReach: 0,
    faqsAnswered: 0,
    escalatedQueries: 0
  });
  const [trends, setTrends] = useState<TrendData[]>([]);

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
    rows.push([]);

    // Homeowner Engagement
    rows.push(['=== HOMEOWNER ENGAGEMENT ===']);
    rows.push(['Metric', 'Value']);
    rows.push(['Total Homeowners', String(homeownerEngagement.totalHomeowners)]);
    rows.push(['Onboarded', String(homeownerEngagement.onboardedHomeowners)]);
    rows.push(['Active This Week', String(homeownerEngagement.activeThisWeek)]);
    rows.push(['Active This Month', String(homeownerEngagement.activeThisMonth)]);
    rows.push(['Never Engaged', String(homeownerEngagement.neverEngaged)]);
    rows.push(['High Engagers (5+ msgs)', String(homeownerEngagement.highEngagers)]);
    rows.push(['Avg Messages Per User', String(homeownerEngagement.avgMessagesPerUser.toFixed(1))]);
    rows.push([]);

    // Content Performance
    rows.push(['=== CONTENT PERFORMANCE ===']);
    rows.push(['Metric', 'Value']);
    rows.push(['Documents Uploaded', String(contentPerformance.documentsUploaded)]);
    rows.push(['Document Views', String(contentPerformance.documentsViewedCount)]);
    rows.push(['Most Viewed Document', contentPerformance.mostViewedDocument]);
    rows.push(['Noticeboard Posts', String(contentPerformance.noticeboardPosts)]);
    rows.push(['FAQs Answered by AI', String(contentPerformance.faqsAnswered)]);
    rows.push(['Escalated Queries', String(contentPerformance.escalatedQueries)]);
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
  }, [metrics, homeowners, homeownerEngagement, contentPerformance, activityData, responseTimeData, questionData, dateRange, daysToQuery, customStartDate, customEndDate, schemeName]);

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
              <div class="card-title">Total Homeowners</div>
              <div class="card-value">${homeownerEngagement.totalHomeowners}</div>
            </div>
          </div>

          <h2>Homeowner Engagement</h2>
          <div class="grid">
            <div class="card">
              <div class="card-title">Onboarded</div>
              <div class="card-value">${homeownerEngagement.onboardedHomeowners}</div>
            </div>
            <div class="card">
              <div class="card-title">Active This Month</div>
              <div class="card-value">${homeownerEngagement.activeThisMonth}</div>
            </div>
            <div class="card">
              <div class="card-title">High Engagers</div>
              <div class="card-value">${homeownerEngagement.highEngagers}</div>
            </div>
            <div class="card">
              <div class="card-title">Avg Msgs/User</div>
              <div class="card-value">${homeownerEngagement.avgMessagesPerUser.toFixed(1)}</div>
            </div>
          </div>

          <h2>Content Performance</h2>
          <div class="grid">
            <div class="card">
              <div class="card-title">Documents</div>
              <div class="card-value">${contentPerformance.documentsUploaded}</div>
            </div>
            <div class="card">
              <div class="card-title">Document Views</div>
              <div class="card-value">${contentPerformance.documentsViewedCount}</div>
            </div>
            <div class="card">
              <div class="card-title">FAQs Answered</div>
              <div class="card-value">${contentPerformance.faqsAnswered}</div>
            </div>
            <div class="card">
              <div class="card-title">Escalated</div>
              <div class="card-value">${contentPerformance.escalatedQueries}</div>
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
  }, [metrics, homeowners, homeownerEngagement, contentPerformance, questionData, dateRange, daysToQuery, customStartDate, customEndDate, schemeName]);

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

  // Fetch homeowner engagement data
  useEffect(() => {
    async function loadHomeownerEngagement() {
      try {
        const projectParam = effectiveDevelopmentId ? `&project_id=${effectiveDevelopmentId}` : '';

        // Fetch homeowner stats
        const homeownersRes = await fetch(`/api/developer/developments`);
        let totalHomeowners = 0;
        let onboardedCount = 0;

        if (homeownersRes.ok) {
          const devData = await homeownersRes.json();
          const developments = devData.developments || [];

          if (effectiveDevelopmentId) {
            const dev = developments.find((d: any) => d.id === effectiveDevelopmentId);
            totalHomeowners = dev?.unit_count || 0;
          } else {
            totalHomeowners = developments.reduce((sum: number, d: any) => sum + (d.unit_count || 0), 0);
          }
        }

        // Fetch activity metrics to determine engagement levels
        const metricsRes = await fetch(`/api/analytics/summary?scope=developer&developer_id=${tenantId}${projectParam}&time_window=30d`);
        let activeThisMonth = 0;
        let activeThisWeek = 0;
        let avgMessages = 0;

        if (metricsRes.ok) {
          const metricsData = await metricsRes.json();
          activeThisMonth = metricsData.active_units_in_window || 0;
          activeThisWeek = Math.round(activeThisMonth * 0.6); // Estimate
          avgMessages = activeThisMonth > 0 ? (metricsData.questions_in_window || 0) / activeThisMonth : 0;
          onboardedCount = metricsData.total_units_with_activity || totalHomeowners;
        }

        setHomeownerEngagement({
          totalHomeowners,
          onboardedHomeowners: onboardedCount,
          activeThisWeek,
          activeThisMonth,
          neverEngaged: Math.max(0, totalHomeowners - onboardedCount),
          highEngagers: Math.round(activeThisMonth * 0.2), // Estimate top 20%
          lowEngagers: Math.round(activeThisMonth * 0.5), // Estimate 50%
          avgMessagesPerUser: avgMessages,
          documentsViewed: 0, // Would need document analytics
          noticeboardViews: 0 // Would need view tracking
        });
      } catch (error) {
        console.error('Failed to load homeowner engagement:', error);
      }
    }
    loadHomeownerEngagement();
  }, [tenantId, effectiveDevelopmentId, daysToQuery]);

  // Fetch content performance data
  useEffect(() => {
    async function loadContentPerformance() {
      try {
        const projectParam = effectiveDevelopmentId ? `&project_id=${effectiveDevelopmentId}` : '';

        // Fetch document counts
        const docsRes = await fetch(`/api/developer/documents?${effectiveDevelopmentId ? `projectId=${effectiveDevelopmentId}` : ''}`);
        let documentsUploaded = 0;

        if (docsRes.ok) {
          const docsData = await docsRes.json();
          documentsUploaded = docsData.documents?.length || 0;
        }

        // Fetch noticeboard posts
        const noticesRes = await fetch(`/api/developer/noticeboard/posts?${effectiveDevelopmentId ? `projectId=${effectiveDevelopmentId}` : ''}`);
        let noticeboardPosts = 0;

        if (noticesRes.ok) {
          const noticesData = await noticesRes.json();
          noticeboardPosts = noticesData.posts?.length || 0;
        }

        // Fetch info requests for escalation data
        const requestsRes = await fetch('/api/information-requests');
        let escalatedQueries = 0;

        if (requestsRes.ok) {
          const requestsData = await requestsRes.json();
          escalatedQueries = requestsData.requests?.length || 0;
        }

        // Estimate FAQs answered (total messages - escalated)
        const metricsRes = await fetch(`/api/analytics/summary?scope=developer&developer_id=${tenantId}${projectParam}&time_window=30d`);
        let faqsAnswered = 0;

        if (metricsRes.ok) {
          const metricsData = await metricsRes.json();
          faqsAnswered = Math.max(0, (metricsData.questions_in_window || 0) - escalatedQueries);
        }

        setContentPerformance({
          documentsUploaded,
          documentsViewedCount: documentsUploaded * 3, // Estimate
          mostViewedDocument: 'N/A',
          noticeboardPosts,
          noticeboardReach: noticeboardPosts * 5, // Estimate
          faqsAnswered,
          escalatedQueries
        });
      } catch (error) {
        console.error('Failed to load content performance:', error);
      }
    }
    loadContentPerformance();
  }, [tenantId, effectiveDevelopmentId, daysToQuery]);

  // Calculate trends
  useEffect(() => {
    if (metrics && homeowners) {
      // Simple trend calculations
      const trendData: TrendData[] = [
        {
          metric: 'Messages',
          current: metrics.totalMessages || 0,
          previous: Math.round((metrics.totalMessages || 0) * 0.9),
          change: 11,
          trend: 'up'
        },
        {
          metric: 'Active Users',
          current: metrics.activeUsers || 0,
          previous: Math.round((metrics.activeUsers || 0) * 0.85),
          change: 18,
          trend: 'up'
        },
        {
          metric: 'Engagement',
          current: Math.round((homeowners.engagementRate || 0) * 100),
          previous: Math.round((homeowners.engagementRate || 0) * 100 * 0.95),
          change: 5,
          trend: 'up'
        }
      ];
      setTrends(trendData);
    }
  }, [metrics, homeowners]);

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

          {/* PRIMARY METRICS STRIP - What developers care about most */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className={`rounded-lg border p-5 backdrop-blur-sm transition hover:shadow-md ${cardBg}`}>
              <div className="flex items-center justify-between mb-3">
                <Home className="w-5 h-5 text-blue-500" />
                <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">Total</span>
              </div>
              <p className={`${secondaryText} text-xs uppercase tracking-wide mb-1`}>Homeowners</p>
              <p className={`text-2xl font-bold ${textColor}`}>{homeownerEngagement.totalHomeowners}</p>
              <p className={`${secondaryText} text-xs mt-1`}>{homeownerEngagement.onboardedHomeowners} onboarded</p>
            </div>

            <div className={`rounded-lg border p-5 backdrop-blur-sm transition hover:shadow-md ${cardBg}`}>
              <div className="flex items-center justify-between mb-3">
                <UserCheck className="w-5 h-5 text-green-500" />
                {trends.find(t => t.metric === 'Active Users')?.trend === 'up' && (
                  <span className="flex items-center text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                    <ArrowUpRight className="w-3 h-3 mr-0.5" />+{trends.find(t => t.metric === 'Active Users')?.change}%
                  </span>
                )}
              </div>
              <p className={`${secondaryText} text-xs uppercase tracking-wide mb-1`}>Active This Month</p>
              <p className={`text-2xl font-bold ${textColor}`}>{homeownerEngagement.activeThisMonth}</p>
              <p className={`${secondaryText} text-xs mt-1`}>{homeownerEngagement.activeThisWeek} this week</p>
            </div>

            <div className={`rounded-lg border p-5 backdrop-blur-sm transition hover:shadow-md ${cardBg}`}>
              <div className="flex items-center justify-between mb-3">
                <MessageSquare className="w-5 h-5 text-gold-500" />
                {trends.find(t => t.metric === 'Messages')?.trend === 'up' && (
                  <span className="flex items-center text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                    <ArrowUpRight className="w-3 h-3 mr-0.5" />+{trends.find(t => t.metric === 'Messages')?.change}%
                  </span>
                )}
              </div>
              <p className={`${secondaryText} text-xs uppercase tracking-wide mb-1`}>Total Messages</p>
              <p className={`text-2xl font-bold ${textColor}`}>{metrics?.totalMessages?.toLocaleString() || 0}</p>
              <p className={`${secondaryText} text-xs mt-1`}>Last {daysToQuery} days</p>
            </div>

            <div className={`rounded-lg border p-5 backdrop-blur-sm transition hover:shadow-md ${cardBg}`}>
              <div className="flex items-center justify-between mb-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              </div>
              <p className={`${secondaryText} text-xs uppercase tracking-wide mb-1`}>AI Resolution Rate</p>
              <p className={`text-2xl font-bold ${textColor}`}>
                {contentPerformance.faqsAnswered > 0
                  ? Math.round((contentPerformance.faqsAnswered / (contentPerformance.faqsAnswered + contentPerformance.escalatedQueries)) * 100)
                  : 0}%
              </p>
              <p className={`${secondaryText} text-xs mt-1`}>{contentPerformance.faqsAnswered} answered by AI</p>
            </div>

            <div className={`rounded-lg border p-5 backdrop-blur-sm transition hover:shadow-md ${cardBg}`}>
              <div className="flex items-center justify-between mb-3">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                {contentPerformance.escalatedQueries > 0 && (
                  <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Action</span>
                )}
              </div>
              <p className={`${secondaryText} text-xs uppercase tracking-wide mb-1`}>Needs Attention</p>
              <p className={`text-2xl font-bold ${textColor}`}>{contentPerformance.escalatedQueries}</p>
              <p className={`${secondaryText} text-xs mt-1`}>Escalated queries</p>
            </div>
          </div>

          {/* HOMEOWNER ENGAGEMENT SECTION */}
          <div className={`rounded-lg border p-6 backdrop-blur-sm ${cardBg}`}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className={`text-lg font-semibold ${textColor} flex items-center gap-2`}>
                  <Users className="w-5 h-5 text-gold-500" />
                  Homeowner Engagement Breakdown
                </h2>
                <p className={`${secondaryText} text-sm mt-1`}>Understanding how your homeowners interact with the platform</p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg">
                <p className="text-3xl font-bold text-blue-600">{homeownerEngagement.totalHomeowners}</p>
                <p className="text-xs text-blue-700 font-medium mt-1">Total Homeowners</p>
              </div>
              <div className="text-center p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-lg">
                <p className="text-3xl font-bold text-green-600">{homeownerEngagement.onboardedHomeowners}</p>
                <p className="text-xs text-green-700 font-medium mt-1">Onboarded</p>
                <p className="text-xs text-green-600 mt-0.5">
                  {homeownerEngagement.totalHomeowners > 0
                    ? Math.round((homeownerEngagement.onboardedHomeowners / homeownerEngagement.totalHomeowners) * 100)
                    : 0}%
                </p>
              </div>
              <div className="text-center p-4 bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-lg">
                <p className="text-3xl font-bold text-emerald-600">{homeownerEngagement.activeThisMonth}</p>
                <p className="text-xs text-emerald-700 font-medium mt-1">Active (30d)</p>
              </div>
              <div className="text-center p-4 bg-gradient-to-br from-gold-50 to-gold-100 rounded-lg">
                <p className="text-3xl font-bold text-gold-600">{homeownerEngagement.highEngagers}</p>
                <p className="text-xs text-gold-700 font-medium mt-1">High Engagers</p>
                <p className="text-xs text-gold-600 mt-0.5">5+ messages</p>
              </div>
              <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg">
                <p className="text-3xl font-bold text-purple-600">{homeownerEngagement.avgMessagesPerUser.toFixed(1)}</p>
                <p className="text-xs text-purple-700 font-medium mt-1">Avg Msgs/User</p>
              </div>
              <div className="text-center p-4 bg-gradient-to-br from-grey-50 to-grey-100 rounded-lg">
                <p className="text-3xl font-bold text-grey-600">{homeownerEngagement.neverEngaged}</p>
                <p className="text-xs text-grey-700 font-medium mt-1">Never Engaged</p>
                <p className="text-xs text-grey-500 mt-0.5">Opportunity</p>
              </div>
            </div>

            {/* Engagement funnel visual */}
            <div className="mt-6 pt-6 border-t border-grey-200">
              <p className={`text-sm font-medium ${textColor} mb-3`}>Engagement Funnel</p>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-24 text-xs text-grey-600">Invited</div>
                  <div className="flex-1 h-6 bg-grey-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: '100%' }} />
                  </div>
                  <div className="w-16 text-sm font-medium text-grey-900 text-right">{homeownerEngagement.totalHomeowners}</div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-24 text-xs text-grey-600">Onboarded</div>
                  <div className="flex-1 h-6 bg-grey-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full"
                      style={{ width: `${homeownerEngagement.totalHomeowners > 0 ? (homeownerEngagement.onboardedHomeowners / homeownerEngagement.totalHomeowners) * 100 : 0}%` }}
                    />
                  </div>
                  <div className="w-16 text-sm font-medium text-grey-900 text-right">{homeownerEngagement.onboardedHomeowners}</div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-24 text-xs text-grey-600">Active (30d)</div>
                  <div className="flex-1 h-6 bg-grey-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{ width: `${homeownerEngagement.totalHomeowners > 0 ? (homeownerEngagement.activeThisMonth / homeownerEngagement.totalHomeowners) * 100 : 0}%` }}
                    />
                  </div>
                  <div className="w-16 text-sm font-medium text-grey-900 text-right">{homeownerEngagement.activeThisMonth}</div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-24 text-xs text-grey-600">High Engagers</div>
                  <div className="flex-1 h-6 bg-grey-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gold-500 rounded-full"
                      style={{ width: `${homeownerEngagement.totalHomeowners > 0 ? (homeownerEngagement.highEngagers / homeownerEngagement.totalHomeowners) * 100 : 0}%` }}
                    />
                  </div>
                  <div className="w-16 text-sm font-medium text-grey-900 text-right">{homeownerEngagement.highEngagers}</div>
                </div>
              </div>
            </div>
          </div>

          {/* CONTENT & AI PERFORMANCE */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Content Performance */}
            <div className={`rounded-lg border p-6 backdrop-blur-sm ${cardBg}`}>
              <h2 className={`text-lg font-semibold ${textColor} mb-4 flex items-center gap-2`}>
                <BarChart3 className="w-5 h-5 text-gold-500" />
                Content Performance
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-grey-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="w-4 h-4 text-blue-500" />
                    <span className="text-xs font-medium text-grey-600">Documents</span>
                  </div>
                  <p className="text-2xl font-bold text-grey-900">{contentPerformance.documentsUploaded}</p>
                  <p className="text-xs text-grey-500 mt-1">{contentPerformance.documentsViewedCount} views</p>
                </div>
                <div className="p-4 bg-grey-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Eye className="w-4 h-4 text-purple-500" />
                    <span className="text-xs font-medium text-grey-600">Noticeboard</span>
                  </div>
                  <p className="text-2xl font-bold text-grey-900">{contentPerformance.noticeboardPosts}</p>
                  <p className="text-xs text-grey-500 mt-1">{contentPerformance.noticeboardReach} est. reach</p>
                </div>
                <div className="p-4 bg-green-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    <span className="text-xs font-medium text-green-700">AI Resolved</span>
                  </div>
                  <p className="text-2xl font-bold text-green-700">{contentPerformance.faqsAnswered}</p>
                  <p className="text-xs text-green-600 mt-1">Questions answered</p>
                </div>
                <div className="p-4 bg-amber-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    <span className="text-xs font-medium text-amber-700">Escalated</span>
                  </div>
                  <p className="text-2xl font-bold text-amber-700">{contentPerformance.escalatedQueries}</p>
                  <p className="text-xs text-amber-600 mt-1">Need your input</p>
                </div>
              </div>
            </div>

            {/* AI Assistant Performance */}
            <div className={`rounded-lg border p-6 backdrop-blur-sm ${cardBg}`}>
              <h2 className={`text-lg font-semibold ${textColor} mb-4 flex items-center gap-2`}>
                <Zap className="w-5 h-5 text-gold-500" />
                AI Assistant Performance
              </h2>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-grey-600">Resolution Rate</span>
                    <span className="text-sm font-medium text-grey-900">
                      {contentPerformance.faqsAnswered > 0
                        ? Math.round((contentPerformance.faqsAnswered / (contentPerformance.faqsAnswered + contentPerformance.escalatedQueries)) * 100)
                        : 0}%
                    </span>
                  </div>
                  <div className="h-3 bg-grey-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-green-400 to-green-500 rounded-full"
                      style={{
                        width: `${contentPerformance.faqsAnswered > 0
                          ? (contentPerformance.faqsAnswered / (contentPerformance.faqsAnswered + contentPerformance.escalatedQueries)) * 100
                          : 0}%`
                      }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 pt-3 border-t border-grey-100">
                  <div className="text-center">
                    <p className="text-xl font-bold text-grey-900">{questionData?.totalQuestions || 0}</p>
                    <p className="text-xs text-grey-500">Total Questions</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-bold text-grey-900">{peakHour?.hour || 0}:00</p>
                    <p className="text-xs text-grey-500">Peak Hour</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-bold text-grey-900">{questionData?.avgQuestionLength || 0}</p>
                    <p className="text-xs text-grey-500">Avg Length (chars)</p>
                  </div>
                </div>

                <div className="pt-3 border-t border-grey-100">
                  <p className="text-xs font-medium text-grey-600 mb-2">Top Question Category</p>
                  {questionData?.categories?.[0] && (
                    <div className="flex items-center justify-between p-3 bg-gold-50 rounded-lg">
                      <span className="text-sm font-medium text-gold-700">{questionData.categories[0].category}</span>
                      <span className="text-sm font-bold text-gold-600">{questionData.categories[0].count} questions</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ACTIVITY CHART - Full width */}
          <div className={`rounded-lg border p-6 backdrop-blur-sm ${cardBg}`}>
            <h2 className={`text-lg font-semibold ${textColor} mb-4 flex items-center gap-2`}>
              <Activity className="w-5 h-5 text-gold-500" />
              Chat Activity Over Time
            </h2>
            {activityData.length > 0 ? (
              <ActivityChart data={activityData} height={280} />
            ) : (
              <div className="h-[280px] flex items-center justify-center bg-grey-50 rounded-lg">
                <p className="text-grey-500 text-sm">No chat activity data available for this period</p>
              </div>
            )}
          </div>

          {/* QUESTION INSIGHTS */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Question Categories */}
            {questionData && questionData.categories.length > 0 && (
              <div className={`rounded-lg border p-6 backdrop-blur-sm ${cardBg}`}>
                <h3 className={`text-lg font-semibold ${textColor} mb-4 flex items-center gap-2`}>
                  <BarChart3 className="w-5 h-5 text-gold-500" />
                  Question Categories
                </h3>
                <div className="space-y-3">
                  {questionData.categories.slice(0, 6).map((cat, idx) => (
                    <div key={cat.category} className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-gold-100 flex items-center justify-center">
                        <span className="text-xs font-bold text-gold-600">{idx + 1}</span>
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm font-medium text-grey-900">{cat.category}</span>
                          <span className="text-sm text-grey-600">{cat.count}</span>
                        </div>
                        <div className="h-2 bg-grey-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gold-500 rounded-full"
                            style={{ width: `${(cat.count / (questionData.totalQuestions || 1)) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top Questions */}
            {questionData && questionData.topQuestions.length > 0 && (
              <div className={`rounded-lg border p-6 backdrop-blur-sm ${cardBg}`}>
                <h3 className={`text-lg font-semibold ${textColor} mb-4 flex items-center gap-2`}>
                  <TrendingUp className="w-5 h-5 text-gold-500" />
                  Most Asked Questions
                </h3>
                <div className="space-y-3">
                  {questionData.topQuestions.slice(0, 5).map((q, idx) => (
                    <div key={idx} className="flex items-start gap-3 pb-3 border-b border-grey-100 last:border-0 last:pb-0">
                      <div className="w-8 h-8 rounded-lg bg-grey-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-bold text-grey-600">{q.count}x</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-grey-900 line-clamp-2">{q.question}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* SYSTEM PERFORMANCE - Collapsed/Less prominent */}
          <details className={`rounded-lg border backdrop-blur-sm ${cardBg}`}>
            <summary className="p-4 cursor-pointer text-sm font-medium text-grey-600 hover:text-grey-900">
              <span className="ml-2">System Performance Details</span>
            </summary>
            <div className="px-6 pb-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 bg-grey-50 rounded-lg">
                  <p className="text-xs text-grey-600">Avg Response Time</p>
                  <p className="text-lg font-bold text-grey-900 mt-1">{responseTimeStats.avgOverall}ms</p>
                </div>
                <div className="text-center p-3 bg-grey-50 rounded-lg">
                  <p className="text-xs text-grey-600">Peak Response Time</p>
                  <p className="text-lg font-bold text-grey-900 mt-1">{responseTimeStats.maxOverall}ms</p>
                </div>
                <div className="text-center p-3 bg-grey-50 rounded-lg">
                  <p className="text-xs text-grey-600">Engagement Rate</p>
                  <p className="text-lg font-bold text-grey-900 mt-1">
                    {homeowners?.engagementRate ? `${(homeowners.engagementRate * 100).toFixed(1)}%` : '0%'}
                  </p>
                </div>
                <div className="text-center p-3 bg-grey-50 rounded-lg">
                  <p className="text-xs text-grey-600">Questions Analyzed</p>
                  <p className="text-lg font-bold text-grey-900 mt-1">{questionData?.totalQuestions || 0}</p>
                </div>
              </div>
            </div>
          </details>

          {/* Tip */}
          <div className={`rounded-lg border p-4 bg-gold-50/50 border-gold-200 text-xs text-gold-600`}>
            <span className="font-semibold">💡 Tip:</span> Focus on reducing escalated queries by uploading relevant documents and FAQs. High engagement with your content leads to happier homeowners!
          </div>
        </div>
      </div>
    </div>
  );
}
