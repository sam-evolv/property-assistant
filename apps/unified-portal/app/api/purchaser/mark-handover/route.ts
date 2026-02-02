import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
    console.error('[Mark Handover] Error:', error);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}
