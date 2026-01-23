/**
 * Sales Pipeline API - Unit Update
 *
 * PATCH /api/pipeline/[developmentId]/[unitId]
 * Update a single field on a unit's pipeline record
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminContextFromSession } from '@/lib/api-auth';
import { db } from '@openhouse/db/client';
import { unitSalesPipeline, units, audit_log } from '@openhouse/db/schema';
import { eq, and } from 'drizzle-orm';

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

const TEXT_FIELDS = ['purchaserName', 'purchaserEmail', 'purchaserPhone'] as const;

const TEXT_FIELD_MAPPING: Record<string, string> = {
  purchaserName: 'purchaser_name',
  purchaserEmail: 'purchaser_email',
  purchaserPhone: 'purchaser_phone',
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ developmentId: string; unitId: string }> }
) {
  try {
    const { developmentId, unitId } = await params;
    const adminContext = await getAdminContextFromSession();

    if (!adminContext) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { tenantId, adminId, role, email } = adminContext;

    if (!['developer', 'admin', 'super_admin'].includes(role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant context required' }, { status: 400 });
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
    const [existingPipeline] = await db
      .select()
      .from(unitSalesPipeline)
      .where(
        and(
          eq(unitSalesPipeline.tenant_id, tenantId),
          eq(unitSalesPipeline.unit_id, unitId)
        )
      );

    // If no pipeline record exists, create one first
    let pipelineId: string;

    if (!existingPipeline) {
      // Get unit to verify it exists and get development context
      const [unit] = await db
        .select()
        .from(units)
        .where(
          and(
            eq(units.tenant_id, tenantId),
            eq(units.id, unitId),
            eq(units.development_id, developmentId)
          )
        );

      if (!unit) {
        return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
      }

      // Create pipeline record
      const [newPipeline] = await db
        .insert(unitSalesPipeline)
        .values({
          tenant_id: tenantId,
          development_id: developmentId,
          unit_id: unitId,
          purchaser_name: unit.purchaser_name,
          purchaser_email: unit.purchaser_email,
          purchaser_phone: unit.purchaser_phone,
        })
        .returning();

      pipelineId = newPipeline.id;
    } else {
      pipelineId = existingPipeline.id;
    }

    const now = new Date();
    let updateData: Record<string, any> = { updated_at: now };
    let oldValue: any;

    if (isDateField) {
      const { dateField, updatedByField, updatedAtField } = FIELD_MAPPING[field];

      // Get old value for audit
      oldValue = existingPipeline?.[dateField as keyof typeof existingPipeline] || null;

      // Parse the new date value
      const newDate = value ? new Date(value) : null;

      updateData[dateField] = newDate;
      updateData[updatedByField] = adminId;
      updateData[updatedAtField] = now;
    } else {
      const dbField = TEXT_FIELD_MAPPING[field];
      oldValue = existingPipeline?.[dbField as keyof typeof existingPipeline] || null;
      updateData[dbField] = value || null;
    }

    // Update the pipeline record
    const [updated] = await db
      .update(unitSalesPipeline)
      .set(updateData)
      .where(eq(unitSalesPipeline.id, pipelineId))
      .returning();

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
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
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
    const adminContext = await getAdminContextFromSession();

    if (!adminContext) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { tenantId, role } = adminContext;

    if (!['developer', 'admin', 'super_admin'].includes(role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant context required' }, { status: 400 });
    }

    // Get unit with pipeline data
    const [result] = await db
      .select({
        unit: units,
        pipeline: unitSalesPipeline,
      })
      .from(units)
      .leftJoin(unitSalesPipeline, eq(units.id, unitSalesPipeline.unit_id))
      .where(
        and(
          eq(units.tenant_id, tenantId),
          eq(units.id, unitId),
          eq(units.development_id, developmentId)
        )
      );

    if (!result) {
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
    }

    const { unit, pipeline } = result;

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
        releaseDate: pipeline?.release_date?.toISOString() || null,
        saleAgreedDate: pipeline?.sale_agreed_date?.toISOString() || null,
        depositDate: pipeline?.deposit_date?.toISOString() || null,
        contractsIssuedDate: pipeline?.contracts_issued_date?.toISOString() || null,
        signedContractsDate: pipeline?.signed_contracts_date?.toISOString() || null,
        counterSignedDate: pipeline?.counter_signed_date?.toISOString() || null,
        kitchenDate: pipeline?.kitchen_date?.toISOString() || null,
        snagDate: pipeline?.snag_date?.toISOString() || null,
        drawdownDate: pipeline?.drawdown_date?.toISOString() || null,
        handoverDate: pipeline?.handover_date?.toISOString() || null,
      },
    });
  } catch (error) {
    console.error('[Pipeline Unit Get API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
