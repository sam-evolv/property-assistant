'use client';

import { useState } from 'react';
import { runPlacesHealthcheck } from './actions';

export default function PlacesHealthPage() {
  const [schemeName, setSchemeName] = useState('Longview Park');
  const [schemeId, setSchemeId] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await runPlacesHealthcheck(
        schemeId || undefined,
        schemeId ? undefined : schemeName
      );

      if (response.success) {
        setResult(response.data);
      } else {
        setError(response.error || 'Unknown error');
      }
    } catch (err: any) {
      setError(err.message || 'Request failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">Places Healthcheck Tool</h1>
      <p className="text-gray-400 mb-6">
        Run the Places API healthcheck with test-mode authentication. This tool checks location data, API key configuration, and cache status for a scheme.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4 mb-8">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Scheme ID (optional, takes priority)
          </label>
          <input
            type="text"
            value={schemeId}
            onChange={(e) => setSchemeId(e.target.value)}
            placeholder="e.g. 12345678-1234-1234-1234-123456789abc"
            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Scheme Name (used if no ID provided)
          </label>
          <input
            type="text"
            value={schemeName}
            onChange={(e) => setSchemeName(e.target.value)}
            placeholder="e.g. Longview Park"
            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <button
          type="submit"
          disabled={loading || (!schemeId && !schemeName)}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Running...' : 'Run Places Healthcheck'}
        </button>
      </form>

      {error && (
        <div className="p-4 bg-red-900/50 border border-red-700 rounded-lg mb-6">
          <h3 className="text-red-400 font-medium mb-1">Error</h3>
          <p className="text-red-300">{error}</p>
        </div>
      )}

      {result && (
        <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-gray-750 border-b border-gray-700">
            <h3 className="text-white font-medium">Response</h3>
          </div>
          <pre className="p-4 text-sm text-gray-300 overflow-x-auto">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
