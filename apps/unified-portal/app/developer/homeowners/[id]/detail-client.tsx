'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  User,
  Building2,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  Clock,
  Download,
  Copy,
  ExternalLink,
  FileText,
  Activity,
  Shield,
  Globe,
  Monitor,
  Trash2,
  Edit3,
  Save,
  X,
  Key,
  CalendarCheck,
  ChevronRight,
} from 'lucide-react';
import { isHomeownerIssuesEnabled } from '@/lib/feature-flags';
import { HomeownerIssuesCard } from '@/components/homeowners/HomeownerIssuesCard';

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
  const [docsOpen, setDocsOpen] = useState(false);

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
    } catch {
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
    } catch {
      // failed to fetch developments
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
    } catch {
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
    } catch {
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
    } catch {
      // failed to download QR code
    }
  }

  function getEngagementPill(level: string): { label: string; className: string } {
    switch (level) {
      case 'high':
        return { label: 'High', className: 'bg-emerald-100 text-emerald-700' };
      case 'medium':
        return { label: 'Medium', className: 'bg-gray-100 text-gray-700' };
      case 'low':
        return { label: 'Low', className: 'bg-gray-100 text-gray-700' };
      default:
        return { label: 'None', className: 'bg-gray-100 text-gray-500' };
    }
  }

  function formatRelativeTime(iso: string | null): string {
    if (!iso) return 'Never';
    const now = Date.now();
    const then = new Date(iso).getTime();
    const diff = Math.max(0, now - then);
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;
    const week = 7 * day;
    if (diff < minute) return 'Just now';
    if (diff < hour) return `${Math.floor(diff / minute)}m ago`;
    if (diff < day) return `${Math.floor(diff / hour)}h ago`;
    if (diff < week) return `${Math.floor(diff / day)}d ago`;
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
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
  const engagement = getEngagementPill(activity.engagement_level);
  const homeownerIssuesOn = isHomeownerIssuesEnabled();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      {/* Sprint 3.5a.2 tight header strip. The Back to Homeowners link
          sits above the strip as a small separate element. The strip
          itself (data-testid="homeowner-header") holds only the avatar,
          name + development, and status pill, measured to <= 80px. */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <Link
          href="/developer/homeowners"
          className="text-gold-600 hover:text-gold-700 inline-flex items-center gap-1 text-xs mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Homeowners
        </Link>
        <div
          data-testid="homeowner-header"
          className="flex items-center justify-between gap-4 mb-6"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              data-testid="homeowner-header-avatar"
              className="w-10 h-10 rounded-full bg-gradient-to-br from-gold-500 to-gold-600 text-white flex items-center justify-center font-semibold text-sm shadow-sm flex-shrink-0"
            >
              {(homeowner.name || 'U').trim().charAt(0).toUpperCase()}
            </div>
            <div className="flex flex-col min-w-0">
              <h1
                data-testid="homeowner-header-name"
                className="text-xl font-semibold leading-tight text-gray-900 truncate"
              >
                {homeowner.name}
              </h1>
              <p className="text-sm text-gray-500 leading-tight truncate">
                {homeowner.development?.name || 'Unknown Development'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {acknowledgement ? (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-green-50 text-green-700 text-xs font-medium rounded-full">
                <CheckCircle2 className="w-3 h-3" />
                Documents Acknowledged
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-amber-50 text-amber-700 text-xs font-medium rounded-full">
                <Clock className="w-3 h-3" />
                Pending Acknowledgement
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        {/* Sprint 3.5a.1: explicit 4/8 split out of 12 so the Reported
            Issues column on the right is the visual centre. Mobile stacks. */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left column - 33% on desktop */}
          <div className="lg:col-span-4 space-y-6">
            {/* Profile Details - Sprint 3.5a.2 compact treatment. Title
                drops the User icon and uses text-base. Edit is an inline
                link with no border. The dl uses divide-y with py-2 rows
                so the card hits the 200px height target. */}
            <div
              data-testid="profile-details-card"
              className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
            >
              <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                <h2
                  data-testid="profile-details-title"
                  className="text-base font-semibold text-gray-900"
                >
                  Profile Details
                </h2>
                {!isEditing ? (
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    data-testid="profile-details-edit"
                    className="text-sm text-gold-600 hover:text-gold-700 hover:underline"
                  >
                    Edit
                  </button>
                ) : (
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={saving}
                      className="text-sm text-green-600 hover:text-green-700 hover:underline disabled:opacity-50 inline-flex items-center gap-1"
                    >
                      <Save className="w-3.5 h-3.5" />
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditing(false);
                        setEditForm({
                          name: homeowner.name || '',
                          house_type: homeowner.house_type || '',
                          address: homeowner.address || '',
                          development_id: homeowner.development_id || '',
                        });
                      }}
                      className="text-sm text-gray-500 hover:text-gray-700 hover:underline inline-flex items-center gap-1"
                    >
                      <X className="w-3.5 h-3.5" />
                      Cancel
                    </button>
                  </div>
                )}
              </div>
              <div className="px-5 py-2">
                {isEditing ? (
                  <div className="space-y-3 py-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">House Type</label>
                      <input
                        type="text"
                        value={editForm.house_type}
                        onChange={(e) => setEditForm(prev => ({ ...prev, house_type: e.target.value }))}
                        placeholder="e.g., BS01, BD03"
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Address</label>
                      <input
                        type="text"
                        value={editForm.address}
                        onChange={(e) => setEditForm(prev => ({ ...prev, address: e.target.value }))}
                        placeholder="Unit address"
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Development</label>
                      <select
                        value={editForm.development_id}
                        onChange={(e) => setEditForm(prev => ({ ...prev, development_id: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
                      >
                        {developments.map(dev => (
                          <option key={dev.id} value={dev.id}>{dev.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : (
                  <dl className="divide-y divide-gray-100 text-sm">
                    <div className="flex justify-between gap-3 py-2">
                      <dt className="text-gray-500">House Type</dt>
                      <dd className="font-medium text-gray-900 text-right">{homeowner.house_type || 'Not specified'}</dd>
                    </div>
                    <div className="flex justify-between gap-3 py-2">
                      <dt className="text-gray-500">Address</dt>
                      <dd className="font-medium text-gray-900 text-right">{homeowner.address || 'Not specified'}</dd>
                    </div>
                    <div className="flex justify-between gap-3 py-2">
                      <dt className="text-gray-500">Added</dt>
                      <dd className="font-medium text-gray-900 text-right">
                        {new Date(homeowner.created_at).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </dd>
                    </div>
                  </dl>
                )}
              </div>
            </div>

            {/* Access Code & Portal - Sprint 3.5a.2 compact. The handover
                status moves into the header as a single-line pill so the
                body only carries the access code, URL, and the two
                size-sm action buttons. Card height target: <= 280px. */}
            <div
              data-testid="access-code-card"
              className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
            >
              <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between gap-2">
                <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                  <Key className="w-4 h-4 text-gold-500" />
                  Access Code & Portal
                </h2>
                {homeowner.is_handed_over ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 text-xs font-medium rounded-full border border-green-200 whitespace-nowrap">
                    <CheckCircle2 className="w-3 h-3" />
                    Handed Over
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-xs font-medium rounded-full border border-blue-200 whitespace-nowrap">
                    <Clock className="w-3 h-3" />
                    Pre-Handover
                  </span>
                )}
              </div>
              <div className="p-3 space-y-2">
                {homeowner.access_code && (
                  <div className="bg-gold-50 rounded-lg p-2 border border-gold-200">
                    <p className="text-xs text-gold-700 font-medium mb-1">Access Code</p>
                    <div className="flex items-center gap-2">
                      <code
                        data-testid="access-code-value"
                        className="text-sm font-semibold bg-white px-2.5 py-1.5 rounded border border-gold-300 flex-1 text-center tracking-wider text-gold-800"
                      >
                        {homeowner.access_code}
                      </code>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(homeowner.access_code || '')}
                        className="p-1.5 hover:bg-gold-100 rounded transition-colors"
                        title="Copy Access Code"
                      >
                        {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5 text-gold-600" />}
                      </button>
                    </div>
                  </div>
                )}

                <div className="bg-gray-50 rounded-lg p-2">
                  <p className="text-xs text-gray-500 mb-1">Portal URL</p>
                  <div className="flex items-center gap-2">
                    <code className="text-xs bg-white px-2 py-1 rounded border border-gray-200 flex-1 truncate">
                      {getQRPortalUrl()}
                    </code>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(getQRPortalUrl())}
                      className="p-1.5 hover:bg-gray-200 rounded transition-colors"
                      title="Copy URL"
                    >
                      {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5 text-gray-600" />}
                    </button>
                  </div>
                  {homeowner.handover_date && (
                    <p className="text-xs text-gray-500 mt-1.5 inline-flex items-center gap-1">
                      <CalendarCheck className="w-3 h-3" />
                      Handover: {new Date(homeowner.handover_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={downloadQRCode}
                    data-testid="access-code-download-qr"
                    className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 px-3 bg-gold-500 text-white rounded-lg hover:bg-gold-600 transition text-xs font-medium"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download QR
                  </button>
                  <a
                    href={getQRPortalUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid="access-code-open-portal"
                    className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 px-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition text-xs font-medium text-gray-700"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Open Portal
                  </a>
                </div>
              </div>
            </div>

            {/* Sprint 3.5a.1 Documents & Acceptance collapsible. Wraps the
                two acknowledgement cards that used to live in the right
                column. Closed by default; the header surfaces the overall
                acknowledgement status. */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <button
                type="button"
                onClick={() => setDocsOpen((v) => !v)}
                className="w-full flex items-center justify-between gap-2 px-5 py-4 hover:bg-gray-50 transition-colors"
                aria-expanded={docsOpen}
              >
                <div className="flex items-center gap-2">
                  <ChevronRight
                    className={`w-4 h-4 text-gray-400 transition-transform duration-200 ease-out ${
                      docsOpen ? 'rotate-90' : ''
                    }`}
                  />
                  <span className="text-base font-semibold text-gray-900">Documents & Acceptance</span>
                </div>
                {acknowledgement ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 text-xs font-medium rounded-full">
                    <CheckCircle2 className="w-3 h-3" />
                    Acknowledged
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 text-xs font-medium rounded-full">
                    <Clock className="w-3 h-3" />
                    Pending
                  </span>
                )}
              </button>
              {docsOpen && (
                <div className="border-t border-gray-100 divide-y divide-gray-100">
                  {/* Community Noticeboard Terms - nested, reduced chrome */}
                  <div className="p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <MessageSquare className="w-4 h-4 text-gold-500" />
                      <h3 className="text-sm font-semibold text-gray-900">Community Noticeboard Terms</h3>
                    </div>
                    {noticeboard_terms ? (
                      <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                        <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-green-800">Guidelines Accepted</p>
                          <p className="text-xs text-green-700">
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
                    ) : (
                      <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <Clock className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-gray-700">Not Yet Accepted</p>
                          <p className="text-xs text-gray-500">
                            They will be prompted to accept the community noticeboard guidelines before their first post.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Must-Read Document Acknowledgement - nested, reduced chrome */}
                  <div className="p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <Shield className="w-4 h-4 text-gold-500" />
                      <h3 className="text-sm font-semibold text-gray-900">Must-Read Document Acknowledgement</h3>
                    </div>
                    {acknowledgement ? (
                      <div className="space-y-3">
                        <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                          <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-green-800">Documents Acknowledged</p>
                            <p className="text-xs text-green-700">
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

                        <div className="space-y-2">
                          <div className="flex items-start gap-2 text-xs">
                            <User className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
                            <div className="min-w-0">
                              <span className="text-gray-500">Acknowledged by </span>
                              <span className="text-gray-900 font-medium">{acknowledgement.purchaser_name || 'Unknown'}</span>
                            </div>
                          </div>
                          <div className="flex items-start gap-2 text-xs">
                            <Globe className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
                            <div className="min-w-0">
                              <span className="text-gray-500">IP </span>
                              <span className="text-gray-900 font-mono">{acknowledgement.ip_address || 'Not recorded'}</span>
                            </div>
                          </div>
                          {acknowledgement.user_agent && (
                            <div className="flex items-start gap-2 text-xs">
                              <Monitor className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
                              <div className="min-w-0 flex-1">
                                <p className="text-gray-500">Device</p>
                                <p className="text-gray-700 truncate">{acknowledgement.user_agent}</p>
                              </div>
                            </div>
                          )}
                        </div>

                        {acknowledgement.documents_acknowledged.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-gray-700 mb-2">Documents ({acknowledgement.documents_acknowledged.length})</p>
                            <ul className="space-y-1">
                              {acknowledgement.documents_acknowledged.map((doc, index) => (
                                <li key={doc.id || index} className="flex items-center gap-2 px-2.5 py-1.5 bg-gray-50 rounded text-xs">
                                  <FileText className="w-3.5 h-3.5 text-gold-500 flex-shrink-0" />
                                  <span className="text-gray-700 truncate">{doc.title}</span>
                                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0 ml-auto" />
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                        <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">No Acknowledgement Recorded</p>
                          <p className="text-xs text-gray-600">
                            This homeowner has not yet acknowledged the must-read documents. They will be prompted on first access.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Danger Zone */}
            <div className="bg-white rounded-xl border border-red-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-red-100 bg-red-50">
                <h2 className="text-sm font-semibold text-red-700 flex items-center gap-2">
                  <Trash2 className="w-4 h-4" />
                  Danger Zone
                </h2>
              </div>
              <div className="p-5">
                {!showDeleteConfirm ? (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="w-full px-3 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors text-sm font-medium"
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
                        className="flex-1 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium disabled:opacity-50"
                      >
                        {deleting ? 'Deleting...' : 'Confirm Delete'}
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(false)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right column - 67% on desktop, anchored by the Reported Issues card. */}
          <div className="lg:col-span-8 space-y-6">
            {homeownerIssuesOn && (
              <HomeownerIssuesCard homeownerId={homeownerId} homeownerName={homeowner.name} />
            )}

            {/* Homeowner Activity - Sprint 3.5a.1 icon-led stat blocks. */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100">
                <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-gold-500" />
                  Homeowner Activity
                </h2>
              </div>
              <div className="p-5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gold-50 flex items-center justify-center flex-shrink-0">
                      <MessageSquare className="w-4 h-4 text-gold-700" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-2xl font-semibold text-gray-900 leading-tight">{activity.total_messages}</p>
                      <p className="text-[13px] text-gray-600">Total messages</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gold-50 flex items-center justify-center flex-shrink-0">
                      <Activity className="w-4 h-4 text-gold-700" />
                    </div>
                    <div className="min-w-0">
                      <div className="leading-tight">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${engagement.className}`}>
                          {engagement.label}
                        </span>
                      </div>
                      <p className="text-[13px] text-gray-600 mt-1">Engagement level</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gold-50 flex items-center justify-center flex-shrink-0">
                      <Clock className="w-4 h-4 text-gold-700" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-base font-semibold text-gray-900 leading-tight truncate">{formatRelativeTime(activity.last_message)}</p>
                      <p className="text-[13px] text-gray-600">Last active</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
