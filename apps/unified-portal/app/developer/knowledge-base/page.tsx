'use client';

import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import Link from 'next/link';
import { 
  BookOpen, 
  MessageSquare, 
  TrendingUp, 
  CheckCircle,
  Clock,
  Search,
  Trash2,
  Eye,
  Plus,
  ChevronRight,
  HelpCircle,
  Lightbulb,
  X,
  Edit3,
  FolderArchive,
  BarChart3,
  Tag,
  Inbox,
  Send
} from 'lucide-react';
import { SkeletonCard } from '@/components/ui/SkeletonLoader';
import { useCurrentContext } from '@/contexts/CurrentContext';

interface FAQEntry {
  id: string;
  question: string;
  answer: string;
  topic: string;
  tags: string[];
  priority: number;
  status: 'draft' | 'published';
  created_at: string;
  updated_at: string;
}

interface QuestionInsight {
  question: string;
  count: number;
  topic: string;
  last_asked: string;
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

type TabType = 'faqs' | 'insights' | 'gaps' | 'requests';

const TOPIC_OPTIONS = [
  'general',
  'floor_plans',
  'room_dimensions',
  'amenities',
  'parking',
  'utilities',
  'maintenance',
  'local_area',
  'transport',
  'documents',
  'construction',
  'warranty',
  'other'
];

export default function KnowledgeBasePage() {
  const { developmentId } = useCurrentContext();
  const [activeTab, setActiveTab] = useState<TabType>('faqs');
  const [faqs, setFaqs] = useState<FAQEntry[]>([]);
  const [questions, setQuestions] = useState<QuestionInsight[]>([]);
  const [infoRequests, setInfoRequests] = useState<InfoRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingFaq, setEditingFaq] = useState<FAQEntry | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<InfoRequest | null>(null);
  const [responseText, setResponseText] = useState('');
  const [submittingResponse, setSubmittingResponse] = useState(false);
  const [formData, setFormData] = useState({
    question: '',
    answer: '',
    topic: 'general',
    priority: 0,
    status: 'published' as 'draft' | 'published',
  });

