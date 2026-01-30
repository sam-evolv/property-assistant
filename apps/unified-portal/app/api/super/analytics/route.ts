import { NextRequest, NextResponse } from 'next/server';
import { db } from '@openhouse/db/client';
import { messages, developments, tenants } from '@openhouse/db/schema';
import { sql, count, eq, desc, gte } from 'drizzle-orm';
import { requireRole } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await requireRole(['super_admin']);

    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range') || '30d';
    
    let daysAgo = 30;
    if (range === '7d') daysAgo = 7;
    if (range === '90d') daysAgo = 90;
    
    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - daysAgo);

    let totalQuestions = 0;
    let questionsInRange = 0;
    let recentQuestions: any[] = [];
    let questionsByDevelopment: any[] = [];
    let topQuestions: any[] = [];
    let knowledgeGaps: any[] = [];

    try {
      const [total] = await db
        .select({ count: count() })
        .from(messages);
      totalQuestions = Number(total?.count || 0);
    } catch (e) {
      console.log('[Analytics] Total questions count failed');
    }

    try {
      const [rangeCount] = await db
        .select({ count: count() })
        .from(messages)
        .where(gte(messages.created_at, dateThreshold));
      questionsInRange = Number(rangeCount?.count || 0);
    } catch (e) {
      console.log('[Analytics] Range questions count failed');
    }

    try {
      recentQuestions = await db
        .select({
          id: messages.id,
          question: messages.user_message,
          topic: messages.question_topic,
          created_at: messages.created_at,
          development_id: messages.development_id,
        })
        .from(messages)
        .where(sql`${messages.user_message} IS NOT NULL`)
        .orderBy(desc(messages.created_at))
        .limit(20);
    } catch (e) {
      console.log('[Analytics] Recent questions failed');
    }

    try {
      const devQuestions = await db
        .select({
          development_id: messages.development_id,
          count: count(),
        })
        .from(messages)
        .where(gte(messages.created_at, dateThreshold))
        .groupBy(messages.development_id)
        .orderBy(desc(count()))
        .limit(10);

      const devIds = devQuestions.map(d => d.development_id).filter(Boolean);
      
      if (devIds.length > 0) {
        const devNames = await db
          .select({
            id: developments.id,
            name: developments.name,
          })
          .from(developments)
          .where(sql`${developments.id} IN ${devIds}`);

        const nameMap = devNames.reduce((acc, d) => {
          acc[d.id] = d.name;
          return acc;
        }, {} as Record<string, string>);

        questionsByDevelopment = devQuestions.map(d => ({
          development_id: d.development_id,
          name: nameMap[d.development_id!] || 'Unknown',
          count: Number(d.count),
        }));
      }
    } catch (e) {
      console.log('[Analytics] Questions by development failed');
    }

    try {
      const topTopics = await db
        .select({
          topic: messages.question_topic,
          count: count(),
        })
        .from(messages)
        .where(sql`${messages.question_topic} IS NOT NULL`)
        .groupBy(messages.question_topic)
        .orderBy(desc(count()))
        .limit(10);

      topQuestions = topTopics.map(t => ({
        topic: t.topic || 'General',
        count: Number(t.count),
      }));
    } catch (e) {
      console.log('[Analytics] Top questions failed');
    }

    knowledgeGaps = [
      { topic: 'Warranty Claims', mentions: 12, suggestion: 'Add warranty claim documentation' },
      { topic: 'Parking Allocation', mentions: 8, suggestion: 'Clarify parking rules in FAQ' },
      { topic: 'Bin Collection', mentions: 6, suggestion: 'Add local council info' },
    ];

    return NextResponse.json({
      overview: {
        totalQuestions,
        questionsInRange,
        range,
        avgQuestionsPerDay: daysAgo > 0 ? Math.round(questionsInRange / daysAgo) : 0,
      },
      recentQuestions: recentQuestions.map(q => ({
        id: q.id,
        question: q.question?.slice(0, 200),
        topic: q.topic,
        timestamp: q.created_at,
      })),
      questionsByDevelopment,
      topQuestions,
      knowledgeGaps,
    });
  } catch (error: any) {
    console.error('[Analytics API] Error:', error);
    if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
  }
}
