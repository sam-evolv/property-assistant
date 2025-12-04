import { NextResponse } from 'next/server';
import { db } from '@openhouse/db';
import { messages, homeowners } from '@openhouse/db/schema';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { developmentId: string } }
) {
  try {
    const { developmentId } = params;
    
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [msgCount, homeownerCount, msgGrowth] = await Promise.all([
      db.select({ count: sql<number>`COUNT(*)::int` })
        .from(messages)
        .where(sql`${messages.development_id} = ${developmentId}`)
        .then(r => r[0]?.count || 0),
      
      db.select({ count: sql<number>`COUNT(*)::int` })
        .from(homeowners)
        .where(sql`${homeowners.development_id} = ${developmentId}`)
        .then(r => r[0]?.count || 0),
      
      db.select({ count: sql<number>`COUNT(*)::int` })
        .from(messages)
        .where(sql`${messages.development_id} = ${developmentId} AND ${messages.created_at} >= ${sevenDaysAgo}`)
        .then(r => r[0]?.count || 0),
    ]);

    const overview = {
      total_messages: msgCount,
      total_homeowners: homeownerCount,
      growth_7d: msgGrowth,
    };

    return NextResponse.json(overview);
  } catch (error) {
    console.error('[API] /api/analytics/developments/[id]/overview error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch development overview' },
      { status: 500 }
    );
  }
}
