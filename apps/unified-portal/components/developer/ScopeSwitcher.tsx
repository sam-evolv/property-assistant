'use client';

/**
 * SCOPE SWITCHER
 *
 * Combined component that shows hierarchical navigation for super_admin:
 * - TenantSwitcher (Developer dropdown) - only for super_admin
 * - DevelopmentSwitcher (Scheme dropdown) - for all users
 *
 * For non-super_admin users, only shows DevelopmentSwitcher.
 * For super_admin users, shows both with TenantSwitcher filtering DevelopmentSwitcher.
 */

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { TenantSwitcher } from './TenantSwitcher';
import { DevelopmentSwitcher } from './DevelopmentSwitcher';

export function ScopeSwitcher() {
  const { userRole } = useAuth();
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);

  const isSuperAdmin = userRole === 'super_admin';

  const handleTenantChange = (tenantId: string | null) => {
    console.log('[ScopeSwitcher] Tenant changed:', tenantId || 'All Developers');
    setSelectedTenantId(tenantId);
  };

  return (
    <div>
      {/* Show TenantSwitcher for super_admin */}
      {isSuperAdmin && (
        <TenantSwitcher
          selectedTenantId={selectedTenantId}
          onTenantChange={handleTenantChange}
        />
      )}

      {/* Show DevelopmentSwitcher for all users */}
      {/* For super_admin, filter by selected tenant. For others, API handles filtering */}
      <DevelopmentSwitcher
        tenantFilter={isSuperAdmin ? selectedTenantId : undefined}
      />
    </div>
  );
}
