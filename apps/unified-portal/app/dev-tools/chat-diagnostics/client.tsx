'use client';

import { useState } from 'react';
import { runChatDiagnostic } from './actions';

export default function ChatDiagnosticsClient() {
  const [unitUid, setUnitUid] = useState('');
  const [message, setMessage] = useState('Where is the nearest supermarket?');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);

  const handleRunDiagnostic = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setLatencyMs(null);

    try {
      const response = await runChatDiagnostic(unitUid, message);
      
      if (response.success) {
        setResult(response.data);
        setLatencyMs(response.latencyMs || null);
      } else {
        setError(response.error || 'Unknown error');
        setLatencyMs(response.latencyMs || null);
      }
    } catch (err: any) {
      setError(err.message || 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-2">Chat Diagnostics Tool</h1>
      <p className="text-gray-400 mb-6">
        Test the purchaser chat API with diagnostic headers. Debug output is included when available.
      </p>

      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Unit UID (optional)
          </label>
          <input
            type="text"
            value={unitUid}
            onChange={(e) => setUnitUid(e.target.value)}
            placeholder="e.g. LV-PARK-001 or leave empty"
            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            If empty, the API will use default scheme resolution
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Message
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Enter your test message..."
            rows={3}
            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        <button
          onClick={handleRunDiagnostic}
          disabled={loading || !message.trim()}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
        >
          {loading ? 'Running...' : 'Run Diagnostic'}
        </button>
      </div>

      {latencyMs !== null && (
        <div className="mb-4 text-sm text-gray-400">
          Response time: {latencyMs}ms
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-900/50 border border-red-700 rounded-lg mb-4">
          <p className="text-red-300 font-medium">Error</p>
          <p className="text-red-200 text-sm mt-1">{error}</p>
        </div>
      )}

      {result && (
        <div className="space-y-4">
          {result.debug && (
            <div className="p-4 bg-purple-900/30 border border-purple-700 rounded-lg">
              <p className="text-purple-300 font-medium mb-2">Debug Information</p>
              <pre className="text-sm text-purple-200 overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(result.debug, null, 2)}
              </pre>
            </div>
          )}

          <div className="p-4 bg-gray-800 border border-gray-700 rounded-lg">
            <p className="text-gray-300 font-medium mb-2">Full Response</p>
            <pre className="text-sm text-gray-200 overflow-x-auto whitespace-pre-wrap max-h-[600px] overflow-y-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        </div>
      )}

      <div className="mt-8 p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
        <p className="text-gray-400 text-sm">
          <strong className="text-gray-300">How it works:</strong> This tool calls the purchaser chat API with 
          X-Test-Mode and X-Test-Secret headers injected server-side. The secret is never exposed to the browser.
          When the API detects an amenity or location intent, it includes diagnostic data in the response.
        </p>
      </div>
    </div>
  );
}
