import { NextResponse } from 'next/server';
import { db } from '@openhouse/db';
import { messages } from '@openhouse/db/schema';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');
    const limit = parseInt(searchParams.get('limit') || '10');

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const result = await db.select({
      question: sql<string>`SUBSTRING(${messages.user_message} FROM 1 FOR 100)`,
      count: sql<number>`COUNT(*)::int`,
    })
      .from(messages)
      .where(sql`${messages.created_at} >= ${startDate} AND ${messages.user_message} IS NOT NULL`)
      .groupBy(sql`SUBSTRING(${messages.user_message} FROM 1 FOR 100)`)
      .orderBy(sql`COUNT(*) DESC`)
      .limit(limit);

    return NextResponse.json({ topQuestions: result });
  } catch (error) {
    console.error('[API] /api/analytics-v2/top-questions error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch top questions' },
      { status: 500 }
    );
  }
}
