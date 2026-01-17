'use client';

import { useEffect, useState, memo, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Users, Building2, FileCheck, TrendingUp, ArrowRight, AlertCircle, ChevronRight, FileText, Settings, Sparkles, Plus, X, Send, Clock, MessageSquare, Activity, Zap, Target, CheckCircle2, ArrowUpRight, Calendar } from 'lucide-react';
import Link from 'next/link';
import { ChartLoadingSkeleton } from '@/components/ui/ChartLoadingSkeleton';

const TopQuestionsChart = dynamic(
  () => import('./dashboard-charts').then(mod => ({ default: mod.TopQuestionsChart })),
  { ssr: false, loading: () => <ChartLoadingSkeleton height={280} /> }
);

const OnboardingFunnelChart = dynamic(
  () => import('./dashboard-charts').then(mod => ({ default: mod.OnboardingFunnelChart })),
  { ssr: false, loading: () => <ChartLoadingSkeleton height={200} /> }
);

const ChatActivityChart = dynamic(
  () => import('./dashboard-charts').then(mod => ({ default: mod.ChatActivityChart })),
  { ssr: false, loading: () => <ChartLoadingSkeleton height={200} /> }
);

interface KpiData {
  value: number;
  label: string;
  description: string;
  suffix: string;
  growth?: number;
  delta?: number;
  inactiveCount?: number;
  pendingCount?: number;
}

interface DashboardData {
  requestId?: string;
  kpis: {
    onboardingRate: KpiData;
    engagementRate: KpiData;
    documentCoverage: KpiData;
    mustReadCompliance: KpiData;
  };
  questionTopics: Array<{ topic: string; label: string; count: number }>;
  chatActivity: Array<{ date: string; count: number }>;
  onboardingFunnel: Array<{ stage: string; count: number; colour: string }>;
  unansweredQueries: Array<{ question: string; topic: string; date: string }>;
  houseTypeEngagement: Array<{ houseType: string; activeUsers: number; messageCount: number }>;
  summary: {
    totalUnits: number;
    registeredHomeowners: number;
    activeHomeowners: number;
    totalMessages: number;
    messageGrowth: number;
    totalDocuments: number;
  };
}

interface DashboardError {
  error: string;
  details?: string;
  requestId?: string;
  endpoint?: string;
}

function KpiCard({ 
  icon: Icon, 
  iconColour, 
  value, 
  label, 
  description, 
  suffix = '', 
  growth,
  delta,
  actionLink,
  actionLabel,
  isDarkMode 
}: { 
  icon: any; 
  iconColour: string; 
  value: number; 
  label: string; 
  description: string; 
  suffix?: string;
  growth?: number;
  delta?: number;
  actionLink?: string;
  actionLabel?: string;
  isDarkMode: boolean;
}) {
  const cardBg = isDarkMode ? 'bg-gray-800/50 border-gray-700' : 'bg-white/80 border-gray-200';
  const textColor = isDarkMode ? 'text-white' : 'text-gray-900';
  const secondaryText = isDarkMode ? 'text-gray-300' : 'text-gray-600';

  return (
    <div className={`rounded-xl border p-6 backdrop-blur-sm transition hover:shadow-md ${cardBg}`}>
      <div className="flex items-center justify-between mb-4">
        <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
          <Icon className={`w-5 h-5 ${iconColour}`} />
        </div>
        {delta !== undefined && delta !== 0 && (
          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
            delta > 0 
              ? 'text-green-600 bg-green-500/10' 
              : 'text-amber-600 bg-amber-500/10'
          }`} title="vs previous 30 days">
            {delta > 0 ? '+' : ''}{delta} pp
          </span>
        )}
        {(delta === undefined || delta === 0) && growth !== undefined && growth !== 0 && (
          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
            growth >= 0 
              ? 'text-green-600 bg-green-500/10' 
              : 'text-red-600 bg-red-500/10'
          }`}>
            {growth >= 0 ? '+' : ''}{growth}%
          </span>
        )}
      </div>
      <p className={`${secondaryText} text-xs uppercase tracking-wide mb-1`}>{label}</p>
      <p className={`text-3xl font-bold ${textColor}`}>
        {value}{suffix}
      </p>
      <p className={`${secondaryText} text-xs mt-2`}>{description}</p>
      {actionLink && actionLabel && (
        <Link href={actionLink} className="text-xs text-gold-500 hover:text-gold-600 mt-3 inline-block hover:underline">
          {actionLabel} →
        </Link>
      )}
    </div>
  );
}

