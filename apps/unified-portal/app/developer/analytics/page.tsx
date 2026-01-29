import { requireRole } from '@/lib/supabase-server';
import AnalyticsClient from './analytics-client';
import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false },
      db: { schema: 'public' }
    }
  );
}

export default async function DeveloperAnalyticsPage() {
  const session = await requireRole(['developer', 'admin', 'super_admin']);
  const tenantId = session.tenantId;

  // SECURITY: Require tenant context
  if (!tenantId) {
    console.error('[AnalyticsPage] SECURITY: No tenant context');
    return (
      <AnalyticsClient
        tenantId=""
        serverHomeownerCount={0}
        serverHomeownersByProject={{}}
      />
    );
  }

  // Fetch homeowner counts server-side - SAME approach as Homeowners page.tsx
  // SECURITY: Filter by tenant_id to prevent cross-tenant data leakage
  const supabaseAdmin = getSupabaseAdmin();

  let totalHomeowners = 0;
  let homeownersByProject: Record<string, number> = {};

  try {
    // SECURITY: Filter by tenant_id unconditionally
    const { data: units, error } = await supabaseAdmin
      .from('units')
      .select('id, project_id')
      .eq('tenant_id', tenantId);

    if (error) {
      console.error('[AnalyticsPage] Error fetching units:', error);
    } else {
      totalHomeowners = units?.length || 0;

      // Group by project
      (units || []).forEach(u => {
        const pid = u.project_id || 'unknown';
        homeownersByProject[pid] = (homeownersByProject[pid] || 0) + 1;
      });

      console.log('[AnalyticsPage] Loaded homeowner counts from Supabase for tenant:', tenantId, {
        total: totalHomeowners,
        byProject: homeownersByProject
      });
    }
  } catch (error) {
    console.error('[AnalyticsPage] Failed to fetch units:', error);
  }

  return (
    <AnalyticsClient
      tenantId={session.tenantId}
      serverHomeownerCount={totalHomeowners}
      serverHomeownersByProject={homeownersByProject}
    />
  );
}
