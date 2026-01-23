/**
 * Sales Pipeline API - Unit Update
 *
 * PATCH /api/pipeline/[developmentId]/[unitId]
 * Update a single field on a unit's pipeline record
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';
import { db } from '@openhouse/db/client';
import { units, audit_log } from '@openhouse/db/schema';
import { eq, sql, and } from 'drizzle-orm';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Mapping from camelCase API fields to snake_case DB columns
const FIELD_MAPPING: Record<string, { dateField: string; updatedByField: string; updatedAtField: string }> = {
  releaseDate: { dateField: 'release_date', updatedByField: 'release_updated_by', updatedAtField: 'release_updated_at' },
  saleAgreedDate: { dateField: 'sale_agreed_date', updatedByField: 'sale_agreed_updated_by', updatedAtField: 'sale_agreed_updated_at' },
  depositDate: { dateField: 'deposit_date', updatedByField: 'deposit_updated_by', updatedAtField: 'deposit_updated_at' },
  contractsIssuedDate: { dateField: 'contracts_issued_date', updatedByField: 'contracts_issued_updated_by', updatedAtField: 'contracts_issued_updated_at' },
  signedContractsDate: { dateField: 'signed_contracts_date', updatedByField: 'signed_contracts_updated_by', updatedAtField: 'signed_contracts_updated_at' },
  counterSignedDate: { dateField: 'counter_signed_date', updatedByField: 'counter_signed_updated_by', updatedAtField: 'counter_signed_updated_at' },
  kitchenDate: { dateField: 'kitchen_date', updatedByField: 'kitchen_updated_by', updatedAtField: 'kitchen_updated_at' },
  snagDate: { dateField: 'snag_date', updatedByField: 'snag_updated_by', updatedAtField: 'snag_updated_at' },
  drawdownDate: { dateField: 'drawdown_date', updatedByField: 'drawdown_updated_by', updatedAtField: 'drawdown_updated_at' },
  handoverDate: { dateField: 'handover_date', updatedByField: 'handover_updated_by', updatedAtField: 'handover_updated_at' },
};

const TEXT_FIELD_MAPPING: Record<string, string> = {
  purchaserName: 'purchaser_name',
  purchaserEmail: 'purchaser_email',
  purchaserPhone: 'purchaser_phone',
};

// Check if pipeline tables exist
async function checkPipelineTablesExist(): Promise<boolean> {
  try {
    await db.execute(sql`SELECT 1 FROM unit_sales_pipeline LIMIT 1`);
    return true;
  } catch (e) {
    return false;
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ developmentId: string; unitId: string }> }
) {
  try {
    const { developmentId, unitId } = await params;
    const session = await requireRole(['developer', 'admin', 'super_admin']);
    const { tenantId, id: adminId, email, role } = session;

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant context required' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    // Check if pipeline tables exist
    const pipelineTablesExist = await checkPipelineTablesExist();
    if (!pipelineTablesExist) {
      return NextResponse.json(
        { error: 'Pipeline tables not yet created. Please run the database migration first.' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { field, value } = body;

    if (!field) {
      return NextResponse.json({ error: 'field is required' }, { status: 400 });
    }

    // Check if it's a date field or text field
    const isDateField = field in FIELD_MAPPING;
    const isTextField = field in TEXT_FIELD_MAPPING;

    if (!isDateField && !isTextField) {
      return NextResponse.json({ error: `Invalid field: ${field}` }, { status: 400 });
    }

    // Get existing pipeline record
    const existingResult = await db.execute(sql`
      SELECT * FROM unit_sales_pipeline
      WHERE tenant_id = ${tenantId}::uuid
      AND unit_id = ${unitId}::uuid
      LIMIT 1
    `);
    const existingPipeline = existingResult.rows?.[0] as any;

    // If no pipeline record exists, create one first
    let pipelineId: string;

    if (!existingPipeline) {
      // Get unit to verify it exists and get development context - try Drizzle first, fallback to Supabase
      let unit: any = null;

      try {
        const [drizzleUnit] = await db
          .select()
          .from(units)
          .where(
            and(
              eq(units.tenant_id, tenantId),
              eq(units.id, unitId),
              eq(units.development_id, developmentId)
            )
          );
        unit = drizzleUnit;
      } catch (drizzleError) {
        console.error('[Pipeline Unit Update API] Drizzle error (falling back to Supabase):', drizzleError);
        const { data: supabaseUnit, error: supabaseError } = await supabaseAdmin
          .from('units')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('id', unitId)
          .eq('development_id', developmentId)
          .single();

        if (supabaseError && supabaseError.code !== 'PGRST116') {
          console.error('[Pipeline Unit Update API] Supabase error:', supabaseError);
        }
        unit = supabaseUnit;
      }

      if (!unit) {
        return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
      }

      // Create pipeline record
      const insertResult = await db.execute(sql`
        INSERT INTO unit_sales_pipeline
          (id, tenant_id, development_id, unit_id, purchaser_name, purchaser_email, purchaser_phone, created_at, updated_at)
        VALUES
          (gen_random_uuid(), ${tenantId}::uuid, ${developmentId}::uuid, ${unitId}::uuid, ${unit.purchaser_name}, ${unit.purchaser_email}, ${unit.purchaser_phone}, NOW(), NOW())
        RETURNING id
      `);
      pipelineId = (insertResult.rows?.[0] as any)?.id;
    } else {
      pipelineId = existingPipeline.id;
    }

    const now = new Date();
    let oldValue: any;

    if (isDateField) {
      const { dateField, updatedByField, updatedAtField } = FIELD_MAPPING[field];

      // Get old value for audit
      oldValue = existingPipeline?.[dateField] || null;

      // Parse the new date value
      const newDate = value ? new Date(value) : null;

      await db.execute(sql`
        UPDATE unit_sales_pipeline
        SET ${sql.identifier(dateField)} = ${newDate}::timestamptz,
            ${sql.identifier(updatedByField)} = ${adminId}::uuid,
            ${sql.identifier(updatedAtField)} = ${now}::timestamptz,
            updated_at = ${now}::timestamptz
        WHERE id = ${pipelineId}::uuid
      `);
    } else {
      const dbField = TEXT_FIELD_MAPPING[field];
      oldValue = existingPipeline?.[dbField] || null;

      await db.execute(sql`
        UPDATE unit_sales_pipeline
        SET ${sql.identifier(dbField)} = ${value || null},
            updated_at = ${now}::timestamptz
        WHERE id = ${pipelineId}::uuid
      `);
    }

    // Audit log
    await db.insert(audit_log).values({
      tenant_id: tenantId,
      type: 'pipeline',
      action: 'field_updated',
      actor: email,
      actor_id: adminId,
      actor_role: role,
      metadata: {
        pipeline_id: pipelineId,
        unit_id: unitId,
        development_id: developmentId,
        field,
        old_value: oldValue,
        new_value: value,
      },
    });

    return NextResponse.json({
      success: true,
      unit: {
        id: unitId,
        pipelineId,
        [field]: value,
      },
      auditEntry: {
        action: 'field_updated',
        field,
        oldValue,
        newValue: value,
        updatedBy: adminId,
        updatedAt: now.toISOString(),
      },
    });
  } catch (error) {
    console.error('[Pipeline Unit Update API] Error:', error);
    console.error('[Pipeline Unit Update API] Stack:', error instanceof Error ? error.stack : 'No stack');
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * GET /api/pipeline/[developmentId]/[unitId]
 * Get single unit pipeline details
 */