function UnansweredQueriesCard({ 
  queries, 
  isDarkMode 
}: { 
  queries: Array<{ question: string; topic: string; date: string }>; 
  isDarkMode: boolean;
}) {
  const cardBg = isDarkMode ? 'bg-gray-800/50 border-gray-700' : 'bg-white/80 border-gray-200';
  const textColor = isDarkMode ? 'text-white' : 'text-gray-900';
  const secondaryText = isDarkMode ? 'text-gray-300' : 'text-gray-600';

  if (queries.length === 0) {
    return (
      <div className={`rounded-xl border p-6 backdrop-blur-sm ${cardBg}`}>
        <div className="flex items-center gap-2 mb-4">
          <AlertCircle className="w-5 h-5 text-amber-500" />
          <h2 className={`text-lg font-semibold ${textColor}`}>Knowledge Gaps</h2>
        </div>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className={`p-3 rounded-full ${isDarkMode ? 'bg-green-900/30' : 'bg-green-100'} mb-3`}>
            <FileCheck className="w-6 h-6 text-green-600" />
          </div>
          <p className={`font-medium ${textColor}`}>All questions answered</p>
          <p className={`text-sm ${secondaryText}`}>Your documentation is covering queries well</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border p-6 backdrop-blur-sm ${cardBg}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-amber-500" />
          <h2 className={`text-lg font-semibold ${textColor}`}>Knowledge Gaps</h2>
        </div>
        <span className={`text-xs ${secondaryText}`}>{queries.length} queries need attention</span>
      </div>
      <div className="space-y-3">
        {queries.map((query, index) => (
          <div 
            key={index} 
            className={`p-3 rounded-lg ${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-50'}`}
          >
            <p className={`text-sm ${textColor} line-clamp-2`}>{query.question}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className={`text-xs px-2 py-0.5 rounded-full ${isDarkMode ? 'bg-amber-900/30 text-amber-400' : 'bg-amber-100 text-amber-700'}`}>
                {query.topic}
              </span>
            </div>
          </div>
        ))}
      </div>
      <p className={`text-xs ${secondaryText} mt-4`}>
        Consider uploading more documents on these topics
      </p>
    </div>
  );
}

interface Development {
  id: string;
  name: string;
  address: string | null;
  is_active: boolean;
  unitCount?: number;
  activeUnitCount?: number;
}

function DevelopmentsCard({ isDarkMode }: { isDarkMode: boolean }) {
  const [developments, setDevelopments] = useState<Development[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestForm, setRequestForm] = useState({
    proposedName: '',
    locationCounty: '',
    locationAddress: '',
    estimatedUnits: '',
    targetGoLive: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [requestSuccess, setRequestSuccess] = useState(false);

  const cardBg = isDarkMode ? 'bg-gray-800/50 border-gray-700' : 'bg-white/80 border-gray-200';
  const textColor = isDarkMode ? 'text-white' : 'text-gray-900';
  const secondaryText = isDarkMode ? 'text-gray-300' : 'text-gray-600';

  useEffect(() => {
    const fetchDevelopments = async () => {
      try {
        const response = await fetch('/api/developments');
        if (response.ok) {
          const data = await response.json();
          setDevelopments(data.developments || []);
        }
      } catch (err) {
        console.error('Failed to fetch developments:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchDevelopments();
  }, []);

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestForm.proposedName.trim()) return;
    
    setSubmitting(true);
    try {
      const response = await fetch('/api/development-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestForm),
      });
      
      if (response.ok) {
        setRequestSuccess(true);
        setRequestForm({
          proposedName: '',
          locationCounty: '',
          locationAddress: '',
          estimatedUnits: '',
          targetGoLive: '',
          notes: '',
        });
        setTimeout(() => {
          setShowRequestModal(false);
          setRequestSuccess(false);
        }, 2000);
      }
    } catch (err) {
      console.error('Failed to submit request:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className={`rounded-xl border p-6 backdrop-blur-sm ${cardBg}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-gold-500" />
            <h2 className={`text-lg font-semibold ${textColor}`}>Your Developments</h2>
          </div>
          <button
            onClick={() => setShowRequestModal(true)}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-gold-500/10 text-gold-500 rounded-lg hover:bg-gold-500/20 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Request New
          </button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2].map(i => (
              <div key={i} className="h-16 bg-gray-300/20 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : developments.length === 0 ? (
          <div className="text-center py-8">
            <Building2 className={`w-12 h-12 mx-auto mb-3 ${secondaryText}`} />
            <p className={secondaryText}>No developments assigned yet</p>
            <p className={`text-sm ${secondaryText} mt-1`}>Request a new development to get started</p>
          </div>
        ) : (
          <div className="space-y-3">
            {developments.map((dev) => (
              <Link key={dev.id} href={`/developer/developments/${dev.id}`}>
                <div className={`p-4 rounded-lg border ${isDarkMode ? 'border-gray-700 hover:border-gold-500/50' : 'border-gray-200 hover:border-gold-500/50'} transition-colors cursor-pointer`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className={`font-medium ${textColor}`}>{dev.name}</h3>
                      <p className={`text-sm ${secondaryText}`}>{dev.address || 'Address pending'}</p>
                      {dev.unitCount !== undefined && dev.unitCount > 0 && (
                        <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'} mt-1`}>
                          {dev.unitCount} units / {dev.activeUnitCount || 0} active
                        </p>
                      )}
                    </div>
                    <span className={`px-2 py-1 rounded text-xs ${
                      dev.is_active ? 'bg-green-900/30 text-green-400' : 'bg-gray-700 text-gray-400'
                    }`}>
                      {dev.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {showRequestModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={`w-full max-w-lg rounded-xl p-6 ${isDarkMode ? 'bg-gray-900' : 'bg-white'}`}>
            {requestSuccess ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileCheck className="w-8 h-8 text-green-500" />
                </div>
                <h2 className={`text-xl font-semibold ${textColor} mb-2`}>Request Submitted!</h2>
                <p className={secondaryText}>We'll review your request and get back to you soon.</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-6">
                  <h2 className={`text-xl font-semibold ${textColor}`}>Request New Development</h2>
                  <button onClick={() => setShowRequestModal(false)} className={secondaryText}>
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleSubmitRequest} className="space-y-4">
                  <div>
                    <label className={`block text-sm font-medium ${secondaryText} mb-1`}>
                      Proposed Development Name *
                    </label>
                    <input
                      type="text"
                      value={requestForm.proposedName}
                      onChange={(e) => setRequestForm({ ...requestForm, proposedName: e.target.value })}
                      className={`w-full px-3 py-2 rounded-lg border ${isDarkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'} focus:ring-2 focus:ring-gold-500`}
                      placeholder="e.g., Rathard Park"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={`block text-sm font-medium ${secondaryText} mb-1`}>County</label>
                      <input
                        type="text"
                        value={requestForm.locationCounty}
                        onChange={(e) => setRequestForm({ ...requestForm, locationCounty: e.target.value })}
                        className={`w-full px-3 py-2 rounded-lg border ${isDarkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'} focus:ring-2 focus:ring-gold-500`}
                        placeholder="e.g., Cork"
                      />
                    </div>
                    <div>
                      <label className={`block text-sm font-medium ${secondaryText} mb-1`}>Estimated Units</label>
                      <input
                        type="number"
                        value={requestForm.estimatedUnits}
                        onChange={(e) => setRequestForm({ ...requestForm, estimatedUnits: e.target.value })}
                        className={`w-full px-3 py-2 rounded-lg border ${isDarkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'} focus:ring-2 focus:ring-gold-500`}
                        placeholder="e.g., 75"
                        min="1"
                      />
                    </div>
                  </div>

                  <div>
                    <label className={`block text-sm font-medium ${secondaryText} mb-1`}>Approximate Address</label>
                    <input
                      type="text"
                      value={requestForm.locationAddress}
                      onChange={(e) => setRequestForm({ ...requestForm, locationAddress: e.target.value })}
                      className={`w-full px-3 py-2 rounded-lg border ${isDarkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'} focus:ring-2 focus:ring-gold-500`}
                      placeholder="Street or area"
                    />
                  </div>

                  <div>
                    <label className={`block text-sm font-medium ${secondaryText} mb-1`}>Target Go-Live Date</label>
                    <input
                      type="text"
                      value={requestForm.targetGoLive}
                      onChange={(e) => setRequestForm({ ...requestForm, targetGoLive: e.target.value })}
                      className={`w-full px-3 py-2 rounded-lg border ${isDarkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'} focus:ring-2 focus:ring-gold-500`}
                      placeholder="e.g., Q2 2025"
                    />
                  </div>

                  <div>
                    <label className={`block text-sm font-medium ${secondaryText} mb-1`}>Additional Notes</label>
                    <textarea
                      value={requestForm.notes}
                      onChange={(e) => setRequestForm({ ...requestForm, notes: e.target.value })}
                      className={`w-full px-3 py-2 rounded-lg border ${isDarkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'} focus:ring-2 focus:ring-gold-500`}
                      rows={3}
                      placeholder="Any additional information..."
                    />
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      type="submit"
                      disabled={submitting || !requestForm.proposedName.trim()}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gold-500 text-white rounded-lg hover:bg-gold-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Send className="w-4 h-4" />
                      {submitting ? 'Submitting...' : 'Submit Request'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowRequestModal(false)}
                      className={`px-4 py-2 rounded-lg border ${isDarkMode ? 'border-gray-700 text-gray-300' : 'border-gray-300 text-gray-700'}`}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// Smart suggestions based on data
function SmartSuggestionsCard({
  data,
  isDarkMode
}: {
  data: DashboardData;
  isDarkMode: boolean;
}) {
  const cardBg = isDarkMode ? 'bg-gray-800/50 border-gray-700' : 'bg-white/80 border-gray-200';
  const textColor = isDarkMode ? 'text-white' : 'text-gray-900';
  const secondaryText = isDarkMode ? 'text-gray-300' : 'text-gray-600';

  // Generate contextual suggestions based on the data
  const suggestions = useMemo(() => {
    const items: Array<{
      icon: any;
      title: string;
      description: string;
      link?: string;
      priority: 'high' | 'medium' | 'low';
      color: string;
    }> = [];

    // Check onboarding rate
    if (data.kpis.onboardingRate.value < 50) {
      items.push({
        icon: Users,
        title: 'Boost onboarding',
        description: `${data.summary.totalUnits - data.summary.registeredHomeowners} units pending registration. Send QR codes to new homeowners.`,
        link: '/developer/homeowners',
        priority: 'high',
        color: 'text-amber-500',
      });
    }

    // Check engagement
    if (data.kpis.engagementRate.value < 30 && data.summary.registeredHomeowners > 0) {
      items.push({
        icon: MessageSquare,
        title: 'Increase engagement',
        description: 'Low engagement detected. Consider sending a noticeboard announcement.',
        link: '/developer/noticeboard',
        priority: 'medium',
        color: 'text-blue-500',
      });
    }

    // Check unanswered queries
    if (data.unansweredQueries.length > 0) {
      items.push({
        icon: AlertCircle,
        title: 'Address knowledge gaps',
        description: `${data.unansweredQueries.length} questions couldn't be fully answered. Upload relevant documents.`,
        link: '/developer/knowledge-base',
        priority: 'high',
        color: 'text-red-500',
      });
    }

    // Must-read compliance
    if (data.kpis.mustReadCompliance.value < 80 && (data.kpis.mustReadCompliance.pendingCount || 0) > 0) {
      items.push({
        icon: FileCheck,
        title: 'Improve compliance',
        description: `${data.kpis.mustReadCompliance.pendingCount} homeowners haven't acknowledged important documents.`,
        link: '/developer/homeowners?compliance=false',
        priority: 'medium',
        color: 'text-purple-500',
      });
    }

    // If everything is good
    if (items.length === 0) {
      items.push({
        icon: CheckCircle2,
        title: 'Great work!',
        description: 'Your development is performing well. Keep monitoring for any changes.',
        priority: 'low',
        color: 'text-green-500',
      });
    }

    return items.slice(0, 3); // Max 3 suggestions
  }, [data]);

  return (
    <div className={`rounded-xl border p-6 backdrop-blur-sm ${cardBg}`}>
      <div className="flex items-center gap-2 mb-4">
        <Zap className="w-5 h-5 text-gold-500" />
        <h2 className={`text-lg font-semibold ${textColor}`}>Smart Suggestions</h2>
      </div>
      <div className="space-y-3">
        {suggestions.map((suggestion, index) => {
          const Icon = suggestion.icon;
          return (
            <div
              key={index}
              className={`p-4 rounded-lg border ${isDarkMode ? 'border-gray-700 bg-gray-700/30' : 'border-gray-100 bg-gray-50'}`}
            >
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-gray-600' : 'bg-white'} flex-shrink-0`}>
                  <Icon className={`w-4 h-4 ${suggestion.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className={`font-medium text-sm ${textColor}`}>{suggestion.title}</h3>
                    {suggestion.priority === 'high' && (
                      <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-red-500/10 text-red-500 rounded">
                        Priority
                      </span>
                    )}
                  </div>
                  <p className={`text-xs ${secondaryText} mt-1`}>{suggestion.description}</p>
                  {suggestion.link && (
                    <Link
                      href={suggestion.link}
                      className="inline-flex items-center gap-1 text-xs text-gold-500 hover:text-gold-600 mt-2 font-medium"
                    >
                      Take action <ArrowUpRight className="w-3 h-3" />
                    </Link>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Summary Stats Bar - Quick overview at the top
function SummaryStatsBar({
  data,
  isDarkMode
}: {
  data: DashboardData;
  isDarkMode: boolean;
}) {
  const bgColor = isDarkMode ? 'bg-gray-800/30' : 'bg-gray-50';
  const textColor = isDarkMode ? 'text-white' : 'text-gray-900';
  const secondaryText = isDarkMode ? 'text-gray-400' : 'text-gray-500';
  const borderColor = isDarkMode ? 'border-gray-700' : 'border-gray-200';

  const stats = [
    {
      label: 'Total Units',
      value: data.summary.totalUnits.toLocaleString(),
      icon: Building2,
      color: 'text-gold-500'
    },
    {
      label: 'Registered',
      value: data.summary.registeredHomeowners.toLocaleString(),
      icon: Users,
      color: 'text-blue-500'
    },
    {
      label: 'Active (7d)',
      value: data.summary.activeHomeowners.toLocaleString(),
      icon: Activity,
      color: 'text-green-500'
    },
    {
      label: 'Messages',
      value: data.summary.totalMessages.toLocaleString(),
      icon: MessageSquare,
      color: 'text-purple-500',
      growth: data.summary.messageGrowth
    },
    {
      label: 'Documents',
      value: data.summary.totalDocuments.toLocaleString(),
      icon: FileText,
      color: 'text-cyan-500'
    },
  ];

  return (
    <div className={`rounded-xl ${bgColor} border ${borderColor} p-4`}>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-white'}`}>
                <Icon className={`w-4 h-4 ${stat.color}`} />
              </div>
              <div>
                <p className={`text-xs ${secondaryText} uppercase tracking-wide`}>{stat.label}</p>
                <div className="flex items-center gap-2">
                  <p className={`text-lg font-bold ${textColor}`}>{stat.value}</p>
                  {stat.growth !== undefined && stat.growth !== 0 && (
                    <span className={`text-xs font-medium ${stat.growth > 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {stat.growth > 0 ? '+' : ''}{stat.growth}%
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Recent Activity Timeline
function RecentActivityCard({
  chatActivity,
  isDarkMode
}: {
  chatActivity: Array<{ date: string; count: number }>;
  isDarkMode: boolean;
}) {
  const cardBg = isDarkMode ? 'bg-gray-800/50 border-gray-700' : 'bg-white/80 border-gray-200';
  const textColor = isDarkMode ? 'text-white' : 'text-gray-900';
  const secondaryText = isDarkMode ? 'text-gray-300' : 'text-gray-600';

  // Get last 7 days of activity
  const recentActivity = chatActivity.slice(-7).reverse();
  const totalRecent = recentActivity.reduce((sum, day) => sum + day.count, 0);
  const avgDaily = recentActivity.length > 0 ? Math.round(totalRecent / recentActivity.length) : 0;

  return (
    <div className={`rounded-xl border p-6 backdrop-blur-sm ${cardBg}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-gold-500" />
          <h2 className={`text-lg font-semibold ${textColor}`}>Recent Activity</h2>
        </div>
        <span className={`text-xs ${secondaryText}`}>Last 7 days</span>
      </div>

      {recentActivity.length > 0 ? (
        <>
          <div className="flex items-baseline gap-2 mb-4">
            <span className={`text-3xl font-bold ${textColor}`}>{totalRecent}</span>
            <span className={`text-sm ${secondaryText}`}>total interactions</span>
          </div>

          <div className="flex items-end gap-1 h-16 mb-4">
            {recentActivity.map((day, index) => {
              const maxCount = Math.max(...recentActivity.map(d => d.count), 1);
              const height = Math.max((day.count / maxCount) * 100, 8);
              return (
                <div key={index} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full bg-gold-500 rounded-t transition-all hover:bg-gold-400"
                    style={{ height: `${height}%` }}
                    title={`${day.count} interactions on ${new Date(day.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' })}`}
                  />
                </div>
              );
            })}
          </div>

          <div className="flex justify-between text-xs">
            {recentActivity.map((day, index) => (
              <span key={index} className={secondaryText}>
                {new Date(day.date).toLocaleDateString('en-GB', { weekday: 'short' }).charAt(0)}
              </span>
            ))}
          </div>

          <div className={`mt-4 pt-4 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
            <p className={`text-sm ${secondaryText}`}>
              <span className={`font-medium ${textColor}`}>{avgDaily}</span> average daily interactions
            </p>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className={`p-3 rounded-full ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'} mb-3`}>
            <Clock className="w-6 h-6 text-gray-400" />
          </div>
          <p className={`font-medium ${textColor}`}>No recent activity</p>
          <p className={`text-sm ${secondaryText}`}>Chat activity will appear here</p>
        </div>
      )}
    </div>
  );
}

function QuickActionsCard({
  summary,
  isDarkMode
}: {
  summary: DashboardData['summary'];
  isDarkMode: boolean;
}) {
  const cardBg = isDarkMode ? 'bg-gray-800/50 border-gray-700' : 'bg-white/80 border-gray-200';
  const textColor = isDarkMode ? 'text-white' : 'text-gray-900';
  const secondaryText = isDarkMode ? 'text-gray-300' : 'text-gray-600';
  const buttonClass = isDarkMode
    ? 'border-gray-600 text-gray-300 hover:bg-gray-700'
    : 'border-gray-300 text-gray-700 hover:bg-gray-100';

  const unregisteredUnits = summary.totalUnits - summary.registeredHomeowners;

  const actions = [
    {
      href: '/developer/documents',
      icon: FileText,
      label: 'Manage Documents',
      description: `${summary.totalDocuments} documents uploaded`,
      show: true,
    },
    {
      href: '/developer/homeowners',
      icon: Users,
      label: unregisteredUnits > 0 ? `${unregisteredUnits} Units Awaiting Registration` : 'View Homeowners',
      description: unregisteredUnits > 0 ? 'Send QR codes to complete onboarding' : 'All units registered',
      show: true,
      highlight: unregisteredUnits > 0,
    },
    {
      href: '/developer/insights',
      icon: Sparkles,
      label: 'AI Insights',
      description: 'View detailed analytics',
      show: true,
    },
  ];

  return (
    <div className={`rounded-xl border p-6 backdrop-blur-sm ${cardBg}`}>
      <h2 className={`text-lg font-semibold ${textColor} mb-4`}>Quick Actions</h2>
      <div className="space-y-3">
        {actions.filter(a => a.show).map((action, index) => (
          <Link key={index} href={action.href}>
            <button className={`w-full flex items-center justify-between p-4 rounded-lg border transition ${buttonClass} ${
              action.highlight ? 'border-amber-500/50 bg-amber-500/5' : ''
            }`}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                  <action.icon className={`w-4 h-4 ${action.highlight ? 'text-amber-500' : ''}`} />
                </div>
                <div className="text-left">
                  <span className={`text-sm font-medium block ${action.highlight ? 'text-amber-500' : ''}`}>
                    {action.label}
                  </span>
                  <span className={`text-xs ${secondaryText}`}>{action.description}</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4" />
            </button>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function DeveloperDashboardClient({ 
  developerName = 'Developer', 
  isDarkMode = false, 
  tenantId 
}: { 
  developerName?: string; 
  isDarkMode?: boolean; 
  tenantId?: string 
}) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<DashboardError | null>(null);
  const [retrying, setRetrying] = useState(false);

  const fetchDashboard = useCallback(async (isRetry = false) => {
    if (isRetry) {
      setRetrying(true);
    } else {
      setLoading(true);
    }
    setError(null);
    
    try {
      const response = await fetch('/api/analytics/developer/dashboard');
      const responseData = await response.json();
      
      if (!response.ok) {
        // Extract structured error from API response
        const errorInfo: DashboardError = {
          error: responseData.error || `HTTP ${response.status}`,
          details: responseData.details || response.statusText,
          requestId: responseData.requestId || response.headers.get('x-request-id') || undefined,
          endpoint: responseData.endpoint || '/api/analytics/developer/dashboard',
        };
        console.error('[Dashboard] API error:', errorInfo);
        setError(errorInfo);
        return;
      }
      
      setData(responseData);
    } catch (err) {
      console.error('[Dashboard] Fetch error:', err);
      setError({
        error: 'Network error',
        details: err instanceof Error ? err.message : 'Failed to connect to server',
        endpoint: '/api/analytics/developer/dashboard',
      });
    } finally {
      setLoading(false);
      setRetrying(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const bgColor = isDarkMode ? 'bg-gray-900' : 'bg-gradient-to-br from-gray-50 to-white';
  const cardBg = isDarkMode ? 'bg-gray-800/50 border-gray-700' : 'bg-white/80 border-gray-200';
  const textColor = isDarkMode ? 'text-white' : 'text-gray-900';
  const secondaryText = isDarkMode ? 'text-gray-300' : 'text-gray-600';

  if (loading) {
    const skeletonBg = isDarkMode ? 'bg-gray-700' : 'bg-gray-200';
    return (
      <div className={`min-h-full flex flex-col ${bgColor}`}>
        {/* Header skeleton */}
        <div className={`border-b ${isDarkMode ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-white/50'} px-8 py-6`}>
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <div className={`h-9 w-48 ${skeletonBg} rounded-lg animate-pulse`} />
                <div className={`h-4 w-64 ${skeletonBg} rounded mt-2 animate-pulse`} />
              </div>
              <div className="flex gap-3">
                <div className={`h-10 w-32 ${skeletonBg} rounded-lg animate-pulse`} />
                <div className={`h-10 w-28 ${skeletonBg} rounded-lg animate-pulse`} />
              </div>
            </div>
          </div>
        </div>

        <div className="px-8 py-8 flex-1">
          <div className="max-w-7xl mx-auto space-y-8">
            {/* Summary stats bar skeleton */}
            <div className={`${skeletonBg} h-20 rounded-xl animate-pulse`} />

            {/* KPI cards skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className={`h-36 ${skeletonBg} rounded-xl animate-pulse`} />
              ))}
            </div>

            {/* Charts skeleton */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className={`h-80 ${skeletonBg} rounded-xl animate-pulse`} />
              <div className={`h-64 ${skeletonBg} rounded-xl animate-pulse`} />
            </div>

            {/* Bottom cards skeleton */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className={`h-64 ${skeletonBg} rounded-xl animate-pulse`} />
              <div className={`h-64 ${skeletonBg} rounded-xl animate-pulse`} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={`min-h-full flex flex-col ${bgColor}`}>
        <div className="px-8 py-8 flex-1 flex items-center justify-center">
          <div className="text-center max-w-md">
            <div className={`p-4 rounded-full ${isDarkMode ? 'bg-red-900/30' : 'bg-red-100'} w-fit mx-auto mb-4`}>
              <AlertCircle className="w-10 h-10 text-red-500" />
            </div>
            <h2 className={`text-xl font-semibold ${textColor} mb-2`}>
              {error?.error || 'Failed to load dashboard'}
            </h2>
            <p className={`${secondaryText} mb-4`}>
              {error?.details || 'An unexpected error occurred while loading the dashboard.'}
            </p>
            {error?.requestId && (
              <p className={`text-xs ${secondaryText} mb-4 font-mono`}>
                Request ID: {error.requestId}
              </p>
            )}
            {error?.endpoint && (
              <p className={`text-xs ${secondaryText} mb-6 font-mono`}>
                Endpoint: {error.endpoint}
              </p>
            )}
            <button
              onClick={() => fetchDashboard(true)}
              disabled={retrying}
              className={`px-6 py-3 rounded-lg font-medium transition-all ${
                retrying 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-600 hover:to-gold-700 text-white shadow-lg hover:shadow-xl'
              }`}
            >
              {retrying ? 'Retrying...' : 'Retry'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Get time-based greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className={`min-h-full flex flex-col ${bgColor}`}>
      <div className={`border-b ${isDarkMode ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-white/50'} px-8 py-6 backdrop-blur-sm`}>
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className={`text-3xl font-bold ${textColor}`}>
                {getGreeting()} 👋
              </h1>
              <p className={`${secondaryText} text-sm mt-1`}>
                Here's what's happening with your developments today
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/developer/analytics"
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                  isDarkMode
                    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Target className="w-4 h-4" />
                Full Analytics
              </Link>
              <Link
                href="/developer/insights"
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-gold-500 to-gold-600 text-white hover:from-gold-600 hover:to-gold-700 transition shadow-sm"
              >
                <Sparkles className="w-4 h-4" />
                AI Insights
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="px-8 py-8 flex-1">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Summary Stats Bar */}
          <SummaryStatsBar data={data} isDarkMode={isDarkMode} />

          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard 
              icon={Users}
              iconColour="text-gold-500"
              value={data.kpis.onboardingRate.value}
              label={data.kpis.onboardingRate.label}
              description={data.kpis.onboardingRate.description}
              suffix={data.kpis.onboardingRate.suffix}
              delta={data.kpis.onboardingRate.delta}
              isDarkMode={isDarkMode}
            />
            <KpiCard 
              icon={TrendingUp}
              iconColour="text-green-500"
              value={data.kpis.engagementRate.value}
              label={data.kpis.engagementRate.label}
              description={data.kpis.engagementRate.description}
              suffix={data.kpis.engagementRate.suffix}
              growth={data.kpis.engagementRate.growth}
              delta={data.kpis.engagementRate.delta}
              actionLink={data.kpis.engagementRate.inactiveCount && data.kpis.engagementRate.inactiveCount > 0 ? '/developer/homeowners?active=false' : undefined}
              actionLabel={data.kpis.engagementRate.inactiveCount && data.kpis.engagementRate.inactiveCount > 0 ? 'View inactive homeowners' : undefined}
              isDarkMode={isDarkMode}
            />
            <KpiCard 
              icon={FileText}
              iconColour="text-blue-500"
              value={data.kpis.documentCoverage.value}
              label={data.kpis.documentCoverage.label}
              description={data.kpis.documentCoverage.description}
              suffix={data.kpis.documentCoverage.suffix}
              isDarkMode={isDarkMode}
            />
            <KpiCard 
              icon={FileCheck}
              iconColour="text-purple-500"
              value={data.kpis.mustReadCompliance.value}
              label={data.kpis.mustReadCompliance.label}
              description={data.kpis.mustReadCompliance.description}
              suffix={data.kpis.mustReadCompliance.suffix}
              delta={data.kpis.mustReadCompliance.delta}
              actionLink={data.kpis.mustReadCompliance.pendingCount && data.kpis.mustReadCompliance.pendingCount > 0 ? '/developer/homeowners?compliance=false' : undefined}
              actionLabel={data.kpis.mustReadCompliance.pendingCount && data.kpis.mustReadCompliance.pendingCount > 0 ? 'View pending acknowledgements' : undefined}
              isDarkMode={isDarkMode}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className={`rounded-xl border p-6 backdrop-blur-sm ${cardBg}`}>
              <div className="flex items-center justify-between mb-4">
                <h2 className={`text-lg font-semibold ${textColor}`}>What Homeowners Ask About</h2>
                <span className={`text-xs ${secondaryText}`}>Last 30 days</span>
              </div>
              {data.questionTopics.length > 0 ? (
                <TopQuestionsChart data={data.questionTopics} isDarkMode={isDarkMode} />
              ) : (
                <div className="flex items-center justify-center h-64">
                  <p className={secondaryText}>No questions recorded yet</p>
                </div>
              )}
              <p className={`text-xs ${secondaryText} mt-4`}>
                Focus documentation on the most asked topics
              </p>
            </div>

            <div className={`rounded-xl border p-6 backdrop-blur-sm ${cardBg}`}>
              <h2 className={`text-lg font-semibold ${textColor} mb-4`}>Onboarding Funnel</h2>
              <OnboardingFunnelChart data={data.onboardingFunnel} isDarkMode={isDarkMode} />
              <p className={`text-xs ${secondaryText} mt-4`}>
                Track homeowner progression from unit creation to active engagement
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className={`rounded-xl border p-6 backdrop-blur-sm lg:col-span-2 ${cardBg}`}>
              <div className="flex items-center justify-between mb-4">
                <h2 className={`text-lg font-semibold ${textColor}`}>Chat Activity</h2>
                <span className={`text-xs ${secondaryText}`}>Last 30 days</span>
              </div>
              {data.chatActivity.length > 0 ? (
                <ChatActivityChart data={data.chatActivity} isDarkMode={isDarkMode} />
              ) : (
                <div className="flex items-center justify-center h-48">
                  <p className={secondaryText}>No chat activity recorded yet</p>
                </div>
              )}
            </div>

            <UnansweredQueriesCard queries={data.unansweredQueries} isDarkMode={isDarkMode} />
          </div>

          {/* Developments and Quick Actions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <DevelopmentsCard isDarkMode={isDarkMode} />
            <QuickActionsCard summary={data.summary} isDarkMode={isDarkMode} />
          </div>

          {/* Smart Suggestions and Recent Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SmartSuggestionsCard data={data} isDarkMode={isDarkMode} />
            <RecentActivityCard chatActivity={data.chatActivity} isDarkMode={isDarkMode} />
          </div>
        </div>
      </div>
    </div>
  );
}
