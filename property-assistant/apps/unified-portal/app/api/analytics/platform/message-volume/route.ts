import { NextResponse } from 'next/server';
import { db } from '@openhouse/db';
import { messages } from '@openhouse/db/schema';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const result = await db.select({
      date: sql<string>`DATE(${messages.created_at})`,
      count: sql<number>`COUNT(*)::int`,
    })
      .from(messages)
      .where(sql`${messages.created_at} >= ${startDate}`)
      .groupBy(sql`DATE(${messages.created_at})`)
      .orderBy(sql`DATE(${messages.created_at})`);

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('[API] /api/analytics/platform/message-volume error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch message volume' },
      { status: 500 }
    );
  }
}
