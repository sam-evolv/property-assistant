import { db } from '@openhouse/db/client';
import { sql } from 'drizzle-orm';
import OpenAI from 'openai';
import { logger } from './logger';

function getOpenAI() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY!,
  });
}

async function getProjectIdFromDevelopmentId(developmentId: string): Promise<string | null> {
  try {
    console.log('[UNIT-FIRST] === MAPPING development_id to project_id ===');
    console.log('[UNIT-FIRST] Input development_id:', developmentId);
    
    const devResult = await db.execute(sql`
      SELECT id, name FROM developments WHERE id = ${developmentId}::uuid LIMIT 1
    `);
    
    if (!devResult.rows || devResult.rows.length === 0) {
      console.log('[UNIT-FIRST] Development not found for id:', developmentId);
      return null;
    }
    
    const developmentName = (devResult.rows[0] as any).name;
    console.log('[UNIT-FIRST] Found development name:', developmentName);
    
    const projResult = await db.execute(sql`
      SELECT id FROM projects WHERE name = ${developmentName} LIMIT 1
    `);
    
    if (!projResult.rows || projResult.rows.length === 0) {
      console.log('[UNIT-FIRST] No matching project found for name:', developmentName);
      return null;
    }
    
    const projectId = (projResult.rows[0] as any).id;
    console.log('[UNIT-FIRST] Mapped to project_id:', projectId);
    
    return projectId;
  } catch (error) {
    console.error('[UNIT-FIRST] Failed to map development to project:', error);
    return null;
  }
}

export interface UnitFirstChunk {
  id: string;
  content: string;
  document_id: string;
  document_title: string | null;
  house_type_code: string | null;
  unit_id: string | null;
  vector_score: number;
  keyword_score: number;
  tier_weight: number;
  final_score: number;
  metadata: Record<string, any>;
  tier: 'unit' | 'house_type' | 'important' | 'development' | 'global';
}

export interface RetrievalResult {
  chunks: UnitFirstChunk[];
  confidence: 'high' | 'medium' | 'low';
  confidenceScore: number;
  tierBreakdown: Record<string, number>;
  suggestFallback: boolean;
}

const TIER_WEIGHTS = {
  unit: 1.0,
  house_type: 0.9,
  important: 0.8,
  development: 0.7,
  global: 0.4,
} as const;

const CONFIDENCE_THRESHOLDS = {
  high: 0.85,
  medium: 0.6,
} as const;

const SUPPLIER_KEYWORDS = [
  'supplier', 'installed', 'contractor', 'fitter', 'provider',
  'manufacturer', 'supplied', 'installer', 'fitted', 'made', 'company'
];

const PROPERTY_KEYWORDS = [
  'kitchen', 'wardrobe', 'boiler', 'windows', 'doors', 'flooring',
  'bathroom', 'bedroom', 'living', 'dining', 'garage', 'parking',
  'heating', 'plumbing', 'electrical', 'tiles', 'countertop'
];

const DIMENSION_KEYWORDS = [
  'size', 'dimension', 'area', 'square', 'sqm', 'm²', 'metres', 'meters',
  'length', 'width', 'height', 'floor area', 'room size'
];

function extractKeywords(query: string): string[] {
  const normalized = query.toLowerCase();
  const tokens = normalized.split(/\s+/).filter(t => t.length > 2);
  
  const stopwords = new Set([
    'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her',
    'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how',
    'man', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'what', 'when',
    'where', 'which', 'while', 'with', 'would', 'your', 'about', 'could',
    'have', 'this', 'will', 'from', 'they', 'been', 'more', 'some', 'than',
    'into', 'only', 'over', 'such', 'make', 'like', 'just', 'know'
  ]);
  
  return tokens.filter(t => !stopwords.has(t));
}

