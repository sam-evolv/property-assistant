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
import { eq, sql, and } from 'drizzle-orm';

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
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenant_id');
    const developmentId = searchParams.get('development_id');

    if (!tenantId) {
      return NextResponse.json(
        { error: 'tenant_id is required' },
        { status: 400 }
      );
    }

    // If specific development requested, get count for just that development
    if (developmentId) {
      try {
        // Get count directly from homeowners table for specific development
        const countResult = await db.execute(sql`
          SELECT COUNT(*)::int as count
          FROM homeowners
          WHERE development_id = ${developmentId}::uuid
        `);

        const count = Number((countResult.rows[0] as any)?.count) || 0;

        // Get development name
        const dev = await db.query.developments.findFirst({
          where: eq(developments.id, developmentId),
          columns: { id: true, name: true }
        });

        return NextResponse.json({
          totalHomeowners: count,
          onboardedHomeowners: count, // All homeowners in the table are considered onboarded
          developments: dev ? [{
            developmentId: dev.id,
            developmentName: dev.name,
            totalHomeowners: count
          }] : []
        } as HomeownerCountsResponse);
      } catch (err) {
        console.error('[Homeowner Counts API] Failed to get count for development:', err);
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
        WHERE d.tenant_id = ${tenantId}::uuid
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
      console.error('[Homeowner Counts API] Failed to fetch homeowner counts:', err);
      return NextResponse.json(
        { error: 'Failed to fetch homeowner counts' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[Homeowner Counts API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch homeowner counts' },
      { status: 500 }
    );
  }
}
