import { NextResponse } from 'next/server';
import { db } from '@openhouse/db';
import { messages } from '@openhouse/db/schema';
import { sql } from 'drizzle-orm';
import { getServerSession } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

function formatTopicAsLabel(topic: string): string {
  return topic
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export async function GET(request: Request) {
  try {
    // This endpoint returns verbatim purchaser chat samples. Require an
    // authenticated session and scope to the caller's tenant.
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');
    const limit = parseInt(searchParams.get('limit') || '10');
    const requestedTenantId = searchParams.get('tenantId');

    // Non-super callers are locked to their own tenant; super_admin may
    // scope to a specific tenant (or view all when none is supplied).
    const effectiveTenantId =
      session.role === 'super_admin' ? requestedTenantId : session.tenantId;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const tenantFilter = effectiveTenantId
      ? sql`AND tenant_id = ${effectiveTenantId}::uuid`
      : sql``;

    const result = await db.execute(sql`
      SELECT
        COALESCE(question_topic, 'general_inquiry') as topic,
        COUNT(*)::int as count,
        MIN(user_message) as sample_question
      FROM messages
      WHERE created_at >= ${startDate}
        AND user_message IS NOT NULL
        ${tenantFilter}
      GROUP BY COALESCE(question_topic, 'general_inquiry')
      ORDER BY COUNT(*) DESC
      LIMIT ${limit}
    `);

    const topQuestions = (result.rows || []).map((row: any) => ({
      topic: row.topic,
      question: formatTopicAsLabel(row.topic || 'General Inquiry'),
      sample: row.sample_question,
      count: row.count,
    }));

    return NextResponse.json({ topQuestions });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch top questions' },
      { status: 500 }
    );
  }
}
