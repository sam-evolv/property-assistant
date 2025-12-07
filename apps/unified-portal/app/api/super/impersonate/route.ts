import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PROJECT_ID = '57dc3919-2725-4575-8046-9179075ac88e';
const BASE_URL = process.env.REPLIT_DEV_DOMAIN 
  ? `https://${process.env.REPLIT_DEV_DOMAIN}` 
  : 'https://84141d02-f316-41eb-8d70-a45b1b91c63c-00-140og66wspdkl.riker.replit.dev';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const unitUid = searchParams.get('unitUid');

    if (!unitUid) {
      return NextResponse.json({ error: 'Missing unitUid' }, { status: 400 });
    }

    console.log('[Super Admin Impersonation] Looking up unit:', unitUid);

    // Fetch unit from Supabase by unit_uid OR by id
    const { data: unit, error } = await supabase
      .from('units')
      .select('id, unit_uid, address, purchaser_name, project_id')
      .or(`unit_uid.eq.${unitUid},id.eq.${unitUid}`)
      .limit(1)
      .single();

    if (error || !unit) {
      console.error('[Super Admin Impersonation] Unit not found:', error?.message);
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
    }

    // Generate a simple URL - no complex token needed for testing
    // Just direct link to the homes page with the unit ID
    const url = `${BASE_URL}/homes/${unit.id}`;

    console.log(`[Super Admin Impersonation] Generated URL for unit ${unitUid}:`, url);
    
    return NextResponse.json({ 
      url,
      unitId: unit.id,
      unitUid: unit.unit_uid,
      address: unit.address,
      purchaserName: unit.purchaser_name,
    });
  } catch (error) {
    console.error('[Impersonation API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
