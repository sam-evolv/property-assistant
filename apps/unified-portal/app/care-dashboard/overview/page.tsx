import { requireRole } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';
import { CareOverviewClient } from './overview-client';

export const dynamic = 'force-dynamic';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false }, db: { schema: 'public' } }
  );
}

export default async function CareOverviewPage() {
  let session;
  try {
    session = await requireRole(['installer', 'installer_admin', 'super_admin']);
  } catch {
    return <CareOverviewClient totalInstallations={0} portalActive={0} queriesThisWeek={0} aiResolved={0} openEscalations={0} recentActivity={[]} topIssues={[]} error="You do not have permission to view this page." />;
  }

  const tenantId = session.tenantId;
  const supabase = getSupabaseAdmin();

  try {
    // Total installations count
    const { count: totalInstallations } = await supabase
      .from('installations')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId);

    // Portal active count
    const { count: portalActive } = await supabase
      .from('installations')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('portal_status', 'active');

    // Queries this week
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoISO = sevenDaysAgo.toISOString();

    const { count: queriesThisWeek } = await supabase
      .from('support_queries')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .gte('created_at', sevenDaysAgoISO);

    // AI resolved count (resolved = true AND escalated = false, last 7 days)
    const { count: aiResolved } = await supabase
      .from('support_queries')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('resolved', true)
      .eq('escalated', false)
      .gte('created_at', sevenDaysAgoISO);

    // Open escalations
    const { count: openEscalations } = await supabase
      .from('escalations')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .in('status', ['open', 'assigned', 'scheduled']);

    // Recent activity: support_queries joined with installations
    const { data: recentActivityData } = await supabase
      .from('support_queries')
      .select('query_text, created_at, escalated, resolved, installation_id, installations(customer_name)')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(10);

    const recentActivity = (recentActivityData || []).map((q: any) => ({
      query_text: q.query_text || '',
      created_at: q.created_at || '',
      customer_name: q.installations?.customer_name || 'Unknown',
      escalated: q.escalated ?? false,
      resolved: q.resolved ?? true,
    }));

    // Top issues: group by query_category
    const { data: queryCategoryData } = await supabase
      .from('support_queries')
      .select('query_category')
      .eq('tenant_id', tenantId)
      .not('query_category', 'is', null);

    const categoryCounts: Record<string, number> = {};
    (queryCategoryData || []).forEach((q: any) => {
      if (q.query_category) {
        categoryCounts[q.query_category] = (categoryCounts[q.query_category] || 0) + 1;
      }
    });
    const topIssues = Object.entries(categoryCounts)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);

    return (
      <CareOverviewClient
        totalInstallations={totalInstallations ?? 0}
        portalActive={portalActive ?? 0}
        queriesThisWeek={queriesThisWeek ?? 0}
        aiResolved={aiResolved ?? 0}
        openEscalations={openEscalations ?? 0}
        recentActivity={recentActivity}
        topIssues={topIssues}
      />
    );
  } catch (err: any) {
    console.error('[CareOverview] Error fetching data:', err);
    return (
      <CareOverviewClient
        totalInstallations={0}
        portalActive={0}
        queriesThisWeek={0}
        aiResolved={0}
        openEscalations={0}
        recentActivity={[]}
        topIssues={[]}
        error="Failed to load overview data. Please refresh the page."
      />
    );
  }
}
