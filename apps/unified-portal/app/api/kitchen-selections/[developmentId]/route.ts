import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';
import { db } from '@openhouse/db/client';
import { developments, units, kitchenSelections, kitchenSelectionOptions } from '@openhouse/db/schema';
import { eq, and, sql } from 'drizzle-orm';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface KitchenUnit {
  id: string;
  unitId: string;
  unitNumber: string;
  purchaserName: string | null;
  houseType: string;
  hasKitchen: boolean;
  counterType: string | null;
  unitFinish: string | null;
  handleStyle: string | null;
  hasWardrobe: boolean;
  wardrobeStyle: string | null;
  notes: string | null;
  status: 'complete' | 'pending';
}

export async function GET(
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

    const supabaseAdmin = getSupabaseAdmin();

    const [development] = await db
      .select({
        id: developments.id,
        name: developments.name,
        code: developments.code,
      })
      .from(developments)
      .where(and(eq(developments.id, developmentId), eq(developments.tenant_id, tenantId)));

    if (!development) {
      return NextResponse.json({ error: 'Development not found' }, { status: 404 });
    }

    const allUnits = await db
      .select()
      .from(units)
      .where(and(eq(units.tenant_id, tenantId), eq(units.development_id, developmentId)))
      .orderBy(sql`${units.unit_number} ASC`);

    const selections = await db
      .select()
      .from(kitchenSelections)
      .where(and(
        eq(kitchenSelections.tenant_id, tenantId),
        eq(kitchenSelections.development_id, developmentId)
      ));

    const selectionsMap = new Map(selections.map(s => [s.unit_id, s]));

    let [options] = await db
      .select()
      .from(kitchenSelectionOptions)
      .where(and(
        eq(kitchenSelectionOptions.tenant_id, tenantId),
        eq(kitchenSelectionOptions.development_id, developmentId)
      ));

    if (!options) {
      const [newOptions] = await db
        .insert(kitchenSelectionOptions)
        .values({
          tenant_id: tenantId,
          development_id: developmentId,
        })
        .returning();
      options = newOptions;
    }

    const kitchenUnits: KitchenUnit[] = allUnits.map(unit => {
      const selection = selectionsMap.get(unit.id);
      
      const hasAllKitchenFields = selection?.has_kitchen && 
        selection?.counter_type && 
        selection?.unit_finish && 
        selection?.handle_style;
      const hasAllWardrobeFields = selection?.has_wardrobe && selection?.wardrobe_style;
      
      const isComplete = (selection?.has_kitchen ? hasAllKitchenFields : true) && 
                         (selection?.has_wardrobe ? hasAllWardrobeFields : true) &&
                         (selection?.has_kitchen || selection?.has_wardrobe);

      return {
        id: selection?.id || '',
        unitId: unit.id,
        unitNumber: unit.unit_number,
        purchaserName: unit.purchaser_name,
        houseType: unit.house_type_code,
        hasKitchen: selection?.has_kitchen || false,
        counterType: selection?.counter_type || null,
        unitFinish: selection?.unit_finish || null,
        handleStyle: selection?.handle_style || null,
        hasWardrobe: selection?.has_wardrobe || false,
        wardrobeStyle: selection?.wardrobe_style || null,
        notes: selection?.notes || null,
        status: isComplete ? 'complete' : 'pending',
      };
    });

    return NextResponse.json({
      development: {
        id: development.id,
        name: development.name,
        code: development.code,
      },
      units: kitchenUnits,
      options: {
        counterTypes: options.counter_types as string[],
        unitFinishes: options.unit_finishes as string[],
        handleStyles: options.handle_styles as string[],
        wardrobeStyles: options.wardrobe_styles as string[],
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

    const body = await request.json();
    const { unitId, field, value } = body;

    if (!unitId || !field) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const [existingUnit] = await db
      .select()
      .from(units)
      .where(and(
        eq(units.id, unitId),
        eq(units.tenant_id, tenantId),
        eq(units.development_id, developmentId)
      ));

    if (!existingUnit) {
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
    }

    const [existing] = await db
      .select()
      .from(kitchenSelections)
      .where(eq(kitchenSelections.unit_id, unitId));

    const fieldMap: Record<string, string> = {
      hasKitchen: 'has_kitchen',
      counterType: 'counter_type',
      unitFinish: 'unit_finish',
      handleStyle: 'handle_style',
      hasWardrobe: 'has_wardrobe',
      wardrobeStyle: 'wardrobe_style',
      notes: 'notes',
    };

    const dbField = fieldMap[field];
    if (!dbField) {
      return NextResponse.json({ error: 'Invalid field' }, { status: 400 });
    }

    let result;
    if (existing) {
      [result] = await db
        .update(kitchenSelections)
        .set({ [dbField]: value, updated_at: new Date() })
        .where(eq(kitchenSelections.id, existing.id))
        .returning();
    } else {
      [result] = await db
        .insert(kitchenSelections)
        .values({
          tenant_id: tenantId,
          development_id: developmentId,
          unit_id: unitId,
          [dbField]: value,
        })
        .returning();
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
