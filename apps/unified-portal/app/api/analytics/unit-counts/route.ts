export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@openhouse/api/session';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false },
      db: { schema: 'public' }
    }
  );
}

/**
 * This endpoint exactly replicates the Homeowners page's server-side query
 * to ensure consistent counts across Analytics, Insights, and Homeowners tabs.
 *
 * Source of truth: supabaseAdmin.from('units').select('*')
 */
export async function GET(request: NextRequest) {
  try {
    const adminContext = await getAdminSession();

    if (!adminContext) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const developmentId = searchParams.get('developmentId');

    // Build query exactly like the Homeowners page does
    let query = supabaseAdmin
      .from('units')
      .select('id, project_id, created_at, purchaser_email', { count: 'exact' });

    // Filter by development/project if specified
    if (developmentId && developmentId !== 'all') {
      query = query.eq('project_id', developmentId);
    }

    const { data: units, count, error } = await query;

    if (error) {
      console.error('[UNIT COUNTS] Error fetching units:', error);
      return NextResponse.json({ error: 'Failed to fetch units' }, { status: 500 });
    }

    // Calculate additional metrics
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const totalHomeowners = count || units?.length || 0;

    // Count onboarded this month (created in last 30 days)
    const onboardedThisMonth = (units || []).filter(u => {
      if (!u.created_at) return false;
      const createdAt = new Date(u.created_at);
      return createdAt >= thirtyDaysAgo;
    }).length;

    // Count with email (considered "active" or "registered")
    const withEmail = (units || []).filter(u => u.purchaser_email).length;

    console.log('[UNIT COUNTS] Results:', {
      total: totalHomeowners,
      onboardedThisMonth,
      withEmail,
      developmentId: developmentId || 'all'
    });

    return NextResponse.json({
      success: true,
      total: totalHomeowners,
      onboarded_this_month: onboardedThisMonth,
      with_email: withEmail,
      // Include breakdown by development if fetching all
      ...((!developmentId || developmentId === 'all') && units ? {
        by_development: Object.entries(
          (units || []).reduce((acc, u) => {
            const pid = u.project_id || 'unknown';
            acc[pid] = (acc[pid] || 0) + 1;
            return acc;
          }, {} as Record<string, number>)
        ).map(([id, count]) => ({ development_id: id, count }))
      } : {})
    });
  } catch (error) {
    console.error('[UNIT COUNTS] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch unit counts' }, { status: 500 });
  }
}
