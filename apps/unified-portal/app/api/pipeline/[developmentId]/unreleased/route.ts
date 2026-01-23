/**
 * Sales Pipeline API - Unreleased Units
 *
 * GET /api/pipeline/[developmentId]/unreleased
 * Get all units that haven't been released yet (no release_date)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ developmentId: string }> }
) {
  try {
    const { developmentId } = await params;
    const session = await requireRole(['developer', 'admin', 'super_admin']);
    const tenantId = session.tenantId;

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant context required' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    // Get all units for this development
    const { data: allUnits, error: unitsError } = await supabaseAdmin
      .from('units')
      .select('id, unit_number, address')
      .eq('tenant_id', tenantId)
      .eq('development_id', developmentId)
      .order('unit_number', { ascending: true });

    if (unitsError) {
      console.error('[Pipeline Unreleased API] Error fetching units:', unitsError);
      return NextResponse.json({ error: 'Failed to fetch units' }, { status: 500 });
    }

    if (!allUnits || allUnits.length === 0) {
      return NextResponse.json({ units: [] });
    }

    // Get all pipeline records for this development that have a release_date
    const { data: releasedPipelines, error: pipelineError } = await supabaseAdmin
      .from('unit_sales_pipeline')
      .select('unit_id')
      .eq('tenant_id', tenantId)
      .eq('development_id', developmentId)
      .not('release_date', 'is', null);

    if (pipelineError) {
      console.error('[Pipeline Unreleased API] Error fetching pipelines:', pipelineError);
    }

    // Get set of released unit IDs
    const releasedUnitIds = new Set((releasedPipelines || []).map(p => p.unit_id));

    // Filter to only unreleased units
    const unreleasedUnits = allUnits.filter(unit => !releasedUnitIds.has(unit.id));

    // Format response
    const formattedUnits = unreleasedUnits.map(unit => ({
      id: unit.id,
      unitNumber: unit.unit_number,
      address: unit.address || '',
    }));

    return NextResponse.json({ units: formattedUnits });
  } catch (error) {
    console.error('[Pipeline Unreleased API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
