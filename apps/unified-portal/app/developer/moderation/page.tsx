'use client';

import { useState, useEffect } from 'react';
import { useCurrentContext } from '@/contexts/CurrentContext';
import { AlertTriangle, CheckCircle, XCircle, Eye, EyeOff, MessageSquare, FileText, RefreshCw, Filter } from 'lucide-react';

interface Report {
  id: string;
  notice_id: string | null;
  comment_id: string | null;
  reason: string;
  status: string;
  created_at: string;
  reviewed_at: string | null;
  resolution_notes: string | null;
  content_preview: string;
  author_unit: string;
  content_type: string;
}

interface Stats {
  pending?: number;
  resolved?: number;
  dismissed?: number;
}

export default function ModerationPage() {
  const { tenantId } = useCurrentContext();
  const [reports, setReports] = useState<Report[]>([]);
  const [stats, setStats] = useState<Stats>({});
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchReports = async () => {
    if (!tenantId) return;
    
    setLoading(true);
    try {
      const res = await fetch(`/developer/api/moderation?status=${statusFilter}`);
      if (res.ok) {
        const data = await res.json();
        setReports(data.reports || []);
        setStats(data.stats || {});
      }
    } catch (error) {
      console.error('Failed to fetch reports:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [tenantId, statusFilter]);

  const handleAction = async (reportId: string, action: 'hide' | 'dismiss', notes?: string) => {
    setActionLoading(reportId);
    try {
      const res = await fetch('/developer/api/moderation', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportId,
          action,
          resolutionNotes: notes,
        }),
      });
      if (res.ok) {
        fetchReports();
      }
    } catch (error) {
      console.error('Failed to process report:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">Pending</span>;
      case 'resolved':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">Resolved</span>;
      case 'dismissed':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">Dismissed</span>;
      default:
        return null;
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Community Moderation</h1>
          <p className="text-gray-600 mt-1">Review and manage reported noticeboard content</p>
        </div>
        <button
          onClick={fetchReports}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-white border rounded-lg hover:bg-gray-50 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.pending || 0}</p>
              <p className="text-sm text-gray-600">Pending Review</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.resolved || 0}</p>
              <p className="text-sm text-gray-600">Resolved</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              <XCircle className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.dismissed || 0}</p>
              <p className="text-sm text-gray-600">Dismissed</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border p-4 mb-6">
        <div className="flex items-center gap-4">
          <Filter className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Filter:</span>
          <div className="flex gap-2">
            {['pending', 'resolved', 'dismissed', 'all'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  statusFilter === status
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading reports...</div>
        ) : reports.length === 0 ? (
          <div className="p-8 text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <p className="text-lg font-medium text-gray-900">No reports to review</p>
            <p className="text-gray-500">The community is behaving well</p>
          </div>
        ) : (
          <div className="divide-y">
            {reports.map((report) => (
              <div key={report.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {report.content_type.includes('notice') ? (
                        <FileText className="w-4 h-4 text-blue-500" />
                      ) : (
                        <MessageSquare className="w-4 h-4 text-purple-500" />
                      )}
                      <span className="text-sm font-medium text-gray-700">
                        {report.content_type}
                      </span>
                      {getStatusBadge(report.status)}
                      <span className="text-xs text-gray-500">
                        from {report.author_unit}
                      </span>
                    </div>
                    
                    <div className="bg-gray-50 rounded-lg p-3 mb-3">
                      <p className="text-sm text-gray-700">{report.content_preview}</p>
                    </div>
                    
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Report reason:</p>
                        <p className="text-sm text-gray-600">{report.reason}</p>
                      </div>
                    </div>
                    
                    <p className="text-xs text-gray-500 mt-2">
                      Reported {formatTime(report.created_at)}
                      {report.reviewed_at && ` • Reviewed ${formatTime(report.reviewed_at)}`}
                    </p>
                    
                    {report.resolution_notes && (
                      <p className="text-xs text-gray-500 mt-1">
                        Resolution: {report.resolution_notes}
                      </p>
                    )}
                  </div>
                  
                  {report.status === 'pending' && (
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => handleAction(report.id, 'hide')}
                        disabled={actionLoading === report.id}
                        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                      >
                        <EyeOff className="w-4 h-4" />
                        Hide Content
                      </button>
                      <button
                        onClick={() => handleAction(report.id, 'dismiss')}
                        disabled={actionLoading === report.id}
                        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
                      >
                        <Eye className="w-4 h-4" />
                        Dismiss
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
