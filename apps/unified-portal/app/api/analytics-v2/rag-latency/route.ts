import { NextResponse } from 'next/server';
import { db } from '@openhouse/db';
import { messages } from '@openhouse/db/schema';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const days = parseInt(searchParams.get('days') || '30');

    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId required' }, { status: 400 });
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const ragLatency = await db.execute(sql`
      SELECT
        DATE(created_at) as date,
        AVG(latency_ms)::int as avg_latency,
        COUNT(*)::int as retrieval_count,
        COUNT(CASE WHEN latency_ms > 2000 THEN 1 END)::float / NULLIF(COUNT(*), 0) as failure_rate
      FROM messages
      WHERE created_at >= ${startDate}
        AND latency_ms IS NOT NULL
      GROUP BY DATE(created_at)
      ORDER BY date DESC
      LIMIT 14
    `).then(r => r.rows.map((row: any) => ({
      date: new Date(row.date).toLocaleDateString(),
      avgLatency: row.avg_latency || 0,
      retrievalCount: row.retrieval_count || 0,
      failureRate: row.failure_rate || 0,
    })));

    return NextResponse.json({ ragLatency });
  } catch (error) {
    console.error('[API] /api/analytics-v2/rag-latency error:', error);
    return NextResponse.json({ error: 'Failed to fetch RAG latency' }, { status: 500 });
  }
}
