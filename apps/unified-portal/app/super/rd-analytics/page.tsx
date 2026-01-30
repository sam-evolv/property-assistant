'use client';

import { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  MessageSquare, 
  MapPin, 
  AlertTriangle, 
  Lightbulb,
  Loader2,
  ArrowUp,
  ArrowDown,
  Minus,
  BarChart3,
  Users,
  ThumbsUp,
  RefreshCw
} from 'lucide-react';
import { SectionHeader } from '@/components/admin-enterprise/SectionHeader';

interface TopicData {
  topic: string;
  count: number;
  trend: 'up' | 'down' | 'stable';
  change: number;
}

interface TrendingQuestion {
  question: string;
  count: number;
  developments: string[];
}

interface RegionalData {
  county: string;
  questions: number;
  developments: number;
  avgPerUnit: number;
}

interface KnowledgeGap {
  topic: string;
  confidence: number;
  frequency: number;
  suggestion: string;
}

interface Insight {
  id: string;
  type: 'opportunity' | 'warning' | 'success';
  title: string;
  description: string;
  created_at: string;
}

interface AnalyticsData {
  overview: {
    totalQuestions: number;
    avgPerUnit: number;
    satisfactionRate: number;
    activeUsers: number;
    questionsTrend: number;
  };
  topics: TopicData[];
  trending: TrendingQuestion[];
  regional: RegionalData[];
  gaps: KnowledgeGap[];
  insights: Insight[];
  hasData: boolean;
}

type Section = 'overview' | 'trending' | 'regional' | 'gaps' | 'insights';

