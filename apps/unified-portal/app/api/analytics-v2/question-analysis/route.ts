import { NextResponse } from 'next/server';
import { db } from '@openhouse/db';
import { messages } from '@openhouse/db/schema';
import { sql, and, gte, isNotNull, eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');
    const limit = parseInt(searchParams.get('limit') || '20');
    const developmentId = searchParams.get('developmentId') || null;
    const tenantId = searchParams.get('tenantId') || null;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Build tenant filter for queries that join with developments
    const tenantFilter = tenantId ? sql`AND d.tenant_id = ${tenantId}::uuid` : sql``;
    const devFilter = developmentId ? sql`AND m.development_id = ${developmentId}::uuid` : sql``;

    const [topQuestions, questionsByDevelopment, questionsByTimeOfDay, avgQuestionLength] = await Promise.all([
      // Top questions - filter by tenant through developments join
      db.execute(sql`
        SELECT
          SUBSTRING(m.user_message FROM 1 FOR 150) as question,
          COUNT(*)::int as count,
          AVG(m.latency_ms)::int as avg_response_time
        FROM messages m
        INNER JOIN developments d ON m.development_id = d.id
        WHERE m.created_at >= ${startDate}
          AND m.user_message IS NOT NULL
          ${tenantFilter}
          ${devFilter}
        GROUP BY SUBSTRING(m.user_message FROM 1 FOR 150)
        ORDER BY COUNT(*) DESC
        LIMIT ${limit}
      `).then(r => r.rows),

      db.execute(sql`
        SELECT
          d.name as development_name,
          SUBSTRING(m.user_message FROM 1 FOR 100) as question,
          COUNT(*)::int as count
        FROM messages m
        INNER JOIN developments d ON m.development_id = d.id
        WHERE m.created_at >= ${startDate} AND m.user_message IS NOT NULL
          ${tenantFilter}
          ${devFilter}
        GROUP BY d.name, SUBSTRING(m.user_message FROM 1 FOR 100)
        ORDER BY count DESC
        LIMIT 10
      `).then(r => r.rows),

      db.execute(sql`
        SELECT
          EXTRACT(HOUR FROM m.created_at)::int as hour,
          COUNT(*)::int as count
        FROM messages m
        INNER JOIN developments d ON m.development_id = d.id
        WHERE m.created_at >= ${startDate} AND m.user_message IS NOT NULL
          ${tenantFilter}
          ${devFilter}
        GROUP BY EXTRACT(HOUR FROM m.created_at)
        ORDER BY hour
      `).then(r => r.rows),

      db.execute(sql`
        SELECT AVG(LENGTH(m.user_message))::int as avg_length
        FROM messages m
        INNER JOIN developments d ON m.development_id = d.id
        WHERE m.created_at >= ${startDate} AND m.user_message IS NOT NULL
          ${tenantFilter}
          ${devFilter}
      `).then(r => r.rows[0]?.avg_length || 0),
    ]);

    const questionCategories = categorizeQuestions(topQuestions as any[]);

    const analysis = {
      topQuestions: (topQuestions as any[]).map(q => ({
        question: q.question,
        count: q.count,
        avgResponseTime: q.avg_response_time,
      })),
      questionsByDevelopment,
      questionsByTimeOfDay,
      avgQuestionLength,
      totalQuestions: (topQuestions as any[]).reduce((sum, q) => sum + (q.count || 0), 0),
      categories: questionCategories,
    };

    return NextResponse.json(analysis);
  } catch (error) {
    console.error('[API] /api/analytics-v2/question-analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch question analysis' },
      { status: 500 }
    );
  }
}

function categorizeQuestions(questions: any[]) {
  const categories: Record<string, number> = {
    'Property Info': 0,
    'Maintenance': 0,
    'Amenities': 0,
    'Payments': 0,
    'Documents': 0,
    'General': 0,
  };

  questions.forEach(q => {
    const text = q.question.toLowerCase();
    if (text.includes('property') || text.includes('house') || text.includes('home')) {
      categories['Property Info'] += q.count;
    } else if (text.includes('fix') || text.includes('repair') || text.includes('maintenance')) {
      categories['Maintenance'] += q.count;
    } else if (text.includes('pool') || text.includes('gym') || text.includes('amenity')) {
      categories['Amenities'] += q.count;
    } else if (text.includes('pay') || text.includes('bill') || text.includes('fee')) {
      categories['Payments'] += q.count;
    } else if (text.includes('document') || text.includes('contract') || text.includes('paper')) {
      categories['Documents'] += q.count;
    } else {
      categories['General'] += q.count;
    }
  });

  return Object.entries(categories)
    .map(([category, count]) => ({ category, count }))
    .filter(c => c.count > 0)
    .sort((a, b) => b.count - a.count);
}
