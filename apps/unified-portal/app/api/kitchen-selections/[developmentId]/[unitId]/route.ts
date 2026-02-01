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
      hasKitchen: 'has_kitchen',
      counterType: 'counter_type',
      cabinetColor: 'unit_finish',
      handleStyle: 'handle_style',
      hasWardrobe: 'has_wardrobe',
      wardrobeStyle: 'wardrobe_style',
      notes: 'notes',
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

    updates.updated_at = new Date().toISOString();

    const { data: existing } = await supabase
      .from('kitchen_selections')
      .select('id')
      .eq('unit_id', unitId)
      .eq('tenant_id', tenantId)
      .eq('development_id', developmentId)
      .single();

    let result;
    if (existing) {
      const { data, error } = await supabase
        .from('kitchen_selections')
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
        .from('kitchen_selections')
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

    const hasAllKitchenFields = result.has_kitchen && 
      result.counter_type && 
      result.unit_finish && 
      result.handle_style;
    
    if (hasAllKitchenFields) {
      await supabase
        .from('unit_sales_pipeline')
        .update({ kitchen_date: new Date().toISOString() })
        .eq('unit_id', unitId)
        .eq('tenant_id', tenantId)
        .eq('development_id', developmentId);
    }

    return NextResponse.json({ success: true, selection: result });
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
