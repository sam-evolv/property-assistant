import { NextResponse } from 'next/server';
import {
  CareAuthError,
  careAuthErrorToResponse,
  requireCareTenantSession,
} from '@/lib/care/require-care-session';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { supabase, session } = await requireCareTenantSession();

    const { data, error } = await supabase
      .from('diagnostic_flows')
      .select(`
        id,
        name,
        description,
        system_type,
        status,
        icon,
        colour,
        steps,
        stats_started,
        stats_resolved,
        stats_escalated,
        created_at,
        updated_at,
        tenant_id
      `)
      .eq('tenant_id', session.tenantId)
      .order('stats_started', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const flows = (data || []).map((f: Record<string, unknown>) => {
      const steps = f.steps as unknown[] | null;
      return {
        id: f.id,
        flow_name: f.name,
        description: f.description,
        system_type: f.system_type,
        step_count: Array.isArray(steps) ? steps.length : 0,
        times_triggered: (f.stats_started as number) || 0,
        updated_at: f.updated_at,
      };
    });

    return NextResponse.json({ flows });
  } catch (error) {
    if (error instanceof CareAuthError) return careAuthErrorToResponse(error);
    return NextResponse.json({ error: 'Failed to fetch diagnostic flows' }, { status: 500 });
  }
}
