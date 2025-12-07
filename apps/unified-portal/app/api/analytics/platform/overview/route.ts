import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { db } from '@openhouse/db';
import { developments, messages, homeowners, documents, admins } from '@openhouse/db/schema';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

// Create Supabase admin client for real unit data
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Fetch unit count from Supabase (real data)
    const { count: supabaseUnitCount, error: unitError } = await supabaseAdmin
      .from('units')
      .select('*', { count: 'exact', head: true });

    if (unitError) {
      console.error('[Analytics] Error fetching Supabase units:', unitError);
    }

    // Fetch project count from Supabase (real data)
    const { count: supabaseProjectCount, error: projectError } = await supabaseAdmin
      .from('projects')
      .select('*', { count: 'exact', head: true });

    if (projectError) {
      console.error('[Analytics] Error fetching Supabase projects:', projectError);
    }

    // Fetch legacy data from Drizzle for messages, docs, etc. (these stay in old schema for now)
    const [msgCount, activeUsers, homeownerCount, docCount, developerCount] = await Promise.all([
      db.select({ count: sql<number>`COUNT(*)::int` }).from(messages).then(r => r[0]?.count || 0),
      db.execute(sql`
        SELECT COUNT(DISTINCT house_id)::int as count
        FROM messages
        WHERE created_at >= ${sevenDaysAgo} AND house_id IS NOT NULL
      `).then(r => r.rows[0]?.count || 0),
      db.select({ count: sql<number>`COUNT(*)::int` }).from(homeowners).then(r => r[0]?.count || 0),
      db.select({ count: sql<number>`COUNT(*)::int` }).from(documents).then(r => r[0]?.count || 0),
      db.select({ count: sql<number>`COUNT(DISTINCT tenant_id)::int` }).from(admins).then(r => r[0]?.count || 0),
    ]);

    const overview = {
      total_developers: developerCount,
      total_developments: supabaseProjectCount || 0,  // Use Supabase projects
      total_units: supabaseUnitCount || 0,             // Use Supabase units
      total_homeowners: homeownerCount,
      total_messages: msgCount,
      total_documents: docCount,
      active_homeowners_7d: activeUsers,
    };

    console.log('[Analytics] Platform overview:', overview);

    return NextResponse.json(overview);
  } catch (error) {
    console.error('[API] /api/analytics/platform/overview error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch platform overview' },
      { status: 500 }
    );
  }
}