function detectQueryIntent(query: string): {
  isSupplierQuery: boolean;
  isDimensionQuery: boolean;
  isPropertyQuery: boolean;
} {
  const normalized = query.toLowerCase();
  
  return {
    isSupplierQuery: SUPPLIER_KEYWORDS.some(kw => normalized.includes(kw)) ||
      /who\s+(supplied|installed|fitted|provided|made|manufactured)/i.test(normalized),
    isDimensionQuery: DIMENSION_KEYWORDS.some(kw => normalized.includes(kw)) ||
      /how\s+(big|large|small)/i.test(normalized),
    isPropertyQuery: PROPERTY_KEYWORDS.some(kw => normalized.includes(kw)),
  };
}

function computeKeywordScore(
  content: string,
  queryKeywords: string[],
  intent: ReturnType<typeof detectQueryIntent>
): number {
  const contentLower = content.toLowerCase();
  let score = 0;
  let maxScore = 0;
  
  for (const keyword of queryKeywords) {
    maxScore += 1;
    if (contentLower.includes(keyword)) {
      score += 1;
      
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      const matches = contentLower.match(regex);
      if (matches && matches.length > 1) {
        score += 0.2 * Math.min(matches.length - 1, 3);
      }
    }
  }
  
  if (intent.isSupplierQuery) {
    for (const kw of SUPPLIER_KEYWORDS) {
      if (contentLower.includes(kw)) {
        score += 0.5;
        maxScore += 0.5;
      }
    }
  }
  
  if (intent.isDimensionQuery) {
    if (/\d+(?:\.\d+)?\s*m?\s*[xX×]\s*\d+(?:\.\d+)?\s*m?/.test(content)) {
      score += 1;
    }
    if (/\d+(?:\.\d+)?\s*m²/.test(content) || /\d+(?:\.\d+)?\s*sqm/i.test(content)) {
      score += 0.5;
    }
    maxScore += 1.5;
  }
  
  if (intent.isPropertyQuery) {
    for (const kw of PROPERTY_KEYWORDS) {
      if (contentLower.includes(kw)) {
        score += 0.3;
        maxScore += 0.3;
      }
    }
  }
  
  return maxScore > 0 ? Math.min(score / maxScore, 1.0) : 0;
}

export interface UnitFirstRetrievalOptions {
  tenantId: string;
  developmentId: string;
  unitId?: string;
  houseTypeCode?: string;
  query: string;
  limit?: number;
  includeGlobalFallback?: boolean;
}

