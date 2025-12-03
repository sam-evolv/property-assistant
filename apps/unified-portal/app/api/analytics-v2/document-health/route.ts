import { NextResponse } from 'next/server';
import { db } from '@openhouse/db';
import { documents, doc_chunks } from '@openhouse/db/schema';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const limit = parseInt(searchParams.get('limit') || '20');

    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId required' }, { status: 400 });
    }

    const documentHealth = await db.execute(sql`
      SELECT
        d.id as document_id,
        d.file_name as document_name,
        d.chunks_count as embedding_count,
        d.created_at as uploaded_at,
        d.view_count as access_count,
        EXTRACT(DAY FROM NOW() - d.created_at)::int as days_since_upload,
        CASE
          WHEN d.view_count > 10 AND EXTRACT(DAY FROM NOW() - d.created_at) < 90 THEN 85
          WHEN d.view_count > 5 THEN 70
          WHEN d.view_count > 0 THEN 50
          ELSE 25
        END as health_score,
        CASE
          WHEN d.view_count > 10 AND EXTRACT(DAY FROM NOW() - d.created_at) < 90 THEN 'healthy'
          WHEN d.view_count > 0 AND EXTRACT(DAY FROM NOW() - d.created_at) < 180 THEN 'under-used'
          WHEN EXTRACT(DAY FROM NOW() - d.created_at) >= 180 THEN 'outdated'
          ELSE 'unused'
        END as status
      FROM documents d
      WHERE d.status = 'active'
      ORDER BY d.view_count DESC
      LIMIT ${limit}
    `).then(r => r.rows.map((row: any) => ({
      documentId: row.document_id,
      documentName: row.document_name,
      healthScore: row.health_score,
      embeddingCount: row.embedding_count || 0,
      lastAccessed: row.access_count > 0 ? row.uploaded_at : null,
      uploadedAt: row.uploaded_at,
      daysSinceUpload: row.days_since_upload,
      status: row.status,
    })));

    const statusCounts = await db.execute(sql`
      SELECT
        CASE
          WHEN view_count > 10 AND EXTRACT(DAY FROM NOW() - created_at) < 90 THEN 'healthy'
          WHEN view_count > 0 AND EXTRACT(DAY FROM NOW() - created_at) < 180 THEN 'under-used'
          WHEN EXTRACT(DAY FROM NOW() - created_at) >= 180 THEN 'outdated'
          ELSE 'unused'
        END as status,
        COUNT(*)::int as count
      FROM documents
      WHERE status = 'active'
      GROUP BY (CASE
        WHEN view_count > 10 AND EXTRACT(DAY FROM NOW() - created_at) < 90 THEN 'healthy'
        WHEN view_count > 0 AND EXTRACT(DAY FROM NOW() - created_at) < 180 THEN 'under-used'
        WHEN EXTRACT(DAY FROM NOW() - created_at) >= 180 THEN 'outdated'
        ELSE 'unused'
      END)
    `).then(r => {
      const counts: Record<string, number> = {};
      r.rows.forEach((row: any) => {
        counts[row.status] = row.count;
      });
      return counts;
    });

    const avgHealthScore = documentHealth.length > 0
      ? documentHealth.reduce((sum, doc) => sum + doc.healthScore, 0) / documentHealth.length
      : 0;

    return NextResponse.json({
      documentHealth,
      statusCounts,
      avgHealthScore,
    });
  } catch (error) {
    console.error('[API] /api/analytics-v2/document-health error:', error);
    return NextResponse.json({ error: 'Failed to fetch document health' }, { status: 500 });
  }
}
