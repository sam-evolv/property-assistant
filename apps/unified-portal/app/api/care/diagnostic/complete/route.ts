import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { installation_id, diagnostic_flow_id, steps_completed, outcome, completed_at_step } = body;

    // Validate required fields
    if (!installation_id || !diagnostic_flow_id || !outcome) {
      return NextResponse.json(
        { error: 'installation_id, diagnostic_flow_id, and outcome are required' },
        { status: 400 }
      );
    }

    if (!['resolved', 'escalated'].includes(outcome)) {
      return NextResponse.json(
        { error: 'outcome must be either "resolved" or "escalated"' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // 1. Look up installation to get tenant_id
    const { data: installation, error: installError } = await supabase
      .from('installations')
      .select('id, tenant_id, system_type, inverter_model, customer_name')
      .eq('id', installation_id)
      .single();

    if (installError || !installation) {
      console.error('[Care Diagnostic Complete] Installation lookup error:', installError);
      return NextResponse.json(
        { error: 'Installation not found' },
        { status: 404 }
      );
    }

    const tenantId = installation.tenant_id;

    // 2. Insert into diagnostic_completions
    const { data: completion, error: completionError } = await supabase
      .from('diagnostic_completions')
      .insert({
        diagnostic_flow_id,
        installation_id,
        tenant_id: tenantId,
        steps_completed: steps_completed || [],
        outcome,
        completed_at_step: completed_at_step ?? null,
      })
      .select('id')
      .single();

    if (completionError) {
      console.error('[Care Diagnostic Complete] Insert error:', completionError);
      return NextResponse.json(
        { error: 'Failed to log diagnostic completion' },
        { status: 500 }
      );
    }

    // 3. Update diagnostic_flows stats
    // Fetch current stats first to increment
    const { data: flow, error: flowFetchError } = await supabase
      .from('diagnostic_flows')
      .select('stats_started, stats_resolved, stats_escalated')
      .eq('id', diagnostic_flow_id)
      .single();

    if (flowFetchError || !flow) {
      console.error('[Care Diagnostic Complete] Flow lookup error:', flowFetchError);
      // Non-blocking: completion was logged, stats update is best-effort
    } else {
      const statsUpdate: Record<string, number> = {
        stats_started: (flow.stats_started || 0) + 1,
      };

      if (outcome === 'resolved') {
        statsUpdate.stats_resolved = (flow.stats_resolved || 0) + 1;
      } else if (outcome === 'escalated') {
        statsUpdate.stats_escalated = (flow.stats_escalated || 0) + 1;
      }

      const { error: statsError } = await supabase
        .from('diagnostic_flows')
        .update(statsUpdate)
        .eq('id', diagnostic_flow_id);

      if (statsError) {
        console.error('[Care Diagnostic Complete] Stats update error:', statsError);
      }
    }

    // 4. If escalated, create an escalation record
    let escalationId: string | undefined;

    if (outcome === 'escalated') {
      // Fetch the flow name for the escalation title
      const { data: flowInfo } = await supabase
        .from('diagnostic_flows')
        .select('name')
        .eq('id', diagnostic_flow_id)
        .single();

      const flowName = flowInfo?.name || 'Diagnostic Flow';

      const { data: escalation, error: escalationError } = await supabase
        .from('escalations')
        .insert({
          installation_id,
          tenant_id: tenantId,
          title: `Escalation from diagnostic: ${flowName}`,
          description: `Customer completed the "${flowName}" diagnostic flow and the issue was not resolved. Steps completed: ${JSON.stringify(steps_completed || [])}`,
          priority: 'medium',
          status: 'open',
          diagnostic_context: {
            diagnostic_flow_id,
            steps_completed: steps_completed || [],
            completed_at_step: completed_at_step ?? null,
            system: installation.inverter_model || installation.system_type,
          },
        })
        .select('id')
        .single();

      if (escalationError) {
        console.error('[Care Diagnostic Complete] Escalation creation error:', escalationError);
      } else if (escalation) {
        escalationId = escalation.id;
      }
    }

    return NextResponse.json({
      success: true,
      ...(escalationId ? { escalation_id: escalationId } : {}),
    });
  } catch (error) {
    console.error('[Care Diagnostic Complete] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