  useEffect(() => {
    fetchData();
  }, [developmentId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [faqsRes, questionsRes, requestsRes] = await Promise.all([
        fetch(`/api/developer/faq${developmentId ? `?developmentId=${developmentId}` : ''}`).catch(() => null),
        fetch('/api/analytics/platform/top-questions?days=30').catch(() => null),
        fetch('/api/information-requests').catch(() => null),
      ]);

      if (faqsRes?.ok) {
        const data = await faqsRes.json();
        setFaqs(data.faqs || []);
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

      if (requestsRes?.ok) {
        const data = await requestsRes.json();
        setInfoRequests(data.requests || []);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRespondToRequest = async (requestId: string, response: string) => {
    if (!response.trim()) {
      toast.error('Please enter a response');
      return;
    }

    setSubmittingResponse(true);
    try {
      const res = await fetch(`/api/information-requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          response: response.trim(),
          status: 'resolved',
        }),
      });

      if (!res.ok) throw new Error('Failed to respond');

      toast.success('Response saved successfully');
      setSelectedRequest(null);
      setResponseText('');
      fetchData();
    } catch (error) {
      console.error('Failed to respond:', error);
      toast.error('Failed to save response');
    } finally {
      setSubmittingResponse(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const url = editingFaq ? `/api/developer/faq/${editingFaq.id}` : '/api/developer/faq';
      const method = editingFaq ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          developmentId: developmentId,
        }),
      });

      if (!res.ok) throw new Error('Failed to save FAQ');

      toast.success(editingFaq ? 'FAQ updated successfully' : 'FAQ created successfully');
      setShowModal(false);
      setEditingFaq(null);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Failed to save FAQ:', error);
      toast.error('Failed to save FAQ');
    }
  };

  const handleDelete = async (faqId: string) => {
    if (!confirm('Are you sure you want to delete this FAQ?')) return;

    try {
      const res = await fetch(`/api/developer/faq/${faqId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete FAQ');

      toast.success('FAQ deleted successfully');
      fetchData();
    } catch (error) {
      console.error('Failed to delete FAQ:', error);
      toast.error('Failed to delete FAQ');
    }
  };

  const handleEdit = (faq: FAQEntry) => {
    setEditingFaq(faq);
    setFormData({
      question: faq.question,
      answer: faq.answer,
      topic: faq.topic || 'general',
      priority: faq.priority,
      status: faq.status,
    });
    setShowModal(true);
  };

  const handleCreateFromInsight = (insight: QuestionInsight) => {
    setEditingFaq(null);
    setFormData({
      question: insight.question,
      answer: '',
      topic: insight.topic || 'general',
      priority: 0,
      status: 'draft',
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({
      question: '',
      answer: '',
      topic: 'general',
      priority: 0,
      status: 'published',
    });
  };

  const filteredFaqs = faqs.filter(faq => 
    faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
    faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const faqTopics = new Set(faqs.map(f => f.topic));
  const unansweredQuestions = questions.filter(q => !faqTopics.has(q.topic));

  const pendingRequests = infoRequests.filter(r => r.status === 'pending');
  
  const tabs = [
    { id: 'faqs' as TabType, label: 'Manual FAQs', icon: HelpCircle, count: faqs.length },
    { id: 'insights' as TabType, label: 'Question Insights', icon: TrendingUp, count: questions.length },
    { id: 'gaps' as TabType, label: 'Knowledge Gaps', icon: Lightbulb, count: unansweredQuestions.length },
    { id: 'requests' as TabType, label: 'Purchaser Requests', icon: Inbox, count: pendingRequests.length },
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
                Add custom FAQs and see what purchasers are asking about
              </p>
            </div>
            <div className="flex gap-3">
              <Link
                href="/developer/archive"
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition flex items-center gap-2"
              >
                <FolderArchive className="w-4 h-4" />
                Smart Archive
              </Link>
              <button
                onClick={() => {
                  resetForm();
                  setEditingFaq(null);
                  setShowModal(true);
                }}
                className="px-4 py-2 bg-gold-500 text-white rounded-lg hover:bg-gold-600 transition flex items-center gap-2 shadow-sm"
              >
                <Plus className="w-4 h-4" />
                Add FAQ
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <StatCard
            title="Manual FAQs"
            value={faqs.length}
            icon={<HelpCircle className="w-5 h-5" />}
            color="gold"
            subtitle="Custom Q&As you've added"
          />
          <StatCard
            title="Questions Asked"
            value={questions.reduce((acc, q) => acc + q.count, 0)}
            icon={<MessageSquare className="w-5 h-5" />}
            color="blue"
            subtitle="Last 30 days"
          />
          <StatCard
            title="Knowledge Gaps"
            value={unansweredQuestions.length}
            icon={<Lightbulb className="w-5 h-5" />}
            color="purple"
            subtitle="Topics needing FAQs"
          />
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
                {tab.count > 0 && (
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {activeTab === 'faqs' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row gap-3 justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search FAQs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gold-500 focus:border-transparent"
                />
              </div>
            </div>

            {filteredFaqs.length === 0 ? (
              <div className="p-12 text-center">
                <HelpCircle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No FAQs Yet</h3>
                <p className="text-gray-500 mb-4">Add custom questions and answers to supplement your AI knowledge</p>
                <button
                  onClick={() => { resetForm(); setEditingFaq(null); setShowModal(true); }}
                  className="px-4 py-2 bg-gold-500 text-white rounded-lg hover:bg-gold-600"
                >
                  Add Your First FAQ
                </button>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {filteredFaqs.map((faq) => (
                  <div key={faq.id} className="p-4 hover:bg-gray-50 transition">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                            faq.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {faq.status === 'published' ? 'Published' : 'Draft'}
                          </span>
                          <span className="px-2 py-0.5 text-xs bg-gold-50 text-gold-700 rounded">
                            {faq.topic}
                          </span>
                        </div>
                        <h4 className="font-medium text-gray-900 mb-1">{faq.question}</h4>
                        <p className="text-gray-600 text-sm line-clamp-2">{faq.answer}</p>
                        <p className="text-xs text-gray-400 mt-2">
                          Updated {new Date(faq.updated_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEdit(faq)}
                          className="p-2 hover:bg-gray-100 rounded-lg"
                          title="Edit"
                        >
                          <Edit3 className="w-4 h-4 text-gray-500" />
                        </button>
                        <button
                          onClick={() => handleDelete(faq.id)}
                          className="p-2 hover:bg-red-50 rounded-lg"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'insights' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-gold-500" />
                Top Questions (Last 30 Days)
              </h3>
              <p className="text-gray-600 text-sm mb-6">
                These are the most common questions purchasers are asking the AI assistant.
              </p>
              
              {questions.length === 0 ? (
                <div className="text-center py-12">
                  <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-gray-500 font-medium">No questions recorded yet</p>
                  <p className="text-gray-400 text-sm mt-1">Questions from purchasers will appear here</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {questions.map((q, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
                      <div className="flex items-center gap-4 flex-1">
                        <span className="w-8 h-8 bg-gold-100 text-gold-600 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                          {idx + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">{q.question}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="px-2 py-0.5 text-xs bg-gold-50 text-gold-700 rounded">{q.topic}</span>
                            <span className="text-xs text-gray-500">{q.count} times</span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleCreateFromInsight(q)}
                        className="px-3 py-1.5 text-sm text-gold-600 hover:bg-gold-50 rounded-lg flex items-center gap-1"
                        title="Create FAQ from this question"
                      >
                        <Plus className="w-4 h-4" />
                        Add FAQ
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'gaps' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl border border-purple-200 p-6">
              <div className="flex items-start gap-4">
                <Lightbulb className="w-8 h-8 text-purple-500 flex-shrink-0" />
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Knowledge Gaps Detected</h4>
                  <p className="text-gray-600 text-sm mb-4">
                    These topics are frequently asked about but don't have dedicated FAQs. 
                    Adding FAQs for these topics will improve AI responses.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Topics Needing Attention</h3>
              
              {unansweredQuestions.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-400" />
                  <p className="text-gray-500 font-medium">Great job! No knowledge gaps detected</p>
                  <p className="text-gray-400 text-sm mt-1">Your FAQs cover all common question topics</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {unansweredQuestions.map((q, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 bg-purple-50 rounded-lg border border-purple-100">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{q.question}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Tag className="w-3 h-3 text-purple-500" />
                          <span className="text-xs text-purple-600">{q.topic}</span>
                          <span className="text-xs text-gray-500">Asked {q.count} times</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleCreateFromInsight(q)}
                        className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 text-sm flex items-center gap-1"
                      >
                        <Plus className="w-4 h-4" />
                        Create FAQ
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'requests' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200 p-6">
              <div className="flex items-start gap-4">
                <Inbox className="w-8 h-8 text-amber-500 flex-shrink-0" />
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Purchaser Requests</h4>
                  <p className="text-gray-600 text-sm">
                    When the AI cannot answer a question, purchasers can submit a request for information.
                    Respond to these requests and consider adding FAQs for common topics.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Pending Requests ({pendingRequests.length})</h3>
              
              {infoRequests.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-400" />
                  <p className="text-gray-500 font-medium">No pending requests</p>
                  <p className="text-gray-400 text-sm mt-1">Purchaser requests for information will appear here</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {infoRequests.map((request) => (
                    <div key={request.id} className={`p-4 rounded-lg border ${
                      request.status === 'pending' 
                        ? 'bg-amber-50 border-amber-200' 
                        : 'bg-gray-50 border-gray-200'
                    }`}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                              request.status === 'pending' 
                                ? 'bg-amber-100 text-amber-700' 
                                : 'bg-green-100 text-green-700'
                            }`}>
                              {request.status === 'pending' ? 'Pending' : 'Resolved'}
                            </span>
                            {request.topic && (
                              <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                                {request.topic}
                              </span>
                            )}
                          </div>
                          <p className="font-medium text-gray-900 mb-1">{request.question}</p>
                          {request.context && (
                            <p className="text-gray-500 text-sm mb-2">{request.context}</p>
                          )}
                          <p className="text-xs text-gray-400">
                            Submitted {new Date(request.created_at).toLocaleDateString()}
                          </p>
                          {request.response && (
                            <div className="mt-3 p-3 bg-white rounded border border-gray-200">
                              <p className="text-sm text-gray-700">{request.response}</p>
                            </div>
                          )}
                        </div>
                        {request.status === 'pending' && (
                          <button
                            onClick={() => {
                              setSelectedRequest(request);
                              setResponseText('');
                            }}
                            className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 text-sm flex items-center gap-1"
                          >
                            <Send className="w-4 h-4" />
                            Respond
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {selectedRequest && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full">
              <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Respond to Request</h2>
                <button
                  onClick={() => { setSelectedRequest(null); setResponseText(''); }}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600 mb-1">Purchaser asked:</p>
                  <p className="font-medium text-gray-900">{selectedRequest.question}</p>
                  {selectedRequest.context && (
                    <p className="text-sm text-gray-500 mt-2">{selectedRequest.context}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Your Response *
                  </label>
                  <textarea
                    required
                    rows={5}
                    value={responseText}
                    onChange={(e) => setResponseText(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    placeholder="Provide a helpful response..."
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => { setSelectedRequest(null); setResponseText(''); }}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleRespondToRequest(selectedRequest.id, responseText)}
                    disabled={submittingResponse || !responseText.trim()}
                    className="flex-1 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50"
                  >
                    {submittingResponse ? 'Sending...' : 'Send Response'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">
                  {editingFaq ? 'Edit FAQ' : 'Add New FAQ'}
                </h2>
                <button
                  onClick={() => { setShowModal(false); setEditingFaq(null); resetForm(); }}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Question *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.question}
                    onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gold-500 focus:border-transparent"
                    placeholder="e.g., What time is garbage collection?"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Answer *
                  </label>
                  <textarea
                    required
                    rows={5}
                    value={formData.answer}
                    onChange={(e) => setFormData({ ...formData, answer: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gold-500 focus:border-transparent"
                    placeholder="Provide a detailed answer that the AI can use to respond to purchasers..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Topic
                    </label>
                    <select
                      value={formData.topic}
                      onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gold-500 focus:border-transparent"
                    >
                      {TOPIC_OPTIONS.map(topic => (
                        <option key={topic} value={topic}>
                          {topic.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Priority
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gold-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">Higher priority FAQs appear first</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="status"
                      checked={formData.status === 'published'}
                      onChange={() => setFormData({ ...formData, status: 'published' })}
                      className="text-gold-500 focus:ring-gold-500"
                    />
                    <span className="text-sm text-gray-700">Published</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="status"
                      checked={formData.status === 'draft'}
                      onChange={() => setFormData({ ...formData, status: 'draft' })}
                      className="text-gold-500 focus:ring-gold-500"
                    />
                    <span className="text-sm text-gray-700">Draft</span>
                  </label>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => { setShowModal(false); setEditingFaq(null); resetForm(); }}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 bg-gold-500 text-white rounded-lg hover:bg-gold-600"
                  >
                    {editingFaq ? 'Update FAQ' : 'Create FAQ'}
                  </button>
                </div>
              </form>
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
