import { NextRequest, NextResponse } from 'next/server';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { db } from '@openhouse/db/client';
import { admins, userDevelopments, developments } from '@openhouse/db/schema';
import { eq, and, sql } from 'drizzle-orm';

interface DisciplineCoverage {
  discipline: string;
  count: number;
  percentage: number;
}

interface HouseTypeCoverage {
  house_type_code: string;
  development_name: string;
  disciplines: string[];
  missing_disciplines: string[];
  coverage_percentage: number;
}

interface ClassificationQuality {
  total_documents: number;
  ai_classified: number;
  needs_review: number;
  classification_rate: number;
  avg_confidence: number;
}

interface DocumentCurrency {
  total_documents: number;
  docs_older_than_year: number;
  docs_last_30_days: number;
  docs_last_90_days: number;
}

interface KeywordTrend {
  term: string;
  count: number;
  is_risk_term: boolean;
}

interface GapPrediction {
  house_type_code: string;
  development_name: string;
  missing: string[];
  has_count: number;
  expected_count: number;
}

interface EmbeddingHealth {
  total_documents: number;
  documents_with_chunks: number;
  documents_without_chunks: number;
  total_chunks: number;
  documents_pending: number;
  documents_processing: number;
  documents_error: number;
  documents_complete: number;
  unhealthy_documents: Array<{
    id: string;
    title: string;
    file_name: string;
    processing_status: string;
    chunks_count: number;
    created_at: string;
  }>;
}

interface InsightsResponse {
  document_coverage: {
    by_discipline: DisciplineCoverage[];
    total_documents: number;
    missing_disciplines: string[];
  };
  house_type_coverage: HouseTypeCoverage[];
  classification_quality: ClassificationQuality;
  currency: DocumentCurrency;
  keyword_trends: KeywordTrend[];
  predicted_gaps: GapPrediction[];
  embedding_health: EmbeddingHealth;
}

const ALL_DISCIPLINES = [
  'architectural', 'structural', 'mechanical', 'electrical',
  'plumbing', 'civil', 'landscape', 'other'
];

const RISK_TERMS = [
  'fire stopping', 'structural load', 'drainage', 'm&e containment',
  'waterproofing', 'insulation', 'ventilation', 'electrical safety',
  'gas installation', 'radon', 'asbestos', 'damp', 'subsidence'
];

