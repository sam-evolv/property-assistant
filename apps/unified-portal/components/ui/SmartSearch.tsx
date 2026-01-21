'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import {
  Search,
  X,
  Clock,
  TrendingUp,
  Loader2,
  Filter,
  ChevronDown,
  Home,
  FileText,
  Users,
  Building2,
} from 'lucide-react';

export interface SearchResult {
  id: string;
  type: 'unit' | 'document' | 'homeowner' | 'development' | string;
  title: string;
  subtitle?: string;
  href?: string;
  onClick?: () => void;
  metadata?: Record<string, string>;
}

export interface SearchFilter {
  id: string;
  label: string;
  icon?: typeof Search;
  count?: number;
}

interface SmartSearchProps {
  placeholder?: string;
  filters?: SearchFilter[];
  recentSearches?: string[];
  popularSearches?: string[];
  onSearch: (query: string, filters: string[]) => Promise<SearchResult[]> | SearchResult[];
  onResultClick?: (result: SearchResult) => void;
  onClearRecent?: () => void;
  debounceMs?: number;
  minQueryLength?: number;
  maxResults?: number;
  className?: string;
}

const typeIcons: Record<string, typeof Search> = {
  unit: Home,
  document: FileText,
  homeowner: Users,
  development: Building2,
};

export function SmartSearch({
  placeholder = 'Search...',
  filters = [],
  recentSearches = [],
  popularSearches = [],
  onSearch,
  onResultClick,
  onClearRecent,
  debounceMs = 300,
  minQueryLength = 2,
  maxResults = 10,
  className,
}: SmartSearchProps) {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [showFilters, setShowFilters] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const isOpen = isFocused && (query.length > 0 || recentSearches.length > 0 || popularSearches.length > 0);

  // Perform search
  const performSearch = useCallback(
    async (searchQuery: string) => {
      if (searchQuery.length < minQueryLength) {
        setResults([]);
        return;
      }

      setIsLoading(true);
      try {
        const searchResults = await onSearch(searchQuery, activeFilters);
        setResults(searchResults.slice(0, maxResults));
      } catch (error) {
        console.error('Search error:', error);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    },
    [onSearch, activeFilters, minQueryLength, maxResults]
  );

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (query.length >= minQueryLength) {
      debounceRef.current = setTimeout(() => {
        performSearch(query);
      }, debounceMs);
    } else {
      setResults([]);
    }

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, debounceMs, minQueryLength, performSearch]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsFocused(false);
        setShowFilters(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev < results.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev > 0 ? prev - 1 : results.length - 1
      );
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      const result = results[selectedIndex];
      if (result) {
        handleResultClick(result);
      }
    } else if (e.key === 'Escape') {
      setIsFocused(false);
      inputRef.current?.blur();
    }
  };

  const handleResultClick = (result: SearchResult) => {
    setQuery('');
    setIsFocused(false);
    setResults([]);
    onResultClick?.(result);
    result.onClick?.();
  };

  const handleQuickSearch = (term: string) => {
    setQuery(term);
    performSearch(term);
  };

  const toggleFilter = (filterId: string) => {
    setActiveFilters((prev) =>
      prev.includes(filterId)
        ? prev.filter((id) => id !== filterId)
        : [...prev, filterId]
    );
  };

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* Search Input */}
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2">
          {isLoading ? (
            <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
          ) : (
            <Search className="w-5 h-5 text-gray-400" />
          )}
        </div>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedIndex(-1);
          }}
          onFocus={() => setIsFocused(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn(
            'w-full pl-10 pr-10 py-2.5 text-sm',
            'border border-gray-200 rounded-lg',
            'focus:outline-none focus:ring-2 focus:ring-gold-500/20 focus:border-gold-500',
            'placeholder-gray-400 text-gray-900',
            'transition-all duration-200'
          )}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {query && (
            <button
              onClick={() => {
                setQuery('');
                setResults([]);
                inputRef.current?.focus();
              }}
              className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          {filters.length > 0 && (
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                'p-1 rounded transition-colors',
                activeFilters.length > 0
                  ? 'text-gold-600 bg-gold-50'
                  : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
              )}
            >
              <Filter className="w-4 h-4" />
              {activeFilters.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 text-[10px] font-bold text-white bg-gold-500 rounded-full flex items-center justify-center">
                  {activeFilters.length}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Filter Pills */}
      {showFilters && filters.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 p-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          <div className="flex flex-wrap gap-2">
            {filters.map((filter) => {
              const Icon = filter.icon;
              const isActive = activeFilters.includes(filter.id);

              return (
                <button
                  key={filter.id}
                  onClick={() => toggleFilter(filter.id)}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full transition-colors',
                    isActive
                      ? 'bg-gold-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  )}
                >
                  {Icon && <Icon className="w-3 h-3" />}
                  {filter.label}
                  {filter.count !== undefined && (
                    <span className={cn('ml-1', isActive ? 'text-gold-200' : 'text-gray-400')}>
                      ({filter.count})
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden">
          {/* Results */}
          {results.length > 0 && (
            <div className="py-2">
              <div className="px-3 py-1.5">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  Results
                </span>
              </div>
              {results.map((result, index) => {
                const Icon = typeIcons[result.type] || Search;
                const isSelected = index === selectedIndex;

                return (
                  <button
                    key={result.id}
                    onClick={() => handleResultClick(result)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2 text-left transition-colors',
                      isSelected ? 'bg-gray-100' : 'hover:bg-gray-50'
                    )}
                  >
                    <div className="p-2 rounded-lg bg-gray-100">
                      <Icon className="w-4 h-4 text-gray-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {result.title}
                      </p>
                      {result.subtitle && (
                        <p className="text-xs text-gray-500 truncate">
                          {result.subtitle}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 capitalize">
                      {result.type}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* No results */}
          {query.length >= minQueryLength && !isLoading && results.length === 0 && (
            <div className="px-4 py-8 text-center">
              <Search className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No results found</p>
              <p className="text-xs text-gray-400 mt-1">Try a different search term</p>
            </div>
          )}

          {/* Quick searches when empty */}
          {query.length < minQueryLength && (
            <>
              {/* Recent Searches */}
              {recentSearches.length > 0 && (
                <div className="py-2 border-b border-gray-100">
                  <div className="flex items-center justify-between px-3 py-1.5">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Recent
                    </span>
                    {onClearRecent && (
                      <button
                        onClick={onClearRecent}
                        className="text-xs text-gray-400 hover:text-gray-600"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  {recentSearches.slice(0, 5).map((term, index) => (
                    <button
                      key={index}
                      onClick={() => handleQuickSearch(term)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
                    >
                      <Clock className="w-4 h-4 text-gray-400" />
                      {term}
                    </button>
                  ))}
                </div>
              )}

              {/* Popular Searches */}
              {popularSearches.length > 0 && (
                <div className="py-2">
                  <div className="px-3 py-1.5">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      Popular
                    </span>
                  </div>
                  {popularSearches.slice(0, 5).map((term, index) => (
                    <button
                      key={index}
                      onClick={() => handleQuickSearch(term)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
                    >
                      <TrendingUp className="w-4 h-4 text-gray-400" />
                      {term}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Keyboard hints */}
          <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-t border-gray-100">
            <div className="flex items-center gap-4 text-xs text-gray-400">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-white border rounded text-[10px]">↑↓</kbd>
                Navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-white border rounded text-[10px]">↵</kbd>
                Select
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-white border rounded text-[10px]">esc</kbd>
                Close
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SmartSearch;
