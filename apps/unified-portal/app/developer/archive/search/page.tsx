'use client';

import { useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, Search, FileText, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useCurrentContext } from '@/contexts/CurrentContext';
import { SearchBar } from '@/components/archive/SearchBar';
import { SearchResultCard } from '@/components/archive/SearchResultCard';

interface SearchResult {
  document_id: string;
  file_name: string;
  title: string;
  discipline: string | null;
  house_type_code: string | null;
  score: number;
  preview_text: string;
  tags: string[];
  important: boolean;
  must_read: boolean;
  ai_classified: boolean;
  development_id: string;
  development_name: string;
  file_url: string | null;
  created_at: string;
}

interface SearchFilters {
  discipline?: string;
  houseType?: string;
  important?: boolean;
  mustRead?: boolean;
  aiOnly?: boolean;
}

export default function ArchiveSearchPage() {
  const { tenantId, developmentId } = useCurrentContext();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [developments, setDevelopments] = useState<Array<{ id: string; name: string }>>([]);
  const [houseTypes, setHouseTypes] = useState<Array<{ code: string; name: string }>>([]);
  const [searchMeta, setSearchMeta] = useState<{ cached: boolean; total: number } | null>(null);

  useEffect(() => {
    async function fetchDevelopments() {
      if (!tenantId) return;
      try {
        const res = await fetch(`/api/developments?tenantId=${tenantId}`);
        if (res.ok) {
          const data = await res.json();
          setDevelopments(data.developments || []);
        }
      } catch (err) {
        console.error('Failed to fetch developments:', err);
      }
    }
    fetchDevelopments();
  }, [tenantId]);

  useEffect(() => {
    async function fetchHouseTypes() {
      if (!tenantId) return;
      const devId = developmentId || '';
      try {
        const res = await fetch(`/api/house-types?tenantId=${tenantId}${devId ? `&developmentId=${devId}` : ''}`);
        if (res.ok) {
          const data = await res.json();
          setHouseTypes(data.houseTypes?.map((ht: any) => ({ 
            code: ht.house_type_code, 
            name: ht.name || ht.house_type_code 
          })) || []);
        }
      } catch (err) {
        console.error('Failed to fetch house types:', err);
      }
    }
    fetchHouseTypes();
  }, [tenantId, developmentId]);

  const handleSearch = useCallback(async (query: string, filters: SearchFilters) => {
    if (!tenantId) return;
    
    setIsLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      const params = new URLSearchParams({
        tenantId,
        q: query,
        limit: '30'
      });
      
      if (developmentId) params.set('developmentId', developmentId);
      if (filters.discipline) params.set('discipline', filters.discipline);
      if (filters.houseType) params.set('houseType', filters.houseType);
      if (filters.important) params.set('important', 'true');
      if (filters.mustRead) params.set('mustRead', 'true');
      if (filters.aiOnly) params.set('aiOnly', 'true');

      const res = await fetch(`/developer/api/archive/search?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Search failed');
      }

      setResults(data.results || []);
      setSearchMeta({ cached: data.cached, total: data.total });
    } catch (err) {
      console.error('Search error:', err);
      setError(err instanceof Error ? err.message : 'Search failed');
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, [tenantId, developmentId]);

  useEffect(() => {
    if (initialQuery && tenantId) {
      handleSearch(initialQuery, {});
    }
  }, [initialQuery, tenantId, handleSearch]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Link
            href="/developer/archive"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Archive</span>
          </Link>
          
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <Search className="h-7 w-7 text-amber-500" />
            Smart Archive Search
          </h1>
          <p className="text-gray-600 mt-1">
            Semantic search across all your documents with AI-powered relevance ranking
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <SearchBar
            onSearch={handleSearch}
            isLoading={isLoading}
            developments={developments}
            houseTypes={houseTypes}
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin text-amber-500 mx-auto mb-3" />
              <p className="text-gray-600">Searching documents...</p>
            </div>
          </div>
        )}

        {!isLoading && hasSearched && (
          <>
            <div className="flex items-center justify-between mb-4">
              <p className="text-gray-600">
                {results.length === 0 
                  ? 'No results found'
                  : `Found ${results.length} document${results.length === 1 ? '' : 's'}`}
                {searchMeta?.cached && (
                  <span className="ml-2 text-xs text-gray-400">(cached)</span>
                )}
              </p>
            </div>

            {results.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No documents found</h3>
                <p className="text-gray-500 max-w-md mx-auto">
                  Try adjusting your search terms or filters to find what you're looking for.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {results.map((result) => (
                  <SearchResultCard key={result.document_id} result={result} />
                ))}
              </div>
            )}
          </>
        )}

        {!hasSearched && !isLoading && (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <Search className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Start searching</h3>
            <p className="text-gray-500 max-w-md mx-auto">
              Enter a search term above to find documents across all your developments.
              Use filters to narrow down results by discipline, house type, or status.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
