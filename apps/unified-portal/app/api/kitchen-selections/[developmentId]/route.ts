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

const COUNTER_TYPES = [
  { value: 'CT1', label: 'CT1 - Show House Counter' },
  { value: 'CT2', label: 'CT2 - White with Gold/Black Vein' },
  { value: 'CT3', label: 'CT3 - Wood' },
  { value: 'CT4', label: 'CT4 - Black/Yellow' },
  { value: 'CT5', label: 'CT5 - Grey Counter' },
  { value: 'CT6', label: 'CT6 - White with Brown Vein' },
];

const CABINET_COLORS = ['Green', 'Charcoal', 'Navy', 'White', 'Dust Grey', 'Light Grey'];

const HANDLE_STYLES = [
  'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'H7', 'H8',
  'H9', 'H10', 'H11', 'H12', 'H13', 'H14', 'H15', 'H16'
];

interface KitchenUnit {
  id: string;
  unitId: string;
  unitNumber: string;
  address: string | null;
  purchaserName: string | null;
  houseType: string;
  bedrooms: number;
  hasKitchen: boolean | null;
  counterType: string | null;
  cabinetColor: string | null;
  handleStyle: string | null;
  hasWardrobe: boolean | null;
  notes: string | null;
  kitchenDate: string | null;
  status: 'complete' | 'pending' | 'none';
  pcSumKitchen: number;
  pcSumWardrobes: number;
  pcSumTotal: number;
}

