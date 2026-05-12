/**
 * GET /api/care/service-records?installation_id=X
 * Returns service records for a given installation, ordered by date descending.
 *
 * Homeowner-side route (called from /care/[installationId]/ServiceScreen).
 * Auth model deferred to Batch 2: homeowner session design. Until then this
 * route trusts installationId from the query string. The structural cross-
 * check applied to the chat route in Batch 1.3 will extend to this route in
 * Batch 2.
 */

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

    const { data: records, error } = await supabase
      .from('service_records')
      .select('id, service_date, service_type, engineer_name, outcome, warranty_validated, notes')
      .eq('installation_id', installationId)
      .order('service_date', { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch service records' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      records: records || [],
      count: records?.length || 0,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch service records' },
      { status: 500 }
    );
  }
}
