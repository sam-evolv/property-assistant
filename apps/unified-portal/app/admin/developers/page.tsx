import { requireRole } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import { db } from '@openhouse/db';
import { admins } from '@openhouse/db/schema';
import { desc } from 'drizzle-orm';
import Link from 'next/link';
import { UserPlus, Mail, Shield } from 'lucide-react';

export default async function DevelopersPage() {
  try {
    await requireRole(['super_admin', 'admin']);
  } catch (error) {
    redirect('/unauthorized');
  }

  const allDevelopers = await db
    .select()
    .from(admins)
    .orderBy(desc(admins.created_at));

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Developers & Admins</h1>
            <p className="text-gray-600 mt-2">
              Manage developer accounts and admin users
            </p>
          </div>
          <Link
            href="/admin/developers/new"
            className="px-6 py-3 bg-gradient-to-r from-gold-500 to-gold-600 text-white rounded-lg hover:from-gold-600 hover:to-gold-700 transition-all duration-200 shadow-md hover:shadow-lg inline-flex items-center gap-2 font-medium"
          >
            <UserPlus className="w-5 h-5" />
            Add Developer
          </Link>
        </div>

        {allDevelopers.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
            <Shield className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No developers yet</h3>
            <p className="text-gray-600 mb-6">
              Get started by adding your first developer or admin user.
            </p>
            <Link
              href="/admin/developers/new"
              className="px-6 py-3 bg-gold-500 text-white rounded-lg hover:bg-gold-600 transition-all inline-flex items-center gap-2 font-medium"
            >
              <UserPlus className="w-5 h-5" />
              Add Developer
            </Link>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {allDevelopers.map((dev) => (
                    <tr key={dev.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center">
                            <span className="text-white font-semibold text-sm">
                              {dev.email.substring(0, 2).toUpperCase()}
                            </span>
                          </div>
                          <div className="font-medium text-gray-900">{dev.email}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2 text-gray-600">
                          <Mail className="w-4 h-4" />
                          <span className="text-sm">{dev.email}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-3 py-1 bg-gold-100 text-gold-700 rounded-full text-xs font-medium">
                          {dev.role || 'Developer'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {dev.created_at ? new Date(dev.created_at).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        }) : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <Link
                          href={`/admin/developers/${dev.id}/edit`}
                          className="text-gold-600 hover:text-gold-700 font-medium text-sm transition-colors"
                        >
                          Edit
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
