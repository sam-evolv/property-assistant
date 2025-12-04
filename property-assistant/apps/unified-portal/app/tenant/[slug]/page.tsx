'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface TenantDetail {
  tenant: {
    id: string;
    name: string;
    slug: string;
    description?: string;
    theme_color?: string;
    logo_url?: string;
    created_at: string;
  };
  admins: Array<{
    id: string;
    email: string;
    role: string;
    created_at: string;
  }>;
  developments: Array<{
    id: string;
    name: string;
    address: string;
    created_at: string;
  }>;
  documents_count: number;
  pois_count: number;
  noticeboard_count: number;
}

export default function TenantDetailPage() {
  const params = useParams();
  const slug = params?.slug as string;
  
  const [data, setData] = useState<TenantDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTenantDetail() {
      try {
        const res = await fetch(`/api/tenant/${slug}`);
        if (!res.ok) throw new Error('Failed to fetch tenant details');
        const tenantData = await res.json();
        setData(tenantData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }
    
    if (slug) {
      fetchTenantDetail();
    }
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading tenant details...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <h2 className="text-red-800 font-semibold mb-2">Error</h2>
          <p className="text-red-600">{error || 'Tenant not found'}</p>
          <Link href="/tenants" className="mt-4 inline-block text-gold-500 hover:underline">
            ← Back to all tenants
          </Link>
        </div>
      </div>
    );
  }

  const { tenant, admins, developments, documents_count, pois_count, noticeboard_count } = data;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link href="/tenants" className="text-gold-500 hover:underline text-sm">
            ← Back to all tenants
          </Link>
        </div>

        {/* Tenant Summary */}
        <div className="bg-white shadow-md rounded-lg p-6 mb-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-4">
              {tenant.logo_url && (
                <img src={tenant.logo_url} alt={tenant.name} width={64} height={64} className="h-16 w-16 rounded-lg object-cover" />
              )}
              <div>
                <h1 className="text-3xl font-bold text-gray-900">{tenant.name}</h1>
                <p className="text-gray-600 mt-1">{tenant.description || 'No description'}</p>
                <div className="mt-2 flex items-center space-x-3">
                  <span className="px-3 py-1 bg-gold-50 text-gold-700 text-xs font-semibold rounded-full">
                    {tenant.slug}
                  </span>
                  {tenant.theme_color && (
                    <span className="flex items-center text-sm text-gray-500">
                      Theme: <span className="ml-1 h-4 w-4 rounded" style={{ backgroundColor: tenant.theme_color }}></span>
                    </span>
                  )}
                </div>
              </div>
            </div>
            <Link
              href={`/demo/${tenant.slug}`}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              Open Chat Demo
            </Link>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-sm font-medium text-gray-500">Documents</h3>
            <p className="mt-2 text-3xl font-semibold text-gray-900">{documents_count}</p>
          </div>
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-sm font-medium text-gray-500">Points of Interest</h3>
            <p className="mt-2 text-3xl font-semibold text-gray-900">{pois_count}</p>
          </div>
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-sm font-medium text-gray-500">Noticeboard Posts</h3>
            <p className="mt-2 text-3xl font-semibold text-gray-900">{noticeboard_count}</p>
          </div>
        </div>

        {/* Admin Users */}
        <div className="bg-white shadow-md rounded-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Admin Users</h2>
          {admins.length > 0 ? (
            <div className="space-y-3">
              {admins.map((admin) => (
                <div key={admin.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                  <div>
                    <p className="font-medium text-gray-900">{admin.email}</p>
                    <p className="text-sm text-gray-500">Role: {admin.role}</p>
                  </div>
                  <span className="text-xs text-gray-400">
                    Added {new Date(admin.created_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">No admin users found</p>
          )}
        </div>

        {/* Developments */}
        <div className="bg-white shadow-md rounded-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Developments</h2>
          {developments.length > 0 ? (
            <div className="space-y-3">
              {developments.map((dev) => (
                <div key={dev.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                  <div>
                    <p className="font-medium text-gray-900">{dev.name}</p>
                    <p className="text-sm text-gray-500">{dev.address}</p>
                  </div>
                  <span className="text-xs text-gray-400">
                    Created {new Date(dev.created_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">No developments found</p>
          )}
        </div>
      </div>
    </div>
  );
}
