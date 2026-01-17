/**
 * API endpoint to get actual homeowner/unit counts per development
 * Used by Analytics and Insights pages for accurate totals
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { db } from '@openhouse/db/client';
import { developments } from '@openhouse/db/schema';
import { eq } from 'drizzle-orm';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

interface DevelopmentCounts {
  developmentId: string;
  developmentName: string;
  totalUnits: number;
  onboardedUnits: number; // Units with purchaser_name set
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

    const supabaseAdmin = getSupabaseAdmin();

    // Get developments for this tenant
    let devs: any[] = [];
    try {
      if (developmentId) {
        // Get specific development
        devs = await db
          .select({ id: developments.id, name: developments.name })
          .from(developments)
          .where(eq(developments.id, developmentId));
      } else {
        // Get all developments for this tenant
        devs = await db
          .select({ id: developments.id, name: developments.name })
          .from(developments)
          .where(eq(developments.tenant_id, tenantId));
      }
    } catch (err) {
      console.error('[Homeowner Counts API] Failed to fetch developments:', err);
      return NextResponse.json(
        { error: 'Failed to fetch developments' },
        { status: 500 }
      );
    }

    if (devs.length === 0) {
      return NextResponse.json({
        totalHomeowners: 0,
        onboardedHomeowners: 0,
        developments: []
      } as HomeownerCountsResponse);
    }

    // Get unit counts per development
    const developmentCounts: DevelopmentCounts[] = [];
    let totalHomeowners = 0;
    let onboardedHomeowners = 0;

    for (const dev of devs) {
      try {
        // Get total units count for this development
        const { count: totalCount } = await supabaseAdmin
          .from('units')
          .select('*', { count: 'exact', head: true })
          .eq('project_id', dev.id);

        // Get onboarded units (with purchaser_name set)
        const { count: onboardedCount } = await supabaseAdmin
          .from('units')
          .select('*', { count: 'exact', head: true })
          .eq('project_id', dev.id)
          .not('purchaser_name', 'is', null);

        const total = totalCount || 0;
        const onboarded = onboardedCount || 0;

        developmentCounts.push({
          developmentId: dev.id,
          developmentName: dev.name,
          totalUnits: total,
          onboardedUnits: onboarded,
        });

        totalHomeowners += total;
        onboardedHomeowners += onboarded;
      } catch (err) {
        console.error(`[Homeowner Counts API] Failed to get counts for ${dev.id}:`, err);
        // Continue with other developments
      }
    }

    const response: HomeownerCountsResponse = {
      totalHomeowners,
      onboardedHomeowners,
      developments: developmentCounts,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Homeowner Counts API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch homeowner counts' },
      { status: 500 }
    );
  }
}
