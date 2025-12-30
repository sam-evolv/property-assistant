'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronDown, Building2, Check, Layers } from 'lucide-react';
import { ArchiveScope, isAllSchemes, getSchemeId, createAllSchemesScope, createSchemeScope } from '@/lib/archive-scope';

interface Development {
  id: string;
  name: string;
  code?: string;
  archive_mode?: 'shared' | 'isolated';
}

interface DevelopmentSelectorProps {
  tenantId: string | null;
  archiveScope: ArchiveScope;
  onScopeChange: (scope: ArchiveScope) => void;
  selectedDevelopmentId?: string | null;
  onDevelopmentChange?: (developmentId: string | null) => void;
  className?: string;
}

export function DevelopmentSelector({
  tenantId,
  archiveScope,
  onScopeChange,
  selectedDevelopmentId,
  onDevelopmentChange,
  className = '',
}: DevelopmentSelectorProps) {
  const [developments, setDevelopments] = useState<Development[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastFetchedTenantId = useRef<string | null>(null);
  const currentTenantIdRef = useRef<string | null>(tenantId);
  
  currentTenantIdRef.current = tenantId;

  const currentSchemeId = selectedDevelopmentId ?? getSchemeId(archiveScope);

  const fetchDevelopments = useCallback(async () => {
    const fetchForTenant = currentTenantIdRef.current;
    
    if (!fetchForTenant) {
      setIsLoading(false);
      setDevelopments([]);
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/developer/developments');
      if (!response.ok) {
        throw new Error('Failed to fetch developments');
      }
      
      if (fetchForTenant !== currentTenantIdRef.current) {
        setIsLoading(false);
        return;
      }
      
      const data = await response.json();
      
      if (fetchForTenant !== currentTenantIdRef.current) {
        setIsLoading(false);
        return;
      }
      
      const devList = data.developments || [];
      setDevelopments(devList);
      lastFetchedTenantId.current = fetchForTenant;
      
      const devIds = new Set(devList.map((d: Development) => d.id));
      const currentId = getSchemeId(archiveScope);
      
      if (currentId && !devIds.has(currentId)) {
        console.log('[DevelopmentSelector] Current scheme not in list, resetting to ALL_SCHEMES');
        onScopeChange(createAllSchemesScope());
        if (onDevelopmentChange) {
          onDevelopmentChange(null);
        }
      } else if (devList.length === 1 && isAllSchemes(archiveScope)) {
        const singleScheme = devList[0];
        onScopeChange(createSchemeScope(singleScheme.id));
        if (onDevelopmentChange) {
          onDevelopmentChange(singleScheme.id);
        }
      }
      
      setIsLoading(false);
    } catch (err) {
      setIsLoading(false);
      if (fetchForTenant !== currentTenantIdRef.current) {
        return;
      }
      console.error('[DevelopmentSelector] Failed to fetch:', err);
      setError('Failed to load developments');
    }
  }, [archiveScope, onScopeChange, onDevelopmentChange]);

  useEffect(() => {
    if (!tenantId) {
      setDevelopments([]);
      setIsLoading(false);
      lastFetchedTenantId.current = null;
      return;
    }
    
    if (tenantId !== lastFetchedTenantId.current) {
      setDevelopments([]);
      lastFetchedTenantId.current = null;
      fetchDevelopments();
    }
  }, [tenantId, fetchDevelopments]);

  const handleSelect = (developmentId: string | null) => {
    const newScope = developmentId 
      ? createSchemeScope(developmentId) 
      : createAllSchemesScope();
    
    onScopeChange(newScope);
    if (onDevelopmentChange) {
      onDevelopmentChange(developmentId);
    }
    setIsOpen(false);
  };

  if (!tenantId) {
    return null;
  }

  if (isLoading) {
    return (
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800/50 text-gray-400 ${className}`}>
        <Building2 className="w-4 h-4" />
        <span className="text-sm">Loading...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg bg-red-900/20 text-red-400 ${className}`}>
        <Building2 className="w-4 h-4" />
        <span className="text-sm">{error}</span>
      </div>
    );
  }

  if (developments.length === 0) {
    return (
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800/50 text-gray-400 ${className}`}>
        <Building2 className="w-4 h-4" />
        <span className="text-sm">No developments found</span>
      </div>
    );
  }

  const selectedDevelopment = developments.find(d => d.id === currentSchemeId);
  const isAllSchemesSelected = isAllSchemes(archiveScope) && !selectedDevelopmentId;

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-200 hover:bg-gray-700 hover:border-gray-600 transition-colors min-w-[200px]"
      >
        {isAllSchemesSelected ? (
          <Layers className="w-4 h-4 text-emerald-400" />
        ) : (
          <Building2 className="w-4 h-4 text-gray-400" />
        )}
        <span className="flex-1 text-left text-sm truncate">
          {isAllSchemesSelected ? 'All Schemes' : selectedDevelopment?.name || 'Select Scheme'}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full left-0 mt-1 w-full min-w-[240px] bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 py-1 max-h-64 overflow-auto">
            {developments.length > 1 && (
              <>
                <button
                  onClick={() => handleSelect(null)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-700 transition-colors ${
                    isAllSchemesSelected ? 'text-white bg-gray-700/50' : 'text-gray-300'
                  }`}
                >
                  <Layers className="w-4 h-4 text-emerald-400" />
                  <span className="flex-1">All Schemes</span>
                  {isAllSchemesSelected && <Check className="w-4 h-4 text-emerald-400" />}
                </button>
                
                <div className="border-t border-gray-700 my-1" />
              </>
            )}
            
            {developments.map((dev) => (
              <button
                key={dev.id}
                onClick={() => handleSelect(dev.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-700 transition-colors ${
                  currentSchemeId === dev.id ? 'text-white bg-gray-700/50' : 'text-gray-300'
                }`}
              >
                <Building2 className="w-4 h-4 text-gray-400" />
                <span className="flex-1 truncate">{dev.name}</span>
                {dev.archive_mode === 'isolated' && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">
                    Isolated
                  </span>
                )}
                {currentSchemeId === dev.id && <Check className="w-4 h-4 text-emerald-400" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
