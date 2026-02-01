'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  User,
  Home,
  Building2,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  Clock,
  QrCode,
  Download,
  Copy,
  ExternalLink,
  FileText,
  Activity,
  Calendar,
  Shield,
  Globe,
  Monitor,
  Trash2,
  Edit3,
  Save,
  X,
  TrendingUp,
  TrendingDown,
  Minus,
  Key,
  CalendarCheck
} from 'lucide-react';

interface HomeownerDetails {
  homeowner: {
    id: string;
    name: string;
    house_type: string | null;
    address: string | null;
    unique_qr_token: string;
    access_code: string | null;
    handover_date: string | null;
    is_handed_over: boolean;
    portal_type: 'pre_handover' | 'property_assistant';
    development_id: string;
    created_at: string;
    development: {
      id: string;
      name: string;
      address: string;
    };
  };
  activity: {
    total_messages: number;
    user_messages: number;
    assistant_messages: number;
    first_message: string | null;
    last_message: string | null;
    is_active_this_week: boolean;
    engagement_level: 'high' | 'medium' | 'low' | 'none';
    recent_messages: {
      id: string;
      content: string;
      role: string;
      created_at: string;
    }[];
  };
  acknowledgement: {
    agreed_at: string;
    purchaser_name: string;
    ip_address: string | null;
    user_agent: string | null;
    docs_version: number;
    documents_acknowledged: { id: string; title: string }[];
  } | null;
  noticeboard_terms: {
    accepted_at: string;
  } | null;
}

interface EditFormData {
  name: string;
  house_type: string;
  address: string;
  development_id: string;
}

interface Development {
  id: string;
  name: string;
  address: string;
}

