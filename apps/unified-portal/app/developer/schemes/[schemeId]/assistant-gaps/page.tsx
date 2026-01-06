'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface GapLog {
  id: string;
  scheme_id: string;
  unit_id: string | null;
  user_question: string;
  intent_type: string | null;
  attempted_sources: string[];
  final_source: string | null;
  gap_reason: string;
  created_at: string;
  suggested_fix?: string;
  fix_priority?: string;
}

interface GapSummary {
  totalGaps: number;
  byReason: Record<string, number>;
  byIntent: Record<string, number>;
  recentTrend: {
    last24h: number;
    last7d: number;
    last30d: number;
  };
}

export default function AssistantGapsPage() {
  const params = useParams();
  const schemeId = params.schemeId as string;
  
  const [logs, setLogs] = useState<GapLog[]>([]);
  const [summary, setSummary] = useState<GapSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  useEffect(() => {
    fetchData();
  }, [schemeId, filter, page]);
  
  async function fetchData() {
    setLoading(true);
    try {
      const [logsRes, summaryRes] = await Promise.all([
        fetch(`/developer/api/assistant-gaps?schemeId=${schemeId}&limit=20&offset=${(page - 1) * 20}${filter ? `&gapReason=${filter}` : ''}`),
        fetch(`/developer/api/assistant-gaps?schemeId=${schemeId}&action=summary`),
      ]);
      
      const logsData = await logsRes.json();
      const summaryData = await summaryRes.json();
      
      setLogs(logsData.logs || []);
      setTotalPages(logsData.totalPages || 1);
      setSummary(summaryData.summary || null);
    } catch (error) {
      console.error('Failed to fetch gap data:', error);
    }
    setLoading(false);
  }
  
  const gapReasonLabels: Record<string, string> = {
    playbook_fallback: 'Playbook Fallback',
    defer_to_developer: 'Deferred to Developer',
    defer_to_omc: 'Deferred to OMC',
    low_doc_confidence: 'Low Document Confidence',
    no_documents_found: 'No Documents Found',
    category_mismatch: 'Category Mismatch',
    scheme_mismatch: 'Scheme Mismatch',
    missing_scheme_data: 'Missing Scheme Data',
    validation_failed: 'Validation Failed',
    unknown: 'Unknown',
  };
  
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">Assistant Answer Gaps</h1>
        <button
          onClick={fetchData}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Refresh
        </button>
      </div>
      
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-zinc-800 rounded-lg p-4">
            <div className="text-zinc-400 text-sm">Total Gaps</div>
            <div className="text-2xl font-bold text-white">{summary.totalGaps}</div>
          </div>
          <div className="bg-zinc-800 rounded-lg p-4">
            <div className="text-zinc-400 text-sm">Last 24 Hours</div>
            <div className="text-2xl font-bold text-amber-500">{summary.recentTrend.last24h}</div>
          </div>
          <div className="bg-zinc-800 rounded-lg p-4">
            <div className="text-zinc-400 text-sm">Last 7 Days</div>
            <div className="text-2xl font-bold text-white">{summary.recentTrend.last7d}</div>
          </div>
          <div className="bg-zinc-800 rounded-lg p-4">
            <div className="text-zinc-400 text-sm">Last 30 Days</div>
            <div className="text-2xl font-bold text-white">{summary.recentTrend.last30d}</div>
          </div>
        </div>
      )}
      
      {summary && Object.keys(summary.byReason).length > 0 && (
        <div className="bg-zinc-800 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-white mb-4">Gaps by Reason</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(summary.byReason).map(([reason, count]) => (
              <button
                key={reason}
                onClick={() => setFilter(filter === reason ? '' : reason)}
                className={`p-3 rounded-lg text-left transition-colors ${
                  filter === reason 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                }`}
              >
                <div className="text-sm truncate">{gapReasonLabels[reason] || reason}</div>
                <div className="text-xl font-bold">{count}</div>
              </button>
            ))}
          </div>
        </div>
      )}
      
      <div className="bg-zinc-800 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-zinc-700">
          <h2 className="text-lg font-semibold text-white">Gap Log</h2>
          {filter && (
            <span className="ml-2 text-sm text-blue-400">
              Filtered: {gapReasonLabels[filter] || filter}
              <button onClick={() => setFilter('')} className="ml-2 text-zinc-400 hover:text-white">
                Clear
              </button>
            </span>
          )}
        </div>
        
        {loading ? (
          <div className="p-8 text-center text-zinc-400">Loading...</div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-zinc-400">
            No answer gaps logged yet. This is good - it means the assistant is answering questions successfully.
          </div>
        ) : (
          <div className="divide-y divide-zinc-700">
            {logs.map((log) => (
              <div key={log.id} className="p-4 hover:bg-zinc-700/50">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs px-2 py-1 bg-zinc-700 rounded text-zinc-300">
                    {gapReasonLabels[log.gap_reason] || log.gap_reason}
                  </span>
                  <span className="text-xs text-zinc-500">
                    {new Date(log.created_at).toLocaleString()}
                  </span>
                </div>
                <p className="text-white mb-2">{log.user_question}</p>
                <div className="flex gap-4 text-xs text-zinc-400">
                  {log.intent_type && (
                    <span>Intent: {log.intent_type}</span>
                  )}
                  {log.final_source && (
                    <span>Source: {log.final_source}</span>
                  )}
                  {log.attempted_sources?.length > 0 && (
                    <span>Tried: {log.attempted_sources.join(', ')}</span>
                  )}
                </div>
                {log.suggested_fix && (
                  <div className={`mt-2 p-2 rounded text-sm ${
                    log.fix_priority === 'high' 
                      ? 'bg-red-900/30 text-red-300 border border-red-800' 
                      : log.fix_priority === 'medium'
                      ? 'bg-amber-900/30 text-amber-300 border border-amber-800'
                      : 'bg-zinc-700/50 text-zinc-300'
                  }`}>
                    <span className="font-medium">Suggested fix: </span>
                    {log.suggested_fix}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        
        {totalPages > 1 && (
          <div className="p-4 border-t border-zinc-700 flex justify-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 bg-zinc-700 text-white rounded disabled:opacity-50"
            >
              Previous
            </button>
            <span className="px-3 py-1 text-zinc-400">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1 bg-zinc-700 text-white rounded disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
