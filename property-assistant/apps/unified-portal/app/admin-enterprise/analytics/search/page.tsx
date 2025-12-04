import { requireRole } from '@/lib/supabase-server';

export default async function SearchAnalyticsPage() {
  await requireRole(['super_admin', 'admin']);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Search Analytics</h1>
        <p className="text-gray-400">Phase 2 Scaffolding - RAG search logs and performance</p>
      </div>

      <div className="space-y-6">
        <div className="bg-gray-900 border border-gold-900/20 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
          <h2 className="text-xl font-semibold text-white mb-4">Search Metrics</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <div className="text-sm text-gray-400">Total Searches</div>
              <div className="text-2xl font-bold text-white">--</div>
            </div>
            <div>
              <div className="text-sm text-gray-400">Zero Results</div>
              <div className="text-2xl font-bold text-white">--</div>
            </div>
            <div>
              <div className="text-sm text-gray-400">Avg Similarity</div>
              <div className="text-2xl font-bold text-white">--</div>
            </div>
          </div>
        </div>

        <div className="bg-gray-900 border border-gold-900/20 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
          <h2 className="text-xl font-semibold text-white mb-4">Recent Search Logs</h2>
          <div className="text-sm text-gray-500">
            Placeholder - Search log table will be implemented in Phase 3+
          </div>
        </div>

        <div className="bg-gray-900 border border-gold-900/20 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
          <h2 className="text-xl font-semibold text-white mb-4">Low Similarity Queries</h2>
          <div className="text-sm text-gray-500">
            Placeholder - Queries with similarity &lt; 0.5 will be shown here
          </div>
        </div>

        <div className="bg-gray-900 border border-gold-900/20 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
          <h2 className="text-xl font-semibold text-white mb-4">Performance Metrics</h2>
          <div className="text-sm text-gray-500">
            Placeholder - Latency distribution and token counts will be shown here
          </div>
        </div>
      </div>
    </div>
  );
}
