import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import { requireCsrf } from '@/lib/csrf';

export const dynamic = 'force-dynamic';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function POST(req: NextRequest) {
  const csrfError = requireCsrf(req);
  if (csrfError) return csrfError;

  try {
    const body = await req.json();
    const { unitId } = body;

    if (!unitId) {
      return NextResponse.json(
        { error: 'Unit ID is required' },
        { status: 400 }
      );
    }

    logger.info('[Mark Handover] Marking unit as handed over', { unitId });

    const supabase = getSupabaseAdmin();
    const now = new Date().toISOString();

    const { error: unitError } = await supabase
      .from('units')
      .update({ handover_date: now })
      .eq('id', unitId);

    if (unitError) {
      logger.error('[Mark Handover] Failed to update units table', unitError, { unitId });
      return NextResponse.json(
        { error: 'Failed to update handover status in units table' },
        { status: 500 }
      );
    }

    const { error: pipelineError } = await supabase
      .from('unit_sales_pipeline')
      .update({ handover_date: now })
      .eq('unit_id', unitId);

    if (pipelineError) {
      logger.error('[Mark Handover] Failed to update pipeline table', pipelineError, { unitId });
      return NextResponse.json(
        { error: 'Failed to update handover status in pipeline table' },
        { status: 500 }
      );
    }

    logger.info('[Mark Handover] Successfully marked unit as handed over', { unitId, handoverDate: now });

    return NextResponse.json({
      success: true,
      unitId: unitId,
      handoverDate: now,
      message: 'Unit marked as handed over'
    });
  } catch (error) {
    logger.error('[Mark Handover] Error', error);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}
