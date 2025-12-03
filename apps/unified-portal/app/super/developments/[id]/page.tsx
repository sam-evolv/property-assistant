import { requireRole } from '@/lib/supabase-server';
import { notFound } from 'next/navigation';

export default async function DevelopmentDetailPage({
  params,
}: {
  params: { id: string };
}) {
  await requireRole(['super_admin', 'admin']);

  const developmentId = params.id;

  if (!developmentId) {
    notFound();
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Development Deep Dive</h1>
        <p className="text-gray-400">Development ID: {developmentId}</p>
        <p className="text-gray-500 text-sm mt-1">Phase 2 Scaffolding - 8-Tab Interface</p>
      </div>

      <div className="bg-gray-900 border border-gold-900/20 rounded-lg p-6 mb-6 shadow-sm hover:shadow-md transition-shadow">
        <h2 className="text-xl font-semibold text-white mb-4">Development Info</h2>
        <div className="text-sm text-gray-500">
          Placeholder - Development details will be loaded from database in Phase 3+
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-800 border border-gold-900/20 rounded-lg p-4 text-center hover:border-gold-700/40 transition-all cursor-pointer">
          <div className="text-sm text-gray-400">Timeline</div>
        </div>
        <div className="bg-gray-800 border border-gold-900/20 rounded-lg p-4 text-center hover:border-gold-700/40 transition-all cursor-pointer">
          <div className="text-sm text-gray-400">Units</div>
        </div>
        <div className="bg-gray-800 border border-gold-900/20 rounded-lg p-4 text-center hover:border-gold-700/40 transition-all cursor-pointer">
          <div className="text-sm text-gray-400">Homeowners</div>
        </div>
        <div className="bg-gray-800 border border-gold-900/20 rounded-lg p-4 text-center hover:border-gold-700/40 transition-all cursor-pointer">
          <div className="text-sm text-gray-400">Documents</div>
        </div>
        <div className="bg-gray-800 border border-gold-900/20 rounded-lg p-4 text-center hover:border-gold-700/40 transition-all cursor-pointer">
          <div className="text-sm text-gray-400">RAG Index</div>
        </div>
        <div className="bg-gray-800 border border-gold-900/20 rounded-lg p-4 text-center hover:border-gold-700/40 transition-all cursor-pointer">
          <div className="text-sm text-gray-400">Chat Analytics</div>
        </div>
        <div className="bg-gray-800 border border-gold-900/20 rounded-lg p-4 text-center hover:border-gold-700/40 transition-all cursor-pointer">
          <div className="text-sm text-gray-400">Maps</div>
        </div>
        <div className="bg-gray-800 border border-gold-900/20 rounded-lg p-4 text-center hover:border-gold-700/40 transition-all cursor-pointer">
          <div className="text-sm text-gray-400">Errors</div>
        </div>
      </div>

      <div className="bg-gray-900 border border-gold-900/20 rounded-lg p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-white mb-2">Phase 2 Note</h3>
        <p className="text-gray-400 text-sm">
          This is the scaffolding for the 8-tab Development Deep Dive interface.
          Real data integration and tab functionality will be built in Phase 3+.
        </p>
      </div>
    </div>
  );
}
