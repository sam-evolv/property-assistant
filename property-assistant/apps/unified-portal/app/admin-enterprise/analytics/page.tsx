import { requireRole } from '@/lib/supabase-server';
import Link from 'next/link';

export default async function AnalyticsOverviewPage() {
  await requireRole(['super_admin', 'admin']);

  return (
    <div className="p-8">
      <div className="mb-8 bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-6">
        <h1 className="text-3xl font-bold text-white mb-2">⚠️ Deprecated Page</h1>
        <p className="text-yellow-400 mb-4">This page is deprecated. Please use the new unified analytics dashboard:</p>
        <Link 
          href="/analytics"
          className="inline-block px-6 py-3 bg-yellow-500 text-black font-semibold rounded-lg hover:bg-yellow-400 transition-colors"
        >
          Go to New Analytics Dashboard →
        </Link>
      </div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-400 mb-2">Old Analytics Overview (Phase 2 Scaffolding)</h2>
        <p className="text-gray-500">Legacy modules below - use new dashboard instead</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link
          href="/admin-enterprise/chat-analytics"
          className="bg-gray-900 border border-gray-800 rounded-lg p-6 hover:border-gold-500 transition-colors"
        >
          <h2 className="text-xl font-semibold text-white mb-2">Chat Analytics</h2>
          <p className="text-gray-400 text-sm">
            View chat message volume, top questions, and engagement metrics
          </p>
        </Link>

        <Link
          href="/admin-enterprise/analytics/search"
          className="bg-gray-900 border border-gray-800 rounded-lg p-6 hover:border-gold-500 transition-colors"
        >
          <h2 className="text-xl font-semibold text-white mb-2">Search Analytics</h2>
          <p className="text-gray-400 text-sm">
            RAG search logs, zero-result queries, and similarity scores
          </p>
        </Link>

        <Link
          href="/admin-enterprise/rag"
          className="bg-gray-900 border border-gray-800 rounded-lg p-6 hover:border-gold-500 transition-colors"
        >
          <h2 className="text-xl font-semibold text-white mb-2">RAG Analytics</h2>
          <p className="text-gray-400 text-sm">
            Document chunks, embeddings, and vector index health
          </p>
        </Link>
      </div>

      <div className="mt-8 bg-gray-900 border border-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-2">Phase 2 Note</h3>
        <p className="text-gray-400 text-sm">
          This is a placeholder page. Real analytics integrations will be built in Phase 3+.
          All links above navigate to their respective scaffolded pages.
        </p>
      </div>
    </div>
  );
}
