/**
 * Sales Pipeline API - Unit Update
 *
 * PATCH /api/pipeline/[developmentId]/[unitId]
 * Update a single field on a unit's pipeline record
 */

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

// Calculate current milestone from pipeline dates (matches MILESTONE_ORDER in pre-handover portal)
function calculateCurrentMilestone(pipeline: any): string {
  // Check milestones in reverse order (most advanced first)
  if (pipeline?.handover_date) return 'handover';
  if (pipeline?.drawdown_date) return 'closing';
  if (pipeline?.snag_date) return 'snagging';
  if (pipeline?.kitchen_date) return 'kitchen_selection';
  if (pipeline?.signed_contracts_date || pipeline?.counter_signed_date) return 'contracts_signed';
  if (pipeline?.sale_agreed_date) return 'sale_agreed';
  return 'sale_agreed'; // Default to first milestone
}

// Calculate milestone dates for pre-handover portal
function calculateMilestoneDates(pipeline: any): Record<string, string | null> {
  return {
    sale_agreed: pipeline?.sale_agreed_date || null,
    contracts_signed: pipeline?.signed_contracts_date || pipeline?.counter_signed_date || null,
    kitchen_selection: pipeline?.kitchen_date || null,
    snagging: pipeline?.snag_date || null,
    closing: pipeline?.drawdown_date || null,
    handover: pipeline?.handover_date || null,
  };
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

    // Get existing pipeline record using Supabase
    const { data: existingPipeline, error: fetchError } = await supabaseAdmin
      .from('unit_sales_pipeline')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('unit_id', unitId)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('[Pipeline Unit Update API] Error fetching pipeline:', fetchError);
    }

    // If no pipeline record exists, create one first
    let pipelineId: string;

    if (!existingPipeline) {
      // Get unit to verify it exists
      const { data: unit, error: unitError } = await supabaseAdmin
        .from('units')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('id', unitId)
        .eq('development_id', developmentId)
        .single();

      if (unitError || !unit) {
        console.error('[Pipeline Unit Update API] Unit not found:', unitError);
        return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
      }

      // Create pipeline record using Supabase
      const { data: newPipeline, error: insertError } = await supabaseAdmin
        .from('unit_sales_pipeline')
        .insert({
          tenant_id: tenantId,
          development_id: developmentId,
          unit_id: unitId,
          purchaser_name: unit.purchaser_name || null,
          purchaser_email: unit.purchaser_email || null,
          purchaser_phone: unit.purchaser_phone || null,
        })
        .select('id')
        .single();

      if (insertError || !newPipeline) {
        console.error('[Pipeline Unit Update API] Error creating pipeline:', insertError);
        return NextResponse.json({ error: 'Failed to create pipeline record' }, { status: 500 });
      }
      pipelineId = newPipeline.id;
    } else {
      pipelineId = existingPipeline.id;
    }

    const now = new Date().toISOString();
    let oldValue: any;

    if (isDateField) {
      const { dateField, updatedByField, updatedAtField } = FIELD_MAPPING[field];

      // Get old value for audit
      oldValue = existingPipeline?.[dateField] || null;

      // Update using Supabase
      const updateData: Record<string, any> = {
        [dateField]: value || null,
        [updatedByField]: adminId,
        [updatedAtField]: now,
        updated_at: now,
      };

      const { error: updateError } = await supabaseAdmin
        .from('unit_sales_pipeline')
        .update(updateData)
        .eq('id', pipelineId);

      if (updateError) {
        console.error('[Pipeline Unit Update API] Error updating pipeline:', updateError);
        return NextResponse.json({ error: 'Failed to update pipeline' }, { status: 500 });
      }
    } else {
      const dbField = TEXT_FIELD_MAPPING[field];
      oldValue = existingPipeline?.[dbField] || null;

      const { error: updateError } = await supabaseAdmin
        .from('unit_sales_pipeline')
        .update({
          [dbField]: value || null,
          updated_at: now,
        })
        .eq('id', pipelineId);

      if (updateError) {
        console.error('[Pipeline Unit Update API] Error updating pipeline:', updateError);
        return NextResponse.json({ error: 'Failed to update pipeline' }, { status: 500 });
      }
    }

    // Sync current_milestone and milestone_dates to units table for pre-handover portal
    if (isDateField) {
      try {
        // Fetch the updated pipeline record
        const { data: updatedPipeline } = await supabaseAdmin
          .from('unit_sales_pipeline')
          .select('*')
          .eq('id', pipelineId)
          .single();

        if (updatedPipeline) {
          const currentMilestone = calculateCurrentMilestone(updatedPipeline);
          const milestoneDates = calculateMilestoneDates(updatedPipeline);
          const isHandoverComplete = !!updatedPipeline.handover_date;

          // Update the units table with milestone data
          const { error: unitUpdateError } = await supabaseAdmin
            .from('units')
            .update({
              current_milestone: currentMilestone,
              milestone_dates: milestoneDates,
              handover_complete: isHandoverComplete,
              est_snagging_date: updatedPipeline.snag_date || null,
              est_handover_date: updatedPipeline.handover_date || null,
            })
            .eq('id', unitId)
            .eq('tenant_id', tenantId);

          if (unitUpdateError) {
            console.error('[Pipeline Unit Update API] Failed to sync milestone to units table:', unitUpdateError);
          } else {
            console.log(`[Pipeline Unit Update API] Synced milestone '${currentMilestone}' to unit ${unitId}`);
          }
        }
      } catch (syncError) {
        console.error('[Pipeline Unit Update API] Milestone sync failed (non-critical):', syncError);
      }
    }

    // Audit log using Supabase (skip if it fails - non-critical)
    try {
      await supabaseAdmin.from('audit_log').insert({
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
    } catch (auditError) {
      console.error('[Pipeline Unit Update API] Audit log failed (non-critical):', auditError);
    }

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
        updatedAt: now,
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

    // Get unit using Supabase
    const { data: unit, error: unitError } = await supabaseAdmin
      .from('units')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', unitId)
      .eq('development_id', developmentId)
      .single();

    if (unitError || !unit) {
      console.error('[Pipeline Unit Get API] Unit not found:', unitError);
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
    }

    // Get pipeline data using Supabase
    const { data: pipeline, error: pipelineError } = await supabaseAdmin
      .from('unit_sales_pipeline')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('unit_id', unitId)
      .single();

    if (pipelineError && pipelineError.code !== 'PGRST116') {
      console.error('[Pipeline Unit Get API] Error fetching pipeline:', pipelineError);
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
