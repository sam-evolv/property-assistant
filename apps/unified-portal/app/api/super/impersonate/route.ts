import { NextRequest, NextResponse } from 'next/server';
import { signQRToken } from '@openhouse/api/qr-tokens';
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
        .select('id, project_id, address, purchaser_name')
        .eq('id', unitUid)
        .single();
      if (data) {
        // Get project info separately
        const { data: project } = await supabase
          .from('projects')
          .select('id, name, developer_id')
          .eq('id', data.project_id)
          .single();
        unit = {
          id: data.id,
          development_id: data.project_id,
          address: data.address,
          purchaser_name: data.purchaser_name,
          tenant_id: project?.developer_id || data.project_id,
          development_name: project?.name,
        };
      }
    }

    if (!unit) {
      // Fallback: get any unit from Supabase
      const { data: anyUnits, error: anyError } = await supabase
        .from('units')
        .select('id, project_id, address, purchaser_name')
        .limit(10);
      
      console.log('[Super Admin Impersonation] fallback units:', anyUnits?.length || 0, 'error:', anyError?.message || 'none');
      if (anyUnits && anyUnits.length > 0) {
        console.log('[Super Admin Impersonation] first unit sample:', JSON.stringify(anyUnits[0], null, 2));
      }
      
      if (anyUnits && anyUnits.length > 0) {
        const numMatch = unitUid.match(/(\d+)/);
        const unitNum = numMatch ? parseInt(numMatch[1], 10) : 1;
        
        const exactMatch = anyUnits.find((u: any) => {
          const addrMatch = u.address?.match(/^(\d+)\s/);
          return addrMatch && parseInt(addrMatch[1], 10) === unitNum;
        });
        
        const selected = exactMatch || anyUnits[0];
        const { data: project } = await supabase
          .from('projects')
          .select('id, name, developer_id')
          .eq('id', selected.project_id)
          .single();
        unit = {
          id: selected.id,
          development_id: selected.project_id,
          address: selected.address,
          purchaser_name: selected.purchaser_name,
          tenant_id: project?.developer_id || selected.project_id,
          development_name: project?.name,
        };
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
    
    // Use signQRToken directly (no DB storage needed for demo)
    const tokenResult = signQRToken({
      supabaseUnitId: unit.id,
      projectId: developmentId,
    });

    console.log(`[Super Admin Impersonation] Found unit:`, unit.id, unit.address);
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
