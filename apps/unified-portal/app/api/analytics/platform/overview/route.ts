import { NextResponse } from 'next/server';
import { db } from '@openhouse/db';
import { developments, messages, homeowners, units, documents, admins } from '@openhouse/db/schema';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [devCount, msgCount, activeUsers, unitCount, homeownerCount, docCount, developerCount] = await Promise.all([
      db.select({ count: sql<number>`COUNT(*)::int` }).from(developments).then(r => r[0]?.count || 0),
      db.select({ count: sql<number>`COUNT(*)::int` }).from(messages).then(r => r[0]?.count || 0),
      db.execute(sql`
        SELECT COUNT(DISTINCT house_id)::int as count
        FROM messages
        WHERE created_at >= ${sevenDaysAgo} AND house_id IS NOT NULL
      `).then(r => r.rows[0]?.count || 0),
      db.select({ count: sql<number>`COUNT(*)::int` }).from(units).then(r => r[0]?.count || 0),
      db.select({ count: sql<number>`COUNT(*)::int` }).from(homeowners).then(r => r[0]?.count || 0),
      db.select({ count: sql<number>`COUNT(*)::int` }).from(documents).then(r => r[0]?.count || 0),
      db.select({ count: sql<number>`COUNT(DISTINCT tenant_id)::int` }).from(admins).then(r => r[0]?.count || 0),
    ]);

    const overview = {
      total_developers: developerCount,
      total_developments: devCount,
      total_units: unitCount,
      total_homeowners: homeownerCount,
      total_messages: msgCount,
      total_documents: docCount,
      active_homeowners_7d: activeUsers,
    };

    return NextResponse.json(overview);
  } catch (error) {
    console.error('[API] /api/analytics/platform/overview error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch platform overview' },
      { status: 500 }
    );
  }
}
