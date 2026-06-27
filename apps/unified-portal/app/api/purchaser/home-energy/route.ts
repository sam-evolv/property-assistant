import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validatePurchaserToken } from '@openhouse/api/qr-tokens';

export const dynamic = 'force-dynamic';

// Service-role client, same pattern as the other purchaser API routes.
function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return createClient(url!, key!);
}

// Returns the seeded My Home energy showcase for a unit, if one exists.
// Reads units.metadata->'demo_home' only and returns nothing else from the row.
// A unit with no demo_home gets { energy: null } (HTTP 200) so the tab can
// degrade quietly to the slim view instead of surfacing an error.
export async function GET(request: NextRequest) {
  const supabase = getSupabaseClient();
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const unitUid = searchParams.get('unitUid');

    if (!unitUid) {
      return NextResponse.json({ error: 'Unit UID required' }, { status: 400 });
    }

    // Validate using the shared purchaser authentication, same as important-docs-status.
    const tokenResult = await validatePurchaserToken(token || unitUid, unitUid);
    if (!tokenResult.valid) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }
    const supabaseUnitId = tokenResult.unitId || unitUid;

    const { data: unitData, error: unitError } = await supabase
      .from('units')
      .select('metadata')
      .eq('id', supabaseUnitId)
      .single();

    if (unitError || !unitData) {
      return NextResponse.json({ energy: null });
    }

    const metadata = (unitData.metadata as Record<string, unknown> | null) || {};
    // Only the demo_home object is ever returned. No other metadata leaks out.
    const energy = (metadata.demo_home as unknown) ?? null;

    return NextResponse.json({ energy });
  } catch {
    // Fail quiet: the tab treats a null payload as "no energy data".
    return NextResponse.json({ energy: null });
  }
}
