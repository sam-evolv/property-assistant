import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateQRTokenForUnit } from '@openhouse/api/qr-tokens';

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

    // Try to find unit by:
    // 1. Direct ID match (if it's a UUID)
    // 2. Address contains the code (e.g., "LV-PARK-003" -> look for "3" in address)
    // 3. Just get the first unit for the project if nothing matches
    
    let unit = null;
    let error = null;

    // Check if it's a UUID format
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(unitUid);
    
    if (isUUID) {
      // Direct ID lookup
      const result = await supabase
        .from('units')
        .select('id, address, purchaser_name, project_id')
        .eq('id', unitUid)
        .single();
      unit = result.data;
      error = result.error;
    }

    if (!unit) {
      // Try to extract a number from the unitUid (e.g., "LV-PARK-003" -> 3)
      const numMatch = unitUid.match(/(\d+)/);
      const unitNum = numMatch ? parseInt(numMatch[1], 10) : 1;

      // Get units for the project
      const { data: units, error: listError } = await supabase
        .from('units')
        .select('id, address, purchaser_name, project_id')
        .eq('project_id', PROJECT_ID)
        .limit(200);

      if (listError || !units || units.length === 0) {
        console.error('[Super Admin Impersonation] No units found:', listError?.message);
        return NextResponse.json({ error: 'No units found for project' }, { status: 404 });
      }

      // Find unit by matching address number (e.g., "3 Longview Park" for unit 3)
      const exactMatch = units.find(u => {
        const addrMatch = u.address?.match(/^(\d+)\s/);
        return addrMatch && parseInt(addrMatch[1], 10) === unitNum;
      });
      
      if (exactMatch) {
        unit = exactMatch;
      } else {
        // Fallback to first unit
        unit = units[0];
      }
    }

    if (!unit) {
      console.error('[Super Admin Impersonation] Unit not found');
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
    }

    // Generate signed QR token and store in database for drawing access
    // Use default tenant/development for demo (Supabase projects table doesn't have these columns)
    const projectId = unit.project_id || PROJECT_ID;
    const TENANT_ID = 'fdd1bd1a-97fa-4a1c-94b5-ae22dceb077d';
    const DEVELOPMENT_ID = '34316432-f1e8-4297-b993-d9b5c88ee2d8';
    
    const tokenResult = await generateQRTokenForUnit(
      unit.id,
      projectId,
      TENANT_ID,
      DEVELOPMENT_ID
    );

    console.log(`[Super Admin Impersonation] Found unit:`, unit.id, unit.address);
    console.log(`[Super Admin Impersonation] Token stored in database`);
    console.log(`[Super Admin Impersonation] URL:`, tokenResult.url);
    
    return NextResponse.json({ 
      url: tokenResult.url,
      unitId: unit.id,
      address: unit.address,
      purchaserName: unit.purchaser_name,
    });
  } catch (error) {
    console.error('[Impersonation API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