async function validateDeveloperAccess(
  email: string,
  tenantId: string
): Promise<{ valid: boolean; accessibleDevelopments: string[]; error?: string }> {
  const admin = await db.query.admins.findFirst({
    where: and(
      eq(admins.email, email),
      eq(admins.tenant_id, tenantId)
    ),
    columns: { id: true, role: true }
  });

  if (!admin) {
    console.log('[Insights] No admin found for email:', email, 'tenant:', tenantId);
    return { valid: false, accessibleDevelopments: [], error: 'Admin not found' };
  }

  if (admin.role === 'super_admin' || admin.role === 'tenant_admin') {
    const allDevs = await db.query.developments.findMany({
      where: eq(developments.tenant_id, tenantId),
      columns: { id: true }
    });
    return { valid: true, accessibleDevelopments: allDevs.map(d => d.id) };
  }

  const userDevs = await db.query.userDevelopments.findMany({
    where: eq(userDevelopments.user_id, admin.id),
    columns: { development_id: true }
  });

  return { valid: true, accessibleDevelopments: userDevs.map(d => d.development_id) };
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerComponentClient({ cookies });
    const { data: { user } } = await supabase.auth.getUser();

    if (!user || !user.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const developmentId = searchParams.get('developmentId');

    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    }

    const access = await validateDeveloperAccess(user.email, tenantId);
    if (!access.valid) {
      return NextResponse.json({ error: access.error }, { status: 403 });
    }

    let targetDevelopmentIds = access.accessibleDevelopments;
    if (developmentId) {
      if (!access.accessibleDevelopments.includes(developmentId)) {
        return NextResponse.json({ error: 'No access to this development' }, { status: 403 });
      }
      targetDevelopmentIds = [developmentId];
    }

    if (targetDevelopmentIds.length === 0) {
      return NextResponse.json({
        document_coverage: { by_discipline: [], total_documents: 0, missing_disciplines: ALL_DISCIPLINES },
        house_type_coverage: [],
        classification_quality: { total_documents: 0, ai_classified: 0, needs_review: 0, classification_rate: 0, avg_confidence: 0 },
        currency: { total_documents: 0, docs_older_than_year: 0, docs_last_30_days: 0, docs_last_90_days: 0 },
        keyword_trends: [],
        predicted_gaps: [],
        embedding_health: {
          total_documents: 0, documents_with_chunks: 0, documents_without_chunks: 0,
          total_chunks: 0, documents_pending: 0, documents_processing: 0,
          documents_error: 0, documents_complete: 0, unhealthy_documents: []
        }
      });
    }

    const devIdsStr = targetDevelopmentIds.map(id => `'${id}'::uuid`).join(',');

    const disciplineCoverage = await db.execute(sql.raw(`
      SELECT 
        COALESCE(discipline, 'other') as discipline,
        COUNT(*) as count
      FROM documents
      WHERE tenant_id = '${tenantId}'::uuid
        AND development_id IN (${devIdsStr})
        AND status = 'active'
      GROUP BY COALESCE(discipline, 'other')
      ORDER BY count DESC
    `));

    const totalDocsResult = await db.execute(sql.raw(`
      SELECT COUNT(*) as total
      FROM documents
      WHERE tenant_id = '${tenantId}'::uuid
        AND development_id IN (${devIdsStr})
        AND status = 'active'
    `));
    const totalDocs = parseInt((totalDocsResult.rows[0] as any)?.total || '0');

    const byDiscipline: DisciplineCoverage[] = (disciplineCoverage.rows as any[]).map(row => ({
      discipline: row.discipline,
      count: parseInt(row.count),
      percentage: totalDocs > 0 ? Math.round((parseInt(row.count) / totalDocs) * 100) : 0
    }));

    const foundDisciplines = new Set(byDiscipline.map(d => d.discipline));
    const missingDisciplines = ALL_DISCIPLINES.filter(d => !foundDisciplines.has(d));

    const houseTypeCoverage = await db.execute(sql.raw(`
      SELECT 
        d.house_type_code,
        dev.name as development_name,
        array_agg(DISTINCT COALESCE(d.discipline, 'other')) as disciplines,
        COUNT(DISTINCT d.id) as doc_count
      FROM documents d
      JOIN developments dev ON dev.id = d.development_id
      WHERE d.tenant_id = '${tenantId}'::uuid
        AND d.development_id IN (${devIdsStr})
        AND d.status = 'active'
        AND d.house_type_code IS NOT NULL
      GROUP BY d.house_type_code, dev.name
      ORDER BY doc_count DESC
      LIMIT 50
    `));

    const htCoverage: HouseTypeCoverage[] = (houseTypeCoverage.rows as any[]).map(row => {
      const disciplines = row.disciplines.filter((d: string) => d !== null);
      const missing = ALL_DISCIPLINES.filter(d => !disciplines.includes(d));
      return {
        house_type_code: row.house_type_code,
        development_name: row.development_name,
        disciplines,
        missing_disciplines: missing,
        coverage_percentage: Math.round((disciplines.length / ALL_DISCIPLINES.length) * 100)
      };
    });

    const classificationStats = await db.execute(sql.raw(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE ai_classified = true) as ai_classified,
        COUNT(*) FILTER (WHERE needs_review = true) as needs_review,
        COALESCE(AVG(mapping_confidence) FILTER (WHERE mapping_confidence IS NOT NULL), 0) as avg_confidence
      FROM documents
      WHERE tenant_id = '${tenantId}'::uuid
        AND development_id IN (${devIdsStr})
        AND status = 'active'
    `));

    const classStats = classificationStats.rows[0] as any;
    const classificationQuality: ClassificationQuality = {
      total_documents: parseInt(classStats.total || '0'),
      ai_classified: parseInt(classStats.ai_classified || '0'),
      needs_review: parseInt(classStats.needs_review || '0'),
      classification_rate: totalDocs > 0 ? Math.round((parseInt(classStats.ai_classified || '0') / totalDocs) * 100) : 0,
      avg_confidence: parseFloat(classStats.avg_confidence || '0')
    };

    const currencyStats = await db.execute(sql.raw(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE created_at < now() - interval '1 year') as older_than_year,
        COUNT(*) FILTER (WHERE created_at > now() - interval '30 days') as last_30_days,
        COUNT(*) FILTER (WHERE created_at > now() - interval '90 days') as last_90_days
      FROM documents
      WHERE tenant_id = '${tenantId}'::uuid
        AND development_id IN (${devIdsStr})
        AND status = 'active'
    `));

    const currStats = currencyStats.rows[0] as any;
    const currency: DocumentCurrency = {
      total_documents: parseInt(currStats.total || '0'),
      docs_older_than_year: parseInt(currStats.older_than_year || '0'),
      docs_last_30_days: parseInt(currStats.last_30_days || '0'),
      docs_last_90_days: parseInt(currStats.last_90_days || '0')
    };

    const keywordQuery = await db.execute(sql.raw(`
      SELECT word, count(*) as word_count
      FROM (
        SELECT regexp_split_to_table(lower(content), '\\s+') as word
        FROM doc_chunks
        WHERE tenant_id = '${tenantId}'::uuid
          AND development_id IN (${devIdsStr})
      ) words
      WHERE length(word) > 4
      GROUP BY word
      ORDER BY count(*) DESC
      LIMIT 100
    `));

    const keywordTrends: KeywordTrend[] = (keywordQuery.rows as any[])
      .slice(0, 20)
      .map(row => ({
        term: row.word,
        count: parseInt(row.word_count || '1'),
        is_risk_term: RISK_TERMS.some(rt => row.word.includes(rt.replace(' ', '')))
      }));

    const avgDisciplinesPerHouse = htCoverage.length > 0
      ? htCoverage.reduce((sum, ht) => sum + ht.disciplines.length, 0) / htCoverage.length
      : 0;

    const predictedGaps: GapPrediction[] = htCoverage
      .filter(ht => ht.disciplines.length < avgDisciplinesPerHouse)
      .slice(0, 10)
      .map(ht => ({
        house_type_code: ht.house_type_code,
        development_name: ht.development_name,
        missing: ht.missing_disciplines,
        has_count: ht.disciplines.length,
        expected_count: Math.round(avgDisciplinesPerHouse)
      }));

    // EMBEDDING HEALTH CHECK - Find documents with missing or incomplete embeddings
    const embeddingHealthQuery = await db.execute(sql.raw(`
      SELECT 
        COUNT(*) as total_documents,
        COUNT(*) FILTER (WHERE chunks_count > 0) as documents_with_chunks,
        COUNT(*) FILTER (WHERE chunks_count = 0 OR chunks_count IS NULL) as documents_without_chunks,
        COALESCE(SUM(chunks_count), 0) as total_chunks,
        COUNT(*) FILTER (WHERE processing_status = 'pending') as documents_pending,
        COUNT(*) FILTER (WHERE processing_status = 'processing') as documents_processing,
        COUNT(*) FILTER (WHERE processing_status = 'error') as documents_error,
        COUNT(*) FILTER (WHERE processing_status = 'complete') as documents_complete
      FROM documents
      WHERE tenant_id = '${tenantId}'::uuid
        AND development_id IN (${devIdsStr})
        AND status = 'active'
    `));

    const healthStats = embeddingHealthQuery.rows[0] as any;

    // Get list of unhealthy documents (0 chunks but marked complete, or stuck in processing, or errors)
    const unhealthyDocsQuery = await db.execute(sql.raw(`
      SELECT id, title, file_name, processing_status, chunks_count, created_at
      FROM documents
      WHERE tenant_id = '${tenantId}'::uuid
        AND development_id IN (${devIdsStr})
        AND status = 'active'
        AND (
          (processing_status = 'complete' AND (chunks_count = 0 OR chunks_count IS NULL))
          OR processing_status = 'error'
          OR (processing_status = 'processing' AND updated_at < now() - interval '1 hour')
          OR (processing_status = 'pending' AND created_at < now() - interval '1 hour')
        )
      ORDER BY created_at DESC
      LIMIT 20
    `));

    const embeddingHealth: EmbeddingHealth = {
      total_documents: parseInt(healthStats.total_documents || '0'),
      documents_with_chunks: parseInt(healthStats.documents_with_chunks || '0'),
      documents_without_chunks: parseInt(healthStats.documents_without_chunks || '0'),
      total_chunks: parseInt(healthStats.total_chunks || '0'),
      documents_pending: parseInt(healthStats.documents_pending || '0'),
      documents_processing: parseInt(healthStats.documents_processing || '0'),
      documents_error: parseInt(healthStats.documents_error || '0'),
      documents_complete: parseInt(healthStats.documents_complete || '0'),
      unhealthy_documents: (unhealthyDocsQuery.rows as any[]).map(row => ({
        id: row.id,
        title: row.title,
        file_name: row.file_name,
        processing_status: row.processing_status,
        chunks_count: parseInt(row.chunks_count || '0'),
        created_at: row.created_at
      }))
    };

    const response: InsightsResponse = {
      document_coverage: {
        by_discipline: byDiscipline,
        total_documents: totalDocs,
        missing_disciplines: missingDisciplines
      },
      house_type_coverage: htCoverage,
      classification_quality: classificationQuality,
      currency,
      keyword_trends: keywordTrends,
      predicted_gaps: predictedGaps,
      embedding_health: embeddingHealth
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('[Insights] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate insights' },
      { status: 500 }
    );
  }
}
