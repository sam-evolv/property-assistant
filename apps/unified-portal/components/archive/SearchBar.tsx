'use client';

import { useState, useCallback, useEffect } from 'react';
import { Search, Filter, X, Loader2 } from 'lucide-react';
import { useSafeCurrentContext } from '@/contexts/CurrentContext';
import { DISCIPLINES, type DisciplineType } from '@/lib/archive-constants';

interface SearchFilters {
  discipline?: string;
  houseType?: string;
  important?: boolean;
  mustRead?: boolean;
  aiOnly?: boolean;
}

interface SearchBarProps {
  onSearch: (query: string, filters: SearchFilters) => void;
  isLoading?: boolean;
  developments?: Array<{ id: string; name: string }>;
  houseTypes?: Array<{ code: string; name: string }>;
}

export function SearchBar({ 
  onSearch, 
  isLoading = false,
  developments = [],
  houseTypes = []
}: SearchBarProps) {
  const { developmentId, setDevelopmentId } = useSafeCurrentContext();
  const [query, setQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({});

  const handleSearch = useCallback(() => {
    if (query.trim()) {
      onSearch(query.trim(), filters);
    }
  }, [query, filters, onSearch]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const updateFilter = (key: keyof SearchFilters, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value || undefined
    }));
  };

  const clearFilters = () => {
    setFilters({});
  };

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search documents across all developments..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
          />
        </div>
        
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`px-4 py-2.5 border rounded-lg flex items-center gap-2 transition-colors ${
            showFilters || activeFilterCount > 0
              ? 'border-amber-500 bg-amber-50 text-amber-700'
              : 'border-gray-200 hover:bg-gray-50'
          }`}
        >
          <Filter className="h-4 w-4" />
          <span>Filters</span>
          {activeFilterCount > 0 && (
            <span className="bg-amber-500 text-white text-xs px-1.5 py-0.5 rounded-full">
              {activeFilterCount}
            </span>
          )}
        </button>
        
        <button
          onClick={handleSearch}
          disabled={isLoading || !query.trim()}
          className="px-6 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
          <span>Search</span>
        </button>
      </div>

      {showFilters && (
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-gray-900">Search Filters</h4>
            {activeFilterCount > 0 && (
              <button
                onClick={clearFilters}
                className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
              >
                <X className="h-3 w-3" />
                Clear all
              </button>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Development
              </label>
              <select
                value={developmentId || ''}
                onChange={(e) => setDevelopmentId(e.target.value || null)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              >
                <option value="">All Developments</option>
                {developments.map(dev => (
                  <option key={dev.id} value={dev.id}>{dev.name}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Discipline
              </label>
              <select
                value={filters.discipline || ''}
                onChange={(e) => updateFilter('discipline', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              >
                <option value="">All Disciplines</option>
                {Object.entries(DISCIPLINES).map(([key, { label }]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                House Type
              </label>
              <select
                value={filters.houseType || ''}
                onChange={(e) => updateFilter('houseType', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              >
                <option value="">All House Types</option>
                {houseTypes.map(ht => (
                  <option key={ht.code} value={ht.code}>{ht.code} - {ht.name}</option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.important || false}
                onChange={(e) => updateFilter('important', e.target.checked)}
                className="rounded border-gray-300 text-amber-500 focus:ring-amber-500"
              />
              <span className="text-sm text-gray-700">Important Only</span>
            </label>
            
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.mustRead || false}
                onChange={(e) => updateFilter('mustRead', e.target.checked)}
                className="rounded border-gray-300 text-amber-500 focus:ring-amber-500"
              />
              <span className="text-sm text-gray-700">Must Read</span>
            </label>
            
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.aiOnly || false}
                onChange={(e) => updateFilter('aiOnly', e.target.checked)}
                className="rounded border-gray-300 text-amber-500 focus:ring-amber-500"
              />
              <span className="text-sm text-gray-700">AI Classified Only</span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
