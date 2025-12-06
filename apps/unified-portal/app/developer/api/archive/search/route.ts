import { NextRequest, NextResponse } from 'next/server';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { db } from '@openhouse/db/client';
import { admins, userDevelopments, documents, developments, houseTypes } from '@openhouse/db/schema';
import { eq, and, inArray, sql } from 'drizzle-orm';
import OpenAI from 'openai';

const openai = new OpenAI();

interface SearchFilters {
  discipline?: string | null;
  houseType?: string | null;
  important?: boolean;
  mustRead?: boolean;
  aiOnly?: boolean;
}

interface SearchResult {
  document_id: string;
  file_name: string;
  title: string;
  discipline: string | null;
  house_type_code: string | null;
  score: number;
  preview_text: string;
  tags: string[];
  important: boolean;
  must_read: boolean;
  ai_classified: boolean;
  development_id: string;
  development_name: string;
  file_url: string | null;
  storage_url: string | null;
  created_at: string;
}

async function validateDeveloperAccess(
  email: string,
  tenantId: string
): Promise<{ valid: boolean; isSuperAdmin: boolean; accessibleDevelopments: string[]; error?: string }> {
  const admin = await db.query.admins.findFirst({
    where: and(
      eq(admins.email, email),
      eq(admins.tenant_id, tenantId)
    ),
    columns: { id: true, role: true }
  });

  if (!admin) {
    console.log('[Search] No admin found for email:', email, 'tenant:', tenantId);
    return { valid: false, isSuperAdmin: false, accessibleDevelopments: [], error: 'Admin not found' };
  }

  if (admin.role === 'super_admin') {
    const allDevs = await db.query.developments.findMany({
      where: eq(developments.tenant_id, tenantId),
      columns: { id: true }
    });
    return { 
      valid: true, 
      isSuperAdmin: true, 
      accessibleDevelopments: allDevs.map(d => d.id) 
    };
  }

  if (admin.role !== 'developer' && admin.role !== 'admin' && admin.role !== 'tenant_admin') {
    return { valid: false, isSuperAdmin: false, accessibleDevelopments: [], error: 'Insufficient permissions' };
  }

  const userDevs = await db.query.userDevelopments.findMany({
    where: eq(userDevelopments.user_id, admin.id),
    columns: { development_id: true }
  });

  return { 
    valid: true, 
    isSuperAdmin: false, 
    accessibleDevelopments: userDevs.map(d => d.development_id) 
  };
}

async function generateQueryEmbedding(query: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-large',
    input: query,
    dimensions: 1536,
  });
  return response.data[0].embedding;
}

async function getSignedUrl(
  supabase: ReturnType<typeof createServerComponentClient>,
  storagePath: string
): Promise<string | null> {
  if (!storagePath || !storagePath.startsWith('tenant/')) {
    return storagePath;
  }
  const { data } = await supabase.storage
    .from('documents')
    .createSignedUrl(storagePath, 3600);
  return data?.signedUrl || null;
}

async function getCachedResults(
  userId: string,
  tenantId: string,
  query: string,
  filters: SearchFilters
): Promise<SearchResult[] | null> {
  const result = await db.execute(sql`
    SELECT results, id FROM search_cache 
    WHERE user_id = ${userId}::uuid 
      AND tenant_id = ${tenantId}::uuid 
      AND query = ${query}
      AND filters = ${JSON.stringify(filters)}::jsonb
      AND expires_at > now()
    LIMIT 1
  `);
  
  if (result.rows.length > 0) {
    await db.execute(sql`
      UPDATE search_cache SET hit_count = hit_count + 1 
      WHERE id = ${(result.rows[0] as { id: string }).id}::uuid
    `);
    return (result.rows[0] as { results: SearchResult[] }).results;
  }
  return null;
}

