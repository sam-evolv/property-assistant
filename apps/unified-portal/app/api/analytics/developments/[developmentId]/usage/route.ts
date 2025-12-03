import { NextResponse } from 'next/server';
import { db } from '@openhouse/db';
import { messages } from '@openhouse/db/schema';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { developmentId: string } }
) {
  try {
    const { developmentId } = params;
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const result = await db.select({
      total_messages: sql<number>`COUNT(*)::int`,
      total_tokens: sql<number>`COALESCE(SUM(${messages.token_count}), 0)::int`,
      avg_response_time_ms: sql<number>`COALESCE(AVG(${messages.latency_ms}), 0)::int`,
    })
      .from(messages)
      .where(sql`${messages.development_id} = ${developmentId} AND ${messages.created_at} >= ${startDate}`);

    const usage = result[0] || {
      total_messages: 0,
      total_tokens: 0,
      avg_response_time_ms: 0,
    };

    const estimated_cost_usd = (usage.total_tokens / 1000000) * 2.0;

    return NextResponse.json({
      ...usage,
      estimated_cost_usd: parseFloat(estimated_cost_usd.toFixed(4)),
    });
  } catch (error) {
    console.error('[API] /api/analytics/developments/[id]/usage error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch development usage metrics' },
      { status: 500 }
    );
  }
}
