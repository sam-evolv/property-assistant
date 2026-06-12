import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireRole } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function POST(req: NextRequest) {
  try {
    // Require admin authentication to mark handover
    const session = await requireRole(['developer', 'admin', 'super_admin']);

    const body = await req.json();
    const { unitId } = body;

    if (!unitId) {
      return NextResponse.json(
        { error: 'Unit ID is required' },
        { status: 400 }
      );
    }

    console.log('[Mark Handover] Marking unit as handed over:', unitId);

    const supabase = getSupabaseAdmin();

    // SECURITY: verify the unit belongs to the session tenant before updating (super_admin exempt)
    // tenant-scope: unit fetched by id, tenant_id compared against session tenant
    const { data: unit, error: unitFetchError } = await supabase
      .from('units')
      .select('id, tenant_id')
      .eq('id', unitId)
      .single();

    if (unitFetchError || !unit) {
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
    }

    if (session.role !== 'super_admin' && unit.tenant_id !== session.tenantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const now = new Date().toISOString();

    const { error: unitError } = await supabase
      .from('units')
      .update({ handover_date: now })
      .eq('id', unitId);

    if (unitError) {
      console.error('[Mark Handover] Failed to update units table:', unitError);
    }

    const { error: pipelineError } = await supabase
      .from('unit_sales_pipeline')
      .update({ handover_date: now })
      .eq('unit_id', unitId);

    if (pipelineError) {
      console.error('[Mark Handover] Failed to update pipeline table:', pipelineError);
    }

    if (unitError && pipelineError) {
      return NextResponse.json(
        { error: 'Failed to update handover status' },
        { status: 500 }
      );
    }

    console.log('[Mark Handover] Successfully marked unit as handed over:', unitId, 'at', now);

    return NextResponse.json({
      success: true,
      unitId: unitId,
      handoverDate: now,
      message: 'Unit marked as handed over'
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[Mark Handover] Error:', error);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}
