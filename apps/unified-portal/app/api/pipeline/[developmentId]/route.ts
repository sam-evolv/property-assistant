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
import { developments, units, audit_log } from '@openhouse/db/schema';
import { eq, sql, and, inArray } from 'drizzle-orm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

// Helper to check if pipeline tables exist
async function checkPipelineTablesExist(): Promise<boolean> {
  try {
    await db.execute(sql`SELECT 1 FROM unit_sales_pipeline LIMIT 1`);
    return true;
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

    // Check if pipeline tables exist
    const pipelineTablesExist = await checkPipelineTablesExist();

    // Get all units for this development
    const unitData = await db
      .select()
      .from(units)
      .where(and(eq(units.tenant_id, tenantId), eq(units.development_id, developmentId)))
      .orderBy(sql`${units.unit_number} ASC`);

    // If pipeline tables exist, get pipeline data
    let pipelineData: Map<string, any> = new Map();
    let notesCounts: Map<string, { total: number; unresolved: number }> = new Map();

    if (pipelineTablesExist) {
      try {
        // Get pipeline records for these units
        const pipelineResult = await db.execute(sql`
          SELECT * FROM unit_sales_pipeline
          WHERE tenant_id = ${tenantId}
          AND development_id = ${developmentId}
        `);

        for (const row of pipelineResult.rows || []) {
          pipelineData.set(row.unit_id as string, row);
        }

        // Get notes counts
        const pipelineIds = Array.from(pipelineData.values()).map((p) => p.id);
        if (pipelineIds.length > 0) {
          const notesResult = await db.execute(sql`
            SELECT
              pipeline_id,
              COUNT(*) as total,
              SUM(CASE WHEN is_resolved = false THEN 1 ELSE 0 END) as unresolved
            FROM unit_pipeline_notes
            WHERE pipeline_id = ANY(${pipelineIds}::uuid[])
            GROUP BY pipeline_id
          `);

          for (const row of notesResult.rows || []) {
            notesCounts.set(row.pipeline_id as string, {
              total: Number(row.total),
              unresolved: Number(row.unresolved),
            });
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

        return {
          id: unit.id,
          pipelineId: pipeline?.id || null,
          unitNumber: unit.unit_number,
          address: unit.address_line_1,
          houseTypeCode: unit.house_type_code,
          purchaserName: pipeline?.purchaser_name || unit.purchaser_name || null,
          purchaserEmail: pipeline?.purchaser_email || unit.purchaser_email || null,
          purchaserPhone: pipeline?.purchaser_phone || unit.purchaser_phone || null,
          releaseDate: pipeline?.release_date ? new Date(pipeline.release_date).toISOString() : null,
          saleAgreedDate: pipeline?.sale_agreed_date ? new Date(pipeline.sale_agreed_date).toISOString() : null,
          depositDate: pipeline?.deposit_date ? new Date(pipeline.deposit_date).toISOString() : null,
          contractsIssuedDate: pipeline?.contracts_issued_date ? new Date(pipeline.contracts_issued_date).toISOString() : null,
          signedContractsDate: pipeline?.signed_contracts_date ? new Date(pipeline.signed_contracts_date).toISOString() : null,
          counterSignedDate: pipeline?.counter_signed_date ? new Date(pipeline.counter_signed_date).toISOString() : null,
          kitchenDate: pipeline?.kitchen_date ? new Date(pipeline.kitchen_date).toISOString() : null,
          snagDate: pipeline?.snag_date ? new Date(pipeline.snag_date).toISOString() : null,
          drawdownDate: pipeline?.drawdown_date ? new Date(pipeline.drawdown_date).toISOString() : null,
          handoverDate: pipeline?.handover_date ? new Date(pipeline.handover_date).toISOString() : null,
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
      pipelineTablesExist, // Let frontend know if tables exist
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

    const { tenantId, adminId, role, email } = adminContext;

    if (!['developer', 'admin', 'super_admin'].includes(role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant context required' }, { status: 400 });
    }

    // Check if pipeline tables exist
    const pipelineTablesExist = await checkPipelineTablesExist();
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
    const existingPipelinesResult = await db.execute(sql`
      SELECT unit_id FROM unit_sales_pipeline
      WHERE unit_id = ANY(${unitIds}::uuid[])
    `);

    const existingUnitIds = new Set((existingPipelinesResult.rows || []).map((p: any) => p.unit_id));
    const unitsToRelease = existingUnits.filter((u) => !existingUnitIds.has(u.id));

    if (unitsToRelease.length === 0) {
      return NextResponse.json({
        message: 'All units already have pipeline records',
        released: 0,
      });
    }

    // Create pipeline records
    const now = new Date();
    const values = unitsToRelease.map((unit) =>
      sql`(gen_random_uuid(), ${tenantId}::uuid, ${developmentId}::uuid, ${unit.id}::uuid, ${unit.purchaser_name}, ${unit.purchaser_email}, ${unit.purchaser_phone}, ${now}::timestamptz, ${adminId}::uuid, ${now}::timestamptz, NOW(), NOW())`
    );

    await db.execute(sql`
      INSERT INTO unit_sales_pipeline
        (id, tenant_id, development_id, unit_id, purchaser_name, purchaser_email, purchaser_phone, release_date, release_updated_by, release_updated_at, created_at, updated_at)
      VALUES ${sql.join(values, sql`, `)}
    `);

    // Audit log
    await db.insert(audit_log).values({
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

    return NextResponse.json({
      message: `Released ${unitsToRelease.length} units`,
      released: unitsToRelease.length,
    });
  } catch (error) {
    console.error('[Pipeline Release API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
