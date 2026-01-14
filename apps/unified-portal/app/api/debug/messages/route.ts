export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@openhouse/api/session';
import { db } from '@openhouse/db/client';
import { sql } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const adminContext = await getAdminSession();
    if (!adminContext) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const developmentId = searchParams.get('developmentId');

    const nullHouseIdCount = await db.execute(sql`
      SELECT COUNT(*)::int as count FROM messages WHERE house_id IS NULL
    `);

    const nullUnitIdCount = await db.execute(sql`
      SELECT COUNT(*)::int as count FROM messages WHERE unit_id IS NULL
    `);

    const nullUserIdCount = await db.execute(sql`
      SELECT COUNT(*)::int as count FROM messages WHERE user_id IS NULL
    `);

    const totalMessages = await db.execute(sql`
      SELECT COUNT(*)::int as count FROM messages
    `);

    let byDevelopment = { rows: [] as any[] };
    if (developmentId) {
      byDevelopment = await db.execute(sql`
        SELECT 
          development_id,
          COUNT(*)::int as total_messages,
          COUNT(DISTINCT user_id)::int as unique_users,
          COUNT(CASE WHEN user_message IS NOT NULL THEN 1 END)::int as user_questions,
          COUNT(CASE WHEN ai_message IS NOT NULL THEN 1 END)::int as ai_responses,
          MIN(created_at) as first_message,
          MAX(created_at) as last_message
        FROM messages
        WHERE development_id = ${developmentId}::uuid
        GROUP BY development_id
      `);
    } else {
      byDevelopment = await db.execute(sql`
        SELECT 
          development_id,
          COUNT(*)::int as total_messages,
          COUNT(DISTINCT user_id)::int as unique_users,
          COUNT(CASE WHEN user_message IS NOT NULL THEN 1 END)::int as user_questions,
          COUNT(CASE WHEN ai_message IS NOT NULL THEN 1 END)::int as ai_responses
        FROM messages
        WHERE development_id IS NOT NULL
        GROUP BY development_id
        ORDER BY total_messages DESC
        LIMIT 20
      `);
    }

    const userIdToUnitMatch = await db.execute(sql`
      SELECT 
        m.user_id,
        COUNT(*)::int as msg_count,
        u.unit_number,
        u.address_line_1
      FROM messages m
      LEFT JOIN units u ON u.id = m.user_id
      WHERE m.development_id = ${developmentId || '34316432-f1e8-4297-b993-d9b5c88ee2d8'}::uuid
        AND m.user_id IS NOT NULL
      GROUP BY m.user_id, u.unit_number, u.address_line_1
      ORDER BY msg_count DESC
      LIMIT 20
    `);

    return NextResponse.json({
      summary: {
        total_messages: (totalMessages.rows[0] as any)?.count || 0,
        null_house_id_count: (nullHouseIdCount.rows[0] as any)?.count || 0,
        null_unit_id_count: (nullUnitIdCount.rows[0] as any)?.count || 0,
        null_user_id_count: (nullUserIdCount.rows[0] as any)?.count || 0,
      },
      by_development: byDevelopment.rows,
      user_id_to_unit_match: userIdToUnitMatch.rows,
      _note: 'Debug panel for message linkage diagnostics',
    });
  } catch (error: any) {
    console.error('[Debug Messages] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch debug data' }, { status: 500 });
  }
}
