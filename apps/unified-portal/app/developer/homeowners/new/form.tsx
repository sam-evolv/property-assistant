'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, User, Home, Building2, MapPin, AlertCircle } from 'lucide-react';

interface Development {
  id: string;
  name: string;
  address: string;
}

interface FormErrors {
  developmentId?: string;
  name?: string;
}

export function HomeownerForm({ developments }: { developments: Development[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<FormErrors>({});

  function validateForm(data: { developmentId: FormDataEntryValue | null; name: FormDataEntryValue | null }): boolean {
    const errors: FormErrors = {};
    
    if (!data.developmentId || data.developmentId.toString().trim() === '') {
      errors.developmentId = 'Please select a development';
    }
    
    if (!data.name || data.name.toString().trim() === '') {
      errors.name = 'Please enter the homeowner name';
    } else if (data.name.toString().trim().length < 2) {
      errors.name = 'Name must be at least 2 characters';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setRequestId(null);

    const formData = new FormData(e.currentTarget);
    const data = {
      developmentId: formData.get('developmentId'),
      name: formData.get('name'),
      houseType: formData.get('houseType') || null,
      address: formData.get('address') || null,
    };

    if (!validateForm(data)) {
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/homeowners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const reqId = response.headers.get('x-request-id');
      if (reqId) setRequestId(reqId);

      if (response.ok) {
        router.push('/developer/homeowners');
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to create homeowner');
        setLoading(false);
      }
    } catch (err: any) {
      setError(err.message || 'Network error. Please check your connection and try again.');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Link href="/developer/homeowners" className="text-gold-500 hover:text-gold-600 flex items-center gap-1 mb-3 text-sm">
            <ArrowLeft className="w-4 h-4" />
            Back to Homeowners
          </Link>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-gold-100 to-gold-50 rounded-xl">
              <User className="w-6 h-6 text-gold-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Add New Homeowner</h1>
              <p className="text-sm text-gray-500">Register a new homeowner for your development</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {developments.length === 0 && (
            <div className="m-6 mb-0 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 text-sm flex items-start gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">No developments available</p>
                <p className="mt-1">You need at least one development to add homeowners. Please create a development first or contact your administrator.</p>
              </div>
            </div>
          )}
          
          {error && (
            <div className="m-6 mb-0 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-start gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <p>{error}</p>
                {requestId && (
                  <p className="mt-2 text-xs text-red-500">Request ID: {requestId}</p>
                )}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <Building2 className="w-4 h-4 text-gray-400" />
                Development <span className="text-red-500">*</span>
              </label>
              <select
                name="developmentId"
                required
                disabled={developments.length === 0}
                className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent bg-white disabled:bg-gray-100 disabled:cursor-not-allowed ${formErrors.developmentId ? 'border-red-300 bg-red-50' : 'border-gray-300'}`}
              >
                <option value="">Select a development...</option>
                {developments.map((dev) => (
                  <option key={dev.id} value={dev.id}>
                    {dev.name} - {dev.address}
                  </option>
                ))}
              </select>
              {formErrors.developmentId && (
                <p className="mt-1 text-xs text-red-600">{formErrors.developmentId}</p>
              )}
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <User className="w-4 h-4 text-gray-400" />
                Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="name"
                required
                className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent ${formErrors.name ? 'border-red-300 bg-red-50' : 'border-gray-300'}`}
                placeholder="e.g., Mr John Smith and Mrs Jane Smith"
              />
              {formErrors.name ? (
                <p className="mt-1 text-xs text-red-600">{formErrors.name}</p>
              ) : (
                <p className="mt-1 text-xs text-gray-500">Enter the full name(s) of the homeowner(s)</p>
              )}
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <Home className="w-4 h-4 text-gray-400" />
                House Type
              </label>
              <input
                type="text"
                name="houseType"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent"
                placeholder="e.g., BS01, BD03, Type A"
              />
              <p className="mt-1 text-xs text-gray-500">The house type code or name for this unit</p>
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <MapPin className="w-4 h-4 text-gray-400" />
                Address
              </label>
              <input
                type="text"
                name="address"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent"
                placeholder="e.g., 42 Longview Park, Carrigtwohill"
              />
              <p className="mt-1 text-xs text-gray-500">The full address of this property</p>
            </div>

            <div className="flex gap-3 pt-4 border-t border-gray-100">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-gradient-to-r from-gold-500 to-gold-600 text-white px-6 py-3 rounded-lg hover:from-gold-600 hover:to-gold-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-md hover:shadow-lg transition-all"
              >
                {loading ? 'Creating...' : 'Create Homeowner'}
              </button>
              <Link
                href="/developer/homeowners"
                className="flex-1 bg-gray-100 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-200 text-center font-medium transition-colors"
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
