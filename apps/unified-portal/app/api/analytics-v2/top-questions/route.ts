import { NextResponse } from 'next/server';
import { db } from '@openhouse/db';
import { messages } from '@openhouse/db/schema';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

function formatTopicAsLabel(topic: string): string {
  return topic
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');
    const limit = parseInt(searchParams.get('limit') || '10');

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const result = await db.execute(sql`
      SELECT 
        COALESCE(question_topic, 'general_inquiry') as topic,
        COUNT(*)::int as count,
        MIN(user_message) as sample_question
      FROM messages
      WHERE created_at >= ${startDate} 
        AND user_message IS NOT NULL
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
    console.error('[API] /api/analytics-v2/top-questions error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch top questions' },
      { status: 500 }
    );
  }
}
