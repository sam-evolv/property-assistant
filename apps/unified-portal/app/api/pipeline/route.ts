/**
 * Sales Pipeline API - Development List
 *
 * GET /api/pipeline
 * Returns all developments with pipeline summary stats for the current tenant
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';
import { db } from '@openhouse/db/client';
import { developments, units } from '@openhouse/db/schema';
import { eq, sql, count } from 'drizzle-orm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireRole(['developer', 'admin', 'super_admin']);
    const tenantId = session.tenantId;

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant context required' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    // Get all developments for this tenant - try Drizzle first, fallback to Supabase
    let devList: any[] = [];
    let usedFallback = false;

    try {
      devList = await db
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
      console.log('[Pipeline API] Drizzle developments:', devList.length);
    } catch (drizzleError) {
      console.error('[Pipeline API] Drizzle error (falling back to Supabase):', drizzleError);
      usedFallback = true;

      // Fallback to Supabase
      const { data: supabaseDevs, error: supabaseError } = await supabaseAdmin
        .from('developments')
        .select('id, name, code, address, is_active')
        .eq('tenant_id', tenantId)
        .order('name', { ascending: true });

      if (supabaseError) {
        console.error('[Pipeline API] Supabase fallback error:', supabaseError);
        throw supabaseError;
      }

      devList = supabaseDevs || [];
      console.log('[Pipeline API] Supabase developments:', devList.length);
    }

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
        // Count total units - try Drizzle first, fallback to Supabase
        let totalCount = 0;

        try {
          if (!usedFallback) {
            const [totalResult] = await db
              .select({ count: count() })
              .from(units)
              .where(sql`${units.tenant_id} = ${tenantId} AND ${units.development_id} = ${dev.id}`);
            totalCount = totalResult?.count || 0;
          } else {
            throw new Error('Using Supabase fallback');
          }
        } catch (e) {
          // Fallback to Supabase for unit count
          const { count: supabaseCount } = await supabaseAdmin
            .from('units')
            .select('*', { count: 'exact', head: true })
            .eq('tenant_id', tenantId)
            .eq('development_id', dev.id);
          totalCount = supabaseCount || 0;
        }

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
              WHERE tenant_id = ${tenantId}::uuid
              AND development_id = ${dev.id}::uuid
              AND release_date IS NOT NULL
            `);
            releasedCount = Number(releasedResult.rows?.[0]?.count || 0);

            // Count handed over units
            const handedOverResult = await db.execute(sql`
              SELECT COUNT(*) as count FROM unit_sales_pipeline
              WHERE tenant_id = ${tenantId}::uuid
              AND development_id = ${dev.id}::uuid
              AND handover_date IS NOT NULL
            `);
            handedOverCount = Number(handedOverResult.rows?.[0]?.count || 0);

            // Count in-progress (released but not handed over)
            const inProgressResult = await db.execute(sql`
              SELECT COUNT(*) as count FROM unit_sales_pipeline
              WHERE tenant_id = ${tenantId}::uuid
              AND development_id = ${dev.id}::uuid
              AND release_date IS NOT NULL
              AND handover_date IS NULL
            `);
            inProgressCount = Number(inProgressResult.rows?.[0]?.count || 0);

            // Count unresolved notes
            const unresolvedResult = await db.execute(sql`
              SELECT COUNT(*) as count FROM unit_pipeline_notes
              WHERE tenant_id = ${tenantId}::uuid
              AND pipeline_id IN (
                SELECT id FROM unit_sales_pipeline
                WHERE development_id = ${dev.id}::uuid
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
          totalUnits: totalCount,
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
