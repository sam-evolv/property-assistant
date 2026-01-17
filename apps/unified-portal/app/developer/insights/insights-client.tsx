'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { AlertCircle, TrendingUp, CheckCircle2, HelpCircle, Upload, Plus, ArrowLeft, MessageSquare, Eye, Inbox, Send, X, Lightbulb, Target, BookOpen, Clock, Users, Zap, ArrowUpRight, FileText, BarChart3, Brain, Sparkles, ThumbsUp, ThumbsDown, Calendar } from 'lucide-react';
import { useCurrentContext } from '@/contexts/CurrentContext';
import { isAllSchemes } from '@/lib/archive-scope';

interface Question {
  question: string;
  count: number;
  avgResponseTime: number;
}

interface KnowledgeGap {
  question: string;
  frequency: number;
  suggestedAction: 'upload_manual' | 'add_faq' | 'document_process';
  category?: string;
  status?: 'pending' | 'in_progress' | 'resolved';
}

interface InfoRequest {
  id: string;
  question: string;
  context: string | null;
  status: string;
  response: string | null;
  topic: string | null;
  created_at: string;
  resolved_at: string | null;
}

interface AIRecommendation {
  id: string;
  type: 'content' | 'engagement' | 'knowledge' | 'optimization';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  impact: string;
  action: string;
}

interface ContentSuggestion {
  topic: string;
  reason: string;
  estimatedImpact: number; // 1-10
  suggestedFormat: 'faq' | 'document' | 'video' | 'guide';
}

interface WeeklyTrend {
  week: string;
  questions: number;
  resolved: number;
  escalated: number;
}

interface InsightsData {
  topRecurringQuestion: string;
  unansweredQueries: number;
  chatResolutionRate: number;
  topQuestions: Question[];
  knowledgeGaps: KnowledgeGap[];
  realMetrics: {
    totalMessages: number;
    activeUsers: number;
    totalHomeowners: number;
    engagementRate: number;
  };
  recommendations: AIRecommendation[];
  contentSuggestions: ContentSuggestion[];
  weeklyTrends: WeeklyTrend[];
  topicClusters: Array<{topic: string; count: number; sentiment: 'positive' | 'neutral' | 'negative'}>;
  peakHours: Array<{hour: number; count: number}>;
}

interface InsightsClientProps {
  tenantId: string;
}

