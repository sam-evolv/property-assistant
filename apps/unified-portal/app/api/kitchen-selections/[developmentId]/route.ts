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
  address: string | null;
  purchaserName: string | null;
  houseType: string;
  bedrooms: number;
  hasKitchen: boolean | null;
  counterType: string | null;
  unitFinish: string | null;
  handleStyle: string | null;
  hasWardrobe: boolean | null;
  wardrobeStyle: string | null;
  notes: string | null;
  status: 'complete' | 'pending';
  pcSumKitchen: number;
  pcSumWardrobes: number;
  pcSumTotal: number;
}

function calculatePCSum(bedrooms: number, hasKitchen: boolean | null, hasWardrobe: boolean | null, config: any) {
  if (hasKitchen === null && hasWardrobe === null) {
    return { pcSumKitchen: 0, pcSumWardrobes: 0, pcSumTotal: 0 };
  }
  
  const kitchen4Bed = Number(config?.pc_sum_kitchen_4bed) || 7000;
  const kitchen3Bed = Number(config?.pc_sum_kitchen_3bed) || 6000;
  const kitchen2Bed = Number(config?.pc_sum_kitchen_2bed) || 5000;
  const wardrobeAllowance = Number(config?.pc_sum_wardrobes) || 1000;
  
  let kitchenAllowance = kitchen2Bed;
  if (bedrooms >= 4) kitchenAllowance = kitchen4Bed;
  else if (bedrooms === 3) kitchenAllowance = kitchen3Bed;
  
  const kitchenImpact = hasKitchen === true ? 0 : (hasKitchen === false ? -kitchenAllowance : 0);
  const wardrobeImpact = hasWardrobe === true ? 0 : (hasWardrobe === false ? -wardrobeAllowance : 0);
  
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
    console.log('[Kitchen Selections API] Session tenant:', tenantId);

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant context required' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    // Get development name from query param if provided
    const url = new URL(request.url);
    const devName = url.searchParams.get('name');
    console.log('[Kitchen Selections API] Requested development:', developmentId, 'name param:', devName);

    // First, get all developments for this tenant to find a valid one
    console.log('[Kitchen Selections API] Fetching all tenant developments from Supabase...');
    const { data: allDevs, error: allDevsError } = await supabaseAdmin
      .from('developments')
      .select('id, name, code')
      .eq('tenant_id', tenantId);
    
    if (allDevsError) {
      console.error('[Kitchen Selections API] All developments query error:', allDevsError);
    }
    console.log('[Kitchen Selections API] Tenant has', allDevs?.length || 0, 'developments');

    // Try to find the requested development by ID first
    let development = allDevs?.find(d => d.id === developmentId);
    let actualDevelopmentId = developmentId;
    
    // If not found by ID and name is provided, try to match by name
    if (!development && devName && allDevs) {
      development = allDevs.find(d => d.name.toLowerCase() === devName.toLowerCase());
      if (development) {
        console.log('[Kitchen Selections API] Found development by name:', development.name);
        actualDevelopmentId = development.id;
      }
    }
    
    // If still not found, use the first available one
    if (!development && allDevs && allDevs.length > 0) {
      console.log('[Kitchen Selections API] Requested dev not found, using first available:', allDevs[0].id);
      development = allDevs[0];
      actualDevelopmentId = allDevs[0].id;
    }
    
    console.log('[Kitchen Selections API] Using development:', development?.name, '(', actualDevelopmentId, ')');

    if (!development) {
      console.log('[Kitchen Selections API] No developments found for tenant');
      return NextResponse.json({ error: 'No developments available' }, { status: 404 });
    }

    // Get units from Supabase using the actual development ID
    console.log('[Kitchen Selections API] Fetching units from Supabase...');
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
    console.log('[Kitchen Selections API] Units found:', allUnits.length);

    // Get kitchen selections - try Supabase (new tables)
    let selections: any[] = [];
    try {
      const { data: supabaseSelections, error } = await supabaseAdmin
        .from('kitchen_selections')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('development_id', actualDevelopmentId);
      
      if (error) {
        console.error('[Kitchen Selections API] Selections query error:', error);
      }
      selections = supabaseSelections || [];
      console.log('[Kitchen Selections API] Kitchen selections found:', selections.length);
    } catch (e: any) {
      console.error('[Kitchen Selections API] Selections error:', e.message);
    }

    const selectionsMap = new Map(selections.map(s => [s.unit_id, s]));

    // Get or create selection options
    let options: any = null;
    try {
      const { data: supabaseOptions, error } = await supabaseAdmin
        .from('kitchen_selection_options')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('development_id', actualDevelopmentId)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        console.error('[Kitchen Selections API] Options query error:', error);
      }
      options = supabaseOptions;
      
      if (!options) {
        console.log('[Kitchen Selections API] Creating default options');
        const { data: newOptions, error: insertError } = await supabaseAdmin
          .from('kitchen_selection_options')
          .insert({
            tenant_id: tenantId,
            development_id: actualDevelopmentId,
            counter_types: ['Granite', 'Quartz', 'Marble', 'Laminate'],
            unit_finishes: ['Matt White', 'Gloss White', 'Oak', 'Walnut'],
            handle_styles: ['Bar', 'Knob', 'Integrated', 'Cup'],
            wardrobe_styles: ['Sliding', 'Hinged', 'Walk-in'],
          })
          .select()
          .single();
        
        if (insertError) {
          console.error('[Kitchen Selections API] Options insert error:', insertError);
          options = {
            counter_types: ['Granite', 'Quartz', 'Marble', 'Laminate'],
            unit_finishes: ['Matt White', 'Gloss White', 'Oak', 'Walnut'],
            handle_styles: ['Bar', 'Knob', 'Integrated', 'Cup'],
            wardrobe_styles: ['Sliding', 'Hinged', 'Walk-in'],
          };
        } else {
          options = newOptions;
        }
      }
      console.log('[Kitchen Selections API] Options ready');
    } catch (e: any) {
      console.error('[Kitchen Selections API] Options error:', e.message);
      options = {
        counter_types: ['Granite', 'Quartz', 'Marble', 'Laminate'],
        unit_finishes: ['Matt White', 'Gloss White', 'Oak', 'Walnut'],
        handle_styles: ['Bar', 'Knob', 'Integrated', 'Cup'],
        wardrobe_styles: ['Sliding', 'Hinged', 'Walk-in'],
      };
    }

    const kitchenUnits: KitchenUnit[] = allUnits.map(unit => {
      const selection = selectionsMap.get(unit.id);
      
      const hasKitchen = selection ? selection.has_kitchen : null;
      const hasWardrobe = selection ? selection.has_wardrobe : null;
      const bedrooms = unit.bedrooms || 3;
      
      const hasAllKitchenFields = hasKitchen === true && 
        selection?.counter_type && 
        selection?.unit_finish && 
        selection?.handle_style;
      const hasAllWardrobeFields = hasWardrobe === true && selection?.wardrobe_style;
      
      const kitchenComplete = hasKitchen === false || hasAllKitchenFields;
      const wardrobeComplete = hasWardrobe === false || hasAllWardrobeFields;
      
      const hasAnySelection = hasKitchen !== null || hasWardrobe !== null;
      const isComplete = hasAnySelection && 
                         (hasKitchen !== null ? kitchenComplete : true) && 
                         (hasWardrobe !== null ? wardrobeComplete : true) &&
                         (hasKitchen === true || hasWardrobe === true);

      const pcSum = calculatePCSum(bedrooms, hasKitchen, hasWardrobe, options);

      return {
        id: selection?.id || '',
        unitId: unit.id,
        unitNumber: unit.unit_number,
        address: `${unit.unit_number} ${development.name}`,
        purchaserName: unit.purchaser_name,
        houseType: unit.house_type_code,
        bedrooms: bedrooms,
        hasKitchen: hasKitchen,
        counterType: selection?.counter_type || null,
        unitFinish: selection?.unit_finish || null,
        handleStyle: selection?.handle_style || null,
        hasWardrobe: hasWardrobe,
        wardrobeStyle: selection?.wardrobe_style || null,
        notes: selection?.notes || null,
        status: isComplete ? 'complete' : 'pending',
        pcSumKitchen: pcSum.pcSumKitchen,
        pcSumWardrobes: pcSum.pcSumWardrobes,
        pcSumTotal: pcSum.pcSumTotal,
      };
    });

    const totalPcSumImpact = kitchenUnits.reduce((sum, u) => sum + u.pcSumTotal, 0);
    const takingOwnKitchen = kitchenUnits.filter(u => u.hasKitchen === false).length;
    const takingOwnWardrobes = kitchenUnits.filter(u => u.hasWardrobe === false).length;

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
      pcSumConfig: {
        kitchen4Bed: Number(options.pc_sum_kitchen_4bed) || 7000,
        kitchen3Bed: Number(options.pc_sum_kitchen_3bed) || 6000,
        kitchen2Bed: Number(options.pc_sum_kitchen_2bed) || 5000,
        wardrobes: Number(options.pc_sum_wardrobes) || 1000,
      },
      summary: {
        totalPcSumImpact,
        takingOwnKitchen,
        takingOwnWardrobes,
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

    // Get development name from query param
    const url = new URL(request.url);
    const devName = url.searchParams.get('name');
    console.log('[Kitchen Selections API] PUT request for development:', developmentId, 'name:', devName);

    const body = await request.json();
    const { unitId, field, value } = body;

    if (!unitId || !field) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    // Find the correct development ID using Supabase
    const { data: allDevs } = await supabaseAdmin
      .from('developments')
      .select('id, name')
      .eq('tenant_id', tenantId);

    let actualDevelopmentId = developmentId;
    let development = allDevs?.find(d => d.id === developmentId);
    
    // If not found by ID and name is provided, try to match by name
    if (!development && devName && allDevs) {
      development = allDevs.find(d => d.name.toLowerCase() === devName.toLowerCase());
      if (development) {
        console.log('[Kitchen Selections API] PUT: Found development by name:', development.name);
        actualDevelopmentId = development.id;
      }
    }
    
    // If still not found, use the first available
    if (!development && allDevs && allDevs.length > 0) {
      console.log('[Kitchen Selections API] PUT: Using first available development');
      development = allDevs[0];
      actualDevelopmentId = allDevs[0].id;
    }

    console.log('[Kitchen Selections API] PUT: Using development ID:', actualDevelopmentId);

    // Verify unit exists using Supabase
    const { data: existingUnit, error: unitError } = await supabaseAdmin
      .from('units')
      .select('id')
      .eq('id', unitId)
      .eq('tenant_id', tenantId)
      .single();

    if (unitError || !existingUnit) {
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
    }

    // Check for existing selection
    const { data: existing } = await supabaseAdmin
      .from('kitchen_selections')
      .select('id')
      .eq('unit_id', unitId)
      .single();

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
      const { data, error } = await supabaseAdmin
        .from('kitchen_selections')
        .update({ [dbField]: value, updated_at: new Date().toISOString() })
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
        .from('kitchen_selections')
        .insert({
          tenant_id: tenantId,
          development_id: actualDevelopmentId,
          unit_id: unitId,
          [dbField]: value,
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
