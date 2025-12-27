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
      breakdownResult,
      recoveryBreakdownResult,
      messagesBreakdownResult
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
      `),
      db.execute(sql`
        SELECT 
          COUNT(*) FILTER (WHERE event_data->>'recovered' = 'true') as recovered,
          COUNT(*) FILTER (WHERE event_data->>'inferred' = 'true') as inferred,
          COUNT(*) FILTER (WHERE (event_data->>'recovered') IS NULL AND (event_data->>'inferred') IS NULL) as live
        FROM analytics_events
      `),
      db.execute(sql`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE metadata->>'recovered' = 'true') as recovered
        FROM messages
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

    const recoveryRow = recoveryBreakdownResult.rows[0] as { recovered: string; inferred: string; live: string };
    const recoveryBreakdown = {
      recovered: Number(recoveryRow?.recovered || 0),
      inferred: Number(recoveryRow?.inferred || 0),
      live: Number(recoveryRow?.live || 0)
    };

    const messagesRow = messagesBreakdownResult.rows[0] as { total: string; recovered: string };
    const messagesBreakdown = {
      total: Number(messagesRow?.total || 0),
      recovered: Number(messagesRow?.recovered || 0),
      live: Number(messagesRow?.total || 0) - Number(messagesRow?.recovered || 0)
    };

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
      recoveryBreakdown,
      messagesBreakdown,
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
      recoveryBreakdown: { recovered: 0, inferred: 0, live: 0 },
      messagesBreakdown: { total: 0, recovered: 0, live: 0 },
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      checkedAt: new Date().toISOString()
    }, { status: 500 });
  }
}
