export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { db } from '@openhouse/db';
import { sql } from 'drizzle-orm';
import { z } from 'zod';

const querySchema = z.object({
  developer_id: z.string().uuid(),
  project_id: z.string().uuid().optional(),
  days: z.coerce.number().min(1).max(90).default(30),
});

export interface DailyActivityData {
  date: string;
  chats: number;
  messages: number;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    
    const parseResult = querySchema.safeParse({
      developer_id: searchParams.get('developer_id') || undefined,
      project_id: searchParams.get('project_id') || undefined,
      days: searchParams.get('days') || 30,
    });

    if (!parseResult.success) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    const { developer_id, project_id, days } = parseResult.data;

    const projectFilter = project_id 
      ? sql`AND development_id = ${project_id}::uuid` 
      : sql``;

    const result = await db.execute(sql`
      SELECT 
        TO_CHAR(DATE_TRUNC('day', created_at), 'YYYY-MM-DD') as date,
        COUNT(DISTINCT session_hash)::int as chats,
        COUNT(*)::int as messages
      FROM analytics_events
      WHERE tenant_id = ${developer_id}::uuid
        AND event_type = 'chat_question'
        AND created_at > NOW() - MAKE_INTERVAL(days => ${days})
        ${projectFilter}
      GROUP BY DATE_TRUNC('day', created_at)
      ORDER BY date ASC
    `);

    const allDays: DailyActivityData[] = [];
    const now = new Date();
    
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const displayDate = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      
      const existing = (result.rows as any[]).find(r => r.date === dateStr);
      allDays.push({
        date: displayDate,
        chats: existing?.chats || 0,
        messages: existing?.messages || 0,
      });
    }

    return NextResponse.json({ activity: allDays });
  } catch (error) {
    console.error('[API] /api/analytics/daily-activity error:', error);
    return NextResponse.json({ error: 'Failed to fetch daily activity' }, { status: 500 });
  }
}