function calculatePCSum(bedrooms: number, hasKitchen: boolean | null, hasWardrobe: boolean | null) {
  const kitchen4Bed = 7000;
  const kitchen3Bed = 6000;
  const kitchen2Bed = 5000;
  const wardrobeAllowance = 1000;
  
  let kitchenAllowance = kitchen2Bed;
  if (bedrooms >= 4) kitchenAllowance = kitchen4Bed;
  else if (bedrooms === 3) kitchenAllowance = kitchen3Bed;
  
  const kitchenImpact = hasKitchen === false ? -kitchenAllowance : 0;
  const wardrobeImpact = hasWardrobe === false ? -wardrobeAllowance : 0;
  
  return {
    pcSumKitchen: kitchenImpact,
    pcSumWardrobes: wardrobeImpact,
    pcSumTotal: kitchenImpact + wardrobeImpact,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ developmentId: string }> }
) {
  try {
    const { developmentId } = await params;
    console.log('[Kitchen Selections API] GET request for development:', developmentId);
    
    const session = await requireRole(['developer', 'admin', 'super_admin']);
    const tenantId = session.tenantId;

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant context required' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const url = new URL(request.url);
    const devName = url.searchParams.get('name');

    const { data: allDevs } = await supabaseAdmin
      .from('developments')
      .select('id, name, code')
      .eq('tenant_id', tenantId);

    let development = allDevs?.find(d => d.id === developmentId);
    let actualDevelopmentId = developmentId;
    
    if (!development && devName && allDevs) {
      development = allDevs.find(d => d.name.toLowerCase() === devName.toLowerCase());
      if (development) actualDevelopmentId = development.id;
    }
    
    if (!development && allDevs && allDevs.length > 0) {
      development = allDevs[0];
      actualDevelopmentId = allDevs[0].id;
    }

    if (!development) {
      return NextResponse.json({ error: 'No developments available' }, { status: 404 });
    }

    const { data: supabaseUnits, error: unitsError } = await supabaseAdmin
      .from('units')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('development_id', actualDevelopmentId)
      .order('unit_number', { ascending: true });
    
    if (unitsError) {
      console.error('[Kitchen Selections API] Units query error:', unitsError);
    }
    const allUnits = supabaseUnits || [];

    const { data: pipelineData, error: pipelineError } = await supabaseAdmin
      .from('unit_sales_pipeline')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('development_id', actualDevelopmentId);
    
    if (pipelineError) {
      console.error('[Kitchen Selections API] Pipeline query error:', pipelineError);
    }
    
    const pipelineMap = new Map((pipelineData || []).map(p => [p.unit_id, p]));

    const kitchenUnits: KitchenUnit[] = allUnits.map(unit => {
      const pipeline = pipelineMap.get(unit.id);
      
      const hasKitchen = pipeline?.kitchen_selected ?? null;
      const hasWardrobe = pipeline?.kitchen_wardrobes ?? null;
      const bedrooms = unit.bedrooms || 3;
      
      const hasKitchenDetails = pipeline?.kitchen_counter && pipeline?.kitchen_cabinet && pipeline?.kitchen_handle;
      
      let status: 'complete' | 'pending' | 'none' = 'none';
      if (hasKitchen === true && hasKitchenDetails) {
        status = 'complete';
      } else if (hasKitchen === false) {
        status = 'complete';
      } else if (hasKitchen === true || hasWardrobe !== null || pipeline?.kitchen_notes) {
        status = 'pending';
      }

      const pcSum = calculatePCSum(bedrooms, hasKitchen, hasWardrobe);

      return {
        id: pipeline?.id || '',
        unitId: unit.id,
        unitNumber: unit.unit_number,
        address: `${unit.unit_number} ${development.name}`,
        purchaserName: pipeline?.purchaser_name || unit.purchaser_name,
        houseType: unit.house_type_code,
        bedrooms: bedrooms,
        hasKitchen: hasKitchen,
        counterType: pipeline?.kitchen_counter || null,
        cabinetColor: pipeline?.kitchen_cabinet || null,
        handleStyle: pipeline?.kitchen_handle || null,
        hasWardrobe: hasWardrobe,
        notes: pipeline?.kitchen_notes || null,
        kitchenDate: pipeline?.kitchen_date || null,
        status,
        pcSumKitchen: pcSum.pcSumKitchen,
        pcSumWardrobes: pcSum.pcSumWardrobes,
        pcSumTotal: pcSum.pcSumTotal,
      };
    });

    const totalPcSumImpact = kitchenUnits.reduce((sum, u) => sum + u.pcSumTotal, 0);
    const takingKitchen = kitchenUnits.filter(u => u.hasKitchen === true).length;
    const takingOwnKitchen = kitchenUnits.filter(u => u.hasKitchen === false).length;
    const decidedCount = takingKitchen + takingOwnKitchen;
    const pendingCount = kitchenUnits.filter(u => u.status === 'pending').length;

    return NextResponse.json({
      development: {
        id: development.id,
        name: development.name,
        code: development.code,
      },
      units: kitchenUnits,
      options: {
        counterTypes: COUNTER_TYPES,
        cabinetColors: CABINET_COLORS,
        handleStyles: HANDLE_STYLES,
      },
      summary: {
        total: allUnits.length,
        decided: decidedCount,
        takingKitchen,
        takingOwnKitchen,
        pending: pendingCount,
        totalPcSumImpact,
      },
    });
  } catch (error: any) {
    console.error('[Kitchen Selections API] Error:', error);
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
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

    const url = new URL(request.url);
    const devName = url.searchParams.get('name');

    const body = await request.json();
    const { unitId, field, value } = body;

    if (!unitId || !field) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const { data: allDevs } = await supabaseAdmin
      .from('developments')
      .select('id, name')
      .eq('tenant_id', tenantId);

    let actualDevelopmentId = developmentId;
    let development = allDevs?.find(d => d.id === developmentId);
    
    if (!development && devName && allDevs) {
      development = allDevs.find(d => d.name.toLowerCase() === devName.toLowerCase());
      if (development) actualDevelopmentId = development.id;
    }
    
    if (!development && allDevs && allDevs.length > 0) {
      development = allDevs[0];
      actualDevelopmentId = allDevs[0].id;
    }

    const { data: existingUnit, error: unitError } = await supabaseAdmin
      .from('units')
      .select('id')
      .eq('id', unitId)
      .eq('tenant_id', tenantId)
      .single();

    if (unitError || !existingUnit) {
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
    }

    const { data: existing } = await supabaseAdmin
      .from('unit_sales_pipeline')
      .select('id')
      .eq('unit_id', unitId)
      .single();

    const fieldMap: Record<string, string> = {
      hasKitchen: 'kitchen_selected',
      counterType: 'kitchen_counter',
      cabinetColor: 'kitchen_cabinet',
      handleStyle: 'kitchen_handle',
      hasWardrobe: 'kitchen_wardrobes',
      notes: 'kitchen_notes',
    };

    const dbField = fieldMap[field];
    if (!dbField) {
      return NextResponse.json({ error: 'Invalid field' }, { status: 400 });
    }

    const updateData: Record<string, any> = {
      [dbField]: value,
      kitchen_updated_at: new Date().toISOString(),
    };

    if (field === 'hasKitchen' && value === true) {
      updateData.kitchen_date = new Date().toISOString();
    }

    let result;
    if (existing) {
      const { data, error } = await supabaseAdmin
        .from('unit_sales_pipeline')
        .update(updateData)
        .eq('id', existing.id)
        .select()
        .single();
      
      if (error) {
        console.error('[Kitchen Selections API] Update error:', error);
        return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
      }
      result = data;
    } else {
      const { data, error } = await supabaseAdmin
        .from('unit_sales_pipeline')
        .insert({
          tenant_id: tenantId,
          development_id: actualDevelopmentId,
          unit_id: unitId,
          ...updateData,
        })
        .select()
        .single();
      
      if (error) {
        console.error('[Kitchen Selections API] Insert error:', error);
        return NextResponse.json({ error: 'Failed to create' }, { status: 500 });
      }
      result = data;
    }

    return NextResponse.json({ success: true, selection: result });
  } catch (error: any) {
    console.error('[Kitchen Selections API] Update Error:', error);
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
