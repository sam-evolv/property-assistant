import { NextRequest, NextResponse } from 'next/server';
import { assertDevOnly, DevOnlyError, isProductionEnvironment } from '@/lib/env-validation';
import { db } from '@openhouse/db';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  if (isProductionEnvironment()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    assertDevOnly('data-integrity-endpoint');
  } catch (e) {
    if (e instanceof DevOnlyError) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    throw e;
  }

  try {
    const messagesByDevelopment = await db.execute(sql`
      SELECT 
        development_id,
        COUNT(*)::int as message_count,
        COUNT(DISTINCT user_id)::int as unique_users,
        COUNT(DISTINCT session_id)::int as unique_sessions,
        MIN(created_at) as first_message,
        MAX(created_at) as last_message
      FROM messages
      WHERE development_id IS NOT NULL
      GROUP BY development_id
      ORDER BY message_count DESC
    `);

    const messagesWithNullUnitId = await db.execute(sql`
      SELECT 
        COUNT(*)::int as count,
        COUNT(DISTINCT development_id)::int as affected_developments,
        COUNT(DISTINCT user_id)::int as affected_users
      FROM messages
      WHERE unit_id IS NULL
    `);

    const topUnitsByMessages = await db.execute(sql`
      SELECT 
        unit_id,
        development_id,
        COUNT(*)::int as message_count,
        COUNT(DISTINCT user_id)::int as unique_users,
        MIN(created_at) as first_message,
        MAX(created_at) as last_message
      FROM messages
      WHERE unit_id IS NOT NULL
      GROUP BY unit_id, development_id
      ORDER BY message_count DESC
      LIMIT 10
    `);

    const totalStats = await db.execute(sql`
      SELECT 
        COUNT(*)::int as total_messages,
        COUNT(DISTINCT development_id)::int as total_developments,
        COUNT(DISTINCT user_id)::int as total_users,
        COUNT(DISTINCT unit_id)::int as linked_units,
        COUNT(CASE WHEN unit_id IS NOT NULL THEN 1 END)::int as messages_with_unit,
        COUNT(CASE WHEN unit_id IS NULL THEN 1 END)::int as messages_without_unit
      FROM messages
    `);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      data: {
        summary: totalStats.rows[0],
        messagesByDevelopment: messagesByDevelopment.rows,
        nullUnitIdStats: messagesWithNullUnitId.rows[0],
        topUnitsByMessages: topUnitsByMessages.rows,
      },
      recommendations: generateRecommendations(
        totalStats.rows[0] as any,
        messagesWithNullUnitId.rows[0] as any
      ),
    });
  } catch (error) {
    console.error('[DataIntegrity] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch data integrity stats', details: String(error) },
      { status: 500 }
    );
  }
}

function generateRecommendations(
  summary: { total_messages: number; messages_with_unit: number; messages_without_unit: number },
  nullStats: { count: number }
): string[] {
  const recommendations: string[] = [];

  if (nullStats.count > 0) {
    const pct = Math.round((nullStats.count / summary.total_messages) * 100);
    recommendations.push(
      `${nullStats.count} messages (${pct}%) are missing unit_id linkage. Consider running a backfill script.`
    );
  }

  if (summary.messages_with_unit === 0 && summary.total_messages > 0) {
    recommendations.push(
      'No messages have unit_id set. The write-path fix may not be deployed yet, or no new messages have been created.'
    );
  }

  if (summary.messages_with_unit > 0 && summary.messages_without_unit === 0) {
    recommendations.push('All messages have unit_id linkage. No backfill needed.');
  }

  return recommendations;
}