export async function unitFirstRetrieval(options: UnitFirstRetrievalOptions): Promise<RetrievalResult> {
  const {
    tenantId,
    developmentId,
    unitId,
    houseTypeCode,
    query,
    limit = 10,
    includeGlobalFallback = true,
  } = options;

  console.log('\n🔍 UNIT-FIRST RETRIEVAL');
  console.log('='.repeat(60));
  console.log(`  Tenant: ${tenantId}`);
  console.log(`  Development: ${developmentId}`);
  console.log(`  Unit ID: ${unitId || 'none'}`);
  console.log(`  House Type: ${houseTypeCode || 'none'}`);
  console.log(`  Query: ${query}`);

  const embeddingResponse = await getOpenAI().embeddings.create({
    model: 'text-embedding-3-large',
    input: query,
    dimensions: 1536,
  });

  const queryEmbedding = embeddingResponse.data[0].embedding;
  const embeddingVector = `[${queryEmbedding.join(',')}]`;

  const queryKeywords = extractKeywords(query);
  const intent = detectQueryIntent(query);

  console.log(`  Keywords: ${queryKeywords.join(', ')}`);
  console.log(`  Intent: supplier=${intent.isSupplierQuery}, dimension=${intent.isDimensionQuery}, property=${intent.isPropertyQuery}`);

  const allChunks: UnitFirstChunk[] = [];
  const tierBreakdown: Record<string, number> = {};

  if (unitId) {
    console.log('\n  TIER 1: Unit-specific search...');
    const unitResults = await db.execute(sql`
      SELECT
        c.id,
        c.content,
        c.document_id,
        d.title as document_title,
        c.house_type_code,
        c.metadata,
        1 - (c.embedding <=> ${embeddingVector}::vector) as similarity
      FROM doc_chunks c
      LEFT JOIN documents d ON c.document_id = d.id
      WHERE c.tenant_id = ${tenantId}::uuid
        AND c.development_id = ${developmentId}::uuid
        AND (
          c.metadata->>'unit_id' = ${unitId}
          OR c.metadata->>'unit_uid' = ${unitId}
        )
        AND (c.embedding <=> ${embeddingVector}::vector) < 0.8
      ORDER BY c.embedding <=> ${embeddingVector}::vector
      LIMIT 20
    `);

    const unitChunks = (unitResults.rows || []).map((row: any) => ({
      ...row,
      tier: 'unit' as const,
      tier_weight: TIER_WEIGHTS.unit,
    }));

    allChunks.push(...unitChunks.map((c: any) => processChunk(c, queryKeywords, intent)));
    tierBreakdown.unit = unitChunks.length;
    console.log(`    Found ${unitChunks.length} unit-specific chunks`);
  }

  if (houseTypeCode) {
    console.log('\n  TIER 2: House type search...');
    const existingIds = new Set(allChunks.map(c => c.id));
    
    const houseTypeResults = await db.execute(sql`
      SELECT
        c.id,
        c.content,
        c.document_id,
        d.title as document_title,
        c.house_type_code,
        c.metadata,
        1 - (c.embedding <=> ${embeddingVector}::vector) as similarity
      FROM doc_chunks c
      LEFT JOIN documents d ON c.document_id = d.id
      WHERE c.tenant_id = ${tenantId}::uuid
        AND c.development_id = ${developmentId}::uuid
        AND c.house_type_code = ${houseTypeCode}
        AND (c.embedding <=> ${embeddingVector}::vector) < 0.75
      ORDER BY c.embedding <=> ${embeddingVector}::vector
      LIMIT 30
    `);

    const houseTypeChunks = (houseTypeResults.rows || [])
      .filter((row: any) => !existingIds.has(row.id))
      .map((row: any) => ({
        ...row,
        tier: 'house_type' as const,
        tier_weight: TIER_WEIGHTS.house_type,
      }));

    allChunks.push(...houseTypeChunks.map((c: any) => processChunk(c, queryKeywords, intent)));
    tierBreakdown.house_type = houseTypeChunks.length;
    console.log(`    Found ${houseTypeChunks.length} house type chunks`);
  }

  console.log('\n  TIER 3: Important documents search...');
  {
    const existingIds = new Set(allChunks.map(c => c.id));
    
    const importantResults = await db.execute(sql`
      SELECT
        c.id,
        c.content,
        c.document_id,
        d.title as document_title,
        c.house_type_code,
        c.metadata,
        1 - (c.embedding <=> ${embeddingVector}::vector) as similarity
      FROM doc_chunks c
      LEFT JOIN documents d ON c.document_id = d.id
      WHERE c.tenant_id = ${tenantId}::uuid
        AND c.development_id = ${developmentId}::uuid
        AND (
          d.is_important = true
          OR c.metadata->>'is_important' = 'true'
          OR d.document_type IN ('specification', 'floor_plan', 'warranty', 'manual')
        )
        AND (c.embedding <=> ${embeddingVector}::vector) < 0.7
      ORDER BY c.embedding <=> ${embeddingVector}::vector
      LIMIT 20
    `);

    const importantChunks = (importantResults.rows || [])
      .filter((row: any) => !existingIds.has(row.id))
      .map((row: any) => ({
        ...row,
        tier: 'important' as const,
        tier_weight: TIER_WEIGHTS.important,
      }));

    allChunks.push(...importantChunks.map((c: any) => processChunk(c, queryKeywords, intent)));
    tierBreakdown.important = importantChunks.length;
    console.log(`    Found ${importantChunks.length} important document chunks`);
  }

  console.log('\n  TIER 4: Development-wide search...');
  {
    const existingIds = new Set(allChunks.map(c => c.id));
    
    const devResults = await db.execute(sql`
      SELECT
        c.id,
        c.content,
        c.document_id,
        d.title as document_title,
        c.house_type_code,
        c.metadata,
        1 - (c.embedding <=> ${embeddingVector}::vector) as similarity
      FROM doc_chunks c
      LEFT JOIN documents d ON c.document_id = d.id
      WHERE c.tenant_id = ${tenantId}::uuid
        AND c.development_id = ${developmentId}::uuid
        AND (c.house_type_code IS NULL OR c.house_type_code = ${houseTypeCode || ''})
        AND (c.embedding <=> ${embeddingVector}::vector) < 0.65
      ORDER BY c.embedding <=> ${embeddingVector}::vector
      LIMIT 25
    `);

    const devChunks = (devResults.rows || [])
      .filter((row: any) => !existingIds.has(row.id))
      .map((row: any) => ({
        ...row,
        tier: 'development' as const,
        tier_weight: TIER_WEIGHTS.development,
      }));

    allChunks.push(...devChunks.map((c: any) => processChunk(c, queryKeywords, intent)));
    tierBreakdown.development = devChunks.length;
    console.log(`    Found ${devChunks.length} development-level chunks`);
  }

  if (includeGlobalFallback && allChunks.length < 5) {
    console.log('\n  TIER 5: Global fallback (cross-unit similarity)...');
    const existingIds = new Set(allChunks.map(c => c.id));
    
    const globalResults = await db.execute(sql`
      SELECT
        c.id,
        c.content,
        c.document_id,
        d.title as document_title,
        c.house_type_code,
        c.metadata,
        1 - (c.embedding <=> ${embeddingVector}::vector) as similarity
      FROM doc_chunks c
      LEFT JOIN documents d ON c.document_id = d.id
      WHERE c.tenant_id = ${tenantId}::uuid
        AND (c.embedding <=> ${embeddingVector}::vector) < 0.6
      ORDER BY c.embedding <=> ${embeddingVector}::vector
      LIMIT 15
    `);

    const globalChunks = (globalResults.rows || [])
      .filter((row: any) => !existingIds.has(row.id))
      .map((row: any) => ({
        ...row,
        tier: 'global' as const,
        tier_weight: TIER_WEIGHTS.global,
      }));

    allChunks.push(...globalChunks.map((c: any) => processChunk(c, queryKeywords, intent)));
    tierBreakdown.global = globalChunks.length;
    console.log(`    Found ${globalChunks.length} global fallback chunks`);
  }

  // TIER 6: document_sections fallback with project_id mapping
  if (allChunks.length < 5) {
    console.log('\n  TIER 6: document_sections fallback (project_id mapping)...');
    const existingIds = new Set(allChunks.map(c => c.id));
    
    const projectId = await getProjectIdFromDevelopmentId(developmentId);
    
    if (projectId) {
      const sectionsResults = await db.execute(sql`
        SELECT
          ds.id,
          ds.content,
          ds.project_id,
          1 - (ds.embedding <=> ${embeddingVector}::vector) as similarity
        FROM document_sections ds
        WHERE ds.project_id = ${projectId}::uuid
          AND ds.embedding IS NOT NULL
          AND (ds.embedding <=> ${embeddingVector}::vector) < 0.7
        ORDER BY ds.embedding <=> ${embeddingVector}::vector
        LIMIT 20
      `);

      const sectionsChunks = (sectionsResults.rows || [])
        .filter((row: any) => !existingIds.has(row.id))
        .map((row: any) => ({
          id: row.id,
          content: row.content,
          document_id: null,
          document_title: 'Document Section',
          house_type_code: null,
          metadata: { source: 'document_sections', project_id: row.project_id },
          similarity: row.similarity,
          tier: 'development' as const,
          tier_weight: TIER_WEIGHTS.development,
        }));

      allChunks.push(...sectionsChunks.map((c: any) => processChunk(c, queryKeywords, intent)));
      tierBreakdown.document_sections = sectionsChunks.length;
      console.log(`    Found ${sectionsChunks.length} document_sections chunks`);
      if (sectionsChunks.length > 0) {
        console.log(`    First result preview: ${sectionsChunks[0]?.content?.substring(0, 100)}`);
      }
    } else {
      console.log('    Could not map development to project - skipping document_sections');
      tierBreakdown.document_sections = 0;
    }
  }

  allChunks.sort((a, b) => b.final_score - a.final_score);
  const topChunks = allChunks.slice(0, limit);

  const avgScore = topChunks.length > 0
    ? topChunks.reduce((sum, c) => sum + c.vector_score, 0) / topChunks.length
    : 0;

  let confidence: 'high' | 'medium' | 'low';
  if (avgScore >= CONFIDENCE_THRESHOLDS.high) {
    confidence = 'high';
  } else if (avgScore >= CONFIDENCE_THRESHOLDS.medium) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }

  const suggestFallback = confidence === 'low' || topChunks.length < 3;

  console.log('\n  RETRIEVAL SUMMARY:');
  console.log(`    Total candidates: ${allChunks.length}`);
  console.log(`    Selected: ${topChunks.length}`);
  console.log(`    Avg vector score: ${avgScore.toFixed(3)}`);
  console.log(`    Confidence: ${confidence} (${(avgScore * 100).toFixed(1)}%)`);
  console.log(`    Tier breakdown: ${JSON.stringify(tierBreakdown)}`);
  console.log(`    Suggest fallback: ${suggestFallback}`);
  console.log('='.repeat(60));

  return {
    chunks: topChunks,
    confidence,
    confidenceScore: avgScore,
    tierBreakdown,
    suggestFallback,
  };
}

