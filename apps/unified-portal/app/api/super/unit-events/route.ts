export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@openhouse/db/client';
import { sql } from 'drizzle-orm';
import { requireRole } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  try {
    await requireRole(['super_admin', 'admin']);
  } catch (authError) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const unitId = searchParams.get('unit_id');
    const parsedLimit = parseInt(searchParams.get('limit') || '30');
    const limit = Math.min(isNaN(parsedLimit) ? 30 : parsedLimit, 100);

    if (!unitId) {
      return NextResponse.json(
        { error: 'unit_id is required' },
        { status: 400 }
      );
    }

    const events = await db.execute(sql`
      SELECT 
        id,
        event_type,
        event_category,
        event_data,
        session_hash,
        created_at
      FROM analytics_events
      WHERE event_data->>'unit_id' = ${unitId}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `);

    return NextResponse.json({
      unit_id: unitId,
      count: events.rows.length,
      events: events.rows.map((row: any) => ({
        id: row.id,
        event_type: row.event_type,
        event_category: row.event_category,
        event_data: row.event_data,
        session_hash: row.session_hash,
        created_at: row.created_at,
      })),
    });
  } catch (error: any) {
    console.error('[Unit Events API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch unit events: ' + error.message },
      { status: 500 }
    );
  }
}
