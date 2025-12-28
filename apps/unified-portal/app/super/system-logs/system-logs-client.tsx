'use client';

import { useEffect, useState } from 'react';
import { Activity, AlertCircle, Info, AlertTriangle, RefreshCw } from 'lucide-react';

interface AuditLog {
  id: string;
  type: string;
  action: string;
  actor: string | null;
  metadata: any;
  created_at: string;
}

export function SystemLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [hours, setHours] = useState(24);

  const fetchLogs = () => {
    setLoading(true);
    setError(null);
    
    const params = new URLSearchParams();
    params.append('hours', hours.toString());
    if (filter !== 'all') {
      params.append('type', filter);
    }

    fetch(`/api/admin/system-logs?${params}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
          setLogs([]);
        } else {
          setLogs(data.logs || []);
        }
      })
      .catch((err) => {
        console.error('[SystemLogs] Error:', err);
        setError(err.message || 'Failed to fetch logs');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchLogs();
  }, [filter, hours]);

  const getIconForType = (type: string) => {
    if (type.includes('error') || type.includes('ERROR')) {
      return <AlertCircle className="w-4 h-4 text-red-500" />;
    }
    if (type.includes('warn') || type.includes('WARN')) {
      return <AlertTriangle className="w-4 h-4 text-amber-500" />;
    }
    return <Info className="w-4 h-4 text-blue-500" />;
  };

  const getTypeColor = (type: string) => {
    if (type.includes('error') || type.includes('ERROR')) {
      return 'bg-red-50 text-red-700 border-red-200';
    }
    if (type.includes('warn') || type.includes('WARN')) {
      return 'bg-amber-50 text-amber-700 border-amber-200';
    }
    return 'bg-blue-50 text-blue-700 border-blue-200';
  };

  if (loading && logs.length === 0) {
    return (
      <div className="p-8 bg-gray-50 min-h-screen">
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
          <span className="ml-2 text-gray-500">Loading system logs...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Activity className="w-8 h-8 text-gray-700" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">System Logs</h1>
            <p className="text-gray-500 mt-1">{logs.length} log entries</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <select
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
            className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg focus:ring-2 focus:ring-gold-500 focus:border-gold-500"
          >
            <option value={1}>Last Hour</option>
            <option value={6}>Last 6 Hours</option>
            <option value={24}>Last 24 Hours</option>
            <option value={168}>Last Week</option>
          </select>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg focus:ring-2 focus:ring-gold-500 focus:border-gold-500"
          >
            <option value="all">All Types</option>
            <option value="error">Errors</option>
            <option value="warning">Warnings</option>
            <option value="info">Info</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            <span className="font-medium">Error loading logs</span>
          </div>
          <p className="text-sm mt-1">{error}</p>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actor</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Details</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.map((log) => (
                <tr
                  key={log.id}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      {getIconForType(log.type)}
                      <span className={`px-2 py-0.5 text-xs font-medium rounded border ${getTypeColor(log.type)}`}>
                        {log.type}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-sm font-medium text-gray-900">{log.action}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-sm text-gray-600">{log.actor || 'System'}</span>
                  </td>
                  <td className="py-3 px-4">
                    <pre className="text-xs text-gray-500 max-w-sm overflow-x-auto bg-gray-50 p-2 rounded">
                      {JSON.stringify(log.metadata, null, 2)}
                    </pre>
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-500 whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {logs.length === 0 && !error && (
        <div className="text-center py-12 bg-white border border-gray-200 rounded-xl mt-4">
          <Info className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No logs found</p>
          <p className="text-gray-400 text-sm mt-1">
            No logs found for the selected time period and filter.
          </p>
        </div>
      )}
    </div>
  );
}
