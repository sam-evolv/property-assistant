'use client';

import { useState } from 'react';
import Link from 'next/link';
import { updateDeveloper, deleteDeveloper } from '@/app/actions/developers';

interface Tenant {
  id: string;
  name: string;
  slug: string;
}

interface Developer {
  id: string;
  email: string;
  role: string;
  tenant_id: string;
}

export function DeveloperEditForm({ developer, tenants }: { developer: Developer; tenants: Tenant[] }) {
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);

    try {
      await updateDeveloper(developer.id, formData);
    } catch (err: any) {
      setError(err.message || 'Failed to update developer');
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this developer? This action cannot be undone.')) {
      return;
    }

    setDeleting(true);
    setError(null);

    try {
      await deleteDeveloper(developer.id);
    } catch (err: any) {
      setError(err.message || 'Failed to delete developer');
      setDeleting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Link href="/admin" className="text-gold-500 hover:text-gold-700 text-sm">
            ← Back to Dashboard
          </Link>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Edit Developer</h1>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address *
              </label>
              <input
                type="email"
                name="email"
                required
                defaultValue={developer.email}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gold-500"
                placeholder="developer@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tenant *
              </label>
              <select
                name="tenantId"
                required
                defaultValue={developer.tenant_id}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gold-500"
              >
                <option value="">Select a tenant...</option>
                {tenants.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={loading || deleting}
                className="flex-1 bg-gold-500 text-white px-4 py-2 rounded-md hover:bg-gold-600 disabled:bg-blue-300 disabled:cursor-not-allowed font-medium"
              >
                {loading ? 'Updating...' : 'Update Developer'}
              </button>
              <Link
                href="/admin"
                className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300 text-center font-medium"
              >
                Cancel
              </Link>
            </div>
          </form>

          <div className="mt-8 pt-6 border-t border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Danger Zone</h2>
            <button
              onClick={handleDelete}
              disabled={loading || deleting}
              className="w-full bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:bg-red-300 disabled:cursor-not-allowed font-medium"
            >
              {deleting ? 'Deleting...' : 'Delete Developer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
