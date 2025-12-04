'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createDevelopment } from '@/app/actions/developments';

interface Tenant {
  id: string;
  name: string;
  slug: string;
}

interface Developer {
  id: string;
  email: string;
  tenant_id: string;
}

export function DevelopmentForm({ 
  tenants, 
  developers 
}: { 
  tenants: Tenant[]; 
  developers: Developer[] 
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [filteredDevelopers, setFilteredDevelopers] = useState<Developer[]>(developers);

  useEffect(() => {
    if (selectedTenantId) {
      setFilteredDevelopers(developers.filter(d => d.tenant_id === selectedTenantId));
    } else {
      setFilteredDevelopers(developers);
    }
  }, [selectedTenantId, developers]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);

    try {
      await createDevelopment(formData);
    } catch (err: any) {
      setError(err.message || 'Failed to create development');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Link href="/admin" className="text-gold-500 hover:text-gold-700 text-sm">
            ← Back to Dashboard
          </Link>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Create New Development</h1>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Development Name *
              </label>
              <input
                type="text"
                name="name"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gold-500"
                placeholder="Sunset Gardens"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Address
              </label>
              <input
                type="text"
                name="address"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gold-500"
                placeholder="123 Main St, City"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                name="description"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gold-500"
                placeholder="A luxury residential development..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                System Instructions
              </label>
              <textarea
                name="systemInstructions"
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gold-500"
                placeholder="Instructions for the AI assistant..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tenant *
              </label>
              <select
                name="tenantId"
                required
                value={selectedTenantId}
                onChange={(e) => setSelectedTenantId(e.target.value)}
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Developer *
              </label>
              <select
                name="developerUserId"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gold-500"
                disabled={!selectedTenantId}
              >
                <option value="">
                  {selectedTenantId ? 'Select a developer...' : 'Select a tenant first...'}
                </option>
                {filteredDevelopers.map((dev) => (
                  <option key={dev.id} value={dev.id}>
                    {dev.email}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-gold-500 text-white px-4 py-2 rounded-md hover:bg-gold-600 disabled:bg-blue-300 disabled:cursor-not-allowed font-medium"
              >
                {loading ? 'Creating...' : 'Create Development'}
              </button>
              <Link
                href="/admin"
                className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300 text-center font-medium"
              >
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
