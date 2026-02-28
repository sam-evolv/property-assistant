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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const installationId = searchParams.get('installation_id');

    if (!installationId) {
      return NextResponse.json(
        { error: 'installation_id query parameter is required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // 1. Look up installation to get tenant_id
    const { data: installation, error: installError } = await supabase
      .from('installations')
      .select('id, tenant_id')
      .eq('id', installationId)
      .single();

    if (installError || !installation) {
      console.error('[Care Diagnostic Flows] Installation lookup error:', installError);
      return NextResponse.json(
        { error: 'Installation not found' },
        { status: 404 }
      );
    }

    // 2. Fetch diagnostic_flows for this tenant where status is 'live'
    const { data: flows, error: flowsError } = await supabase
      .from('diagnostic_flows')
      .select('id, name, description, icon, colour, system_type, steps, stats_started, stats_resolved, stats_escalated, created_at')
      .eq('tenant_id', installation.tenant_id)
      .eq('status', 'live')
      .order('created_at', { ascending: true });

    if (flowsError) {
      console.error('[Care Diagnostic Flows] Flows fetch error:', flowsError);
      return NextResponse.json(
        { error: 'Failed to fetch diagnostic flows' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      flows: flows || [],
    });
  } catch (error) {
    console.error('[Care Diagnostic Flows] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