function processChunk(
  row: any,
  queryKeywords: string[],
  intent: ReturnType<typeof detectQueryIntent>
): UnitFirstChunk {
  const vectorScore = Number(row.similarity) || 0;
  const keywordScore = computeKeywordScore(row.content, queryKeywords, intent);
  const tierWeight = row.tier_weight;
  
  const finalScore = tierWeight * (0.6 * vectorScore + 0.4 * keywordScore);

  return {
    id: row.id,
    content: row.content,
    document_id: row.document_id,
    document_title: row.document_title,
    house_type_code: row.house_type_code,
    unit_id: row.metadata?.unit_id || row.metadata?.unit_uid || null,
    vector_score: vectorScore,
    keyword_score: keywordScore,
    tier_weight: tierWeight,
    final_score: finalScore,
    metadata: row.metadata || {},
    tier: row.tier,
  };
}

export async function getAnswerConfidence(
  chunks: UnitFirstChunk[],
  query: string
): Promise<{
  confidence: 'exact' | 'probable' | 'uncertain' | 'no_match';
  explanation: string;
  shouldUseRelatedHouseTypes: boolean;
}> {
  if (chunks.length === 0) {
    return {
      confidence: 'no_match',
      explanation: 'No relevant documents found',
      shouldUseRelatedHouseTypes: true,
    };
  }

  const topScore = chunks[0]?.vector_score || 0;
  const avgScore = chunks.reduce((sum, c) => sum + c.vector_score, 0) / chunks.length;
  const hasUnitSpecific = chunks.some(c => c.tier === 'unit');
  const hasHouseType = chunks.some(c => c.tier === 'house_type');

  if (topScore >= 0.85 && (hasUnitSpecific || hasHouseType)) {
    return {
      confidence: 'exact',
      explanation: 'High confidence match from unit or house type documents',
      shouldUseRelatedHouseTypes: false,
    };
  }

  if (topScore >= 0.7 || (avgScore >= 0.6 && hasHouseType)) {
    return {
      confidence: 'probable',
      explanation: 'Good match found, but verify with caution',
      shouldUseRelatedHouseTypes: false,
    };
  }

  if (avgScore >= 0.5) {
    return {
      confidence: 'uncertain',
      explanation: 'Partial match found - answer may be approximate',
      shouldUseRelatedHouseTypes: true,
    };
  }

  return {
    confidence: 'no_match',
    explanation: 'No confident match found in documents',
    shouldUseRelatedHouseTypes: true,
  };
}

export { TIER_WEIGHTS, CONFIDENCE_THRESHOLDS };