async function cacheResults(
  userId: string,
  tenantId: string,
  query: string,
  filters: SearchFilters,
  results: SearchResult[]
): Promise<void> {
  await db.execute(sql`
    INSERT INTO search_cache (user_id, tenant_id, query, filters, results, expires_at)
    VALUES (
      ${userId}::uuid, 
      ${tenantId}::uuid, 
      ${query}, 
      ${JSON.stringify(filters)}::jsonb, 
      ${JSON.stringify(results)}::jsonb,
      now() + interval '6 hours'
    )
    ON CONFLICT DO NOTHING
  `);
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
    const query = searchParams.get('q') || '';
    const discipline = searchParams.get('discipline');
    const houseType = searchParams.get('houseType');
    const important = searchParams.get('important') === 'true';
    const mustRead = searchParams.get('mustRead') === 'true';
    const aiOnly = searchParams.get('aiOnly') === 'true';
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);

    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    }

    if (!query.trim()) {
      return NextResponse.json({ error: 'Search query is required' }, { status: 400 });
    }

    const access = await validateDeveloperAccess(user.email, tenantId);
    if (!access.valid) {
      return NextResponse.json({ error: access.error }, { status: 403 });
    }

    let targetDevelopmentIds = access.accessibleDevelopments;
    if (developmentId) {
      if (!access.accessibleDevelopments.includes(developmentId) && !access.isSuperAdmin) {
        return NextResponse.json({ error: 'No access to this development' }, { status: 403 });
      }
      targetDevelopmentIds = [developmentId];
    }

    if (targetDevelopmentIds.length === 0) {
      return NextResponse.json({ results: [], total: 0 });
    }

    const filters: SearchFilters = { discipline, houseType, important, mustRead, aiOnly };
    
    const cached = await getCachedResults(user.id, tenantId, query, filters);
    if (cached) {
      console.log('[Search] Cache hit for query:', query);
      return NextResponse.json({ results: cached, total: cached.length, cached: true });
    }

    console.log('[Search] Generating embedding for query:', query);
    const queryEmbedding = await generateQueryEmbedding(query);
    const embeddingStr = `[${queryEmbedding.join(',')}]`;

    let filterConditions = '';
    if (discipline) {
      filterConditions += ` AND d.discipline = '${discipline}'`;
    }
    if (houseType) {
      filterConditions += ` AND d.house_type_code = '${houseType}'`;
    }
    if (important) {
      filterConditions += ` AND d.is_important = true`;
    }
    if (mustRead) {
      filterConditions += ` AND d.must_read = true`;
    }
    if (aiOnly) {
      filterConditions += ` AND d.ai_classified = true`;
    }

    const devIdsStr = targetDevelopmentIds.map(id => `'${id}'::uuid`).join(',');

    const hybridSearchQuery = sql.raw(`
      WITH ranked_chunks AS (
        SELECT 
          c.document_id,
          c.content,
          1 - (c.embedding <=> '${embeddingStr}'::vector) as semantic_score,
          COALESCE(ts_rank_cd(c.search_content, plainto_tsquery('english', '${query.replace(/'/g, "''")}'), 32), 0) as keyword_score
        FROM doc_chunks c
        WHERE c.tenant_id = '${tenantId}'::uuid
          AND c.development_id IN (${devIdsStr})
          AND c.embedding IS NOT NULL
        ORDER BY semantic_score DESC
        LIMIT 200
      ),
      scored_chunks AS (
        SELECT 
          document_id,
          content,
          semantic_score,
          keyword_score,
          (0.8 * semantic_score + 0.2 * LEAST(keyword_score, 1.0)) as combined_score
        FROM ranked_chunks
        WHERE semantic_score > 0.25
      ),
      top_docs AS (
        SELECT 
          sc.document_id,
          MAX(sc.combined_score) as max_score,
          (array_agg(sc.content ORDER BY sc.combined_score DESC))[1] as top_chunk_content
        FROM scored_chunks sc
        GROUP BY sc.document_id
        ORDER BY max_score DESC
        LIMIT ${limit}
      )
      SELECT 
        d.id as document_id,
        d.file_name,
        d.title,
        d.discipline,
        d.house_type_code,
        td.max_score as score,
        SUBSTRING(td.top_chunk_content, 1, 300) as preview_text,
        COALESCE(d.ai_tags, '[]'::jsonb) as tags,
        d.is_important as important,
        d.must_read,
        d.ai_classified,
        d.development_id,
        dev.name as development_name,
        d.file_url,
        d.storage_url,
        d.created_at
      FROM top_docs td
      JOIN documents d ON d.id = td.document_id
      JOIN developments dev ON dev.id = d.development_id
      WHERE d.status = 'active'
        ${filterConditions}
      ORDER BY td.max_score DESC
    `);

    const searchResults = await db.execute(hybridSearchQuery);

    const results: SearchResult[] = await Promise.all(
      (searchResults.rows as any[]).map(async (row) => {
        let fileUrl = row.file_url;
        if (!fileUrl && row.storage_url) {
          fileUrl = await getSignedUrl(supabase, row.storage_url);
        }

        return {
          document_id: row.document_id,
          file_name: row.file_name,
          title: row.title,
          discipline: row.discipline,
          house_type_code: row.house_type_code,
          score: parseFloat(row.score) || 0,
          preview_text: row.preview_text || '',
          tags: Array.isArray(row.tags) ? row.tags : [],
          important: row.important || false,
          must_read: row.must_read || false,
          ai_classified: row.ai_classified || false,
          development_id: row.development_id,
          development_name: row.development_name,
          file_url: fileUrl,
          storage_url: row.storage_url,
          created_at: row.created_at,
        };
      })
    );

    if (results.length > 0) {
      await cacheResults(user.id, tenantId, query, filters, results);
    }

    console.log(`[Search] Found ${results.length} results for query: ${query}`);
    return NextResponse.json({ results, total: results.length, cached: false });

  } catch (error) {
    console.error('[Search] Error:', error);
    return NextResponse.json(
      { error: 'Search failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
