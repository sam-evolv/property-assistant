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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ developmentId: string; unitId: string }> }
) {
  try {
    const { developmentId, unitId } = await params;
    const session = await requireRole(['developer', 'admin', 'super_admin']);
    const tenantId = session.tenantId;

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant context required' }, { status: 400 });
    }

    const body = await request.json();
    const supabase = getSupabaseAdmin();

    const fieldMap: Record<string, string> = {
      hasKitchen: 'kitchen_selected',
      counterType: 'kitchen_counter',
      cabinetColor: 'kitchen_cabinet',
      handleStyle: 'kitchen_handle',
      hasWardrobe: 'kitchen_wardrobes',
      notes: 'kitchen_notes',
    };

    const updates: Record<string, any> = {};
    for (const [key, value] of Object.entries(body)) {
      const dbField = fieldMap[key];
      if (dbField) {
        updates[dbField] = value;
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    updates.kitchen_updated_at = new Date().toISOString();

    const { data: existing } = await supabase
      .from('unit_sales_pipeline')
      .select('*')
      .eq('unit_id', unitId)
      .eq('tenant_id', tenantId)
      .eq('development_id', developmentId)
      .single();

    let result;
    if (existing) {
      const { data, error } = await supabase
        .from('unit_sales_pipeline')
        .update(updates)
        .eq('id', existing.id)
        .eq('tenant_id', tenantId)
        .select()
        .single();
      
      if (error) {
        console.error('Kitchen selection update error:', error);
        return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
      }
      result = data;
    } else {
      const { data, error } = await supabase
        .from('unit_sales_pipeline')
        .insert({
          tenant_id: tenantId,
          development_id: developmentId,
          unit_id: unitId,
          ...updates,
        })
        .select()
        .single();
      
      if (error) {
        console.error('Kitchen selection insert error:', error);
        return NextResponse.json({ error: 'Failed to create' }, { status: 500 });
      }
      result = data;
    }

    const { data: unit } = await supabase
      .from('units')
      .select('bedrooms')
      .eq('id', unitId)
      .single();

    const bedrooms = unit?.bedrooms || 3;
    const hasKitchen = result.kitchen_selected;
    const hasWardrobe = result.kitchen_wardrobes;
    const pcSum = calculatePCSum(bedrooms, hasKitchen, hasWardrobe);

    try {
      await supabase
        .from('unit_sales_pipeline')
        .update({
          pc_sum_kitchen: pcSum.pcSumKitchen,
          pc_sum_wardrobes: pcSum.pcSumWardrobes,
          pc_sum_total: pcSum.pcSumTotal,
        })
        .eq('id', result.id)
        .eq('tenant_id', tenantId);
    } catch (e) {
      console.log('PC sum columns not yet available:', e);
    }

    const hasAllKitchenFields = result.kitchen_selected === true && 
      result.kitchen_counter && 
      result.kitchen_cabinet && 
      result.kitchen_handle;
    
    if (hasAllKitchenFields && !result.kitchen_date) {
      await supabase
        .from('unit_sales_pipeline')
        .update({ kitchen_date: new Date().toISOString() })
        .eq('id', result.id)
        .eq('tenant_id', tenantId);
    }

    return NextResponse.json({ 
      success: true, 
      selection: {
        ...result,
        pcSumKitchen: pcSum.pcSumKitchen,
        pcSumWardrobes: pcSum.pcSumWardrobes,
        pcSumTotal: pcSum.pcSumTotal,
      }
    });
  } catch (error: any) {
    console.error('Kitchen selection PATCH error:', error);
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
