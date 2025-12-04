'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Development {
  id: string;
  name: string;
  address: string;
  description: string | null;
  created_at: string;
}

export default function DevelopmentsPage() {
  const [developments, setDevelopments] = useState<Development[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDevelopments();
  }, []);

  const fetchDevelopments = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/developments');
      
      if (!response.ok) {
        throw new Error('Failed to fetch developments');
      }
      
      const data = await response.json();
      setDevelopments(data.developments || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch developments');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-1">
        <div className="bg-gradient-to-br from-white via-grey-50/50 to-gold-50/30 border-b border-border py-8">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="h-10 w-1/3 bg-grey-200 rounded-premium animate-pulse mb-2"></div>
            <div className="h-4 w-1/4 bg-grey-200 rounded-premium animate-pulse"></div>
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-grey-500">Loading your developments...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-1">
      <div className="bg-gradient-to-br from-white via-grey-50/50 to-gold-50/30 border-b border-border py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="motion-safe:animate-fade-in">
              <h1 className="text-heading-xl text-black mb-2">My Developments</h1>
              <p className="text-body text-grey-600">Create and manage your property developments</p>
            </div>
            <Link
              href="/developments/new"
              className="px-6 py-3 bg-gradient-to-br from-gold-500 to-gold-600 text-black rounded-premium font-semibold hover:shadow-gold-glow transition-all duration-premium hover-lift whitespace-nowrap"
            >
              + Create Development
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="bg-red-50 border-2 border-red-200 text-red-800 px-4 py-3 rounded-premium mb-6 motion-safe:animate-slide-down">
            <p className="font-medium">{error}</p>
          </div>
        )}

        {developments.length === 0 ? (
          <div className="bg-white rounded-premium border-2 border-grey-200 p-12 text-center motion-safe:animate-scale-in">
            <div className="max-w-md mx-auto">
              <div className="w-16 h-16 bg-gold-50 rounded-premium mx-auto mb-6 flex items-center justify-center">
                <svg className="w-8 h-8 text-gold-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <h3 className="text-heading-md text-black mb-2">No developments yet</h3>
              <p className="text-body text-grey-600 mb-6">
                Start building your property portfolio by creating your first development
              </p>
              <Link
                href="/developments/new"
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-br from-gold-500 to-gold-600 text-black rounded-premium font-semibold hover:shadow-gold-glow transition-all duration-premium hover-lift"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Create your first development
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid gap-4">
            {developments.map((dev, index) => (
              <Link
                key={dev.id}
                href={`/developments/${dev.id}`}
                className="bg-white rounded-premium border border-grey-200 p-6 hover-lift transition-all duration-premium group motion-safe:animate-slide-up"
                style={{animationDelay: `${index * 50}ms`}}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h2 className="text-heading-sm text-black mb-2 group-hover:text-gold-700 transition-colors duration-premium">{dev.name}</h2>
                    <div className="flex items-center gap-2 text-body-sm text-grey-600 mb-2">
                      <svg className="w-4 h-4 text-grey-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      {dev.address}
                    </div>
                    {dev.description && (
                      <p className="text-body-sm text-grey-500 mb-3 line-clamp-2">{dev.description}</p>
                    )}
                    <div className="flex items-center gap-2 text-caption text-grey-500">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Created {new Date(dev.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="ml-6">
                    <div className="w-10 h-10 bg-gold-50 rounded-premium flex items-center justify-center group-hover:bg-gold-100 transition-colors duration-premium">
                      <svg className="h-5 w-5 text-gold-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