export async function GET(
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

    const supabaseAdmin = getSupabaseAdmin();

    // Get unit - try Drizzle first, fallback to Supabase
    let unit: any = null;

    try {
      const [drizzleUnit] = await db
        .select()
        .from(units)
        .where(
          and(
            eq(units.tenant_id, tenantId),
            eq(units.id, unitId),
            eq(units.development_id, developmentId)
          )
        );
      unit = drizzleUnit;
    } catch (drizzleError) {
      console.error('[Pipeline Unit Get API] Drizzle error (falling back to Supabase):', drizzleError);
      const { data: supabaseUnit, error: supabaseError } = await supabaseAdmin
        .from('units')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('id', unitId)
        .eq('development_id', developmentId)
        .single();

      if (supabaseError && supabaseError.code !== 'PGRST116') {
        console.error('[Pipeline Unit Get API] Supabase error:', supabaseError);
      }
      unit = supabaseUnit;
    }

    if (!unit) {
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
    }

    // Check if pipeline tables exist and get pipeline data
    let pipeline: any = null;
    const pipelineTablesExist = await checkPipelineTablesExist();

    if (pipelineTablesExist) {
      const pipelineResult = await db.execute(sql`
        SELECT * FROM unit_sales_pipeline
        WHERE tenant_id = ${tenantId}::uuid
        AND unit_id = ${unitId}::uuid
        LIMIT 1
      `);
      pipeline = pipelineResult.rows?.[0];
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

    return NextResponse.json({
      unit: {
        id: unit.id,
        pipelineId: pipeline?.id || null,
        unitNumber: unit.unit_number,
        address: unit.address_line_1,
        houseTypeCode: unit.house_type_code,
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
      },
    });
  } catch (error) {
    console.error('[Pipeline Unit Get API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
