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

export interface DailyActivityData {
  date: string;
  chats: number;
  messages: number;
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
        COUNT(*)::int as chats,
        COUNT(*)::int as messages
      FROM messages
      WHERE tenant_id = ${developer_id}::uuid
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
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (errorMessage === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Failed to fetch daily activity' }, { status: 500 });
  }
}