export function HomeownerDetailClient({ homeownerId }: { homeownerId: string }) {
  const router = useRouter();
  const [data, setData] = useState<HomeownerDetails | null>(null);
  const [developments, setDevelopments] = useState<Development[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<EditFormData>({
    name: '',
    house_type: '',
    address: '',
    development_id: '',
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    fetchHomeownerDetails();
    fetchDevelopments();
  }, [homeownerId]);

  async function fetchHomeownerDetails() {
    try {
      const response = await fetch(`/api/homeowners/${homeownerId}/details`);
      if (response.ok) {
        const result = await response.json();
        setData(result);
        setEditForm({
          name: result.homeowner.name || '',
          house_type: result.homeowner.house_type || '',
          address: result.homeowner.address || '',
          development_id: result.homeowner.development_id || '',
        });
      } else {
        setError('Failed to load homeowner details');
      }
    } catch (err) {
      console.error('Failed to fetch homeowner details:', err);
      setError('An error occurred while loading homeowner details');
    } finally {
      setLoading(false);
    }
  }

  async function fetchDevelopments() {
    try {
      const response = await fetch('/api/developments');
      if (response.ok) {
        const result = await response.json();
        setDevelopments(result.developments || []);
      }
    } catch (err) {
      console.error('Failed to fetch developments:', err);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const response = await fetch(`/api/homeowners/${homeownerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });

      if (response.ok) {
        await fetchHomeownerDetails();
        setIsEditing(false);
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Failed to save changes');
      }
    } catch (err) {
      console.error('Failed to save:', err);
      alert('An error occurred while saving');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const response = await fetch(`/api/homeowners/${homeownerId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        router.push('/developer/homeowners');
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Failed to delete homeowner');
      }
    } catch (err) {
      console.error('Failed to delete:', err);
      alert('An error occurred while deleting');
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function getQRPortalUrl() {
    if (typeof window !== 'undefined' && data?.homeowner.unique_qr_token) {
      return `${window.location.origin}/homes/${data.homeowner.unique_qr_token}`;
    }
    return '';
  }

  async function downloadQRCode() {
    try {
      const response = await fetch(`/api/qr/generate?unitId=${homeownerId}&format=png`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `qr-${data?.homeowner.name.replace(/\s+/g, '-').toLowerCase()}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('Failed to download QR code:', err);
    }
  }

  function getEngagementIcon(level: string) {
    switch (level) {
      case 'high': return <TrendingUp className="w-4 h-4 text-green-600" />;
      case 'medium': return <Minus className="w-4 h-4 text-amber-600" />;
      case 'low': return <TrendingDown className="w-4 h-4 text-red-600" />;
      default: return <Minus className="w-4 h-4 text-gray-400" />;
    }
  }

  function getEngagementLabel(level: string) {
    switch (level) {
      case 'high': return { text: 'High Engagement', color: 'text-green-600 bg-green-50' };
      case 'medium': return { text: 'Medium Engagement', color: 'text-amber-600 bg-amber-50' };
      case 'low': return { text: 'Low Engagement', color: 'text-red-600 bg-red-50' };
      default: return { text: 'No Activity', color: 'text-gray-500 bg-gray-50' };
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading homeowner details...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600">{error || 'Homeowner not found'}</p>
          <Link href="/developer/homeowners" className="text-gold-600 hover:text-gold-700 mt-4 inline-block">
            ← Back to Homeowners
          </Link>
        </div>
      </div>
    );
  }

  const { homeowner, activity, acknowledgement, noticeboard_terms } = data;
  const engagement = getEngagementLabel(activity.engagement_level);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Link href="/developer/homeowners" className="text-gold-500 hover:text-gold-600 flex items-center gap-1 mb-3 text-sm">
            <ArrowLeft className="w-4 h-4" />
            Back to Homeowners
          </Link>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-gold-100 to-gold-50 rounded-xl">
                <User className="w-8 h-8 text-gold-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{homeowner.name}</h1>
                <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                  <Building2 className="w-4 h-4" />
                  {homeowner.development?.name || 'Unknown Development'}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {acknowledgement ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 text-sm font-medium rounded-full">
                  <CheckCircle2 className="w-4 h-4" />
                  Documents Acknowledged
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 text-sm font-medium rounded-full">
                  <Clock className="w-4 h-4" />
                  Pending Acknowledgement
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Profile & QR */}
          <div className="lg:col-span-1 space-y-6">
            {/* Profile Card */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-gray-100 flex items-center justify-between">
                <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                  <User className="w-5 h-5 text-gold-500" />
                  Profile Details
                </h2>
                {!isEditing ? (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="text-sm text-gold-600 hover:text-gold-700 flex items-center gap-1"
                  >
                    <Edit3 className="w-4 h-4" />
                    Edit
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="text-sm text-green-600 hover:text-green-700 flex items-center gap-1 disabled:opacity-50"
                    >
                      <Save className="w-4 h-4" />
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={() => {
                        setIsEditing(false);
                        setEditForm({
                          name: homeowner.name || '',
                          house_type: homeowner.house_type || '',
                          address: homeowner.address || '',
                          development_id: homeowner.development_id || '',
                        });
                      }}
                      className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
                    >
                      <X className="w-4 h-4" />
                      Cancel
                    </button>
                  </div>
                )}
              </div>
              <div className="p-5 space-y-4">
                {isEditing ? (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">House Type</label>
                      <input
                        type="text"
                        value={editForm.house_type}
                        onChange={(e) => setEditForm(prev => ({ ...prev, house_type: e.target.value }))}
                        placeholder="e.g., BS01, BD03"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                      <input
                        type="text"
                        value={editForm.address}
                        onChange={(e) => setEditForm(prev => ({ ...prev, address: e.target.value }))}
                        placeholder="Unit address"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Development</label>
                      <select
                        value={editForm.development_id}
                        onChange={(e) => setEditForm(prev => ({ ...prev, development_id: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
                      >
                        {developments.map(dev => (
                          <option key={dev.id} value={dev.id}>{dev.name}</option>
                        ))}
                      </select>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-start gap-3">
                      <Home className="w-5 h-5 text-gray-400 mt-0.5" />
                      <div>
                        <p className="text-sm text-gray-500">House Type</p>
                        <p className="font-medium text-gray-900">{homeowner.house_type || 'Not specified'}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Building2 className="w-5 h-5 text-gray-400 mt-0.5" />
                      <div>
                        <p className="text-sm text-gray-500">Address</p>
                        <p className="font-medium text-gray-900">{homeowner.address || 'Not specified'}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
                      <div>
                        <p className="text-sm text-gray-500">Added</p>
                        <p className="font-medium text-gray-900">
                          {new Date(homeowner.created_at).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric'
                          })}
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Access Code & Portal Card */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Key className="w-5 h-5 text-gold-500" />
                  Access Code & Portal
                </h2>
              </div>
              <div className="p-5 space-y-4">
                {/* Access Code */}
                {homeowner.access_code && (
                  <div className="bg-gradient-to-r from-gold-50 to-amber-50 rounded-lg p-4 border border-gold-200">
                    <p className="text-xs text-gold-700 font-medium mb-2">Access Code</p>
                    <div className="flex items-center gap-2">
                      <code className="text-lg font-bold bg-white px-3 py-1.5 rounded border border-gold-300 flex-1 text-center tracking-wider text-gold-800">
                        {homeowner.access_code}
                      </code>
                      <button
                        onClick={() => copyToClipboard(homeowner.access_code || '')}
                        className="p-2 hover:bg-gold-100 rounded-lg transition-colors"
                        title="Copy Access Code"
                      >
                        {copied ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-gold-600" />}
                      </button>
                    </div>
                  </div>
                )}

                {/* Portal Type Status */}
                <div className={`rounded-lg p-4 ${homeowner.is_handed_over ? 'bg-green-50 border border-green-200' : 'bg-blue-50 border border-blue-200'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    {homeowner.is_handed_over ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                        <span className="text-sm font-medium text-green-700">Property Handed Over</span>
                      </>
                    ) : (
                      <>
                        <Clock className="w-4 h-4 text-blue-600" />
                        <span className="text-sm font-medium text-blue-700">Pre-Handover</span>
                      </>
                    )}
                  </div>
                  <p className="text-xs text-gray-600">
                    {homeowner.is_handed_over 
                      ? 'Access code grants Property Assistant portal access'
                      : 'Access code grants Pre-Handover Portal access'
                    }
                  </p>
                  {homeowner.handover_date && (
                    <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-500">
                      <CalendarCheck className="w-3.5 h-3.5" />
                      Handover: {new Date(homeowner.handover_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                  )}
                </div>

                {/* Portal URL */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs text-gray-500 mb-2">Portal URL</p>
                  <div className="flex items-center gap-2">
                    <code className="text-xs bg-white px-2 py-1 rounded border border-gray-200 flex-1 truncate">
                      {getQRPortalUrl()}
                    </code>
                    <button
                      onClick={() => copyToClipboard(getQRPortalUrl())}
                      className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                      title="Copy URL"
                    >
                      {copied ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-gray-600" />}
                    </button>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={downloadQRCode}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-gold-500 to-gold-600 text-white rounded-lg hover:from-gold-600 hover:to-gold-700 transition-all text-sm font-medium"
                  >
                    <Download className="w-4 h-4" />
                    Download QR
                  </button>
                  <a
                    href={getQRPortalUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Open Portal
                  </a>
                </div>
              </div>
            </div>

            {/* Danger Zone */}
            <div className="bg-white rounded-xl border border-red-200 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-red-100 bg-red-50">
                <h2 className="font-semibold text-red-700 flex items-center gap-2">
                  <Trash2 className="w-5 h-5" />
                  Danger Zone
                </h2>
              </div>
              <div className="p-5">
                {!showDeleteConfirm ? (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="w-full px-4 py-2.5 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors text-sm font-medium"
                  >
                    Delete Homeowner
                  </button>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-red-600">
                      Are you sure? This action cannot be undone.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={handleDelete}
                        disabled={deleting}
                        className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium disabled:opacity-50"
                      >
                        {deleting ? 'Deleting...' : 'Confirm Delete'}
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(false)}
                        className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Activity & Acknowledgement */}
          <div className="lg:col-span-2 space-y-6">
            {/* Activity Stats */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-gold-500" />
                  Chat Activity & Engagement
                </h2>
              </div>
              <div className="p-5">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-gray-50 rounded-lg p-4 text-center">
                    <p className="text-3xl font-bold text-gray-900">{activity.total_messages}</p>
                    <p className="text-xs text-gray-500 mt-1">Total Messages</p>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-4 text-center">
                    <p className="text-3xl font-bold text-blue-600">{activity.user_messages}</p>
                    <p className="text-xs text-gray-500 mt-1">User Questions</p>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-4 text-center">
                    <p className="text-3xl font-bold text-purple-600">{activity.assistant_messages}</p>
                    <p className="text-xs text-gray-500 mt-1">AI Responses</p>
                  </div>
                  <div className={`rounded-lg p-4 text-center ${engagement.color}`}>
                    <div className="flex items-center justify-center gap-2">
                      {getEngagementIcon(activity.engagement_level)}
                      <p className="text-lg font-bold">{engagement.text.split(' ')[0]}</p>
                    </div>
                    <p className="text-xs mt-1">Engagement Level</p>
                  </div>
                </div>

                {activity.first_message && (
                  <div className="flex items-center gap-6 text-sm text-gray-600 border-t border-gray-100 pt-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <span>First message: {new Date(activity.first_message).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    </div>
                    {activity.last_message && (
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-gray-400" />
                        <span>Last active: {new Date(activity.last_message).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      </div>
                    )}
                    {activity.is_active_this_week && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                        Active This Week
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Recent Messages */}
            {activity.recent_messages.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-gray-100">
                  <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-gold-500" />
                    Recent Conversations
                  </h2>
                </div>
                <div className="divide-y divide-gray-100">
                  {activity.recent_messages.map((message) => (
                    <div key={message.id} className="p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${message.role === 'user' ? 'bg-blue-100' : 'bg-purple-100'}`}>
                          {message.role === 'user' ? (
                            <User className="w-4 h-4 text-blue-600" />
                          ) : (
                            <MessageSquare className="w-4 h-4 text-purple-600" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-gray-900">
                              {message.role === 'user' ? 'Homeowner' : 'AI Assistant'}
                            </span>
                            <span className="text-xs text-gray-400">
                              {new Date(message.created_at).toLocaleDateString('en-GB', { 
                                day: 'numeric', 
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600">{message.content}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Community Noticeboard Terms */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-gold-500" />
                  Community Noticeboard Terms
                </h2>
              </div>
              {noticeboard_terms ? (
                <div className="p-5">
                  <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg border border-green-200">
                    <CheckCircle2 className="w-6 h-6 text-green-600" />
                    <div>
                      <p className="font-medium text-green-800">Guidelines Accepted</p>
                      <p className="text-sm text-green-600">
                        Agreed on {new Date(noticeboard_terms.accepted_at).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-5">
                  <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <Clock className="w-6 h-6 text-gray-400" />
                    <div>
                      <p className="font-medium text-gray-700">Not Yet Accepted</p>
                      <p className="text-sm text-gray-500">
                        This homeowner has not yet accepted the community noticeboard guidelines.
                        They will be prompted to do so before their first post.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Acknowledgement Details */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-gold-500" />
                  Must-Read Document Acknowledgement
                </h2>
              </div>
              {acknowledgement ? (
                <div className="p-5 space-y-6">
                  <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg border border-green-200">
                    <CheckCircle2 className="w-6 h-6 text-green-600" />
                    <div>
                      <p className="font-medium text-green-800">Documents Acknowledged</p>
                      <p className="text-sm text-green-600">
                        Agreed on {new Date(acknowledgement.agreed_at).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>

                  {/* Audit Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <User className="w-4 h-4 text-gray-400" />
                        <span className="text-sm font-medium text-gray-700">Acknowledged By</span>
                      </div>
                      <p className="text-gray-900">{acknowledgement.purchaser_name || 'Unknown'}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Globe className="w-4 h-4 text-gray-400" />
                        <span className="text-sm font-medium text-gray-700">IP Address</span>
                      </div>
                      <p className="text-gray-900 font-mono text-sm">{acknowledgement.ip_address || 'Not recorded'}</p>
                    </div>
                    {acknowledgement.user_agent && (
                      <div className="bg-gray-50 rounded-lg p-4 md:col-span-2">
                        <div className="flex items-center gap-2 mb-2">
                          <Monitor className="w-4 h-4 text-gray-400" />
                          <span className="text-sm font-medium text-gray-700">Device</span>
                        </div>
                        <p className="text-gray-600 text-sm truncate">{acknowledgement.user_agent}</p>
                      </div>
                    )}
                  </div>

                  {/* Documents List */}
                  {acknowledgement.documents_acknowledged.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 mb-3">Documents Acknowledged ({acknowledgement.documents_acknowledged.length})</h3>
                      <div className="space-y-2">
                        {acknowledgement.documents_acknowledged.map((doc, index) => (
                          <div key={doc.id || index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                            <FileText className="w-4 h-4 text-gold-500" />
                            <span className="text-sm text-gray-700">{doc.title}</span>
                            <CheckCircle2 className="w-4 h-4 text-green-500 ml-auto" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-8 text-center">
                  <AlertCircle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
                  <h3 className="font-medium text-gray-900 mb-2">No Acknowledgement Recorded</h3>
                  <p className="text-sm text-gray-500 max-w-md mx-auto">
                    This homeowner has not yet acknowledged the must-read documents. They will be prompted to do so when they access their portal.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
