import { NextResponse } from 'next/server';
import { db } from '@openhouse/db';
import { messages, developments, homeowners } from '@openhouse/db/schema';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '5');

    const result = await db.execute(sql`
      SELECT 
        d.id,
        d.name,
        COUNT(DISTINCT m.id)::int as message_count,
        COUNT(DISTINCT h.id)::int as homeowner_count
      FROM developments d
      LEFT JOIN messages m ON m.development_id = d.id
      LEFT JOIN homeowners h ON h.development_id = d.id
      GROUP BY d.id, d.name
      ORDER BY COUNT(DISTINCT m.id) DESC
      LIMIT ${limit}
    `);

    return NextResponse.json({ data: result.rows });
  } catch (error) {
    console.error('[API] /api/analytics/platform/top-developments error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch top developments' },
      { status: 500 }
    );
  }
}
