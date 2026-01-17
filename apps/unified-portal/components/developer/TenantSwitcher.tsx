'use client';

/**
 * TENANT SWITCHER
 *
 * Dropdown component for super_admins to switch between developers/tenants.
 * Shows above DevelopmentSwitcher in the sidebar for hierarchical navigation:
 * - All Developers (aggregate view)
 * - Individual Developer → filters DevelopmentSwitcher to that developer's schemes
 */

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Building, ChevronDown, Check, Users } from 'lucide-react';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  house_count: number;
}

interface TenantSwitcherProps {
  selectedTenantId: string | null;
  onTenantChange: (tenantId: string | null) => void;
}

export function TenantSwitcher({ selectedTenantId, onTenantChange }: TenantSwitcherProps) {
  const { userRole } = useAuth();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Only show for super_admin
  if (userRole !== 'super_admin') {
    return null;
  }

  // Fetch tenants on mount
  useEffect(() => {
    async function fetchTenants() {
      try {
        setIsLoading(true);
        console.log('[TenantSwitcher] Fetching tenants...');
        const response = await fetch('/api/tenants');

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('[TenantSwitcher] API error:', response.status, errorData);
          throw new Error(errorData.error || 'Failed to fetch tenants');
        }

        const data = await response.json();
        console.log('[TenantSwitcher] Loaded tenants:', data.length || 0);
        setTenants(data || []);
        setError(null);
      } catch (err) {
        console.error('[TenantSwitcher] Error fetching tenants:', err);
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setIsLoading(false);
      }
    }

    fetchTenants();
  }, []);

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

  // Find current tenant
  const currentTenant = tenants.find(t => t.id === selectedTenantId);
  const displayName = currentTenant?.name || 'All Developers';

  const handleSelect = (id: string | null) => {
    console.log('[TenantSwitcher] Selecting tenant:', id || 'All Developers');
    onTenantChange(id);
    setIsOpen(false);
  };

  if (isLoading) {
    return (
      <div className="px-4 py-3 border-b border-gold-900/20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-grey-800 rounded-lg animate-pulse" />
          <div className="flex-1">
            <div className="h-3 w-16 bg-grey-800 rounded animate-pulse mb-1" />
            <div className="h-4 w-28 bg-grey-700 rounded animate-pulse" />
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
          selectedTenantId
            ? 'bg-blue-500/20 text-blue-400'
            : 'bg-purple-900/30 text-purple-400'
        }`}>
          {selectedTenantId ? (
            <Building className="w-4 h-4" />
          ) : (
            <Users className="w-4 h-4" />
          )}
        </div>
        <div className="flex-1 text-left">
          <div className="text-[10px] font-medium text-grey-500 uppercase tracking-wider">
            Developer
          </div>
          <div className="text-sm font-semibold text-white truncate">
            {displayName}
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-grey-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-4 right-4 top-full mt-1 z-50 bg-grey-900 rounded-lg shadow-lg border border-gold-900/30 py-1 max-h-64 overflow-y-auto">
          {/* All Developers option */}
          <button
            onClick={() => handleSelect(null)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gold-500/10 transition-colors ${
              !selectedTenantId ? 'bg-purple-500/20' : ''
            }`}
          >
            <div className="w-6 h-6 rounded-md bg-purple-900/30 flex items-center justify-center">
              <Users className="w-3.5 h-3.5 text-purple-400" />
            </div>
            <div className="flex-1">
              <span className="text-sm font-medium text-white">
                All Developers
              </span>
              <div className="text-[10px] text-grey-500">
                {tenants.reduce((sum, t) => sum + (t.house_count || 0), 0)} schemes total
              </div>
            </div>
            {!selectedTenantId && (
              <Check className="w-4 h-4 text-purple-400" />
            )}
          </button>

          {tenants.length > 0 && (
            <div className="border-t border-gold-900/20 my-1" />
          )}

          {/* Individual tenants/developers */}
          {tenants.map((tenant) => (
            <button
              key={tenant.id}
              onClick={() => handleSelect(tenant.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gold-500/10 transition-colors ${
                selectedTenantId === tenant.id ? 'bg-blue-500/20' : ''
              }`}
            >
              <div className={`w-6 h-6 rounded-md flex items-center justify-center ${
                tenant.house_count > 0
                  ? 'bg-blue-900/50 text-blue-400'
                  : 'bg-grey-800 text-grey-500'
              }`}>
                <Building className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white truncate">
                  {tenant.name}
                </div>
                <div className="text-[10px] text-grey-500">
                  {tenant.house_count || 0} scheme{tenant.house_count !== 1 ? 's' : ''}
                </div>
              </div>
              {selectedTenantId === tenant.id && (
                <Check className="w-4 h-4 text-blue-400 flex-shrink-0" />
              )}
            </button>
          ))}

          {tenants.length === 0 && (
            <div className="px-3 py-4 text-center text-sm text-grey-400">
              No developers found
            </div>
          )}
        </div>
      )}
    </div>
  );
}
