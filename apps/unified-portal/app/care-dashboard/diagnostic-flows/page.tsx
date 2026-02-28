import { requireRole } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';
import { DiagnosticFlowsClient } from './diagnostic-flows-client';

export const dynamic = 'force-dynamic';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false }, db: { schema: 'public' } }
  );
}

// Map icon name from DB to a display-friendly icon key
const iconMap: Record<string, string> = {
  'alert-triangle': 'alert-triangle',
  'zap-off': 'zap-off',
  'monitor-off': 'monitor-off',
  'volume-2': 'volume-2',
  'receipt': 'receipt',
};

// Map colour from DB to gradient classes
const colourMap: Record<string, { from: string; to: string; iconColor: string }> = {
  red: { from: 'from-red-100', to: 'to-red-200', iconColor: 'text-red-600' },
  amber: { from: 'from-amber-100', to: 'to-amber-200', iconColor: 'text-amber-600' },
  blue: { from: 'from-blue-100', to: 'to-blue-200', iconColor: 'text-blue-600' },
  purple: { from: 'from-violet-100', to: 'to-violet-200', iconColor: 'text-violet-600' },
  green: { from: 'from-emerald-100', to: 'to-emerald-200', iconColor: 'text-emerald-600' },
};

export default async function DiagnosticFlowsPage() {
  let session;
  try {
    session = await requireRole(['installer', 'installer_admin', 'super_admin']);
  } catch {
    return <DiagnosticFlowsClient flows={[]} error="You do not have permission to view this page." />;
  }

  const tenantId = session.tenantId;
  const supabase = getSupabaseAdmin();

  try {
    const { data, error: fetchError } = await supabase
      .from('diagnostic_flows')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('status', { ascending: false })
      .order('stats_started', { ascending: false });

    if (fetchError) {
      console.error('[DiagnosticFlows] Fetch error:', fetchError);
      return <DiagnosticFlowsClient flows={[]} error="Failed to load diagnostic flows." />;
    }

    const flows = (data || []).map((flow: any) => {
      const colour = colourMap[flow.colour] || colourMap.red;
      const steps = Array.isArray(flow.steps) ? flow.steps : [];
      const resolvedPct = flow.stats_started > 0
        ? Math.round((flow.stats_resolved / flow.stats_started) * 100)
        : 0;

      return {
        id: flow.id,
        name: flow.name || '',
        description: flow.description || '',
        iconKey: flow.icon || 'alert-triangle',
        iconGradientFrom: colour.from,
        iconGradientTo: colour.to,
        iconColor: colour.iconColor,
        badge: flow.status === 'live' ? 'Live' : 'Draft',
        badgeBg: flow.status === 'live' ? 'bg-emerald-50' : 'bg-gray-100',
        badgeText: flow.status === 'live' ? 'text-emerald-800' : 'text-gray-500',
        started: flow.stats_started || 0,
        resolved: `${resolvedPct}%`,
        resolvedRate: resolvedPct,
        escalated: flow.stats_escalated || 0,
        steps: steps.length,
      };
    });

    return <DiagnosticFlowsClient flows={flows} />;
  } catch (err: any) {
    console.error('[DiagnosticFlows] Error:', err);
    return <DiagnosticFlowsClient flows={[]} error="Failed to load diagnostic flows. Please refresh the page." />;
  }
}
