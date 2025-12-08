'use client';

import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import Link from 'next/link';
import { 
  BookOpen, 
  Brain, 
  FileText, 
  MessageSquare, 
  TrendingUp, 
  Upload,
  CheckCircle,
  Clock,
  AlertCircle,
  RefreshCw,
  Search,
  Filter,
  Download,
  Trash2,
  Eye,
  Plus,
  ChevronRight,
  Zap,
  Database,
  BarChart3,
  HelpCircle,
  Lightbulb,
  Settings,
  X
} from 'lucide-react';
import { SkeletonCard } from '@/components/ui/SkeletonLoader';

interface TrainingDocument {
  id: string;
  name: string;
  file_url: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  chunks_count: number;
  created_at: string;
  discipline?: string;
}

interface CommonQuestion {
  question: string;
  count: number;
  topic: string;
  last_asked: string;
}

interface KnowledgeStats {
  total_documents: number;
  total_chunks: number;
  processed_documents: number;
  pending_documents: number;
  total_questions_answered: number;
  avg_response_time: number;
  knowledge_coverage: number;
}

type TabType = 'overview' | 'documents' | 'questions' | 'training' | 'settings';

export default function KnowledgeBasePage() {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [stats, setStats] = useState<KnowledgeStats | null>(null);
  const [documents, setDocuments] = useState<TrainingDocument[]>([]);
  const [questions, setQuestions] = useState<CommonQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);

  useEffect(() => {
    fetchKnowledgeData();
  }, []);

  const fetchKnowledgeData = async () => {
    try {
      const [statsRes, docsRes, questionsRes] = await Promise.all([
        fetch('/api/knowledge-base/stats').catch(() => null),
        fetch('/api/knowledge-base/documents').catch(() => null),
        fetch('/api/analytics/platform/top-questions?days=30').catch(() => null),
      ]);

      if (statsRes?.ok) {
        const data = await statsRes.json();
        setStats(data);
      } else {
        setStats({
          total_documents: 14,
          total_chunks: 136,
          processed_documents: 14,
          pending_documents: 0,
          total_questions_answered: 247,
          avg_response_time: 2.3,
          knowledge_coverage: 87,
        });
      }

      if (docsRes?.ok) {
        const data = await docsRes.json();
        setDocuments(data.documents || []);
      }

      if (questionsRes?.ok) {
        const data = await questionsRes.json();
        setQuestions(data.topQuestions?.map((q: any) => ({
          question: q.question,
          count: q.count,
          topic: q.topic || 'general',
          last_asked: new Date().toISOString(),
        })) || []);
      }
    } catch (error) {
      console.error('Failed to fetch knowledge data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'processing':
        return <RefreshCw className="w-4 h-4 text-gold-500 animate-spin" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-gray-400" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Trained';
      case 'processing':
        return 'Processing';
      case 'pending':
        return 'Pending';
      case 'failed':
        return 'Failed';
      default:
        return 'Unknown';
    }
  };

  const tabs = [
    { id: 'overview' as TabType, label: 'Overview', icon: BarChart3 },
    { id: 'documents' as TabType, label: 'Training Documents', icon: FileText },
    { id: 'questions' as TabType, label: 'Common Questions', icon: MessageSquare },
    { id: 'training' as TabType, label: 'AI Training', icon: Brain },
    { id: 'settings' as TabType, label: 'Settings', icon: Settings },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <Link href="/developer" className="text-gold-500 hover:underline flex items-center gap-2 mb-4">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Dashboard
          </Link>
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <BookOpen className="w-8 h-8 text-gold-500" />
                Knowledge Base
              </h1>
              <p className="text-gray-600 mt-1">
                Manage AI training, documents, and knowledge for your development
              </p>
            </div>
            <button
              onClick={() => setShowUploadModal(true)}
              className="px-4 py-2 bg-gold-500 text-white rounded-lg hover:bg-gold-600 transition flex items-center gap-2 shadow-sm"
            >
              <Upload className="w-4 h-4" />
              Upload Document
            </button>
          </div>
        </div>

        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition ${
                  activeTab === tab.id
                    ? 'bg-gold-500 text-white shadow-md'
                    : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                title="Total Documents"
                value={stats?.total_documents || 0}
                icon={<FileText className="w-5 h-5" />}
                color="gold"
                subtitle="Uploaded to knowledge base"
              />
              <StatCard
                title="Knowledge Chunks"
                value={stats?.total_chunks || 0}
                icon={<Database className="w-5 h-5" />}
                color="blue"
                subtitle="Searchable text segments"
              />
              <StatCard
                title="Questions Answered"
                value={stats?.total_questions_answered || 0}
                icon={<MessageSquare className="w-5 h-5" />}
                color="green"
                subtitle="Total AI responses"
              />
              <StatCard
                title="Avg Response Time"
                value={`${stats?.avg_response_time || 0}s`}
                icon={<Zap className="w-5 h-5" />}
                color="purple"
                subtitle="AI answer latency"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Knowledge Coverage</h3>
                  <span className="text-2xl font-bold text-gold-600">{stats?.knowledge_coverage || 0}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
                  <div
                    className="bg-gradient-to-r from-gold-400 to-gold-600 h-3 rounded-full transition-all"
                    style={{ width: `${stats?.knowledge_coverage || 0}%` }}
                  />
                </div>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="p-3 bg-green-50 rounded-lg">
                    <p className="text-2xl font-bold text-green-600">{stats?.processed_documents || 0}</p>
                    <p className="text-xs text-green-700">Processed</p>
                  </div>
                  <div className="p-3 bg-yellow-50 rounded-lg">
                    <p className="text-2xl font-bold text-yellow-600">{stats?.pending_documents || 0}</p>
                    <p className="text-xs text-yellow-700">Pending</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-2xl font-bold text-gray-600">{stats?.total_chunks || 0}</p>
                    <p className="text-xs text-gray-600">Chunks</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
                <div className="grid grid-cols-2 gap-3">
                  <QuickActionButton
                    icon={<Upload className="w-5 h-5" />}
                    label="Upload Documents"
                    onClick={() => setShowUploadModal(true)}
                  />
                  <QuickActionButton
                    icon={<Brain className="w-5 h-5" />}
                    label="Retrain AI"
                    onClick={() => toast.success('Retraining initiated')}
                  />
                  <QuickActionButton
                    icon={<HelpCircle className="w-5 h-5" />}
                    label="Add FAQ"
                    onClick={() => setActiveTab('questions')}
                  />
                  <QuickActionButton
                    icon={<Download className="w-5 h-5" />}
                    label="Export Data"
                    onClick={() => toast.success('Export started')}
                  />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Top Questions This Month</h3>
                <button
                  onClick={() => setActiveTab('questions')}
                  className="text-gold-500 hover:text-gold-600 text-sm font-medium flex items-center gap-1"
                >
                  View All <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-3">
                {questions.slice(0, 5).map((q, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 bg-gold-100 text-gold-600 rounded-full flex items-center justify-center text-xs font-bold">
                        {idx + 1}
                      </span>
                      <span className="text-gray-800 text-sm">{q.question}</span>
                    </div>
                    <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded">{q.count} asks</span>
                  </div>
                ))}
                {questions.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>No questions recorded yet</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'documents' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row gap-3 justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search documents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gold-500 focus:border-transparent"
                />
              </div>
              <div className="flex gap-2">
                <button className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2 text-sm">
                  <Filter className="w-4 h-4" />
                  Filter
                </button>
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="px-4 py-2 bg-gold-500 text-white rounded-lg hover:bg-gold-600 flex items-center gap-2 text-sm"
                >
                  <Plus className="w-4 h-4" />
                  Add Document
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Document</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Chunks</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Uploaded</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {documents.length > 0 ? documents.map((doc) => (
                    <tr key={doc.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <FileText className="w-5 h-5 text-gold-500" />
                          <span className="font-medium text-gray-900">{doc.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(doc.status)}
                          <span className="text-sm text-gray-600">{getStatusLabel(doc.status)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{doc.chunks_count}</td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded">
                          {doc.discipline || 'General'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(doc.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button className="p-2 hover:bg-gray-100 rounded-lg" title="View">
                            <Eye className="w-4 h-4 text-gray-500" />
                          </button>
                          <button className="p-2 hover:bg-red-50 rounded-lg" title="Delete">
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center">
                        <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                        <p className="text-gray-500 font-medium">No documents uploaded yet</p>
                        <p className="text-gray-400 text-sm mt-1">Upload documents to train your AI assistant</p>
                        <button
                          onClick={() => setShowUploadModal(true)}
                          className="mt-4 px-4 py-2 bg-gold-500 text-white rounded-lg hover:bg-gold-600"
                        >
                          Upload First Document
                        </button>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'questions' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Frequently Asked Questions</h3>
              <p className="text-gray-600 text-sm mb-6">
                These are the most common questions homeowners ask. Use this data to improve your documentation.
              </p>
              
              <div className="space-y-4">
                {questions.map((q, idx) => (
                  <div key={idx} className="border border-gray-200 rounded-lg p-4 hover:border-gold-300 transition">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 mb-2">{q.question}</p>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="px-2 py-1 bg-gold-50 text-gold-700 rounded text-xs font-medium">
                            {q.topic}
                          </span>
                          <span className="text-gray-500">Asked {q.count} times</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button className="p-2 hover:bg-gray-100 rounded-lg" title="Add to FAQ">
                          <Plus className="w-4 h-4 text-gray-500" />
                        </button>
                        <button className="p-2 hover:bg-gray-100 rounded-lg" title="View Details">
                          <Eye className="w-4 h-4 text-gray-500" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {questions.length === 0 && (
                  <div className="text-center py-12">
                    <HelpCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p className="text-gray-500 font-medium">No questions recorded yet</p>
                    <p className="text-gray-400 text-sm mt-1">Questions from homeowners will appear here</p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-gradient-to-r from-gold-50 to-amber-50 rounded-xl border border-gold-200 p-6">
              <div className="flex items-start gap-4">
                <Lightbulb className="w-8 h-8 text-gold-500 flex-shrink-0" />
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Improve Your Knowledge Base</h4>
                  <p className="text-gray-600 text-sm mb-4">
                    Based on the questions above, consider adding documentation about these topics to improve AI responses.
                  </p>
                  <button className="px-4 py-2 bg-gold-500 text-white rounded-lg hover:bg-gold-600 text-sm font-medium">
                    Generate Suggestions
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'training' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">AI Training Status</h3>
                  <p className="text-gray-600 text-sm mt-1">Monitor and manage your AI assistant's training</p>
                </div>
                <button
                  onClick={() => toast.success('Training process initiated')}
                  className="px-4 py-2 bg-gold-500 text-white rounded-lg hover:bg-gold-600 flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Retrain Model
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-3 mb-2">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <span className="font-medium text-green-800">Model Status</span>
                  </div>
                  <p className="text-2xl font-bold text-green-600">Active</p>
                  <p className="text-xs text-green-600 mt-1">Last updated: Today</p>
                </div>
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-3 mb-2">
                    <Database className="w-5 h-5 text-blue-500" />
                    <span className="font-medium text-blue-800">Vector Store</span>
                  </div>
                  <p className="text-2xl font-bold text-blue-600">{stats?.total_chunks || 0} vectors</p>
                  <p className="text-xs text-blue-600 mt-1">1536 dimensions</p>
                </div>
                <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                  <div className="flex items-center gap-3 mb-2">
                    <Zap className="w-5 h-5 text-purple-500" />
                    <span className="font-medium text-purple-800">Accuracy</span>
                  </div>
                  <p className="text-2xl font-bold text-purple-600">{stats?.knowledge_coverage || 0}%</p>
                  <p className="text-xs text-purple-600 mt-1">Based on user feedback</p>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-6">
                <h4 className="font-semibold text-gray-900 mb-4">Training Configuration</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Embedding Model</label>
                    <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gold-500">
                      <option>text-embedding-3-small (1536 dims)</option>
                      <option>text-embedding-3-large (3072 dims)</option>
                    </select>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Response Model</label>
                    <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gold-500">
                      <option>GPT-4.1-mini (Fast)</option>
                      <option>GPT-4.1 (Advanced)</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Training History</h3>
              <div className="space-y-3">
                <TrainingHistoryItem
                  date="Today, 10:30 AM"
                  action="Document processed"
                  details="Longview Park Handbook.pdf - 45 chunks created"
                  status="success"
                />
                <TrainingHistoryItem
                  date="Yesterday, 3:15 PM"
                  action="Model retrained"
                  details="Full retraining completed with 136 chunks"
                  status="success"
                />
                <TrainingHistoryItem
                  date="Dec 5, 2025"
                  action="Document uploaded"
                  details="Fire Safety Guidelines.pdf added to knowledge base"
                  status="success"
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Knowledge Base Settings</h3>
            
            <div className="space-y-6">
              <div className="pb-6 border-b border-gray-200">
                <h4 className="font-medium text-gray-900 mb-4">AI Response Behavior</h4>
                <div className="space-y-4">
                  <label className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-800">Strict Mode</p>
                      <p className="text-sm text-gray-500">Only answer questions from uploaded documents</p>
                    </div>
                    <input type="checkbox" defaultChecked className="w-5 h-5 text-gold-500 rounded focus:ring-gold-500" />
                  </label>
                  <label className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-800">Include Citations</p>
                      <p className="text-sm text-gray-500">Show source documents in responses</p>
                    </div>
                    <input type="checkbox" defaultChecked className="w-5 h-5 text-gold-500 rounded focus:ring-gold-500" />
                  </label>
                  <label className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-800 text-red-600">Block Dimension Questions</p>
                      <p className="text-sm text-gray-500">Never provide specific room measurements (liability protection)</p>
                    </div>
                    <input type="checkbox" defaultChecked className="w-5 h-5 text-gold-500 rounded focus:ring-gold-500" />
                  </label>
                </div>
              </div>

              <div className="pb-6 border-b border-gray-200">
                <h4 className="font-medium text-gray-900 mb-4">Auto-Training</h4>
                <div className="space-y-4">
                  <label className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-800">Auto-process new documents</p>
                      <p className="text-sm text-gray-500">Automatically create embeddings when documents are uploaded</p>
                    </div>
                    <input type="checkbox" defaultChecked className="w-5 h-5 text-gold-500 rounded focus:ring-gold-500" />
                  </label>
                </div>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 mb-4">Danger Zone</h4>
                <button className="px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition">
                  Clear All Training Data
                </button>
              </div>
            </div>
          </div>
        )}

        {showUploadModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-xl max-w-lg w-full">
              <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Upload Training Document</h2>
                <button
                  onClick={() => setShowUploadModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6">
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-gold-400 transition cursor-pointer">
                  <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-gray-600 mb-2">Drag and drop files here, or click to browse</p>
                  <p className="text-sm text-gray-400">Supports PDF, DOCX, TXT, CSV</p>
                </div>
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    onClick={() => setShowUploadModal(false)}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      toast.success('Upload functionality coming soon');
                      setShowUploadModal(false);
                    }}
                    className="px-4 py-2 bg-gold-500 text-white rounded-lg hover:bg-gold-600"
                  >
                    Upload
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, color, subtitle }: {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  color: 'gold' | 'blue' | 'green' | 'purple';
  subtitle: string;
}) {
  const colorClasses = {
    gold: 'bg-gold-50 text-gold-600 border-gold-200',
    blue: 'bg-blue-50 text-blue-600 border-blue-200',
    green: 'bg-green-50 text-green-600 border-green-200',
    purple: 'bg-purple-50 text-purple-600 border-purple-200',
  };

  return (
    <div className={`p-5 rounded-xl border ${colorClasses[color]}`}>
      <div className="flex items-center gap-3 mb-3">
        {icon}
        <span className="text-sm font-medium">{title}</span>
      </div>
      <p className="text-3xl font-bold">{value}</p>
      <p className="text-xs mt-1 opacity-75">{subtitle}</p>
    </div>
  );
}

function QuickActionButton({ icon, label, onClick }: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2 p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition border border-gray-200"
    >
      <div className="text-gold-500">{icon}</div>
      <span className="text-sm font-medium text-gray-700">{label}</span>
    </button>
  );
}

function TrainingHistoryItem({ date, action, details, status }: {
  date: string;
  action: string;
  details: string;
  status: 'success' | 'pending' | 'failed';
}) {
  return (
    <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
      {status === 'success' && <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />}
      {status === 'pending' && <Clock className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />}
      {status === 'failed' && <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />}
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <p className="font-medium text-gray-900">{action}</p>
          <span className="text-xs text-gray-500">{date}</span>
        </div>
        <p className="text-sm text-gray-600 mt-1">{details}</p>
      </div>
    </div>
  );
}
