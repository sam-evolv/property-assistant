'use client';

/**
 * DEVELOPMENT SWITCHER
 *
 * Dropdown component for switching between developments/schemes.
 * Shows in the sidebar/header for developer views.
 * Features:
 * - "All schemes" option for macro analytics
 * - Individual development selection
 * - Fetches developments via RLS-protected API
 * - Supports tenant filtering for super_admin hierarchical navigation
 */

import { useState, useEffect, useRef } from 'react';
import { useCurrentContext } from '@/contexts/CurrentContext';
import { Building2, ChevronDown, Check, Layers } from 'lucide-react';

interface Development {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
  tenant_id?: string;
  tenant_name?: string;
}

interface DevelopmentSwitcherProps {
  /** Optional tenant filter for super_admin. When set, only shows developments for this tenant */
  tenantFilter?: string | null;
}

export function DevelopmentSwitcher({ tenantFilter }: DevelopmentSwitcherProps = {}) {
  const { tenantId, developmentId, setDevelopmentId } = useCurrentContext();
  const [developments, setDevelopments] = useState<Development[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch developments on mount and when tenantFilter changes
  useEffect(() => {
    async function fetchDevelopments() {
      try {
        setIsLoading(true);
        // Build URL with optional tenant filter
        const url = tenantFilter
          ? `/api/developments?tenant_id=${encodeURIComponent(tenantFilter)}`
          : '/api/developments';

        console.log('[DevelopmentSwitcher] Fetching developments...', { tenantFilter, url });
        const response = await fetch(url);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('[DevelopmentSwitcher] API error:', response.status, errorData);
          throw new Error(errorData.error || 'Failed to fetch developments');
        }

        const data = await response.json();
        console.log('[DevelopmentSwitcher] Loaded developments:', data.developments?.length || 0, data.meta);
        setDevelopments(data.developments || []);
        setError(null);

        // If current development is not in the filtered list, reset to "All Schemes"
        if (developmentId && data.developments && !data.developments.some((d: Development) => d.id === developmentId)) {
          console.log('[DevelopmentSwitcher] Current development not in filtered list, resetting to All Schemes');
          setDevelopmentId(null);
        }
      } catch (err) {
        console.error('[DevelopmentSwitcher] Error fetching developments:', err);
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setIsLoading(false);
      }
    }

    fetchDevelopments();
  }, [tenantFilter]); // Re-fetch when tenant filter changes

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Find current development
  const currentDevelopment = developments.find(d => d.id === developmentId);
  const displayName = currentDevelopment?.name || 'All Schemes';

  const handleSelect = (id: string | null, name?: string | null) => {
    console.log('[DevelopmentSwitcher] Selecting development:', id || 'All Schemes', 'name:', name);
    console.log('[DevelopmentSwitcher] Available developments:', developments.map(d => ({ id: d.id, name: d.name })));
    setDevelopmentId(id, name);
    setIsOpen(false);
    console.log('[DevelopmentSwitcher] Selection complete');
  };

  if (isLoading) {
    return (
      <div className="px-4 py-3 border-b border-gold-900/20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-grey-800 rounded-lg animate-pulse" />
          <div className="flex-1">
            <div className="h-3 w-20 bg-grey-800 rounded animate-pulse mb-1" />
            <div className="h-4 w-32 bg-grey-700 rounded animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 py-3 border-b border-gold-900/20">
        <div className="text-xs text-red-400">{error}</div>
      </div>
    );
  }

  return (
    <div ref={dropdownRef} className="relative px-4 py-3 border-b border-gold-900/20">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-gold-500/10 transition-colors group"
      >
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
          developmentId 
            ? 'bg-gold-500/20 text-gold-400' 
            : 'bg-grey-800 text-grey-400'
        }`}>
          {developmentId ? (
            <Building2 className="w-4 h-4" />
          ) : (
            <Layers className="w-4 h-4" />
          )}
        </div>
        <div className="flex-1 text-left">
          <div className="text-[10px] font-medium text-grey-500 uppercase tracking-wider">
            Current Scheme
          </div>
          <div className="text-sm font-semibold text-white truncate">
            {displayName}
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-grey-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-4 right-4 top-full mt-1 z-50 bg-grey-900 rounded-lg shadow-lg border border-gold-900/30 py-1 max-h-64 overflow-y-auto">
          {/* All Schemes option */}
          <button
            onClick={() => handleSelect(null)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gold-500/10 transition-colors ${
              !developmentId ? 'bg-gold-500/20' : ''
            }`}
          >
            <div className="w-6 h-6 rounded-md bg-grey-800 flex items-center justify-center">
              <Layers className="w-3.5 h-3.5 text-grey-400" />
            </div>
            <span className="flex-1 text-sm font-medium text-white">
              All Schemes
            </span>
            {!developmentId && (
              <Check className="w-4 h-4 text-gold-500" />
            )}
          </button>

          {developments.length > 0 && (
            <div className="border-t border-gold-900/20 my-1" />
          )}

          {/* Individual developments */}
          {developments.map((dev) => (
            <button
              key={dev.id}
              onClick={() => handleSelect(dev.id, dev.name)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gold-500/10 transition-colors ${
                developmentId === dev.id ? 'bg-gold-500/20' : ''
              }`}
            >
              <div className={`w-6 h-6 rounded-md flex items-center justify-center ${
                dev.is_active 
                  ? 'bg-green-900/50 text-green-400' 
                  : 'bg-grey-800 text-grey-500'
              }`}>
                <Building2 className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white truncate">
                  {dev.name}
                </div>
                <div className="text-[10px] text-grey-500 uppercase">
                  {dev.code}
                </div>
              </div>
              {developmentId === dev.id && (
                <Check className="w-4 h-4 text-gold-500 flex-shrink-0" />
              )}
            </button>
          ))}

          {developments.length === 0 && (
            <div className="px-3 py-4 text-center text-sm text-grey-400">
              No developments found
            </div>
          )}
        </div>
      )}
    </div>
  );
}
