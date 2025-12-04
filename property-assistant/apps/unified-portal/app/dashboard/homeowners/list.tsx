'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AdminSession } from '@/lib/supabase-server';

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

export function HomeownersList({ 
  session, 
  homeowners,
  developmentId 
}: { 
  session: AdminSession;
  homeowners: Homeowner[];
  developmentId?: string;
}) {
  const [revealedTokens, setRevealedTokens] = useState<Set<string>>(new Set());

  function toggleTokenVisibility(id: string) {
    setRevealedTokens((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function copyQRLink(token: string) {
    const tenantPortalUrl = process.env.NEXT_PUBLIC_TENANT_PORTAL_URL || 'http://localhost:5000';
    const link = `${tenantPortalUrl}/onboarding/${token}`;
    navigator.clipboard.writeText(link);
    alert('QR link copied to clipboard!');
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <Link href="/dashboard" className="text-gold-500 hover:text-gold-700 text-sm mb-2 inline-block">
              ← Back to Dashboard
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">
              Homeowners {developmentId && '(Filtered)'}
            </h1>
          </div>
          <Link
            href="/dashboard/homeowners/new"
            className="px-4 py-2 bg-gold-500 text-white rounded-lg hover:bg-gold-600 transition"
          >
            + Add Homeowner
          </Link>
        </div>

        <div className="bg-white shadow rounded-lg overflow-hidden">
          {homeowners.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <p className="text-lg mb-4">No homeowners found</p>
              <p className="text-sm">Create a development first, then add homeowners to it.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
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
                      QR Token
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {homeowners.map((homeowner) => (
                    <tr key={homeowner.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {homeowner.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {homeowner.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {homeowner.development?.name || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {homeowner.house_type || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500">
                        {revealedTokens.has(homeowner.id) ? (
                          <span className="text-xs">{homeowner.unique_qr_token}</span>
                        ) : (
                          <span className="text-xs">••••••••••••</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                        <button
                          onClick={() => toggleTokenVisibility(homeowner.id)}
                          className="text-gold-500 hover:text-gold-900"
                        >
                          {revealedTokens.has(homeowner.id) ? 'Hide' : 'Show'}
                        </button>
                        <button
                          onClick={() => copyQRLink(homeowner.unique_qr_token)}
                          className="text-green-600 hover:text-green-900"
                        >
                          Copy Link
                        </button>
                        <Link
                          href={`/dashboard/homeowners/${homeowner.id}/edit`}
                          className="text-indigo-600 hover:text-indigo-900"
                        >
                          Edit
                        </Link>
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
