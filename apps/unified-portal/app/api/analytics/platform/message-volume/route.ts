import { NextResponse } from 'next/server';
import { db } from '@openhouse/db';
import { messages } from '@openhouse/db/schema';
import { sql } from 'drizzle-orm';
import { getServerSession } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    // Platform-wide aggregate across all tenants. Restricted to super_admin
    // (the platform overview dashboard).
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (session.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

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
    return NextResponse.json(
      { error: 'Failed to fetch message volume' },
      { status: 500 }
    );
  }
}
