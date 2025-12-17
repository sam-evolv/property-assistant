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
    const limit = parseInt(searchParams.get('limit') || '10');

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const result = await db.select({
      question: sql<string>`SUBSTRING(${messages.content} FROM 1 FOR 100)`,
      count: sql<number>`COUNT(*)::int`,
    })
      .from(messages)
      .where(sql`${messages.development_id} = ${developmentId} AND ${messages.created_at} >= ${startDate} AND ${messages.sender} = 'user'`)
      .groupBy(sql`SUBSTRING(${messages.content} FROM 1 FOR 100)`)
      .orderBy(sql`COUNT(*) DESC`)
      .limit(limit);

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('[API] /api/analytics/developments/[id]/top-questions error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch development top questions' },
      { status: 500 }
    );
  }
}
