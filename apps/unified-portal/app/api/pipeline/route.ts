/**
 * Sales Pipeline API - Development List
 *
 * GET /api/pipeline
 * Returns all developments with pipeline summary stats for the current tenant
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminContextFromSession } from '@/lib/api-auth';
import { db } from '@openhouse/db/client';
import { developments, units, unitSalesPipeline, unitPipelineNotes } from '@openhouse/db/schema';
import { eq, sql, and, isNotNull, isNull, count } from 'drizzle-orm';

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

    // Get all developments for this tenant with pipeline stats
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

    // Get stats for each development
    const developmentsWithStats = await Promise.all(
      devList.map(async (dev) => {
        // Count total units
        const [totalResult] = await db
          .select({ count: count() })
          .from(units)
          .where(and(eq(units.tenant_id, tenantId), eq(units.development_id, dev.id)));

        // Count released units (have pipeline record with release_date)
        const [releasedResult] = await db
          .select({ count: count() })
          .from(unitSalesPipeline)
          .where(
            and(
              eq(unitSalesPipeline.tenant_id, tenantId),
              eq(unitSalesPipeline.development_id, dev.id),
              isNotNull(unitSalesPipeline.release_date)
            )
          );

        // Count handed over units
        const [handedOverResult] = await db
          .select({ count: count() })
          .from(unitSalesPipeline)
          .where(
            and(
              eq(unitSalesPipeline.tenant_id, tenantId),
              eq(unitSalesPipeline.development_id, dev.id),
              isNotNull(unitSalesPipeline.handover_date)
            )
          );

        // Count in-progress (released but not handed over)
        const [inProgressResult] = await db
          .select({ count: count() })
          .from(unitSalesPipeline)
          .where(
            and(
              eq(unitSalesPipeline.tenant_id, tenantId),
              eq(unitSalesPipeline.development_id, dev.id),
              isNotNull(unitSalesPipeline.release_date),
              isNull(unitSalesPipeline.handover_date)
            )
          );

        // Count unresolved notes
        const [unresolvedNotesResult] = await db
          .select({ count: count() })
          .from(unitPipelineNotes)
          .where(
            and(
              eq(unitPipelineNotes.tenant_id, tenantId),
              sql`${unitPipelineNotes.pipeline_id} IN (
                SELECT id FROM unit_sales_pipeline
                WHERE development_id = ${dev.id}
              )`,
              eq(unitPipelineNotes.is_resolved, false)
            )
          );

        return {
          id: dev.id,
          name: dev.name,
          code: dev.code,
          address: dev.address,
          isActive: dev.is_active,
          totalUnits: totalResult?.count || 0,
          releasedUnits: releasedResult?.count || 0,
          stats: {
            released: releasedResult?.count || 0,
            inProgress: inProgressResult?.count || 0,
            handedOver: handedOverResult?.count || 0,
          },
          hasUnresolvedNotes: (unresolvedNotesResult?.count || 0) > 0,
          unresolvedNotesCount: unresolvedNotesResult?.count || 0,
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
