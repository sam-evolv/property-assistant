'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Tenant {
  id: string;
  name: string;
  slug: string | null;
}

interface Developer {
  id: string;
  email: string;
  tenant_id: string;
}

interface Props {
  tenants: Tenant[];
  developers: Developer[];
  currentTenantId: string;
}

export function CreateDevelopmentForm({ tenants, developers, currentTenantId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    status: 'draft' as 'draft' | 'live' | 'archived',
    addressLine1: '',
    addressLine2: '',
    town: '',
    county: '',
    eircode: '',
    latitude: '',
    longitude: '',
    expectedUnitCount: '',
    phase: '',
    isDemo: false,
    logoUrl: '',
    heroImageUrl: '',
    systemInstructions: '',
    tenantId: currentTenantId,
    developerUserId: '',
  });

  const filteredDevelopers = developers.filter(d => d.tenant_id === formData.tenantId);

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setFormData({
      ...formData,
      name,
      slug: generateSlug(name),
    });
  };

  const buildAddress = () => {
    const parts = [
      formData.addressLine1,
      formData.addressLine2,
      formData.town,
      formData.county,
      formData.eircode,
    ].filter(Boolean);
    return parts.join(', ');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.name.trim()) {
      setError('Development name is required');
      return;
    }

    if (!formData.addressLine1.trim()) {
      setError('Address Line 1 is required');
      return;
    }

    if (!formData.tenantId) {
      setError('Please select a tenant/organisation');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/developments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          address: buildAddress(),
          description: formData.description.trim() || null,
          systemInstructions: formData.systemInstructions.trim() || null,
          tenantId: formData.tenantId,
          developerUserId: formData.developerUserId || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create development');
      }

      const data = await response.json();
      setSuccess(true);

      setTimeout(() => {
        router.push(`/super/developments/${data.developmentId}`);
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create development');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="bg-green-900/30 border border-green-500/50 text-green-300 px-6 py-8 rounded-lg text-center">
        <div className="text-4xl mb-4">✓</div>
        <h2 className="text-xl font-semibold mb-2">Development Created Successfully!</h2>
        <p className="text-green-400">Redirecting to development details...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {error && (
        <div className="bg-red-900/30 border border-red-500/50 text-red-300 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <span className="w-8 h-8 bg-gold-500/20 text-gold-400 rounded-full flex items-center justify-center text-sm">1</span>
          Development Details
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Development Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={handleNameChange}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent"
              placeholder="e.g., Rathard Park"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              URL Slug
            </label>
            <input
              type="text"
              value={formData.slug}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent"
              placeholder="rathard-park"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent"
              rows={3}
              placeholder="Brief description of the development..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Status
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as 'draft' | 'live' | 'archived' })}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent"
            >
              <option value="draft">Draft</option>
              <option value="live">Live</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Phase / Stage
            </label>
            <input
              type="text"
              value={formData.phase}
              onChange={(e) => setFormData({ ...formData, phase: e.target.value })}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent"
              placeholder="e.g., Phase 1"
            />
          </div>
        </div>
      </div>

      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <span className="w-8 h-8 bg-gold-500/20 text-gold-400 rounded-full flex items-center justify-center text-sm">2</span>
          Location
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Address Line 1 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={formData.addressLine1}
              onChange={(e) => setFormData({ ...formData, addressLine1: e.target.value })}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent"
              placeholder="Street address"
              required
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Address Line 2
            </label>
            <input
              type="text"
              value={formData.addressLine2}
              onChange={(e) => setFormData({ ...formData, addressLine2: e.target.value })}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent"
              placeholder="Area/neighbourhood"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Town/City
            </label>
            <input
              type="text"
              value={formData.town}
              onChange={(e) => setFormData({ ...formData, town: e.target.value })}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent"
              placeholder="e.g., Cork City"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              County
            </label>
            <input
              type="text"
              value={formData.county}
              onChange={(e) => setFormData({ ...formData, county: e.target.value })}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent"
              placeholder="e.g., Co. Cork"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Eircode
            </label>
            <input
              type="text"
              value={formData.eircode}
              onChange={(e) => setFormData({ ...formData, eircode: e.target.value.toUpperCase() })}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent"
              placeholder="e.g., T12 ABC1"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Expected Unit Count
            </label>
            <input
              type="number"
              value={formData.expectedUnitCount}
              onChange={(e) => setFormData({ ...formData, expectedUnitCount: e.target.value })}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent"
              placeholder="e.g., 75"
              min="1"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Latitude
            </label>
            <input
              type="text"
              value={formData.latitude}
              onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent"
              placeholder="e.g., 51.8969"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Longitude
            </label>
            <input
              type="text"
              value={formData.longitude}
              onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent"
              placeholder="e.g., -8.4756"
            />
          </div>
        </div>
      </div>

      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <span className="w-8 h-8 bg-gold-500/20 text-gold-400 rounded-full flex items-center justify-center text-sm">3</span>
          Organisation & Assignment
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Tenant/Organisation <span className="text-red-400">*</span>
            </label>
            <select
              value={formData.tenantId}
              onChange={(e) => setFormData({ ...formData, tenantId: e.target.value, developerUserId: '' })}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent"
              required
            >
              <option value="">Select tenant...</option>
              {tenants.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Assign to Developer
            </label>
            <select
              value={formData.developerUserId}
              onChange={(e) => setFormData({ ...formData, developerUserId: e.target.value })}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent"
              disabled={!formData.tenantId}
            >
              <option value="">No assignment (admin-managed)</option>
              {filteredDevelopers.map((dev) => (
                <option key={dev.id} value={dev.id}>
                  {dev.email}
                </option>
              ))}
            </select>
            {formData.tenantId && filteredDevelopers.length === 0 && (
              <p className="text-xs text-gray-500 mt-1">No developers found for this tenant</p>
            )}
          </div>
          <div className="md:col-span-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isDemo}
                onChange={(e) => setFormData({ ...formData, isDemo: e.target.checked })}
                className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-gold-500 focus:ring-gold-500"
              />
              <span className="text-sm text-gray-300">This is a demo/test development</span>
            </label>
          </div>
        </div>
      </div>

      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <span className="w-8 h-8 bg-gold-500/20 text-gold-400 rounded-full flex items-center justify-center text-sm">4</span>
          Branding
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Logo URL
            </label>
            <input
              type="url"
              value={formData.logoUrl}
              onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent"
              placeholder="https://..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Hero Image URL
            </label>
            <input
              type="url"
              value={formData.heroImageUrl}
              onChange={(e) => setFormData({ ...formData, heroImageUrl: e.target.value })}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent"
              placeholder="https://..."
            />
          </div>
        </div>
      </div>

      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <span className="w-8 h-8 bg-gold-500/20 text-gold-400 rounded-full flex items-center justify-center text-sm">5</span>
          AI Configuration
        </h2>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            System Instructions for AI Assistant
          </label>
          <textarea
            value={formData.systemInstructions}
            onChange={(e) => setFormData({ ...formData, systemInstructions: e.target.value })}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent font-mono text-sm"
            rows={6}
            placeholder="Custom instructions for the AI assistant for this development..."
          />
          <p className="text-xs text-gray-500 mt-1">
            These instructions will be added to the AI assistant's context when answering questions about this development.
          </p>
        </div>
      </div>

      <div className="flex gap-4 pt-4">
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-3 bg-gold-500 text-white rounded-lg hover:bg-gold-600 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
        >
          {loading ? 'Creating Development...' : 'Create Development'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-6 py-3 bg-gray-700 text-gray-200 rounded-lg hover:bg-gray-600 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
