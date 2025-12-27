'use client';

import { useState, useEffect } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Activity, 
  Database,
  FileText,
  Home,
  Users,
  Target,
  MessageSquare,
  Calendar,
  AlertTriangle,
} from 'lucide-react';
import { OverviewTab } from './tabs/overview';
import { TrendsTab } from './tabs/trends';
import { KnowledgeTab } from './tabs/knowledge';
import { RAGTab } from './tabs/rag';
import { DocumentsTab } from './tabs/documents';
import { EngagementTab } from './tabs/engagement';
import { UnitsTab } from './tabs/units';
import { QuestionsTab } from './tabs/questions';
import { useSafeCurrentContext } from '@/contexts/CurrentContext';
import { useCanonicalSuperadmin } from '@/hooks/useCanonicalAnalytics';
import { formatLastActivityTime, type CanonicalTimeWindow } from '@/lib/canonical-analytics';

type TabId = 'overview' | 'questions' | 'trends' | 'knowledge-gaps' | 'rag-performance' | 'documents' | 'homeowners' | 'units';
type TimeWindow = 7 | 14 | 30 | 90;

interface Tab {
  id: TabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const tabs: Tab[] = [
  { id: 'overview', label: 'Overview', icon: Target },
  { id: 'questions', label: 'Questions', icon: MessageSquare },
  { id: 'trends', label: 'Trends', icon: TrendingUp },
  { id: 'knowledge-gaps', label: 'Knowledge Gaps', icon: Activity },
  { id: 'rag-performance', label: 'RAG Performance', icon: Database },
  { id: 'documents', label: 'Documents', icon: FileText },
  { id: 'homeowners', label: 'Homeowners', icon: Users },
  { id: 'units', label: 'Units', icon: Home },
];

const timeWindows: { value: TimeWindow; label: string }[] = [
  { value: 7, label: 'Last 7 days' },
  { value: 14, label: 'Last 14 days' },
  { value: 30, label: 'Last 30 days' },
  { value: 90, label: 'Last 90 days' },
];

interface AnalyticsClientProps {
  tenantId: string;
}

function daysToCanonicalWindow(days: number): CanonicalTimeWindow {
  if (days <= 7) return '7d';
  if (days <= 14) return '14d';
  if (days <= 30) return '30d';
  return '90d';
}

export default function AnalyticsClient({ tenantId }: AnalyticsClientProps) {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [days, setDays] = useState<TimeWindow>(30);
  const { developmentId } = useSafeCurrentContext();
  
  const canonicalTimeWindow = daysToCanonicalWindow(days);
  const { data: canonicalSummary, error: canonicalError } = useCanonicalSuperadmin({
    project_id: developmentId ?? undefined,
    time_window: canonicalTimeWindow,
  });

  const hasAnalyticsErrors = canonicalSummary?.errors && canonicalSummary.errors.length > 0;
  const showConsistencyWarning = process.env.NODE_ENV === 'development' && hasAnalyticsErrors;

  const tabProps = { 
    tenantId, 
    developmentId: developmentId ?? undefined,
    days 
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
      {/* Hero Header */}
      <div className="bg-gradient-to-r from-gray-900 via-black to-gray-900 text-white border-b border-gold-500/30 shadow-xl">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="flex items-center gap-4 mb-3">
            <div className="p-3 bg-gradient-to-br from-gold-400 via-gold-500 to-gold-600 rounded-xl shadow-lg">
              <BarChart3 className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold tracking-tight">Enterprise Analytics Dashboard</h1>
              <p className="text-gray-300 text-base mt-1">
                Performance, engagement, RAG intelligence, and operational metrics across all developments
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 mt-4">
            <Calendar className="w-4 h-4 text-gray-400" />
            <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
              {timeWindows.map((tw) => (
                <button
                  key={tw.value}
                  onClick={() => setDays(tw.value)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                    days === tw.value
                      ? 'bg-gold-500 text-gray-900'
                      : 'text-gray-400 hover:text-white hover:bg-gray-700'
                  }`}
                >
                  {tw.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Sticky Tab Navigation */}
        <div className="sticky top-0 z-40 bg-gray-900 border-t border-gray-800 shadow-md">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex gap-1 overflow-x-auto scrollbar-hide">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`
                      flex items-center gap-2 px-6 py-4 text-sm font-medium transition-all whitespace-nowrap
                      border-b-2 hover:bg-gray-800
                      ${isActive 
                        ? 'border-gold-400 text-white bg-gray-800' 
                        : 'border-transparent text-gray-400 hover:text-white'
                      }
                    `}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Consistency Warning Banner (dev mode only) */}
      {showConsistencyWarning && (
        <div className="max-w-7xl mx-auto px-6 pt-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800">Analytics consistency check failed</p>
              <p className="text-xs text-amber-600 mt-1">
                {canonicalSummary?.errors.map(e => `${e.metric}: ${e.reason}`).join('; ')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Canonical Summary Quick Stats */}
      {canonicalSummary && !canonicalError && (
        <div className="max-w-7xl mx-auto px-6 pt-4">
          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Canonical Analytics Summary ({canonicalSummary.time_window})
              </h4>
              <div className="flex items-center gap-4">
                <span className="text-xs text-blue-600 font-medium">
                  {formatLastActivityTime(canonicalSummary.last_analytics_event_at)}
                </span>
                <span className="text-xs text-gray-400">Computed: {new Date(canonicalSummary.computed_at).toLocaleTimeString()}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900">{canonicalSummary.total_questions.toLocaleString()}</p>
                <p className="text-xs text-gray-500">Total Questions</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900">{canonicalSummary.questions_in_window.toLocaleString()}</p>
                <p className="text-xs text-gray-500">Questions ({canonicalSummary.time_window})</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900">{canonicalSummary.active_tenants_in_window.toLocaleString()}</p>
                <p className="text-xs text-gray-500">Active Users ({canonicalSummary.time_window})</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900">{canonicalSummary.qr_scans_in_window.toLocaleString()}</p>
                <p className="text-xs text-gray-500">QR Scans ({canonicalSummary.time_window})</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900">{canonicalSummary.signups_in_window.toLocaleString()}</p>
                <p className="text-xs text-gray-500">Signups ({canonicalSummary.time_window})</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{canonicalSummary.live_events_count.toLocaleString()}</p>
                <p className="text-xs text-gray-500">Live Events</p>
              </div>
            </div>
            {canonicalSummary.recovered_events_count > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-500">
                  <span className="font-medium text-blue-600">{canonicalSummary.recovered_events_count.toLocaleString()}</span> recovered events | 
                  <span className="font-medium text-purple-600 ml-1">{canonicalSummary.inferred_events_count.toLocaleString()}</span> inferred events
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Content Area */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {activeTab === 'overview' && <OverviewTab {...tabProps} />}
        {activeTab === 'questions' && <QuestionsTab {...tabProps} />}
        {activeTab === 'trends' && <TrendsTab {...tabProps} />}
        {activeTab === 'knowledge-gaps' && <KnowledgeTab {...tabProps} />}
        {activeTab === 'rag-performance' && <RAGTab {...tabProps} />}
        {activeTab === 'documents' && <DocumentsTab {...tabProps} />}
        {activeTab === 'homeowners' && <EngagementTab {...tabProps} />}
        {activeTab === 'units' && <UnitsTab {...tabProps} />}
      </div>
    </div>
  );
}
