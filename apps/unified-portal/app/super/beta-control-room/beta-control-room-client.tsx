'use client';

import { useState, useEffect, useCallback } from 'react';
import { Activity, Users, MessageSquare, FileText, Clock, AlertTriangle, QrCode, UserCheck, ChevronLeft, ChevronRight, HelpCircle, BookOpen, BarChart3, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

interface AnalyticsHealth {
  analyticsTableExists: boolean;
  lastInsertTimestamp: string | null;
  insertsLast5Minutes: number;
  insertsToday: number;
  insertsTotal: number;
  eventBreakdown: Record<string, number>;
  status: 'operational' | 'degraded' | 'error';
  checkedAt: string;
  error?: string;
}

interface KPIData {
  totalUnits: number;
  uniqueQrScans: number;
  totalSignups: number;
  activatedUsers: number;
  active24h: number;
  questions24h: number;
  questions7d: number;
  fallbackRate: number;
}

interface ActivityEvent {
  id: string;
  eventType: string;
  eventCategory: string | null;
  developmentName: string | null;
  houseTypeCode: string | null;
  createdAt: string;
  eventData: Record<string, any>;
}

interface TopQuestion {
  question: string;
  count: number;
  lastAsked: string;
  confidenceLevel?: string;
  developmentName?: string;
}

interface TrainingOpportunity {
  question: string;
  topic: string;
  developmentName: string | null;
  similarity: string;
  confidenceLevel: string;
  occurrences: number;
  lastAsked: string;
}

interface UnactivatedSignup {
  sessionHash: string;
  signupTime: string;
  developmentName: string | null;
  hoursSinceSignup: number;
}

interface UnansweredQuestion {
  question: string;
  topic: string;
  developmentName: string | null;
  reason: string;
  occurrences: number;
  lastAsked: string;
}

interface DocumentUsage {
  documentName: string;
  documentId: string | null;
  developmentName: string | null;
  usageCount: number;
  avgSimilarity: number;
  lastUsed: string;
}

interface ConversationStats {
  totalConversations: number;
  avgMessagesPerSession: number;
  singleMessageSessions: number;
  multiMessageSessions: number;
  deepConversations: number;
  sessionsByDepth: { depth: number; count: number }[];
}

interface BetaControlRoomData {
  kpis: KPIData;
  liveActivity: {
    events: ActivityEvent[];
    total: number;
  };
  topQuestions: {
    last24h: TopQuestion[];
    last7d: TopQuestion[];
  };
  trainingOpportunities: TrainingOpportunity[];
  unactivatedSignups: UnactivatedSignup[];
  unansweredQuestions: UnansweredQuestion[];
  documentUsage: {
    mostUsed: DocumentUsage[];
    leastUsed: DocumentUsage[];
  };
  conversationStats: ConversationStats;
}

function KPICard({ icon: Icon, label, value, subtext }: { icon: any; label: string; value: string | number; subtext?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center gap-3 mb-2">
        <Icon className="w-5 h-5 text-gold-600" />
        <span className="text-sm text-gray-500">{label}</span>
      </div>
      <div className="text-3xl font-bold text-gray-900">{value}</div>
      {subtext && <p className="text-xs text-gray-400 mt-1">{subtext}</p>}
    </div>
  );
}

function ConfidenceCheckPanel({ health }: { health: AnalyticsHealth | null }) {
  if (!health) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/3"></div>
      </div>
    );
  }

  const statusIcon = {
    operational: <CheckCircle2 className="w-5 h-5 text-green-500" />,
    degraded: <AlertCircle className="w-5 h-5 text-yellow-500" />,
    error: <XCircle className="w-5 h-5 text-red-500" />
  };

  const statusColors = {
    operational: 'bg-green-50 border-green-200',
    degraded: 'bg-yellow-50 border-yellow-200',
    error: 'bg-red-50 border-red-200'
  };

  const statusTextColors = {
    operational: 'text-green-700',
    degraded: 'text-yellow-700',
    error: 'text-red-700'
  };

  return (
    <div className={`rounded-lg border p-4 mb-6 ${statusColors[health.status]}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {statusIcon[health.status]}
          <span className={`font-semibold ${statusTextColors[health.status]}`}>
            Analytics Pipeline: {health.status.charAt(0).toUpperCase() + health.status.slice(1)}
          </span>
        </div>
        <span className="text-xs text-gray-500">
          Checked: {new Date(health.checkedAt).toLocaleTimeString()}
        </span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
        <div className="flex items-center gap-2">
          {health.analyticsTableExists ? (
            <CheckCircle2 className="w-4 h-4 text-green-500" />
          ) : (
            <XCircle className="w-4 h-4 text-red-500" />
          )}
          <span>Table exists</span>
        </div>
        <div>
          <span className="text-gray-500">Last insert:</span>{' '}
          <span className="font-medium">
            {health.lastInsertTimestamp 
              ? new Date(health.lastInsertTimestamp).toLocaleString() 
              : 'Never'}
          </span>
        </div>
        <div>
          <span className="text-gray-500">Last 5 min:</span>{' '}
          <span className="font-medium">{health.insertsLast5Minutes}</span>
        </div>
        <div>
          <span className="text-gray-500">Today:</span>{' '}
          <span className="font-medium">{health.insertsToday}</span>
        </div>
        <div>
          <span className="text-gray-500">Total:</span>{' '}
          <span className="font-medium">{health.insertsTotal}</span>
        </div>
      </div>
      {Object.keys(health.eventBreakdown).length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <span className="text-xs text-gray-500 uppercase tracking-wide">Event Types:</span>
          <div className="flex flex-wrap gap-2 mt-1">
            {Object.entries(health.eventBreakdown).map(([type, count]) => (
              <span key={type} className="inline-flex items-center px-2 py-1 bg-white rounded text-xs">
                {type}: <span className="font-medium ml-1">{count}</span>
              </span>
            ))}
          </div>
        </div>
      )}
      {health.error && (
        <div className="mt-3 p-2 bg-red-100 rounded text-sm text-red-700">
          Error: {health.error}
        </div>
      )}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="animate-pulse">
      <div className="h-8 bg-gold-100 rounded w-1/4 mb-6"></div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div key={i} className="h-28 bg-gold-50 border border-gold-100 rounded-xl"></div>
        ))}
      </div>
      <div className="h-64 bg-gold-50 border border-gold-100 rounded-lg mb-6"></div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-64 bg-gold-50 border border-gold-100 rounded-lg"></div>
        <div className="h-64 bg-gold-50 border border-gold-100 rounded-lg"></div>
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-8 text-gray-400">
      <p>{message}</p>
    </div>
  );
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatEventType(type: string): string {
  return type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

export default function BetaControlRoomClient() {
  const [data, setData] = useState<BetaControlRoomData | null>(null);
  const [health, setHealth] = useState<AnalyticsHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [hours, setHours] = useState<number>(24);
  const [developmentId, setDevelopmentId] = useState<string>('');
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('');
  const [page, setPage] = useState(0);
  const pageSize = 15;

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/super/analytics-health');
      if (res.ok) {
        const result = await res.json();
        setHealth(result);
      }
    } catch (err) {
      console.error('Failed to fetch analytics health:', err);
    }
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        hours: hours.toString(),
        limit: pageSize.toString(),
        offset: (page * pageSize).toString(),
      });
      if (developmentId) params.append('developmentId', developmentId);
      if (eventTypeFilter) params.append('eventType', eventTypeFilter);

      const res = await fetch(`/api/super/beta-control-room?${params}`);
      if (!res.ok) throw new Error('Failed to fetch data');
      const result = await res.json();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [hours, developmentId, eventTypeFilter, page]);

  useEffect(() => {
    fetchData();
    fetchHealth();
    const dataInterval = setInterval(fetchData, 30000);
    const healthInterval = setInterval(fetchHealth, 10000);
    return () => {
      clearInterval(dataInterval);
      clearInterval(healthInterval);
    };
  }, [fetchData, fetchHealth]);

  if (loading && !data) {
    return (
      <div className="p-8 bg-gray-50 min-h-screen">
        <LoadingState />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="p-8 bg-gray-50 min-h-screen">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
          <p className="text-red-600 font-medium">Failed to load data</p>
          <p className="text-red-500 text-sm mt-2">{error}</p>
        </div>
      </div>
    );
  }

  const kpis = data?.kpis || {
    totalUnits: 0,
    uniqueQrScans: 0,
    totalSignups: 0,
    activatedUsers: 0,
    active24h: 0,
    questions24h: 0,
    questions7d: 0,
    fallbackRate: 0,
  };

  const liveActivity = data?.liveActivity || { events: [], total: 0 };
  const topQuestions = data?.topQuestions || { last24h: [], last7d: [] };
  const trainingOpportunities = data?.trainingOpportunities || [];
  const unactivatedSignups = data?.unactivatedSignups || [];
  const unansweredQuestions = data?.unansweredQuestions || [];
  const documentUsage = data?.documentUsage || { mostUsed: [], leastUsed: [] };
  const conversationStats = data?.conversationStats || {
    totalConversations: 0,
    avgMessagesPerSession: 0,
    singleMessageSessions: 0,
    multiMessageSessions: 0,
    deepConversations: 0,
    sessionsByDepth: []
  };
  const totalPages = Math.ceil(liveActivity.total / pageSize);

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Beta Control Room</h1>
        <p className="text-gray-500 mt-1">Real-time monitoring for beta program activity</p>
      </div>

      <ConfidenceCheckPanel health={health} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <KPICard icon={FileText} label="Units" value={kpis.totalUnits.toLocaleString()} />
        <KPICard icon={QrCode} label="QR Scans" value={kpis.uniqueQrScans.toLocaleString()} />
        <KPICard icon={Users} label="Signups" value={kpis.totalSignups.toLocaleString()} />
        <KPICard icon={UserCheck} label="Activated" value={kpis.activatedUsers.toLocaleString()} />
        <KPICard icon={Activity} label="Active (24h)" value={kpis.active24h.toLocaleString()} />
        <KPICard icon={MessageSquare} label="Questions (24h)" value={kpis.questions24h.toLocaleString()} />
        <KPICard icon={MessageSquare} label="Questions (7d)" value={kpis.questions7d.toLocaleString()} />
        <KPICard icon={AlertTriangle} label="Fallback Rate" value={`${kpis.fallbackRate}%`} />
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-center">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Time Range</label>
            <select
              value={hours}
              onChange={(e) => { setHours(parseInt(e.target.value)); setPage(0); }}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-gold-500 focus:border-gold-500"
            >
              <option value="1">Last 1 Hour</option>
              <option value="24">Last 24 Hours</option>
              <option value="168">Last 7 Days</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Development (optional)</label>
            <input
              type="text"
              value={developmentId}
              onChange={(e) => { setDevelopmentId(e.target.value); setPage(0); }}
              placeholder="Development ID"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-gold-500 focus:border-gold-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Event Type</label>
            <select
              value={eventTypeFilter}
              onChange={(e) => { setEventTypeFilter(e.target.value); setPage(0); }}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-gold-500 focus:border-gold-500"
            >
              <option value="">All Events</option>
              <option value="qr_scan">QR Scan</option>
              <option value="purchaser_signup">Signup</option>
              <option value="purchaser_activate">Activation</option>
              <option value="chat_question">Question</option>
              <option value="chat_fallback">Fallback</option>
              <option value="document_open">Document Open</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm mb-6">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Activity className="w-5 h-5 text-gold-600" />
            Live Activity
            <span className="text-sm font-normal text-gray-400">({liveActivity.total} events)</span>
          </h2>
        </div>
        {liveActivity.events.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Time</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Event</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Development</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Category</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {liveActivity.events.map((event) => (
                    <tr key={event.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">
                        {formatDate(event.createdAt)}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gold-100 text-gold-800">
                          {formatEventType(event.eventType)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {event.developmentName || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {event.eventCategory || event.houseTypeCode || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  Page {page + 1} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="p-2 rounded border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                    className="p-2 rounded border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <EmptyState message="No activity recorded yet" />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-gold-600" />
              Top Questions (24h)
            </h2>
          </div>
          {topQuestions.last24h.length > 0 ? (
            <ul className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
              {topQuestions.last24h.map((q, idx) => (
                <li key={idx} className="px-6 py-4 flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gold-100 text-gold-700 text-xs font-bold flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 line-clamp-2">{q.question}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-400">{q.count} times</span>
                      {q.developmentName && (
                        <span className="text-xs text-gray-400">• {q.developmentName}</span>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState message="No questions yet" />
          )}
        </div>

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-gold-600" />
              Top Questions (7d)
            </h2>
          </div>
          {topQuestions.last7d.length > 0 ? (
            <ul className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
              {topQuestions.last7d.map((q, idx) => (
                <li key={idx} className="px-6 py-4 flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gold-100 text-gold-700 text-xs font-bold flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 line-clamp-2">{q.question}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-400">{q.count} times</span>
                      {q.developmentName && (
                        <span className="text-xs text-gray-400">• {q.developmentName}</span>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState message="No questions yet" />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-orange-200 shadow-sm">
          <div className="px-6 py-4 border-b border-orange-200 bg-orange-50">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              Training Opportunities
              <span className="text-xs font-normal text-gray-500">(Low confidence answers - 7d)</span>
            </h2>
          </div>
          {trainingOpportunities.length > 0 ? (
            <ul className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
              {trainingOpportunities.map((item, idx) => (
                <li key={idx} className="px-6 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700 line-clamp-2">{item.question}</p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                          {item.topic}
                        </span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          item.confidenceLevel === 'low' ? 'bg-red-100 text-red-700' :
                          item.confidenceLevel === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {item.confidenceLevel} confidence
                        </span>
                        <span className="text-xs text-gray-400">
                          Similarity: {(parseFloat(item.similarity) * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className="text-sm font-medium text-orange-600">{item.occurrences}x</span>
                      {item.developmentName && (
                        <p className="text-xs text-gray-400 mt-1">{item.developmentName}</p>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState message="No low-confidence answers - AI is performing well!" />
          )}
        </div>

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-gold-600" />
              Unactivated Signups
            </h2>
          </div>
          {unactivatedSignups.length > 0 ? (
            <ul className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
              {unactivatedSignups.map((signup, idx) => (
                <li key={idx} className="px-6 py-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-mono text-gray-600">
                      {signup.sessionHash.slice(0, 12)}...
                    </span>
                    <span className="text-xs text-orange-600 font-medium">
                      {signup.hoursSinceSignup}h ago
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {signup.developmentName || 'Unknown development'}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState message="All signups are active!" />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <div className="bg-white rounded-lg border border-red-200 shadow-sm">
          <div className="px-6 py-4 border-b border-red-200 bg-red-50">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-red-500" />
              Unanswered Questions
              <span className="text-xs font-normal text-gray-500">(Questions AI couldn't answer - 7d)</span>
            </h2>
          </div>
          {unansweredQuestions.length > 0 ? (
            <ul className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
              {unansweredQuestions.map((item, idx) => (
                <li key={idx} className="px-6 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700 line-clamp-2">{item.question}</p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {item.topic && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                            {item.topic}
                          </span>
                        )}
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
                          {item.reason === 'low_similarity_or_no_chunks' ? 'No matching docs' : item.reason}
                        </span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className="text-sm font-medium text-red-600">{item.occurrences}x</span>
                      {item.developmentName && (
                        <p className="text-xs text-gray-400 mt-1">{item.developmentName}</p>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState message="No unanswered questions - all queries matched documents!" />
          )}
        </div>

        <div className="bg-white rounded-lg border border-blue-200 shadow-sm">
          <div className="px-6 py-4 border-b border-blue-200 bg-blue-50">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-500" />
              Conversation Completion
              <span className="text-xs font-normal text-gray-500">(Session depth analysis - 7d)</span>
            </h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-900">{conversationStats.totalConversations}</div>
                <div className="text-xs text-gray-500">Total Sessions</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-900">{conversationStats.avgMessagesPerSession}</div>
                <div className="text-xs text-gray-500">Avg Messages/Session</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{conversationStats.singleMessageSessions}</div>
                <div className="text-xs text-gray-500">One-and-done</div>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{conversationStats.deepConversations}</div>
                <div className="text-xs text-gray-500">Deep (5+ msgs)</div>
              </div>
            </div>
            {conversationStats.sessionsByDepth.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Session Depth Distribution</h4>
                <div className="flex items-end gap-1 h-20">
                  {conversationStats.sessionsByDepth.map((item, idx) => {
                    const maxCount = Math.max(...conversationStats.sessionsByDepth.map(s => s.count));
                    const height = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
                    return (
                      <div key={idx} className="flex-1 flex flex-col items-center">
                        <div 
                          className="w-full bg-blue-400 rounded-t" 
                          style={{ height: `${height}%`, minHeight: item.count > 0 ? '4px' : '0' }}
                          title={`${item.count} sessions with ${item.depth}${item.depth >= 10 ? '+' : ''} messages`}
                        />
                        <span className="text-xs text-gray-400 mt-1">{item.depth}{item.depth >= 10 ? '+' : ''}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <div className="bg-white rounded-lg border border-green-200 shadow-sm">
          <div className="px-6 py-4 border-b border-green-200 bg-green-50">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-green-600" />
              Most Cited Documents
              <span className="text-xs font-normal text-gray-500">(7d)</span>
            </h2>
          </div>
          {documentUsage.mostUsed.length > 0 ? (
            <ul className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
              {documentUsage.mostUsed.map((doc, idx) => (
                <li key={idx} className="px-6 py-4 flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 truncate">{doc.documentName}</p>
                    {doc.developmentName && (
                      <p className="text-xs text-gray-400 mt-1">{doc.developmentName}</p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0 ml-4">
                    <span className="text-sm font-medium text-green-600">{doc.usageCount}x</span>
                    {doc.avgSimilarity > 0 && (
                      <p className="text-xs text-gray-400">{(doc.avgSimilarity * 100).toFixed(0)}% match</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState message="No document usage data yet" />
          )}
        </div>

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-gray-400" />
              Underutilized Documents
              <span className="text-xs font-normal text-gray-500">(Consider reviewing)</span>
            </h2>
          </div>
          {documentUsage.leastUsed.length > 0 ? (
            <ul className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
              {documentUsage.leastUsed.map((doc, idx) => (
                <li key={idx} className="px-6 py-4 flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 truncate">{doc.documentName}</p>
                    {doc.developmentName && (
                      <p className="text-xs text-gray-400 mt-1">{doc.developmentName}</p>
                    )}
                  </div>
                  <span className={`text-sm font-medium ${doc.usageCount === 0 ? 'text-gray-400' : 'text-gray-600'}`}>
                    {doc.usageCount === 0 ? 'Never cited' : `${doc.usageCount}x`}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState message="All documents are being used!" />
          )}
        </div>
      </div>
    </div>
  );
}
