'use client';

import { useEffect, useState } from 'react';
import { Shield, Clock, CheckCircle, AlertCircle, Loader2, Eye } from 'lucide-react';

interface SupportQuery {
  id: string;
  installation_id: string;
  customer_ref: string;
  address: string;
  query_type: string;
  status: string;
  description: string;
  created_at: string;
}

const STATUS_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  open: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
  in_progress: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  resolved: { bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-500' },
};

const STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
};

const TABS = ['all', 'open', 'in_progress', 'resolved'] as const;
const TAB_LABELS: Record<string, string> = {
  all: 'All',
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
};

export default function SupportQueuePage() {
  const [queries, setQueries] = useState<SupportQuery[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('all');

  useEffect(() => {
    async function fetchQueries() {
      try {
        const res = await fetch('/api/care/support-queries');
        if (res.ok) {
          const data = await res.json();
          setQueries(data.queries || []);
        }
      } catch {
        // Silently handle — empty state shown
      } finally {
        setLoading(false);
      }
    }
    fetchQueries();
  }, []);

  const filtered = activeTab === 'all'
    ? queries
    : queries.filter(q => q.status === activeTab);

  if (loading) {
    return (
      <div className="min-h-full bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-full bg-gray-50">
      <div className="p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Support Queue</h1>
            <p className="text-sm text-gray-500 mt-1">
              {queries.length} total quer{queries.length !== 1 ? 'ies' : 'y'}
            </p>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-2">
            {TABS.map((tab) => {
              const count = tab === 'all' ? queries.length : queries.filter(q => q.status === tab).length;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-150 active:scale-[0.98] ${
                    activeTab === tab
                      ? 'bg-gold-500 text-white shadow-sm'
                      : 'text-gray-600 bg-white border border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {TAB_LABELS[tab]}
                  <span className={`ml-1.5 text-xs ${activeTab === tab ? 'text-white/80' : 'text-gray-400'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Queries List */}
          {filtered.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-12 text-center">
              <Shield className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-gray-900 mb-2">No support queries</h2>
              <p className="text-sm text-gray-500">
                {activeTab === 'all'
                  ? 'When homeowners raise support requests, they will appear here.'
                  : `No ${TAB_LABELS[activeTab].toLowerCase()} queries at the moment.`}
              </p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Customer</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Query Type</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date Raised</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((query) => {
                      const statusStyle = STATUS_STYLES[query.status] || STATUS_STYLES.open;
                      const dateStr = new Date(query.created_at).toLocaleDateString('en-IE', {
                        day: 'numeric', month: 'short', year: 'numeric',
                      });
                      return (
                        <tr key={query.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-900">{query.customer_ref}</p>
                            <p className="text-xs text-gray-400">{query.address}</p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-gray-700">{query.query_type}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusStyle.bg} ${statusStyle.text}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`} />
                              {STATUS_LABELS[query.status] || query.status}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5 text-gray-500 text-xs">
                              <Clock className="w-3.5 h-3.5" />
                              {dateStr}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-all duration-150 active:scale-[0.98]">
                              <Eye className="w-3.5 h-3.5" />
                              View
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
