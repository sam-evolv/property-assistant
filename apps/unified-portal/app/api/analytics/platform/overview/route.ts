import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { db } from '@openhouse/db';
import { messages, homeowners, documents, admins } from '@openhouse/db/schema';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const REAL_PROJECT_ID = '97dc3919-2726-4675-8046-9f79070ec88c';

export async function GET() {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Get all units count
    const { count: allUnitCount, error: allError } = await supabaseAdmin
      .from('units')
      .select('id', { count: 'exact', head: true });

    console.log('[Analytics] Total units in Supabase:', allUnitCount);

    // Get units by project_id
    const { count: supabaseUnitCount, error: unitError } = await supabaseAdmin
      .from('units')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', REAL_PROJECT_ID);

    if (unitError) {
      console.error('[Analytics] Supabase units error:', unitError);
    }

    // Use all units if no project match
    const finalUnitCount = (supabaseUnitCount && supabaseUnitCount > 0) ? supabaseUnitCount : (allUnitCount || 0);
    console.log('[Analytics] Final unit count:', finalUnitCount);

    const { count: supabaseProjectCount, error: projectError } = await supabaseAdmin
      .from('projects')
      .select('id', { count: 'exact', head: true });

    if (projectError) {
      console.error('[Analytics] Supabase projects error:', projectError);
    }

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
      total_developments: supabaseProjectCount || 1,
      total_units: finalUnitCount,
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
