'use client';

import { useEffect, useState } from 'react';
import { Shield, Search, Calendar, Filter, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

interface AuditLogEntry {
  id: string;
  accessorEmail: string;
  accessorRole: string;
  action: string;
  rawAction: string;
  resourceType: string;
  resourceDescription: string;
  ipAddress: string;
  createdAt: string;
}

interface AuditLogData {
  logs: AuditLogEntry[];
  total: number;
  limit: number;
  offset: number;
}

export function AuditLogClient() {
  const [data, setData] = useState<AuditLogData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(0);
  const limit = 25;

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      days: String(days),
      limit: String(limit),
      offset: String(page * limit),
    });
    if (debouncedSearch) {
      params.set('search', debouncedSearch);
    }
    fetch(`/api/super/audit-log?${params.toString()}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch audit logs');
        return res.json();
      })
      .then(setData)
      .catch((err) => {
        console.error('Audit log error:', err);
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [days, page, debouncedSearch]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const logs = data?.logs || [];
  const totalPages = Math.ceil((data?.total || 0) / limit);

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#D4AF37]/10 to-[#D4AF37]/20 flex items-center justify-center">
            <Shield className="w-6 h-6 text-[#D4AF37]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Data Access Audit Log</h1>
            <p className="text-sm text-gray-500">GDPR compliance - Track who accesses personal data</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-6">
          <div className="p-4 border-b border-gray-100 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by user, action, or resource..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 text-sm border-0 focus:ring-0 focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <select
                value={days}
                onChange={(e) => {
                  setDays(parseInt(e.target.value));
                  setPage(0);
                }}
                className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-[#D4AF37]/20 focus:border-[#D4AF37]"
              >
                <option value={7}>Last 7 days</option>
                <option value={30}>Last 30 days</option>
                <option value={90}>Last 90 days</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 text-[#D4AF37] animate-spin" />
            </div>
          ) : error ? (
            <div className="p-8 text-center">
              <p className="text-red-600">{error}</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="p-8 text-center">
              <Shield className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No audit log entries found</p>
              <p className="text-sm text-gray-400 mt-1">Data access events will appear here</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">User</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Action</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Resource</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">IP Address</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                        {formatDate(log.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900">{log.accessorEmail}</div>
                        <div className="text-xs text-gray-500 capitalize">{log.accessorRole}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#D4AF37]/10 text-[#8B6428]">
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                        {log.resourceDescription}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 font-mono">
                        {log.ipAddress}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!loading && !error && data && data.total > limit && (
            <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Showing {page * limit + 1} to {Math.min((page + 1) * limit, data.total)} of {data.total} entries
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-gray-600 px-2">
                  Page {page + 1} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
          <p className="text-sm text-blue-800">
            <strong>GDPR Compliance:</strong> This log records when developers and admins access purchaser personal data 
            (chat messages, analytics). It provides accountability and can be presented during audits.
          </p>
        </div>
      </div>
    </div>
  );
}
