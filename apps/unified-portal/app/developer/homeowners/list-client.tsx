'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AdminSession } from '@/lib/types';

interface Homeowner {
  id: string;
  name: string;
  email: string;
  house_type: string | null;
  address: string | null;
  unique_qr_token: string;
  development_id: string;
  created_at: string;
  development?: {
    id: string;
    name: string;
  };
}

export function HomeownersListClient({ session }: { session: AdminSession }) {
  const searchParams = useSearchParams();
  const developmentId = searchParams.get('developmentId');
  
  const [homeowners, setHomeowners] = useState<Homeowner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revealedTokens, setRevealedTokens] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchHomeowners();
  }, [developmentId]);

  async function fetchHomeowners() {
    try {
      const url = developmentId
        ? `/api/homeowners?developmentId=${developmentId}`
        : '/api/homeowners';
        
      const response = await fetch(url);

      if (response.ok) {
        const data = await response.json();
        setHomeowners(data.homeowners || []);
      } else {
        setError('Failed to load homeowners');
      }
    } catch (error) {
      console.error('Failed to fetch homeowners:', error);
      setError('An error occurred while loading homeowners');
    } finally {
      setLoading(false);
    }
  }

  function toggleTokenReveal(homeownerId: string) {
    setRevealedTokens((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(homeownerId)) {
        newSet.delete(homeownerId);
      } else {
        newSet.add(homeownerId);
      }
      return newSet;
    });
  }

  function maskToken(token: string): string {
    if (token.length <= 8) return '••••••••';
    return `${token.slice(0, 4)}••••${token.slice(-4)}`;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading homeowners...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center text-red-600">{error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Homeowners</h1>
              <p className="text-gray-600 mt-1">
                {developmentId ? 'Filtered by development' : 'All assigned homeowners'}
              </p>
            </div>
            <Link
              href="/developer"
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
            >
              ← Back to Dashboard
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {homeowners.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-500">
              <p className="text-lg">No homeowners found.</p>
              <p className="text-sm mt-2">Homeowners will appear here once they're added to developments.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Development
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      House Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Address
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      QR Token
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {homeowners.map((homeowner) => (
                    <tr key={homeowner.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {homeowner.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {homeowner.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {homeowner.development?.name || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {homeowner.house_type || 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {homeowner.address || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex items-center gap-2">
                          <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono">
                            {revealedTokens.has(homeowner.id)
                              ? homeowner.unique_qr_token
                              : maskToken(homeowner.unique_qr_token)}
                          </code>
                          <button
                            onClick={() => toggleTokenReveal(homeowner.id)}
                            className="text-gold-500 hover:text-gold-700 text-xs"
                          >
                            {revealedTokens.has(homeowner.id) ? 'Hide' : 'Show'}
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(homeowner.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
