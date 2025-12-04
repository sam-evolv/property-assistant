'use client';

import { useEffect, useState } from 'react';
import { Activity, AlertCircle, Info, AlertTriangle } from 'lucide-react';

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
  const [filter, setFilter] = useState<string>('all');
  const [hours, setHours] = useState(24);

  useEffect(() => {
    const params = new URLSearchParams();
    params.append('hours', hours.toString());
    if (filter !== 'all') {
      params.append('type', filter);
    }

    fetch(`/api/admin/system-logs?${params}`)
      .then((res) => res.json())
      .then((data) => setLogs(data.logs || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [filter, hours]);

  const getIconForType = (type: string) => {
    if (type.includes('error') || type.includes('ERROR')) {
      return <AlertCircle className="w-5 h-5 text-red-400" />;
    }
    if (type.includes('warn') || type.includes('WARN')) {
      return <AlertTriangle className="w-5 h-5 text-orange-400" />;
    }
    return <Info className="w-5 h-5 text-gold-400" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-950">
        <div className="text-white">Loading system logs...</div>
      </div>
    );
  }

  return (
    <div className="p-8 bg-gray-950 min-h-full">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Activity className="w-8 h-8 text-gold-400" />
          <div>
            <h1 className="text-3xl font-bold text-white">System Logs</h1>
            <p className="text-gray-400 mt-1">{logs.length} log entries</p>
          </div>
        </div>
        <div className="flex gap-3">
          <select
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
            className="px-4 py-2 bg-gray-800 border border-gray-700 text-white rounded-lg"
          >
            <option value={1}>Last Hour</option>
            <option value={6}>Last 6 Hours</option>
            <option value={24}>Last 24 Hours</option>
            <option value={168}>Last Week</option>
          </select>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-4 py-2 bg-gray-800 border border-gray-700 text-white rounded-lg"
          >
            <option value="all">All Types</option>
            <option value="error">Errors</option>
            <option value="warning">Warnings</option>
            <option value="info">Info</option>
          </select>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-800 border-b border-gray-700">
                <th className="text-left py-4 px-6 text-gray-300 font-medium">Type</th>
                <th className="text-left py-4 px-6 text-gray-300 font-medium">Action</th>
                <th className="text-left py-4 px-6 text-gray-300 font-medium">Actor</th>
                <th className="text-left py-4 px-6 text-gray-300 font-medium">Metadata</th>
                <th className="text-left py-4 px-6 text-gray-300 font-medium">Time</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr
                  key={log.id}
                  className="border-b border-gray-800 hover:bg-gray-800/50 transition"
                >
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-2">
                      {getIconForType(log.type)}
                      <span className="text-gray-300 text-sm">{log.type}</span>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-white font-mono text-sm">{log.action}</td>
                  <td className="py-4 px-6 text-gray-300 text-sm">{log.actor || 'System'}</td>
                  <td className="py-4 px-6">
                    <pre className="text-gray-400 text-xs max-w-md overflow-x-auto">
                      {JSON.stringify(log.metadata, null, 2)}
                    </pre>
                  </td>
                  <td className="py-4 px-6 text-gray-400 text-sm whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {logs.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          No logs found for the selected time period and filter.
        </div>
      )}
    </div>
  );
}