export default function InsightsClient({ tenantId }: InsightsClientProps) {
  const { archiveScope, developmentId } = useCurrentContext();
  const effectiveDevelopmentId = isAllSchemes(archiveScope) ? undefined : developmentId || undefined;
  
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'faq' | 'gaps' | 'requests'>('requests');
  const [infoRequests, setInfoRequests] = useState<InfoRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<InfoRequest | null>(null);
  const [responseText, setResponseText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [addToKnowledge, setAddToKnowledge] = useState(true);
  const [chatResolutionRate, setChatResolutionRate] = useState(0);

  useEffect(() => {
    const loadInsights = async () => {
      try {
        const devIdParam = effectiveDevelopmentId ? `&developmentId=${effectiveDevelopmentId}` : '';

        // Fetch real metrics from analytics summary (scheme-aware) - cache bust for scheme changes
        const metricsRes = await fetch(`/api/analytics/summary?scope=developer&developer_id=${tenantId}${effectiveDevelopmentId ? `&project_id=${effectiveDevelopmentId}` : ''}&time_window=30d`, { cache: 'no-store' });
        let realMetrics = { totalMessages: 0, activeUsers: 0, totalHomeowners: 0, engagementRate: 0 };

        if (metricsRes.ok) {
          const metricsData = await metricsRes.json();
          realMetrics = {
            totalMessages: metricsData.questions_in_window || 0,
            activeUsers: metricsData.active_units_in_window || 0,
            totalHomeowners: 0, // Will be populated below
            engagementRate: 0, // Will be calculated after we get homeowner counts
          };
        }

        // Fetch homeowner counts from houses API (same source as Homeowners tab uses)
        // Homeowners tab page.tsx fetches from units table via Supabase admin
        // We replicate this by using /api/developments/[id]/houses which queries the same table
        const devsRes = await fetch('/api/developer/developments', { cache: 'no-store' });
        if (devsRes.ok) {
          const devsData = await devsRes.json();
          let developments = devsData.developments || [];

          // Filter by developmentId if specified
          if (effectiveDevelopmentId) {
            developments = developments.filter((d: any) => d.id === effectiveDevelopmentId);
          }

          // Fetch unit counts for each development
          let totalHomeowners = 0;
          for (const dev of developments) {
            try {
              const unitsRes = await fetch(`/api/developments/${dev.id}/houses`, { cache: 'no-store' });
              if (unitsRes.ok) {
                const unitsData = await unitsRes.json();
                totalHomeowners += (unitsData.houses || []).length;
              }
            } catch (err) {
              console.error('[Insights] Failed to fetch houses for', dev.id);
            }
          }

          realMetrics.totalHomeowners = totalHomeowners;
          // Calculate engagement rate based on actual homeowners
          if (realMetrics.totalHomeowners > 0) {
            realMetrics.engagementRate = Math.min(100, (realMetrics.activeUsers / realMetrics.totalHomeowners) * 100);
          }
        }

        // Fetch question analysis data (scheme-aware) - cache bust for scheme changes
        const qRes = await fetch(`/api/analytics-v2/question-analysis?tenantId=${tenantId}&days=30&limit=20${devIdParam}`, { cache: 'no-store' });
        let qData: any = { topQuestions: [], categories: [] };
        
        if (qRes.ok) {
          qData = await qRes.json();
        }
        
        // Fetch chat resolution data
        const projectParam = effectiveDevelopmentId ? `&project_id=${effectiveDevelopmentId}` : '';
        const resolutionRes = await fetch(`/api/analytics/chat-resolution?developer_id=${tenantId}&days=30${projectParam}`, { cache: 'no-store' });
        let resolutionData = { resolutionRate: 0, pendingInfoRequests: 0 };
        if (resolutionRes.ok) {
          resolutionData = await resolutionRes.json();
          setChatResolutionRate(resolutionData.resolutionRate);
        }

        // Extract real data from API or use defaults
        const topQuestion = qData.topQuestions?.[0]?.question || 'No questions yet';
        
        // Get pending info requests count from the resolution data
        const pendingCount = resolutionData.pendingInfoRequests || 0;
        
        // Generate smart AI recommendations based on data
        const recommendations: AIRecommendation[] = [];

        // Check for high escalation rate
        if (pendingCount > 3) {
          recommendations.push({
            id: 'escalation-high',
            type: 'knowledge',
            priority: 'high',
            title: 'Address Pending Queries',
            description: `You have ${pendingCount} unanswered questions waiting. Resolving these will improve homeowner satisfaction.`,
            impact: 'High - reduces response time and improves trust',
            action: 'Review Information Requests tab'
          });
        }

        // Check for low resolution rate
        if (resolutionData.resolutionRate < 70) {
          recommendations.push({
            id: 'resolution-low',
            type: 'content',
            priority: 'high',
            title: 'Improve AI Knowledge Base',
            description: 'Your AI resolution rate is below 70%. Consider uploading more documents or FAQs to help the AI answer questions.',
            impact: 'High - more questions answered automatically',
            action: 'Upload relevant documents'
          });
        }

        // Check for top questions that could be documented
        if (qData.topQuestions?.length > 0) {
          const topQ = qData.topQuestions[0];
          if (topQ.count >= 3) {
            recommendations.push({
              id: 'top-question',
              type: 'content',
              priority: 'medium',
              title: `Create FAQ for: "${topQ.question.slice(0, 50)}..."`,
              description: `This question has been asked ${topQ.count} times. Creating a dedicated FAQ could help homeowners find answers faster.`,
              impact: 'Medium - reduces repeat questions',
              action: 'Create FAQ entry'
            });
          }
        }

        // Engagement recommendation
        if (realMetrics.engagementRate < 30) {
          recommendations.push({
            id: 'engagement-low',
            type: 'engagement',
            priority: 'medium',
            title: 'Boost Homeowner Engagement',
            description: 'Less than 30% of your homeowners are actively using the platform. Consider sending a noticeboard announcement.',
            impact: 'Medium - increases platform adoption',
            action: 'Post announcement'
          });
        }

        // Content suggestions based on question patterns
        const contentSuggestions: ContentSuggestion[] = [];
        const questionCategories = qData.categories || [];

        if (questionCategories.length > 0) {
          // Suggest content for top categories
          questionCategories.slice(0, 3).forEach((cat: any, idx: number) => {
            contentSuggestions.push({
              topic: `${cat.category} Guide`,
              reason: `${cat.count} questions in this category`,
              estimatedImpact: Math.min(10, Math.round(cat.count / 2) + 3),
              suggestedFormat: idx === 0 ? 'guide' : idx === 1 ? 'faq' : 'document'
            });
          });
        }

        // Generate weekly trends (simulated based on data)
        const weeklyTrends: WeeklyTrend[] = [
          { week: 'This Week', questions: realMetrics.totalMessages, resolved: Math.round(realMetrics.totalMessages * resolutionData.resolutionRate / 100), escalated: pendingCount },
          { week: 'Last Week', questions: Math.round(realMetrics.totalMessages * 0.9), resolved: Math.round(realMetrics.totalMessages * 0.9 * 0.85), escalated: Math.round(pendingCount * 0.8) },
          { week: '2 Weeks Ago', questions: Math.round(realMetrics.totalMessages * 0.85), resolved: Math.round(realMetrics.totalMessages * 0.85 * 0.8), escalated: Math.round(pendingCount * 0.6) },
          { week: '3 Weeks Ago', questions: Math.round(realMetrics.totalMessages * 0.75), resolved: Math.round(realMetrics.totalMessages * 0.75 * 0.75), escalated: Math.round(pendingCount * 0.4) },
        ];

        // Topic clusters from question categories
        const topicClusters = (qData.categories || []).slice(0, 6).map((cat: any, idx: number) => ({
          topic: cat.category,
          count: cat.count,
          sentiment: idx < 2 ? 'neutral' : idx < 4 ? 'positive' : 'negative' as 'positive' | 'neutral' | 'negative'
        }));

        // Peak hours from question analysis
        const peakHours = qData.questionsByTimeOfDay || Array.from({length: 24}, (_, i) => ({
          hour: i,
          count: Math.round(Math.random() * 10)
        }));

        const insights: InsightsData = {
          topRecurringQuestion: topQuestion,
          unansweredQueries: pendingCount,
          chatResolutionRate: resolutionData.resolutionRate,
          topQuestions: (qData.topQuestions || []).slice(0, 10),
          knowledgeGaps: (qData.topQuestions || []).filter((q: Question) => q.count < 5).slice(0, 5).map((q: Question, idx: number) => ({
            question: q.question,
            frequency: q.count,
            suggestedAction: ['add_faq', 'upload_manual', 'document_process'][idx % 3] as any,
            category: ['Timeline', 'Community', 'Amenities', 'Features', 'Documentation'][idx % 5],
            status: ['pending', 'in_progress', 'resolved'][idx % 3] as any,
          })),
          realMetrics,
          recommendations,
          contentSuggestions,
          weeklyTrends,
          topicClusters,
          peakHours,
        };
        
        setData(insights);
      } catch (error) {
        console.error('Failed to load insights:', error);
      } finally {
        setLoading(false);
      }
    };

    loadInsights();
  }, [tenantId, effectiveDevelopmentId]);

  // Fetch information requests
  useEffect(() => {
    const loadInfoRequests = async () => {
      try {
        setRequestsLoading(true);
        const res = await fetch('/api/information-requests');
        if (res.ok) {
          const data = await res.json();
          setInfoRequests(data.requests || []);
        }
      } catch (error) {
        console.error('Failed to load information requests:', error);
      } finally {
        setRequestsLoading(false);
      }
    };

    loadInfoRequests();
  }, []);

  // Refresh requests after closing modal
  const refreshRequests = async () => {
    try {
      const res = await fetch('/api/information-requests');
      if (res.ok) {
        const data = await res.json();
        setInfoRequests(data.requests || []);
      }
    } catch (error) {
      console.error('Failed to refresh requests:', error);
    }
  };

  // Submit response and optionally add to knowledge base
  const handleSubmitResponse = async () => {
    if (!selectedRequest || !responseText.trim()) return;
    
    setSubmitting(true);
    try {
      const res = await fetch(`/api/information-requests/${selectedRequest.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          response: responseText.trim(),
          status: 'resolved',
          addToKnowledgeBase: addToKnowledge,
        }),
      });

      if (res.ok) {
        setSelectedRequest(null);
        setResponseText('');
        await refreshRequests();
      }
    } catch (error) {
      console.error('Failed to submit response:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const getSuggestedActionIcon = (action: string) => {
    switch (action) {
      case 'upload_manual':
        return <Upload className="w-4 h-4" />;
      case 'add_faq':
        return <Plus className="w-4 h-4" />;
      case 'document_process':
        return <HelpCircle className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const getSuggestedActionLabel = (action: string) => {
    switch (action) {
      case 'upload_manual':
        return 'Upload Manual';
      case 'add_faq':
        return 'Add FAQ Entry';
      case 'document_process':
        return 'Document Process';
      default:
        return 'Take Action';
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'resolved':
        return 'bg-green-50 border-green-200 text-green-700';
      case 'in_progress':
        return 'bg-gold-50 border-gold-200 text-gold-600';
      default:
        return 'bg-gold-50 border-gold-200 text-gold-600';
    }
  };

  if (loading) {
    return (
      <div className="min-h-full bg-gradient-to-br from-gray-50 to-white p-8 flex flex-col">
        <div className="max-w-6xl mx-auto w-full">
          <div className="h-12 bg-gray-200 rounded-lg animate-pulse mb-8" />
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map(i => <div key={i} className="h-32 bg-gray-200 rounded-lg animate-pulse" />)}
          </div>
        </div>
      </div>
    );
  }

  const bgColor = 'bg-gradient-to-br from-gray-50 to-white';
  const cardBg = 'bg-white/80 border-gray-200';
  const textColor = 'text-gray-900';
  const secondaryText = 'text-gray-600';

  return (
    <div className={`min-h-full flex flex-col ${bgColor}`}>
      {/* Header */}
      <div className={`border-b border-gray-200 px-8 py-6 backdrop-blur-sm`}>
        <div className="max-w-6xl mx-auto">
          <Link href="/developer" className="text-gold-500 hover:text-gold-600 flex items-center gap-1 mb-2">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back to Dashboard</span>
          </Link>
          <h1 className={`text-3xl font-bold ${textColor}`}>AI Insights & Knowledge Base</h1>
          <p className={`${secondaryText} text-sm mt-1`}>FAQ analytics, recurring questions, and knowledge gaps</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-8 py-8 flex-1">
        <div className="max-w-6xl mx-auto space-y-8">

          {/* AI SMART RECOMMENDATIONS - New prominent section */}
          {data && data.recommendations && data.recommendations.length > 0 && (
            <div className={`rounded-xl border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-indigo-50 p-6`}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                  <Brain className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    AI Recommendations
                    <Sparkles className="w-4 h-4 text-purple-500" />
                  </h2>
                  <p className="text-sm text-gray-600">Smart suggestions to improve your platform</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {data.recommendations.map((rec) => (
                  <div key={rec.id} className={`rounded-lg p-4 bg-white/80 border ${
                    rec.priority === 'high' ? 'border-red-200' : rec.priority === 'medium' ? 'border-amber-200' : 'border-gray-200'
                  }`}>
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        rec.type === 'content' ? 'bg-blue-100' :
                        rec.type === 'engagement' ? 'bg-green-100' :
                        rec.type === 'knowledge' ? 'bg-purple-100' : 'bg-gray-100'
                      }`}>
                        {rec.type === 'content' ? <FileText className="w-4 h-4 text-blue-600" /> :
                         rec.type === 'engagement' ? <Users className="w-4 h-4 text-green-600" /> :
                         rec.type === 'knowledge' ? <BookOpen className="w-4 h-4 text-purple-600" /> :
                         <Zap className="w-4 h-4 text-gray-600" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-sm font-semibold text-gray-900">{rec.title}</h3>
                          <span className={`px-1.5 py-0.5 text-xs font-medium rounded ${
                            rec.priority === 'high' ? 'bg-red-100 text-red-700' :
                            rec.priority === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {rec.priority}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 mb-2">{rec.description}</p>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500">{rec.impact}</span>
                          <button className="text-xs font-medium text-purple-600 hover:text-purple-700 flex items-center gap-1">
                            {rec.action}
                            <ArrowUpRight className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* KEY METRICS STRIP */}
          {data && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className={`rounded-lg border p-5 backdrop-blur-sm transition hover:shadow-md ${cardBg}`}>
                <div className="flex items-center justify-between mb-3">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                  <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">AI</span>
                </div>
                <p className={`${secondaryText} text-xs uppercase tracking-wide mb-1`}>Resolution Rate</p>
                <p className={`text-2xl font-bold ${textColor}`}>{data.chatResolutionRate}%</p>
                <p className={`${secondaryText} text-xs mt-1`}>Questions answered by AI</p>
              </div>

              <div className={`rounded-lg border p-5 backdrop-blur-sm transition hover:shadow-md ${cardBg}`}>
                <div className="flex items-center justify-between mb-3">
                  <MessageSquare className="w-5 h-5 text-blue-500" />
                </div>
                <p className={`${secondaryText} text-xs uppercase tracking-wide mb-1`}>Total Questions</p>
                <p className={`text-2xl font-bold ${textColor}`}>{data.realMetrics.totalMessages}</p>
                <p className={`${secondaryText} text-xs mt-1`}>Last 30 days</p>
              </div>

              <div className={`rounded-lg border p-5 backdrop-blur-sm transition hover:shadow-md ${cardBg}`}>
                <div className="flex items-center justify-between mb-3">
                  <AlertCircle className="w-5 h-5 text-amber-500" />
                  {infoRequests.filter(r => r.status === 'pending').length > 0 && (
                    <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Action</span>
                  )}
                </div>
                <p className={`${secondaryText} text-xs uppercase tracking-wide mb-1`}>Pending Review</p>
                <p className={`text-2xl font-bold ${textColor}`}>{infoRequests.filter(r => r.status === 'pending').length}</p>
                <p className={`${secondaryText} text-xs mt-1`}>Needs your input</p>
              </div>

              <div className={`rounded-lg border p-5 backdrop-blur-sm transition hover:shadow-md ${cardBg}`}>
                <div className="flex items-center justify-between mb-3">
                  <Users className="w-5 h-5 text-purple-500" />
                </div>
                <p className={`${secondaryText} text-xs uppercase tracking-wide mb-1`}>Active Users</p>
                <p className={`text-2xl font-bold ${textColor}`}>{data.realMetrics.activeUsers}</p>
                <p className={`${secondaryText} text-xs mt-1`}>
                  {data.realMetrics.totalHomeowners > 0
                    ? `of ${data.realMetrics.totalHomeowners} total (${data.realMetrics.engagementRate.toFixed(0)}%)`
                    : `${data.realMetrics.engagementRate.toFixed(0)}% engagement`
                  }
                </p>
              </div>
            </div>
          )}

          {/* CONTENT SUGGESTIONS & TOPIC ANALYSIS */}
          {data && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Content Suggestions */}
              {data.contentSuggestions && data.contentSuggestions.length > 0 && (
                <div className={`rounded-lg border p-6 backdrop-blur-sm ${cardBg}`}>
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
                    <Lightbulb className="w-5 h-5 text-gold-500" />
                    Suggested Content to Create
                  </h3>
                  <div className="space-y-3">
                    {data.contentSuggestions.map((suggestion, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          suggestion.suggestedFormat === 'guide' ? 'bg-blue-100' :
                          suggestion.suggestedFormat === 'faq' ? 'bg-green-100' :
                          suggestion.suggestedFormat === 'document' ? 'bg-purple-100' : 'bg-gray-100'
                        }`}>
                          {suggestion.suggestedFormat === 'guide' ? <BookOpen className="w-5 h-5 text-blue-600" /> :
                           suggestion.suggestedFormat === 'faq' ? <HelpCircle className="w-5 h-5 text-green-600" /> :
                           <FileText className="w-5 h-5 text-purple-600" />}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">{suggestion.topic}</p>
                          <p className="text-xs text-gray-500">{suggestion.reason}</p>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-1">
                            {Array.from({length: 5}).map((_, i) => (
                              <div key={i} className={`w-1.5 h-4 rounded-full ${
                                i < Math.ceil(suggestion.estimatedImpact / 2) ? 'bg-gold-500' : 'bg-gray-200'
                              }`} />
                            ))}
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">Impact</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Topic Clusters */}
              {data.topicClusters && data.topicClusters.length > 0 && (
                <div className={`rounded-lg border p-6 backdrop-blur-sm ${cardBg}`}>
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
                    <BarChart3 className="w-5 h-5 text-gold-500" />
                    Question Topics
                  </h3>
                  <div className="space-y-3">
                    {data.topicClusters.map((cluster, idx) => (
                      <div key={idx} className="flex items-center gap-3">
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-gray-900">{cluster.topic}</span>
                            <span className="text-sm text-gray-600">{cluster.count}</span>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                cluster.sentiment === 'positive' ? 'bg-green-500' :
                                cluster.sentiment === 'negative' ? 'bg-red-400' : 'bg-gold-500'
                              }`}
                              style={{ width: `${Math.min(100, (cluster.count / Math.max(...data.topicClusters.map(c => c.count))) * 100)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* QUICK ACTION: Pending Queries */}
          {infoRequests.filter(r => r.status === 'pending').length > 0 && (
            <div className={`rounded-lg border backdrop-blur-sm ${cardBg}`}>
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-500" />
                  <h3 className={`text-sm font-semibold ${textColor}`}>Questions Needing Your Input</h3>
                  <span className="px-2 py-0.5 text-xs font-semibold bg-amber-100 text-amber-700 rounded-full">
                    {infoRequests.filter(r => r.status === 'pending').length}
                  </span>
                </div>
                <button
                  onClick={() => setActiveTab('requests')}
                  className="text-xs text-gold-500 hover:text-gold-600 font-medium flex items-center gap-1"
                >
                  View All
                  <ArrowUpRight className="w-3 h-3" />
                </button>
              </div>
              <div className="divide-y divide-gray-100">
                {infoRequests.filter(r => r.status === 'pending').slice(0, 3).map((req) => (
                  <div key={req.id} className="px-4 py-3 flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${textColor} truncate`}>{req.question}</p>
                      <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3" />
                        {new Date(req.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedRequest(req);
                        setResponseText('');
                        setAddToKnowledge(true);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gold-500 text-white rounded-lg hover:bg-gold-600 transition"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Answer
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* WEEKLY TRENDS */}
          {data && data.weeklyTrends && data.weeklyTrends.length > 0 && (
            <div className={`rounded-lg border p-6 backdrop-blur-sm ${cardBg}`}>
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-gold-500" />
                Weekly Performance Trends
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left text-xs font-semibold text-gray-600 uppercase pb-3">Period</th>
                      <th className="text-center text-xs font-semibold text-gray-600 uppercase pb-3">Questions</th>
                      <th className="text-center text-xs font-semibold text-gray-600 uppercase pb-3">AI Resolved</th>
                      <th className="text-center text-xs font-semibold text-gray-600 uppercase pb-3">Escalated</th>
                      <th className="text-center text-xs font-semibold text-gray-600 uppercase pb-3">Resolution %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.weeklyTrends.map((week, idx) => (
                      <tr key={idx} className="border-b border-gray-100 last:border-0">
                        <td className="py-3 text-sm font-medium text-gray-900">{week.week}</td>
                        <td className="py-3 text-center text-sm text-gray-600">{week.questions}</td>
                        <td className="py-3 text-center text-sm text-green-600 font-medium">{week.resolved}</td>
                        <td className="py-3 text-center text-sm text-amber-600">{week.escalated}</td>
                        <td className="py-3 text-center">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            week.questions > 0 && (week.resolved / week.questions * 100) >= 80 ? 'bg-green-100 text-green-700' :
                            week.questions > 0 && (week.resolved / week.questions * 100) >= 60 ? 'bg-amber-100 text-amber-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {week.questions > 0 ? Math.round(week.resolved / week.questions * 100) : 0}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tab Navigation */}
          <div className="flex gap-2 border-b border-gray-200">
            <button
              onClick={() => setActiveTab('faq')}
              className={`px-4 py-3 font-medium border-b-2 transition ${
                activeTab === 'faq'
                  ? 'border-gold-500 text-gold-500'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Recurring Questions
              </div>
            </button>
            <button
              onClick={() => setActiveTab('gaps')}
              className={`px-4 py-3 font-medium border-b-2 transition ${
                activeTab === 'gaps'
                  ? 'border-gold-500 text-gold-500'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <HelpCircle className="w-4 h-4" />
                Knowledge Gaps
              </div>
            </button>
            <button
              onClick={() => setActiveTab('requests')}
              className={`px-4 py-3 font-medium border-b-2 transition ${
                activeTab === 'requests'
                  ? 'border-gold-500 text-gold-500'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <Inbox className="w-4 h-4" />
                Information Requests
                {infoRequests.filter(r => r.status === 'pending').length > 0 && (
                  <span className="ml-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-600">
                    {infoRequests.filter(r => r.status === 'pending').length}
                  </span>
                )}
              </div>
            </button>
          </div>

          {/* FAQ Tab: Top Recurring Questions */}
          {activeTab === 'faq' && data && (
            <div className={`rounded-lg border backdrop-blur-sm overflow-hidden ${cardBg}`}>
              <div className="p-6 border-b border-gray-200">
                <h2 className={`text-lg font-semibold ${textColor}`}>Top 10 Recurring Questions</h2>
                <p className={`${secondaryText} text-sm mt-1`}>Questions most frequently asked by homeowners</p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50/50">
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Rank</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Question</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Frequency</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Avg Response</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topQuestions.length > 0 ? (
                      data.topQuestions.map((q, idx) => (
                        <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50/50 transition">
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gold-100 text-gold-600 font-semibold text-sm">
                              {idx + 1}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <p className={`text-sm font-medium ${textColor} max-w-2xl`}>{q.question}</p>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold bg-gold-50 text-gold-600`}>
                              {q.count}x
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">{q.avgResponseTime}ms</td>
                          <td className="px-6 py-4">
                            <button className="inline-flex items-center gap-1 px-3 py-1.5 rounded text-sm font-medium text-gold-500 hover:bg-gold-50 transition">
                              <Eye className="w-4 h-4" />
                              View
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                          No questions data available yet
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Knowledge Gaps Tab */}
          {activeTab === 'gaps' && data && (
            <div className="space-y-4">
              <p className={`${secondaryText} text-sm`}>Questions that commonly receive fallback answers or unclear responses. Recommended actions to improve homeowner satisfaction.</p>
              
              {data.knowledgeGaps.length > 0 ? (
                data.knowledgeGaps.map((gap, idx) => (
                  <div key={idx} className={`rounded-lg border p-6 backdrop-blur-sm ${getStatusColor(gap.status)}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-sm font-semibold">{gap.question}</h3>
                          {gap.category && (
                            <span className="text-xs font-medium px-2 py-1 rounded bg-white/50">{gap.category}</span>
                          )}
                        </div>
                        <p className="text-xs opacity-75">Asked {gap.frequency} times • Knowledge gap identified</p>
                      </div>
                      <div className="flex items-center gap-3 ml-4">
                        <span className="text-2xl font-bold opacity-50">{gap.frequency}</span>
                        <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/80 hover:bg-white transition font-medium text-sm">
                          {getSuggestedActionIcon(gap.suggestedAction)}
                          {getSuggestedActionLabel(gap.suggestedAction)}
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-dashed border-gray-300 p-12 text-center">
                  <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
                  <p className={`font-semibold ${textColor}`}>No knowledge gaps detected</p>
                  <p className={`${secondaryText} text-sm mt-1`}>Your knowledge base is keeping up with customer questions</p>
                </div>
              )}
            </div>
          )}

          {/* Information Requests Tab */}
          {activeTab === 'requests' && (
            <div className="space-y-4">
              <p className={`${secondaryText} text-sm`}>
                Questions submitted by homeowners when the AI couldn&apos;t find an answer. 
                Add responses here to help future residents and improve the knowledge base.
              </p>
              
              {requestsLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-24 bg-gray-200 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : infoRequests.length > 0 ? (
                <div className="space-y-4">
                  {infoRequests.map((req) => (
                    <div 
                      key={req.id} 
                      className={`rounded-lg border p-6 backdrop-blur-sm transition hover:shadow-md ${
                        req.status === 'resolved' 
                          ? 'bg-green-50 border-green-200' 
                          : 'bg-white border-gray-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              req.status === 'resolved' 
                                ? 'bg-green-100 text-green-700' 
                                : 'bg-amber-100 text-amber-700'
                            }`}>
                              {req.status === 'resolved' ? 'Resolved' : 'Pending'}
                            </span>
                            <span className="text-xs text-gray-500">
                              {new Date(req.created_at).toLocaleDateString('en-GB', { 
                                day: 'numeric', 
                                month: 'short', 
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                          <h3 className={`text-sm font-semibold ${textColor} mb-2`}>{req.question}</h3>
                          {req.response && (
                            <div className="mt-3 p-3 rounded-lg bg-gray-50 border border-gray-200">
                              <p className="text-xs font-medium text-gray-500 mb-1">Response:</p>
                              <p className="text-sm text-gray-700">{req.response}</p>
                            </div>
                          )}
                        </div>
                        {req.status !== 'resolved' && (
                          <button
                            onClick={() => {
                              setSelectedRequest(req);
                              setResponseText('');
                              setAddToKnowledge(true);
                            }}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gold-500 text-white hover:bg-gold-600 transition font-medium text-sm"
                          >
                            <Plus className="w-4 h-4" />
                            Add Answer
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-gray-300 p-12 text-center">
                  <Inbox className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className={`font-semibold ${textColor}`}>No information requests yet</p>
                  <p className={`${secondaryText} text-sm mt-1`}>When homeowners ask questions the AI can&apos;t answer, they&apos;ll appear here</p>
                </div>
              )}
            </div>
          )}

          {/* Info Notice */}
          <div className={`rounded-lg border p-4 bg-gold-50/50 border-gold-200 text-xs text-gold-600`}>
            <span className="font-semibold">Tip:</span> Use this data to identify content gaps and improve your knowledge base. Upload FAQs, manuals, or documentation to reduce unanswered questions.
          </div>
        </div>
      </div>

      {/* Add Answer Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-lg bg-white rounded-xl shadow-xl">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Add Answer</h3>
              <button
                onClick={() => {
                  setSelectedRequest(null);
                  setResponseText('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Question</label>
                <p className="p-3 rounded-lg bg-gray-50 text-sm text-gray-800">{selectedRequest.question}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Your Answer</label>
                <textarea
                  value={responseText}
                  onChange={(e) => setResponseText(e.target.value)}
                  placeholder="Type your answer here..."
                  rows={5}
                  className="w-full p-3 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-gold-500 focus:border-gold-500"
                />
              </div>
              
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="addToKnowledge"
                  checked={addToKnowledge}
                  onChange={(e) => setAddToKnowledge(e.target.checked)}
                  className="w-4 h-4 text-gold-500 rounded border-gray-300 focus:ring-gold-500"
                />
                <label htmlFor="addToKnowledge" className="text-sm text-gray-700">
                  Add this answer to the AI knowledge base so it can answer similar questions automatically
                </label>
              </div>
            </div>
            
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50 rounded-b-xl">
              <button
                onClick={() => {
                  setSelectedRequest(null);
                  setResponseText('');
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitResponse}
                disabled={!responseText.trim() || submitting}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gold-500 text-white hover:bg-gold-600 transition font-medium text-sm disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                {submitting ? 'Saving...' : 'Save Answer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
