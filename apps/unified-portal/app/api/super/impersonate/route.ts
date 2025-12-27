import { NextRequest, NextResponse } from 'next/server';
import { generateQRTokenForUnit } from '@openhouse/api/qr-tokens';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const unitUid = searchParams.get('unitUid');

    if (!unitUid) {
      return NextResponse.json({ error: 'Missing unitUid' }, { status: 400 });
    }

    console.log('[Super Admin Impersonation] Looking up unit:', unitUid);

    const supabase = getSupabaseAdmin();
    let unit: any = null;

    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(unitUid);
    
    if (isUUID) {
      const { data } = await supabase
        .from('units')
        .select('id, unit_uid, project_id, address_line_1, purchaser_name, projects(tenant_id, name)')
        .eq('id', unitUid)
        .single();
      if (data) {
        unit = {
          id: data.id,
          unit_uid: data.unit_uid,
          development_id: data.project_id,
          address: data.address_line_1,
          purchaser_name: data.purchaser_name,
          tenant_id: (data.projects as any)?.tenant_id,
          development_name: (data.projects as any)?.name,
        };
      }
    }

    if (!unit) {
      // Try by unit_uid or find first available unit
      const { data: unitByUid } = await supabase
        .from('units')
        .select('id, unit_uid, project_id, address_line_1, purchaser_name, projects(tenant_id, name)')
        .eq('unit_uid', unitUid)
        .single();
      
      if (unitByUid) {
        unit = {
          id: unitByUid.id,
          unit_uid: unitByUid.unit_uid,
          development_id: unitByUid.project_id,
          address: unitByUid.address_line_1,
          purchaser_name: unitByUid.purchaser_name,
          tenant_id: (unitByUid.projects as any)?.tenant_id,
          development_name: (unitByUid.projects as any)?.name,
        };
      } else {
        // Fallback: get any unit from the first project
        const { data: anyUnits } = await supabase
          .from('units')
          .select('id, unit_uid, project_id, address_line_1, purchaser_name, projects(tenant_id, name)')
          .limit(10);
        
        if (anyUnits && anyUnits.length > 0) {
          const numMatch = unitUid.match(/(\d+)/);
          const unitNum = numMatch ? parseInt(numMatch[1], 10) : 1;
          
          const exactMatch = anyUnits.find((u: any) => {
            const addrMatch = u.address_line_1?.match(/^(\d+)\s/);
            return addrMatch && parseInt(addrMatch[1], 10) === unitNum;
          });
          
          const selected = exactMatch || anyUnits[0];
          unit = {
            id: selected.id,
            unit_uid: selected.unit_uid,
            development_id: selected.project_id,
            address: selected.address_line_1,
            purchaser_name: selected.purchaser_name,
            tenant_id: (selected.projects as any)?.tenant_id,
            development_name: (selected.projects as any)?.name,
          };
        }
      }
    }

    if (!unit) {
      console.error('[Super Admin Impersonation] Unit not found');
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
    }

    const tenantId = unit.tenant_id;
    const developmentId = unit.development_id;
    
    if (!tenantId || !developmentId) {
      console.error('[Super Admin Impersonation] Missing tenant_id or development_id:', { tenantId, developmentId });
      return NextResponse.json({ 
        error: 'Development not found. Unit may not be properly configured.' 
      }, { status: 404 });
    }
    console.log('[Super Admin Impersonation] Resolved development:', developmentId, 'tenant:', tenantId);
    
    const tokenResult = await generateQRTokenForUnit(
      unit.id,
      developmentId,
      tenantId,
      developmentId
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
