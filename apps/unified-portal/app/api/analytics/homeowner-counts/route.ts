/**
 * API endpoint to get actual homeowner counts per development
 * Used by Analytics and Insights pages for accurate totals
 *
 * Uses the 'homeowners' table (not 'units') to match what the Homeowners tab displays
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@openhouse/db/client';
import { developments, homeowners } from '@openhouse/db/schema';
import { eq, sql } from 'drizzle-orm';
import { getServerSession } from '@/lib/supabase-server';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface DevelopmentCounts {
  developmentId: string;
  developmentName: string;
  totalHomeowners: number;
}

interface HomeownerCountsResponse {
  totalHomeowners: number;
  onboardedHomeowners: number;
  developments: DevelopmentCounts[];
}

export async function GET(request: NextRequest) {
  try {
    // Uses Drizzle (which bypasses RLS), so scope by tenant in-code.
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const requestedTenantId = searchParams.get('tenant_id');
    const developmentId = searchParams.get('development_id');

    // Non-super callers are locked to their own tenant; super_admin may
    // request counts for a specific tenant.
    const effectiveTenantId =
      session.role === 'super_admin' ? requestedTenantId : session.tenantId;

    if (!effectiveTenantId) {
      return NextResponse.json(
        { error: 'tenant_id is required' },
        { status: 400 }
      );
    }

    // If specific development requested, get count for just that development
    if (developmentId) {
      try {
        if (!UUID_RE.test(developmentId)) {
          return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }

        // Verify the development belongs to the effective tenant (prevents
        // cross-tenant IDOR via development_id).
        const dev = await db.query.developments.findFirst({
          where: eq(developments.id, developmentId),
          columns: { id: true, name: true, tenant_id: true }
        });

        if (!dev || dev.tenant_id !== effectiveTenantId) {
          return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }

        // Get count directly from homeowners table for specific development
        const countResult = await db.execute(sql`
          SELECT COUNT(*)::int as count
          FROM homeowners
          WHERE development_id = ${developmentId}::uuid
            AND tenant_id = ${effectiveTenantId}::uuid
        `);

        const count = Number((countResult.rows[0] as any)?.count) || 0;

        return NextResponse.json({
          totalHomeowners: count,
          onboardedHomeowners: count, // All homeowners in the table are considered onboarded
          developments: [{
            developmentId: dev.id,
            developmentName: dev.name,
            totalHomeowners: count
          }]
        } as HomeownerCountsResponse);
      } catch (err) {
        return NextResponse.json(
          { error: 'Failed to fetch homeowner counts' },
          { status: 500 }
        );
      }
    }

    // Get all developments for this tenant with homeowner counts
    try {
      const result = await db.execute(sql`
        SELECT
          d.id as development_id,
          d.name as development_name,
          COUNT(h.id)::int as homeowner_count
        FROM developments d
        LEFT JOIN homeowners h ON h.development_id = d.id
        WHERE d.tenant_id = ${effectiveTenantId}::uuid
        GROUP BY d.id, d.name
        ORDER BY d.name
      `);

      const developmentCounts: DevelopmentCounts[] = [];
      let totalHomeowners = 0;

      for (const row of result.rows as any[]) {
        const count = Number(row.homeowner_count) || 0;
        developmentCounts.push({
          developmentId: row.development_id,
          developmentName: row.development_name,
          totalHomeowners: count
        });
        totalHomeowners += count;
      }

      return NextResponse.json({
        totalHomeowners,
        onboardedHomeowners: totalHomeowners, // All homeowners in the table are considered onboarded
        developments: developmentCounts,
      } as HomeownerCountsResponse);
    } catch (err) {
      return NextResponse.json(
        { error: 'Failed to fetch homeowner counts' },
        { status: 500 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch homeowner counts' },
      { status: 500 }
    );
  }
}
