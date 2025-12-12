import { requireRole } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import { db } from '@openhouse/db/client';
import { developments } from '@openhouse/db/schema';
import { sql } from 'drizzle-orm';

export default async function DevelopmentsPage() {
  let session;
  try {
    session = await requireRole(['super_admin', 'admin']);
  } catch (error) {
    redirect('/unauthorized');
  }

  const allDevelopments = await db.query.developments.findMany({
    orderBy: (developments, { desc }) => [desc(developments.created_at)],
    with: {
      tenant: {
        columns: {
          id: true,
          name: true,
        },
      },
    },
  });

  const isSuperAdmin = session.role === 'super_admin';

  return (
    <div className="p-8 bg-gray-950 min-h-full">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Developments Management</h1>
          <p className="text-gray-400 mt-1">
            Manage all developments across all tenants
          </p>
        </div>
        {isSuperAdmin && (
          <a
            href="/super/developments/new"
            className="px-6 py-3 bg-gold-500 text-white rounded-lg hover:bg-gold-600 transition-all duration-premium shadow-sm hover:shadow-md inline-block font-medium"
          >
            + Create New Development
          </a>
        )}
      </div>

      <div className="grid gap-4">
        {allDevelopments.map((dev) => (
          <a
            key={dev.id}
            href={`/super/developments/${dev.id}`}
            className="bg-gray-900 border border-gray-800 rounded-lg p-6 hover:border-gold-500/50 transition-colors"
          >
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-xl font-semibold text-white">{dev.name}</h2>
                <p className="text-gray-400 text-sm mt-1">{dev.address}</p>
                <p className="text-gray-500 text-xs mt-2">
                  Tenant: {dev.tenant?.name || 'Unknown'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 rounded text-xs ${
                  dev.is_active ? 'bg-green-900/50 text-green-300' : 'bg-gray-800 text-gray-400'
                }`}>
                  {dev.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          </a>
        ))}
        {allDevelopments.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No developments found. {isSuperAdmin && 'Create your first development above.'}
          </div>
        )}
      </div>
    </div>
  );
}