export default function RDAnalyticsPage() {
  const [activeSection, setActiveSection] = useState<Section>('overview');
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    
    try {
      const res = await fetch('/api/super/rd-analytics');
      if (res.ok) {
        const result = await res.json();
        setData(result);
      }
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const sections = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'trending', label: 'Trending Questions', icon: TrendingUp },
    { id: 'regional', label: 'Regional Breakdown', icon: MapPin },
    { id: 'gaps', label: 'Knowledge Gaps', icon: AlertTriangle },
    { id: 'insights', label: 'AI Insights', icon: Lightbulb },
  ];

  const TrendIcon = ({ trend }: { trend: 'up' | 'down' | 'stable' }) => {
    if (trend === 'up') return <ArrowUp className="w-4 h-4 text-green-600" />;
    if (trend === 'down') return <ArrowDown className="w-4 h-4 text-red-600" />;
    return <Minus className="w-4 h-4 text-gray-400" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="p-8 bg-white min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <SectionHeader
          title="R&D Analytics Dashboard"
          description="Platform-wide insights, trends, and knowledge gaps across all developments"
        />
        <button
          onClick={() => fetchAnalytics(true)}
          disabled={refreshing}
          className="px-4 py-2 border-2 border-gray-300 rounded-lg font-bold text-black hover:bg-gray-100 flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="flex border-b-2 border-gray-200 mb-6 overflow-x-auto">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id as Section)}
              className={`flex items-center gap-2 px-6 py-3 text-sm font-bold transition-colors border-b-2 -mb-0.5 whitespace-nowrap ${
                activeSection === section.id
                  ? 'text-amber-600 border-amber-500'
                  : 'text-black border-transparent hover:text-amber-600 hover:border-amber-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              {section.label}
            </button>
          );
        })}
      </div>

      {activeSection === 'overview' && data && (
        <div className="space-y-6">
          {!data.hasData && (
            <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-6 mb-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-black">No Analytics Data Available</p>
                  <p className="text-sm text-black mt-1">
                    Analytics will populate as users interact with the AI assistant. The tables (question_analytics, platform_insights) 
                    need to be created and populated with data from the AI assistant interactions.
                  </p>
                </div>
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white border-2 border-gray-200 rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <MessageSquare className="w-8 h-8 text-amber-500" />
                {data.overview.questionsTrend !== 0 && (
                  <span className={`text-sm font-bold flex items-center gap-1 ${
                    data.overview.questionsTrend > 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {data.overview.questionsTrend > 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                    {Math.abs(data.overview.questionsTrend)}%
                  </span>
                )}
              </div>
              <p className="text-3xl font-black text-black">{data.overview.totalQuestions.toLocaleString()}</p>
              <p className="text-sm font-bold text-black mt-1">Total Questions Nationwide</p>
            </div>

            <div className="bg-white border-2 border-gray-200 rounded-xl p-6 shadow-sm">
              <BarChart3 className="w-8 h-8 text-blue-500 mb-2" />
              <p className="text-3xl font-black text-black">{data.overview.avgPerUnit.toFixed(1)}</p>
              <p className="text-sm font-bold text-black mt-1">Avg Questions per Unit</p>
            </div>

            <div className="bg-white border-2 border-gray-200 rounded-xl p-6 shadow-sm">
              <ThumbsUp className="w-8 h-8 text-green-500 mb-2" />
              <p className="text-3xl font-black text-black">{data.overview.satisfactionRate}%</p>
              <p className="text-sm font-bold text-black mt-1">Satisfaction Rate</p>
            </div>

            <div className="bg-white border-2 border-gray-200 rounded-xl p-6 shadow-sm">
              <Users className="w-8 h-8 text-purple-500 mb-2" />
              <p className="text-3xl font-black text-black">{data.overview.activeUsers.toLocaleString()}</p>
              <p className="text-sm font-bold text-black mt-1">Active Users (30 days)</p>
            </div>
          </div>

          <div className="bg-white border-2 border-gray-200 rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-bold text-black mb-4">Topic Breakdown</h3>
            <div className="space-y-4">
              {data.topics.map((topic, idx) => (
                <div key={idx} className="flex items-center gap-4">
                  <div className="w-40 flex-shrink-0">
                    <span className="font-bold text-black">{topic.topic}</span>
                  </div>
                  <div className="flex-1 h-8 bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-amber-500 rounded-full"
                      style={{ width: `${(topic.count / data.topics[0].count) * 100}%` }}
                    />
                  </div>
                  <div className="w-20 text-right">
                    <span className="font-bold text-black">{topic.count}</span>
                  </div>
                  <div className="w-16 flex items-center gap-1">
                    <TrendIcon trend={topic.trend} />
                    <span className={`text-sm font-bold ${
                      topic.trend === 'up' ? 'text-green-600' : 
                      topic.trend === 'down' ? 'text-red-600' : 'text-gray-500'
                    }`}>
                      {topic.change}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeSection === 'trending' && data && (
        <div className="bg-white border-2 border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <h3 className="text-lg font-bold text-black">Most Asked Questions Nationwide</h3>
            <p className="text-sm text-black mt-1">Questions trending across all developments</p>
          </div>
          <div className="divide-y divide-gray-200">
            {data.trending.map((item, idx) => (
              <div key={idx} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-sm">
                        {idx + 1}
                      </span>
                      <p className="font-bold text-black">{item.question}</p>
                    </div>
                    <div className="ml-11 flex flex-wrap gap-2">
                      {item.developments.slice(0, 3).map((dev, i) => (
                        <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded-full font-medium border border-gray-200">
                          {dev}
                        </span>
                      ))}
                      {item.developments.length > 3 && (
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full font-medium border border-gray-200">
                          +{item.developments.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-black text-black">{item.count}</span>
                    <p className="text-xs text-gray-500 font-medium">times asked</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeSection === 'regional' && data && (
        <div className="bg-white border-2 border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <h3 className="text-lg font-bold text-black">Activity by County</h3>
            <p className="text-sm text-black mt-1">Question volume and engagement by region</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-black uppercase tracking-wider">County</th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-black uppercase tracking-wider">Questions</th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-black uppercase tracking-wider">Developments</th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-black uppercase tracking-wider">Avg per Unit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {data.regional.map((region, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-amber-500" />
                        <span className="font-bold text-black">{region.county}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-black">{region.questions.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right font-medium text-black">{region.developments}</td>
                    <td className="px-6 py-4 text-right">
                      <span className={`font-bold ${
                        region.avgPerUnit > 5 ? 'text-green-600' : 
                        region.avgPerUnit > 2 ? 'text-amber-600' : 'text-gray-600'
                      }`}>
                        {region.avgPerUnit.toFixed(1)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSection === 'gaps' && data && (
        <div className="space-y-6">
          <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-black">Knowledge Gaps Detected</p>
                <p className="text-sm text-black mt-1">
                  These topics have low AI confidence scores and may need additional training or custom Q&A pairs.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white border-2 border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div className="divide-y divide-gray-200">
              {data.gaps.map((gap, idx) => (
                <div key={idx} className="p-6">
                  <div className="flex items-start justify-between gap-6">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-bold text-lg text-black">{gap.topic}</span>
                        <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${
                          gap.confidence < 30 ? 'bg-red-100 text-red-700' :
                          gap.confidence < 60 ? 'bg-amber-100 text-amber-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {gap.confidence}% confidence
                        </span>
                      </div>
                      <p className="text-black">{gap.suggestion}</p>
                      <p className="text-sm text-gray-500 mt-2 font-medium">Asked {gap.frequency} times</p>
                    </div>
                    <div className="w-32">
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${
                            gap.confidence < 30 ? 'bg-red-500' :
                            gap.confidence < 60 ? 'bg-amber-500' :
                            'bg-green-500'
                          }`}
                          style={{ width: `${gap.confidence}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeSection === 'insights' && data && (
        <div className="space-y-4">
          {data.insights.map((insight) => (
            <div 
              key={insight.id}
              className={`bg-white border-2 rounded-xl p-6 shadow-sm ${
                insight.type === 'opportunity' ? 'border-blue-200' :
                insight.type === 'warning' ? 'border-amber-200' :
                'border-green-200'
              }`}
            >
              <div className="flex items-start gap-4">
                <div className={`p-2 rounded-lg ${
                  insight.type === 'opportunity' ? 'bg-blue-100' :
                  insight.type === 'warning' ? 'bg-amber-100' :
                  'bg-green-100'
                }`}>
                  <Lightbulb className={`w-5 h-5 ${
                    insight.type === 'opportunity' ? 'text-blue-600' :
                    insight.type === 'warning' ? 'text-amber-600' :
                    'text-green-600'
                  }`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-black">{insight.title}</span>
                    <span className={`px-2 py-0.5 text-xs font-bold rounded-full uppercase ${
                      insight.type === 'opportunity' ? 'bg-blue-100 text-blue-700' :
                      insight.type === 'warning' ? 'bg-amber-100 text-amber-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {insight.type}
                    </span>
                  </div>
                  <p className="text-black">{insight.description}</p>
                  <p className="text-xs text-gray-500 mt-2 font-medium">
                    Generated {new Date(insight.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
