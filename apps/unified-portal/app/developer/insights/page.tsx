import { requireRole } from '@/lib/supabase-server';
import InsightsClient from './insights-client';
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

export default async function DeveloperInsightsPage() {
  const session = await requireRole(['developer', 'admin', 'super_admin']);

  // Fetch homeowner counts server-side - SAME approach as Homeowners page.tsx
  // This is the source of truth that shows 171 homeowners
  const supabaseAdmin = getSupabaseAdmin();

  let totalHomeowners = 0;
  let homeownersByProject: Record<string, number> = {};

  try {
    const { data: units, error } = await supabaseAdmin
      .from('units')
      .select('id, project_id');

    if (error) {
      // error fetching units
    } else {
      totalHomeowners = units?.length || 0;

      // Group by project
      (units || []).forEach(u => {
        const pid = u.project_id || 'unknown';
        homeownersByProject[pid] = (homeownersByProject[pid] || 0) + 1;
      });

    }
  } catch (error) {
    // failed to fetch units
  }

  return (
    <InsightsClient
      tenantId={session.tenantId}
      serverHomeownerCount={totalHomeowners}
      serverHomeownersByProject={homeownersByProject}
    />
  );
}
