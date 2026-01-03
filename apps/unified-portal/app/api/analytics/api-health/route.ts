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

export interface ApiHealthData {
  uptimePercent: number;
  avgTokensPerMessage: number;
  apiCallsPerMinute: number;
  totalApiCalls: number;
  failedCalls: number;
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

    const [messagesResult, errorResult] = await Promise.all([
      db.execute(sql`
        SELECT 
          COUNT(*)::int as total_messages,
          COALESCE(AVG(token_count), 0)::int as avg_tokens
        FROM messages
        WHERE development_id IN (
          SELECT id FROM developments WHERE tenant_id = ${developer_id}::uuid
        )
          AND created_at > NOW() - MAKE_INTERVAL(days => ${days})
          ${projectFilter}
      `),
      db.execute(sql`
        SELECT COUNT(*)::int as error_count
        FROM error_logs
        WHERE tenant_id = ${developer_id}::uuid
          AND created_at > NOW() - MAKE_INTERVAL(days => ${days})
          AND resolved = false
      `).catch(() => ({ rows: [{ error_count: 0 }] })),
    ]);

    const msgData = messagesResult.rows[0] as any;
    const errData = errorResult.rows[0] as any;
    
    const totalMessages = msgData?.total_messages || 0;
    const errorCount = errData?.error_count || 0;
    const minutesInPeriod = days * 24 * 60;
    
    const uptime = totalMessages > 0 
      ? Math.max(0, Math.min(100, ((totalMessages - errorCount) / totalMessages) * 100))
      : 100;

    return NextResponse.json({
      uptimePercent: Number(uptime.toFixed(1)),
      avgTokensPerMessage: msgData?.avg_tokens || 0,
      apiCallsPerMinute: Math.round(totalMessages / Math.max(minutesInPeriod, 1)),
      totalApiCalls: totalMessages,
      failedCalls: errorCount,
    });
  } catch (error) {
    console.error('[API] /api/analytics/api-health error:', error);
    return NextResponse.json({ 
      uptimePercent: 100,
      avgTokensPerMessage: 0,
      apiCallsPerMinute: 0,
      totalApiCalls: 0,
      failedCalls: 0,
    });
  }
}
