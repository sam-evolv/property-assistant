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
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Developments Management</h1>
          <p className="text-gray-500 mt-1">
            Manage all developments across all tenants
          </p>
        </div>
        {isSuperAdmin && (
          <a
            href="/super/developments/new"
            className="px-6 py-3 bg-gold-500 text-white rounded-lg hover:bg-gold-600 transition-all shadow-sm hover:shadow-md inline-block font-medium"
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
            className="bg-white border border-gray-200 rounded-lg p-6 hover:border-gold-400 hover:shadow-md transition-all"
          >
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">{dev.name}</h2>
                <p className="text-gray-500 text-sm mt-1">{dev.address}</p>
                <p className="text-gray-400 text-xs mt-2">
                  Tenant: {dev.tenant?.name || 'Unknown'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  dev.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {dev.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          </a>
        ))}
        {allDevelopments.length === 0 && (
          <div className="text-center py-12 bg-white border border-gray-200 rounded-lg text-gray-500">
            No developments found. {isSuperAdmin && 'Create your first development above.'}
          </div>
        )}
      </div>
    </div>
  );
}
