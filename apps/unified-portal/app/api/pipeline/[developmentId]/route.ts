/**
 * Sales Pipeline API - Development Units
 *
 * GET /api/pipeline/[developmentId]
 * Returns all units with their pipeline status for a development
 *
 * POST /api/pipeline/[developmentId]
 * Release units to the pipeline (bulk create pipeline records)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';
import { db } from '@openhouse/db/client';
import { developments, units, audit_log } from '@openhouse/db/schema';
import { eq, sql, and, inArray } from 'drizzle-orm';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface KitchenSelection {
  hasKitchen: boolean;
  counterType: string | null;
  cabinetColor: string | null;
  handleStyle: string | null;
  hasWardrobe: boolean;
  notes: string | null;
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

interface PipelineUnit {
  id: string;
  pipelineId: string | null;
  unitNumber: string;
  address: string;
  houseTypeCode: string;
  propertyDesignation: string | null;
  propertyType: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  squareFootage: number | null;
  floorAreaM2: number | null;
  purchaserName: string | null;
  purchaserEmail: string | null;
  purchaserPhone: string | null;
  releaseDate: string | null;
  saleAgreedDate: string | null;
  depositDate: string | null;
  contractsIssuedDate: string | null;
  signedContractsDate: string | null;
  counterSignedDate: string | null;
  kitchenDate: string | null;
  snagDate: string | null;
  drawdownDate: string | null;
  handoverDate: string | null;
  queriesRaisedDate: string | null;
  queriesRepliedDate: string | null;
  saleType: string | null;
  housingAgency: string | null;
  salePrice: number | null;
  notesCount: number;
  unresolvedNotesCount: number;
  kitchenSelection: KitchenSelection | null;
}

// Helper to check if pipeline tables exist using Supabase
async function checkPipelineTablesExist(supabase: ReturnType<typeof getSupabaseAdmin>): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('unit_sales_pipeline')
      .select('id')
      .limit(1);
    return !error;
  } catch (e) {
    return false;
  }
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
    let usedFallback = false;

    // Get development details - try Drizzle first, fallback to Supabase
    let development: any = null;

    try {
      const [drizzleDev] = await db
        .select({
          id: developments.id,
          name: developments.name,
          code: developments.code,
          address: developments.address,
        })
        .from(developments)
        .where(and(eq(developments.id, developmentId), eq(developments.tenant_id, tenantId)));
      development = drizzleDev;
      console.log('[Pipeline Development API] Drizzle development found:', !!development);
    } catch (drizzleError) {
      console.error('[Pipeline Development API] Drizzle error (falling back to Supabase):', drizzleError);
      usedFallback = true;

      const { data: supabaseDev, error: supabaseError } = await supabaseAdmin
        .from('developments')
        .select('id, name, code, address')
        .eq('id', developmentId)
        .eq('tenant_id', tenantId)
        .single();

      if (supabaseError && supabaseError.code !== 'PGRST116') {
        console.error('[Pipeline Development API] Supabase error:', supabaseError);
      }
      development = supabaseDev;
      console.log('[Pipeline Development API] Supabase development found:', !!development);
    }

    if (!development) {
      return NextResponse.json({ error: 'Development not found' }, { status: 404 });
    }

    // Get search parameter
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search')?.toLowerCase() || '';

    // Check if pipeline tables exist
    const pipelineTablesExist = await checkPipelineTablesExist(supabaseAdmin);

    // Get all units for this development - try Drizzle first, fallback to Supabase
    let unitData: any[] = [];

    try {
      if (!usedFallback) {
        unitData = await db
          .select()
          .from(units)
          .where(and(eq(units.tenant_id, tenantId), eq(units.development_id, developmentId)))
          .orderBy(sql`${units.unit_number} ASC`);
        console.log('[Pipeline Development API] Drizzle units:', unitData.length);
      } else {
        throw new Error('Using Supabase fallback');
      }
    } catch (e) {
      console.log('[Pipeline Development API] Falling back to Supabase for units');
      const { data: supabaseUnits, error: supabaseError } = await supabaseAdmin
        .from('units')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('development_id', developmentId)
        .order('unit_number', { ascending: true });

      if (supabaseError) {
        console.error('[Pipeline Development API] Supabase units error:', supabaseError);
        throw supabaseError;
      }
      unitData = supabaseUnits || [];
      console.log('[Pipeline Development API] Supabase units:', unitData.length);
    }

    // If pipeline tables exist, get pipeline data
    let pipelineData: Map<string, any> = new Map();
    let notesCounts: Map<string, { total: number; unresolved: number }> = new Map();
    let kitchenSelections: Map<string, any> = new Map();

    let kitchenConfig: any = null;
    if (pipelineTablesExist) {
      try {
        // Get kitchen config for PC sum calculations
        const { data: configData } = await supabaseAdmin
          .from('kitchen_selection_options')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('development_id', developmentId)
          .single();
        kitchenConfig = configData;

        // Get kitchen selections for these units
        const { data: kitchenRows, error: kitchenError } = await supabaseAdmin
          .from('kitchen_selections')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('development_id', developmentId);

        if (kitchenError) {
          console.error('[Pipeline Development API] Error fetching kitchen selections:', kitchenError);
        } else {
          for (const row of kitchenRows || []) {
            kitchenSelections.set(row.unit_id as string, row);
          }
        }

        // Get pipeline records for these units using Supabase
        const { data: pipelineRows, error: pipelineError } = await supabaseAdmin
          .from('unit_sales_pipeline')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('development_id', developmentId);

        if (pipelineError) {
          console.error('[Pipeline Development API] Error fetching pipeline data:', pipelineError);
        } else {
          // Debug: Log first few rows to see if queries_raised_date is present
          const rowsWithQueries = (pipelineRows || []).filter((r: any) => r.queries_raised_date);
          console.log('[Pipeline DEBUG] Total rows:', pipelineRows?.length, 'Rows with queries_raised_date:', rowsWithQueries.length);
          if (rowsWithQueries.length > 0) {
            console.log('[Pipeline DEBUG] Sample row with queries:', JSON.stringify(rowsWithQueries[0], null, 2));
          }
          for (const row of pipelineRows || []) {
            pipelineData.set(row.unit_id as string, row);
          }
        }

        // Get notes counts using Supabase
        const pipelineIds = Array.from(pipelineData.values()).map((p) => p.id);
        if (pipelineIds.length > 0) {
          const { data: notesRows, error: notesError } = await supabaseAdmin
            .from('unit_pipeline_notes')
            .select('pipeline_id')
            .in('pipeline_id', pipelineIds);

          if (notesError) {
            console.error('[Pipeline Development API] Error fetching notes:', notesError);
          } else {
            // Count notes per pipeline
            const notesCountMap: Record<string, { total: number; unresolved: number }> = {};
            for (const row of notesRows || []) {
              if (!notesCountMap[row.pipeline_id]) {
                notesCountMap[row.pipeline_id] = { total: 0, unresolved: 0 };
              }
              notesCountMap[row.pipeline_id].total++;
            }
            for (const [pipelineId, counts] of Object.entries(notesCountMap)) {
              notesCounts.set(pipelineId, counts);
            }
          }
        }
      } catch (e) {
        console.error('[Pipeline Development API] Error querying pipeline data:', e);
      }
    }

    // Format units for response
    const formattedUnits: PipelineUnit[] = unitData
      .map((unit) => {
        const pipeline = pipelineData.get(unit.id);
        const notes = notesCounts.get(pipeline?.id || '') || { total: 0, unresolved: 0 };
        const kitchen = kitchenSelections.get(unit.id);

        // Debug: Log if pipeline has queries data
        if (pipeline?.queries_raised_date) {
          console.log('[Pipeline DEBUG] Unit', unit.unit_number, 'has queries_raised_date:', pipeline.queries_raised_date, 'replied:', pipeline.queries_replied_date);
        }

        // Safely convert dates
        const safeDate = (dateVal: any): string | null => {
          if (!dateVal) return null;
          try {
            return new Date(dateVal).toISOString();
          } catch {
            return null;
          }
        };

        return {
          id: unit.id,
          pipelineId: pipeline?.id || null,
          unitNumber: unit.unit_number || '',
          address: unit.address_line_1 || '',
          houseTypeCode: unit.house_type_code || '',
          propertyDesignation: unit.property_designation || null,
          propertyType: unit.property_type || null,
          bedrooms: unit.bedrooms ? Number(unit.bedrooms) : null,
          bathrooms: unit.bathrooms ? Number(unit.bathrooms) : null,
          squareFootage: unit.square_footage ? Number(unit.square_footage) : null,
          floorAreaM2: unit.floor_area_m2 ? Number(unit.floor_area_m2) : null,
          purchaserName: pipeline?.purchaser_name || unit.purchaser_name || null,
          purchaserEmail: pipeline?.purchaser_email || unit.purchaser_email || null,
          purchaserPhone: pipeline?.purchaser_phone || unit.purchaser_phone || null,
          releaseDate: safeDate(pipeline?.release_date),
          saleAgreedDate: safeDate(pipeline?.sale_agreed_date),
          depositDate: safeDate(pipeline?.deposit_date),
          contractsIssuedDate: safeDate(pipeline?.contracts_issued_date),
          signedContractsDate: safeDate(pipeline?.signed_contracts_date),
          counterSignedDate: safeDate(pipeline?.counter_signed_date),
          kitchenDate: safeDate(pipeline?.kitchen_date),
          snagDate: safeDate(pipeline?.snag_date),
          drawdownDate: safeDate(pipeline?.drawdown_date),
          handoverDate: safeDate(pipeline?.handover_date),
          queriesRaisedDate: safeDate(pipeline?.queries_raised_date),
          queriesRepliedDate: safeDate(pipeline?.queries_replied_date),
          saleType: pipeline?.sale_type || null,
          housingAgency: pipeline?.housing_agency || null,
          salePrice: pipeline?.sale_price ? Number(pipeline.sale_price) : null,
          notesCount: notes.total,
          unresolvedNotesCount: notes.unresolved,
          kitchenSelection: kitchen ? (() => {
            const hasKitchen = kitchen.has_kitchen;
            const hasWardrobe = kitchen.has_wardrobe;
            const pcSum = calculatePCSum(unit.bedrooms || 3, hasKitchen, hasWardrobe, kitchenConfig);
            return {
              hasKitchen: hasKitchen || false,
              counterType: kitchen.counter_type || null,
              cabinetColor: kitchen.unit_finish || null,
              handleStyle: kitchen.handle_style || null,
              hasWardrobe: hasWardrobe || false,
              notes: kitchen.notes || null,
              pcSumKitchen: pcSum.pcSumKitchen,
              pcSumWardrobes: pcSum.pcSumWardrobes,
              pcSumTotal: pcSum.pcSumTotal,
            };
          })() : null,
        };
      })
      .filter((unit) => {
        if (!search) return true;
        return (
          unit.address.toLowerCase().includes(search) ||
          unit.unitNumber.toLowerCase().includes(search) ||
          (unit.purchaserName?.toLowerCase().includes(search) || false)
        );
      });

    // Calculate stats
    const released = formattedUnits.filter((u) => u.releaseDate).length;
    const handedOver = formattedUnits.filter((u) => u.handoverDate).length;
    const inProgress = released - handedOver;

    return NextResponse.json({
      development: {
        id: development.id,
        name: development.name,
        code: development.code,
        address: development.address,
      },
      units: formattedUnits,
      stats: {
        total: formattedUnits.length,
        released,
        inProgress,
        handedOver,
      },
      pipelineTablesExist, // Let frontend know if tables exist
    });
  } catch (error) {
    console.error('[Pipeline Development API] Error:', error);
    console.error('[Pipeline Development API] Stack:', error instanceof Error ? error.stack : 'No stack');
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * POST /api/pipeline/[developmentId]
 * Release units - create pipeline records for specified unit IDs
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ developmentId: string }> }
) {
  try {
    const { developmentId } = await params;
    const session = await requireRole(['developer', 'admin', 'super_admin']);
    const { tenantId, id: adminId, email, role } = session;

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant context required' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    // Check if pipeline tables exist
    const pipelineTablesExist = await checkPipelineTablesExist(supabaseAdmin);
    if (!pipelineTablesExist) {
      return NextResponse.json(
        { error: 'Pipeline tables not yet created. Please run the database migration first.' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { unitIds } = body;

    if (!Array.isArray(unitIds) || unitIds.length === 0) {
      return NextResponse.json({ error: 'unitIds array required' }, { status: 400 });
    }

    // Verify units exist and belong to this tenant/development - try Drizzle first, fallback to Supabase
    let existingUnits: any[] = [];

    try {
      existingUnits = await db
        .select()
        .from(units)
        .where(
          and(
            eq(units.tenant_id, tenantId),
            eq(units.development_id, developmentId),
            inArray(units.id, unitIds)
          )
        );
    } catch (drizzleError) {
      console.error('[Pipeline Release API] Drizzle error (falling back to Supabase):', drizzleError);
      const { data: supabaseUnits, error: supabaseError } = await supabaseAdmin
        .from('units')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('development_id', developmentId)
        .in('id', unitIds);

      if (supabaseError) {
        console.error('[Pipeline Release API] Supabase error:', supabaseError);
        throw supabaseError;
      }
      existingUnits = supabaseUnits || [];
    }

    if (existingUnits.length !== unitIds.length) {
      return NextResponse.json({ error: 'Some units not found' }, { status: 400 });
    }

    // Check which units already have pipeline records using Supabase
    // (Drizzle has issues with array syntax, so use Supabase for this query)
    const { data: existingPipelinesData, error: existingPipelinesError } = await supabaseAdmin
      .from('unit_sales_pipeline')
      .select('unit_id')
      .in('unit_id', unitIds);

    if (existingPipelinesError) {
      console.error('[Pipeline Release API] Error checking existing pipelines:', existingPipelinesError);
      throw existingPipelinesError;
    }
    const existingPipelinesResult = { rows: existingPipelinesData || [] };

    const existingUnitIds = new Set((existingPipelinesResult.rows || []).map((p: any) => p.unit_id));
    const unitsToRelease = existingUnits.filter((u) => !existingUnitIds.has(u.id));

    if (unitsToRelease.length === 0) {
      return NextResponse.json({
        message: 'All units already have pipeline records',
        released: 0,
      });
    }

    // Create pipeline records using Supabase for reliability
    const now = new Date().toISOString();
    const pipelineRecords = unitsToRelease.map((unit) => ({
      tenant_id: tenantId,
      development_id: developmentId,
      unit_id: unit.id,
      purchaser_name: unit.purchaser_name || null,
      purchaser_email: unit.purchaser_email || null,
      purchaser_phone: unit.purchaser_phone || null,
      release_date: now,
      release_updated_by: adminId,
      release_updated_at: now,
    }));

    const { error: insertError } = await supabaseAdmin
      .from('unit_sales_pipeline')
      .insert(pipelineRecords);

    if (insertError) {
      console.error('[Pipeline Release API] Error inserting pipeline records:', insertError);
      throw insertError;
    }

    // Audit log using Supabase (skip if it fails - non-critical)
    try {
      await supabaseAdmin.from('audit_log').insert({
        tenant_id: tenantId,
        type: 'pipeline',
        action: 'units_released',
        actor: email,
        actor_id: adminId,
        actor_role: role,
        metadata: {
          development_id: developmentId,
          unit_ids: unitsToRelease.map((u) => u.id),
          count: unitsToRelease.length,
        },
      });
    } catch (auditError) {
      console.error('[Pipeline Release API] Audit log failed (non-critical):', auditError);
    }

    return NextResponse.json({
      message: `Released ${unitsToRelease.length} units`,
      released: unitsToRelease.length,
    });
  } catch (error) {
    console.error('[Pipeline Release API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
