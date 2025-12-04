import { NextResponse } from 'next/server';
import { db } from '@openhouse/db';
import { homeowners, messages } from '@openhouse/db/schema';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const days = parseInt(searchParams.get('days') || '30');

    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId required' }, { status: 400 });
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const funnelData = await db.execute(sql`
      SELECT
        COUNT(DISTINCT h.id)::int as total_users,
        COUNT(DISTINCT CASE WHEN h.last_active IS NOT NULL THEN h.id END)::int as visited_users,
        COUNT(DISTINCT CASE WHEN h.total_chats > 0 THEN h.id END)::int as chatted_users,
        COUNT(DISTINCT CASE WHEN h.total_chats > 1 THEN h.id END)::int as returning_users
      FROM homeowners h
    `).then(r => r.rows[0]);

    const total = (funnelData?.total_users as number) || 0;
    const visited = (funnelData?.visited_users as number) || 0;
    const chatted = (funnelData?.chatted_users as number) || 0;
    const returning = (funnelData?.returning_users as number) || 0;

    const funnelMetrics = [
      {
        stage: 'Registered',
        count: total,
        conversionRate: 1.0,
        description: 'Total homeowners registered in the system',
      },
      {
        stage: 'Visited',
        count: visited,
        conversionRate: total > 0 ? visited / total : 0,
        description: 'Homeowners who have logged in or visited',
      },
      {
        stage: 'Engaged',
        count: chatted,
        conversionRate: visited > 0 ? chatted / visited : 0,
        description: 'Homeowners who have sent at least one message',
      },
      {
        stage: 'Returning',
        count: returning,
        conversionRate: chatted > 0 ? returning / chatted : 0,
        description: 'Homeowners who have returned for multiple sessions',
      },
    ];

    const overallConversionRate = total > 0 ? returning / total : 0;

    return NextResponse.json({
      funnelMetrics,
      overallConversionRate,
    });
  } catch (error) {
    console.error('[API] /api/analytics-v2/user-funnel error:', error);
    return NextResponse.json({ error: 'Failed to fetch user funnel' }, { status: 500 });
  }
}
