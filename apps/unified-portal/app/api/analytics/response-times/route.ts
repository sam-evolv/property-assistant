export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { db } from '@openhouse/db';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { requireRole } from '@/lib/supabase-server';

const querySchema = z.object({
  developer_id: z.string().uuid().optional(),
  project_id: z.string().uuid().optional(),
  days: z.coerce.number().min(1).max(90).default(30),
});

export interface ResponseTimeData {
  date: string;
  avgTime: number;
  maxTime: number;
}

export async function GET(request: Request) {
  try {
    const session = await requireRole(['developer', 'admin', 'super_admin']);
    const { searchParams } = new URL(request.url);
    
    const parseResult = querySchema.safeParse({
      developer_id: searchParams.get('developer_id') || undefined,
      project_id: searchParams.get('project_id') || undefined,
      days: searchParams.get('days') || 30,
    });

    if (!parseResult.success) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    const { developer_id: requestedTenantId, project_id, days } = parseResult.data;

    // SECURITY: developer_id is accepted for backward compatibility but ignored for
    // non-super sessions — always scope to the session tenant. Only super_admin may
    // query another tenant via the param.
    const developer_id = session.role === 'super_admin'
      ? (requestedTenantId || session.tenantId)
      : session.tenantId;
    if (!developer_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const projectFilter = project_id 
      ? sql`AND development_id = ${project_id}::uuid` 
      : sql``;

    const result = await db.execute(sql`
      SELECT 
        TO_CHAR(DATE_TRUNC('day', created_at), 'YYYY-MM-DD') as date,
        COALESCE(AVG(latency_ms), 0)::int as avg_time,
        COALESCE(MAX(latency_ms), 0)::int as max_time
      FROM messages
      WHERE development_id IN (
        SELECT id FROM developments WHERE tenant_id = ${developer_id}::uuid
      )
        AND created_at > NOW() - MAKE_INTERVAL(days => ${days})
        AND latency_ms IS NOT NULL
        ${projectFilter}
      GROUP BY DATE_TRUNC('day', created_at)
      ORDER BY date ASC
    `);

    const allDays: ResponseTimeData[] = [];
    const now = new Date();
    
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const displayDate = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      
      const existing = (result.rows as any[]).find(r => r.date === dateStr);
      allDays.push({
        date: displayDate,
        avgTime: existing?.avg_time || 0,
        maxTime: existing?.max_time || 0,
      });
    }

    const avgOverall = allDays.reduce((sum, d) => sum + d.avgTime, 0) / Math.max(allDays.filter(d => d.avgTime > 0).length, 1);
    const maxOverall = Math.max(...allDays.map(d => d.maxTime));

    return NextResponse.json({ 
      responseTimes: allDays,
      avgOverall: Math.round(avgOverall) || 0,
      maxOverall: maxOverall || 0,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (errorMessage === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Failed to fetch response times' }, { status: 500 });
  }
}
