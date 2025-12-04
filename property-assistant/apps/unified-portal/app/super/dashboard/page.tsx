import { requireRole } from '@/lib/supabase-server';

export default async function DashboardPage() {
  await requireRole(['super_admin', 'admin']);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Enterprise Dashboard</h1>
        <p className="text-gray-400">Phase 2 Scaffolding - Placeholder View</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <div className="text-sm text-gray-400 mb-1">Total Developers</div>
          <div className="text-3xl font-bold text-white">--</div>
          <div className="text-xs text-gray-500 mt-2">Placeholder</div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <div className="text-sm text-gray-400 mb-1">Total Developments</div>
          <div className="text-3xl font-bold text-white">--</div>
          <div className="text-xs text-gray-500 mt-2">Placeholder</div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <div className="text-sm text-gray-400 mb-1">Total Units</div>
          <div className="text-3xl font-bold text-white">--</div>
          <div className="text-xs text-gray-500 mt-2">Placeholder</div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <div className="text-sm text-gray-400 mb-1">Total Homeowners</div>
          <div className="text-3xl font-bold text-white">--</div>
          <div className="text-xs text-gray-500 mt-2">Placeholder</div>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Total Messages</h2>
        <div className="text-3xl font-bold text-white">--</div>
        <div className="text-xs text-gray-500 mt-2">
          Real analytics will be connected in Phase 3+
        </div>
      </div>
    </div>
  );
}
