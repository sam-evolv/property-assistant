export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { db } from '@openhouse/db/client';
import { sql } from 'drizzle-orm';
import { getAnalyticsHealth } from '@openhouse/api';
import { requireRole } from '@/lib/supabase-server';

export async function GET() {
  try {
    await requireRole(['super_admin', 'admin']);
  } catch (authError) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const health = getAnalyticsHealth();
    
    const [
      totalResult,
      todayResult,
      last5MinResult,
      lastInsertResult,
      breakdownResult
    ] = await Promise.all([
      db.execute(sql`SELECT COUNT(*) as count FROM analytics_events`),
      db.execute(sql`
        SELECT COUNT(*) as count FROM analytics_events 
        WHERE created_at > CURRENT_DATE
      `),
      db.execute(sql`
        SELECT COUNT(*) as count FROM analytics_events 
        WHERE created_at > now() - interval '5 minutes'
      `),
      db.execute(sql`
        SELECT created_at FROM analytics_events 
        ORDER BY created_at DESC LIMIT 1
      `),
      db.execute(sql`
        SELECT event_type, COUNT(*) as count 
        FROM analytics_events 
        GROUP BY event_type 
        ORDER BY count DESC
      `)
    ]);

    const totalEvents = Number(totalResult.rows[0]?.count || 0);
    const eventsToday = Number(todayResult.rows[0]?.count || 0);
    const eventsLast5Min = Number(last5MinResult.rows[0]?.count || 0);
    const lastInsertTimestamp = lastInsertResult.rows[0]?.created_at || null;
    
    const eventBreakdown: Record<string, number> = {};
    for (const row of breakdownResult.rows as { event_type: string; count: string }[]) {
      eventBreakdown[row.event_type] = Number(row.count);
    }

    let tableExists = true;
    try {
      await db.execute(sql`SELECT 1 FROM analytics_events LIMIT 1`);
    } catch {
      tableExists = false;
    }

    const confidenceCheck = {
      analyticsTableExists: tableExists,
      lastInsertTimestamp,
      insertsLast5Minutes: eventsLast5Min,
      insertsToday: eventsToday,
      insertsTotal: totalEvents,
      eventBreakdown,
      memoryHealth: health,
      status: tableExists && totalEvents > 0 ? 'operational' : 'degraded',
      checkedAt: new Date().toISOString()
    };

    return NextResponse.json(confidenceCheck);
  } catch (error) {
    console.error('[Analytics Health] Error:', error);
    return NextResponse.json({
      analyticsTableExists: false,
      lastInsertTimestamp: null,
      insertsLast5Minutes: 0,
      insertsToday: 0,
      insertsTotal: 0,
      eventBreakdown: {},
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      checkedAt: new Date().toISOString()
    }, { status: 500 });
  }
}
