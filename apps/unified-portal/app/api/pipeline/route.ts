/**
 * Sales Pipeline API - Development List
 *
 * GET /api/pipeline
 * Returns all developments with pipeline summary stats for the current tenant
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminContextFromSession } from '@/lib/api-auth';
import { db } from '@openhouse/db/client';
import { developments, units } from '@openhouse/db/schema';
import { eq, sql, count } from 'drizzle-orm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
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

    // Get all developments for this tenant
    const devList = await db
      .select({
        id: developments.id,
        name: developments.name,
        code: developments.code,
        address: developments.address,
        is_active: developments.is_active,
      })
      .from(developments)
      .where(eq(developments.tenant_id, tenantId))
      .orderBy(sql`name ASC`);

    // Check if pipeline tables exist
    let pipelineTablesExist = false;
    try {
      await db.execute(sql`SELECT 1 FROM unit_sales_pipeline LIMIT 1`);
      pipelineTablesExist = true;
    } catch (e) {
      // Tables don't exist yet - that's OK
      console.log('[Pipeline API] Pipeline tables not yet created, showing basic development list');
    }

    // Get stats for each development
    const developmentsWithStats = await Promise.all(
      devList.map(async (dev) => {
        // Count total units
        const [totalResult] = await db
          .select({ count: count() })
          .from(units)
          .where(sql`${units.tenant_id} = ${tenantId} AND ${units.development_id} = ${dev.id}`);

        let releasedCount = 0;
        let handedOverCount = 0;
        let inProgressCount = 0;
        let unresolvedNotesCount = 0;

        // Only query pipeline stats if tables exist
        if (pipelineTablesExist) {
          try {
            // Count released units (have pipeline record with release_date)
            const releasedResult = await db.execute(sql`
              SELECT COUNT(*) as count FROM unit_sales_pipeline
              WHERE tenant_id = ${tenantId}
              AND development_id = ${dev.id}
              AND release_date IS NOT NULL
            `);
            releasedCount = Number(releasedResult.rows?.[0]?.count || 0);

            // Count handed over units
            const handedOverResult = await db.execute(sql`
              SELECT COUNT(*) as count FROM unit_sales_pipeline
              WHERE tenant_id = ${tenantId}
              AND development_id = ${dev.id}
              AND handover_date IS NOT NULL
            `);
            handedOverCount = Number(handedOverResult.rows?.[0]?.count || 0);

            // Count in-progress (released but not handed over)
            const inProgressResult = await db.execute(sql`
              SELECT COUNT(*) as count FROM unit_sales_pipeline
              WHERE tenant_id = ${tenantId}
              AND development_id = ${dev.id}
              AND release_date IS NOT NULL
              AND handover_date IS NULL
            `);
            inProgressCount = Number(inProgressResult.rows?.[0]?.count || 0);

            // Count unresolved notes
            const unresolvedResult = await db.execute(sql`
              SELECT COUNT(*) as count FROM unit_pipeline_notes
              WHERE tenant_id = ${tenantId}
              AND pipeline_id IN (
                SELECT id FROM unit_sales_pipeline
                WHERE development_id = ${dev.id}
              )
              AND is_resolved = false
            `);
            unresolvedNotesCount = Number(unresolvedResult.rows?.[0]?.count || 0);
          } catch (e) {
            // Query failed, use defaults
            console.error('[Pipeline API] Error querying pipeline stats:', e);
          }
        }

        return {
          id: dev.id,
          name: dev.name,
          code: dev.code,
          address: dev.address,
          isActive: dev.is_active,
          totalUnits: totalResult?.count || 0,
          releasedUnits: releasedCount,
          stats: {
            released: releasedCount,
            inProgress: inProgressCount,
            handedOver: handedOverCount,
          },
          hasUnresolvedNotes: unresolvedNotesCount > 0,
          unresolvedNotesCount: unresolvedNotesCount,
        };
      })
    );

    return NextResponse.json({
      developments: developmentsWithStats,
    });
  } catch (error) {
    console.error('[Pipeline API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
