'use client';

import { useState, useEffect } from 'react';
import { useCurrentContext } from '@/contexts/CurrentContext';
import { AlertTriangle, CheckCircle, Clock, RefreshCw, Filter, XCircle } from 'lucide-react';

interface ErrorLog {
  id: string;
  error_type: string;
  error_code: string | null;
  error_message: string;
  endpoint: string | null;
  severity: string;
  resolved: boolean;
  created_at: string;
}

interface ErrorStats {
  error_type: string;
  severity: string;
  count: number;
  unresolved_count: number;
  last_occurrence: string;
}

export default function ErrorDashboardPage() {
  const { tenantId, developmentId } = useCurrentContext();
  const [errors, setErrors] = useState<ErrorLog[]>([]);
  const [stats, setStats] = useState<ErrorStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({
    unresolvedOnly: false,
    errorType: '',
  });

  const fetchErrors = async () => {
    if (!tenantId) return;
    
    setLoading(true);
    try {
      const params = new URLSearchParams({
        tenantId,
        ...(developmentId && { developmentId }),
        unresolvedOnly: filter.unresolvedOnly.toString(),
        ...(filter.errorType && { errorType: filter.errorType }),
      });
      
      const res = await fetch(`/developer/api/errors?${params}`);
      if (res.ok) {
        const data = await res.json();
        setErrors(data.errors || []);
        setStats(data.stats || []);
      }
    } catch (error) {
      console.error('Failed to fetch errors:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchErrors();
  }, [tenantId, developmentId, filter]);

  const resolveError = async (errorId: string) => {
    try {
      const res = await fetch('/developer/api/errors', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ errorId, tenantId, resolved: true }),
      });
      if (res.ok) {
        fetchErrors();
      }
    } catch (error) {
      console.error('Failed to resolve error:', error);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'error': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'warning': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'llm': return '🤖';
      case 'supabase': return '🗄️';
      case 'timeout': return '⏱️';
      case 'validation': return '✓';
      default: return '❌';
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const totalUnresolved = errors.filter(e => !e.resolved).length;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Error Dashboard</h1>
          <p className="text-gray-600 mt-1">Monitor system errors before residents report them</p>
        </div>
        <button
          onClick={fetchErrors}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-white border rounded-lg hover:bg-gray-50 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{totalUnresolved}</p>
              <p className="text-sm text-gray-600">Unresolved</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <XCircle className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{errors.length}</p>
              <p className="text-sm text-gray-600">Total (7 days)</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Clock className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {errors[0] ? formatTime(errors[0].created_at) : '-'}
              </p>
              <p className="text-sm text-gray-600">Latest Error</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {errors.filter(e => e.resolved).length}
              </p>
              <p className="text-sm text-gray-600">Resolved</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border p-4 mb-6">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Filters:</span>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filter.unresolvedOnly}
              onChange={(e) => setFilter(f => ({ ...f, unresolvedOnly: e.target.checked }))}
              className="rounded border-gray-300"
            />
            <span className="text-sm text-gray-700">Unresolved only</span>
          </label>
          <select
            value={filter.errorType}
            onChange={(e) => setFilter(f => ({ ...f, errorType: e.target.value }))}
            className="text-sm border rounded-lg px-3 py-1.5"
          >
            <option value="">All types</option>
            <option value="llm">LLM Errors</option>
            <option value="supabase">Database Errors</option>
            <option value="timeout">Timeouts</option>
            <option value="validation">Validation</option>
          </select>
        </div>
      </div>

      {/* Error List */}
      <div className="bg-white rounded-lg border">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading errors...</div>
        ) : errors.length === 0 ? (
          <div className="p-8 text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <p className="text-lg font-medium text-gray-900">No errors found</p>
            <p className="text-gray-500">The system is running smoothly</p>
          </div>
        ) : (
          <div className="divide-y">
            {errors.map((error) => (
              <div key={error.id} className={`p-4 ${error.resolved ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{getTypeIcon(error.error_type)}</span>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${getSeverityColor(error.severity)}`}>
                          {error.severity}
                        </span>
                        <span className="text-xs text-gray-500 font-mono">
                          {error.error_type}
                          {error.error_code && ` / ${error.error_code}`}
                        </span>
                        {error.endpoint && (
                          <span className="text-xs text-gray-400 font-mono">{error.endpoint}</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-900 font-medium">{error.error_message}</p>
                      <p className="text-xs text-gray-500 mt-1">{formatTime(error.created_at)}</p>
                    </div>
                  </div>
                  {!error.resolved && (
                    <button
                      onClick={() => resolveError(error.id)}
                      className="px-3 py-1 text-xs font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
                    >
                      Mark Resolved
                    </button>
                  )}
                  {error.resolved && (
                    <span className="px-3 py-1 text-xs font-medium text-gray-500 bg-gray-100 rounded-lg">
                      Resolved
                    </span>
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
