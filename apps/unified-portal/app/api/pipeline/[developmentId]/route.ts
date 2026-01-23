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
import { getAdminContextFromSession } from '@/lib/api-auth';
import { db } from '@openhouse/db/client';
import {
  developments,
  units,
  unitSalesPipeline,
  unitPipelineNotes,
  audit_log,
} from '@openhouse/db/schema';
import { eq, sql, and, isNotNull, isNull, count, inArray } from 'drizzle-orm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Pipeline field names that can be updated
const PIPELINE_DATE_FIELDS = [
  'release_date',
  'sale_agreed_date',
  'deposit_date',
  'contracts_issued_date',
  'signed_contracts_date',
  'counter_signed_date',
  'kitchen_date',
  'snag_date',
  'drawdown_date',
  'handover_date',
] as const;

const PIPELINE_TEXT_FIELDS = [
  'purchaser_name',
  'purchaser_email',
  'purchaser_phone',
] as const;

type DateField = (typeof PIPELINE_DATE_FIELDS)[number];
type TextField = (typeof PIPELINE_TEXT_FIELDS)[number];
type PipelineField = DateField | TextField;

interface PipelineUnit {
  id: string;
  pipelineId: string | null;
  unitNumber: string;
  address: string;
  houseTypeCode: string;
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
  notesCount: number;
  unresolvedNotesCount: number;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ developmentId: string }> }
) {
  try {
    const { developmentId } = await params;
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

    // Get development details
    const [development] = await db
      .select({
        id: developments.id,
        name: developments.name,
        code: developments.code,
        address: developments.address,
      })
      .from(developments)
      .where(and(eq(developments.id, developmentId), eq(developments.tenant_id, tenantId)));

    if (!development) {
      return NextResponse.json({ error: 'Development not found' }, { status: 404 });
    }

    // Get search parameter
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search')?.toLowerCase() || '';

    // Get all units with their pipeline data
    const unitData = await db
      .select({
        unit: units,
        pipeline: unitSalesPipeline,
      })
      .from(units)
      .leftJoin(unitSalesPipeline, eq(units.id, unitSalesPipeline.unit_id))
      .where(and(eq(units.tenant_id, tenantId), eq(units.development_id, developmentId)))
      .orderBy(sql`${units.unit_number} ASC`);

    // Get notes counts for all pipelines in this development
    const pipelineIds = unitData
      .filter((u) => u.pipeline?.id)
      .map((u) => u.pipeline!.id);

    let notesCounts: Map<string, { total: number; unresolved: number }> = new Map();

    if (pipelineIds.length > 0) {
      const notesResult = await db
        .select({
          pipelineId: unitPipelineNotes.pipeline_id,
          total: count(),
          unresolved: sql<number>`SUM(CASE WHEN ${unitPipelineNotes.is_resolved} = false THEN 1 ELSE 0 END)`,
        })
        .from(unitPipelineNotes)
        .where(inArray(unitPipelineNotes.pipeline_id, pipelineIds))
        .groupBy(unitPipelineNotes.pipeline_id);

      for (const row of notesResult) {
        notesCounts.set(row.pipelineId, {
          total: Number(row.total),
          unresolved: Number(row.unresolved),
        });
      }
    }

    // Format units for response
    const formattedUnits: PipelineUnit[] = unitData
      .map(({ unit, pipeline }) => {
        const notes = notesCounts.get(pipeline?.id || '') || { total: 0, unresolved: 0 };

        return {
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
          notesCount: notes.total,
          unresolvedNotesCount: notes.unresolved,
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
    });
  } catch (error) {
    console.error('[Pipeline Development API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
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
    const adminContext = await getAdminContextFromSession();

    if (!adminContext) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { tenantId, adminId, role } = adminContext;

    if (!['developer', 'admin', 'super_admin'].includes(role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant context required' }, { status: 400 });
    }

    const body = await request.json();
    const { unitIds } = body;

    if (!Array.isArray(unitIds) || unitIds.length === 0) {
      return NextResponse.json({ error: 'unitIds array required' }, { status: 400 });
    }

    // Verify units exist and belong to this tenant/development
    const existingUnits = await db
      .select()
      .from(units)
      .where(
        and(
          eq(units.tenant_id, tenantId),
          eq(units.development_id, developmentId),
          inArray(units.id, unitIds)
        )
      );

    if (existingUnits.length !== unitIds.length) {
      return NextResponse.json({ error: 'Some units not found' }, { status: 400 });
    }

    // Check which units already have pipeline records
    const existingPipelines = await db
      .select({ unit_id: unitSalesPipeline.unit_id })
      .from(unitSalesPipeline)
      .where(inArray(unitSalesPipeline.unit_id, unitIds));

    const existingUnitIds = new Set(existingPipelines.map((p) => p.unit_id));
    const unitsToRelease = existingUnits.filter((u) => !existingUnitIds.has(u.id));

    if (unitsToRelease.length === 0) {
      return NextResponse.json({
        message: 'All units already have pipeline records',
        released: 0,
      });
    }

    // Create pipeline records
    const now = new Date();
    const newPipelines = await db
      .insert(unitSalesPipeline)
      .values(
        unitsToRelease.map((unit) => ({
          tenant_id: tenantId,
          development_id: developmentId,
          unit_id: unit.id,
          purchaser_name: unit.purchaser_name,
          purchaser_email: unit.purchaser_email,
          purchaser_phone: unit.purchaser_phone,
          release_date: now,
          release_updated_by: adminId,
          release_updated_at: now,
        }))
      )
      .returning();

    // Audit log
    await db.insert(audit_log).values({
      tenant_id: tenantId,
      type: 'pipeline',
      action: 'units_released',
      actor_id: adminId,
      actor_role: role,
      metadata: {
        development_id: developmentId,
        unit_ids: unitsToRelease.map((u) => u.id),
        count: unitsToRelease.length,
      },
    });

    return NextResponse.json({
      message: `Released ${unitsToRelease.length} units`,
      released: unitsToRelease.length,
      pipelines: newPipelines,
    });
  } catch (error) {
    console.error('[Pipeline Release API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
