import { db } from '@openhouse/db/client';
import { sql } from 'drizzle-orm';
import OpenAI from 'openai';
import { logger } from './logger';

function getOpenAI() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY!,
  });
}

export interface HybridChunk {
  id: string;
  content: string;
  document_id: string;
  document_title: string | null;
  vector_score: number;
  keyword_score: number;
  final_score: number;
  metadata: Record<string, any>;
}

// Domain-specific keywords for supplier/contractor questions
const SUPPLIER_KEYWORDS = [
  'supplier', 'installed', 'contractor', 'fitter', 'provider', 
  'manufacturer', 'supplied', 'installer', 'fitted', 'made'
];

// Common room/property keywords
const PROPERTY_KEYWORDS = [
  'kitchen', 'wardrobe', 'boiler', 'windows', 'doors', 'flooring',
  'bathroom', 'bedroom', 'living', 'dining', 'garage', 'parking'
];

/**
 * Extract keywords from user query
 */
function extractKeywords(query: string): string[] {
  const normalized = query.toLowerCase();
  const tokens = normalized.split(/\s+/).filter(t => t.length > 2);
  
  // Remove common stopwords
  const stopwords = ['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'man', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'its', 'let', 'put', 'say', 'she', 'too', 'use'];
  
  return tokens.filter(t => !stopwords.includes(t));
}

/**
 * Compute keyword matching score for a chunk
 */
function computeKeywordScore(chunkContent: string, queryKeywords: string[], isSupplierQuery: boolean): number {
  const contentLower = chunkContent.toLowerCase();
  let score = 0;
  
  // Base keyword overlap
  for (const keyword of queryKeywords) {
    if (contentLower.includes(keyword)) {
      score += 0.3;
    }
  }
  
  // Boost for supplier-related terms if this is a supplier query
  if (isSupplierQuery) {
    for (const supplierWord of SUPPLIER_KEYWORDS) {
      if (contentLower.includes(supplierWord)) {
        score += 0.5; // Strong boost for supplier keywords
      }
    }
  }
  
  // Boost for property-related terms
  for (const propWord of PROPERTY_KEYWORDS) {
    if (contentLower.includes(propWord)) {
      score += 0.2;
    }
  }
  
  // Normalize to 0-1 range
  return Math.min(score / queryKeywords.length, 1.0);
}

/**
 * Detect if this is a supplier/contractor lookup question
 */
function isSupplierQuery(query: string): boolean {
  const normalized = query.toLowerCase();
  
  // Check for supplier-related patterns
  const supplierPatterns = [
    /who\s+(supplied|installed|fitted|provided|made|manufactured)/i,
    /\b(supplier|installer|contractor|fitter|provider|manufacturer)\b/i,
    /who\s+\w+\s+my\s+(kitchen|wardrobe|boiler|windows|doors)/i,
  ];
  
  return supplierPatterns.some(pattern => pattern.test(normalized));
}

export interface HybridRetrievalOptions {
  tenantId: string;
  developmentId: string;
  unitId?: string;
  houseTypeCode?: string;
  query: string;
  limit?: number;
  vectorWeight?: number;
  keywordWeight?: number;
}

/**
 * Multi-stage hybrid retrieval with keyword boosting
 */
export async function hybridRetrieval(options: HybridRetrievalOptions): Promise<HybridChunk[]> {
  const {
    tenantId,
    developmentId,
    unitId,
    houseTypeCode,
    query,
    limit = 8,
    vectorWeight = 0.7,
    keywordWeight = 0.3,
  } = options;

  logger.info('Hybrid retrieval started', { developmentId, unitId, houseTypeCode, query });

  // Step 1: Generate query embedding
  const embeddingResponse = await getOpenAI().embeddings.create({
    model: 'text-embedding-3-large',
    input: query,
    dimensions: 1536,
  });

  const queryEmbedding = embeddingResponse.data[0].embedding;
  const embeddingVector = `[${queryEmbedding.join(',')}]`;

  // Step 2: Extract keywords and detect intent
  const queryKeywords = extractKeywords(query);
  const isSupplier = isSupplierQuery(query);

  logger.info('Query analysis', {
    keywords: queryKeywords,
    isSupplierQuery: isSupplier,
  });

  // Step 3: Multi-stage vector search
  // Stage A: House type-scoped search (if we know the house type)
  let candidates: any[] = [];

  if (houseTypeCode) {
    console.log(`  Stage A: House type-scoped search (${houseTypeCode})...`);
    const houseTypeResults = await db.execute(sql`
      SELECT
        c.id,
        c.content,
        c.document_id,
        d.title as document_title,
        c.metadata,
        1 - (c.embedding <=> ${embeddingVector}::vector) as similarity
      FROM doc_chunks c
      LEFT JOIN documents d ON c.document_id = d.id
      WHERE c.tenant_id = ${tenantId}::uuid
        AND c.development_id = ${developmentId}::uuid
        AND (c.house_type_code = ${houseTypeCode} OR c.house_type_code IS NULL)
        AND (c.embedding <=> ${embeddingVector}::vector) < 0.7
      ORDER BY c.embedding <=> ${embeddingVector}::vector
      LIMIT 40
    `);

    candidates = houseTypeResults.rows || [];
    console.log(`  Found ${candidates.length} house type-scoped candidates`);
  }

  // Stage B: Development-wide search (always run as fallback, but prefer house type matches)
  if (candidates.length < 20) {
    console.log('  Stage B: Development-wide search...');
    const devResults = await db.execute(sql`
      SELECT
        c.id,
        c.content,
        c.document_id,
        d.title as document_title,
        c.metadata,
        c.house_type_code,
        1 - (c.embedding <=> ${embeddingVector}::vector) as similarity
      FROM doc_chunks c
      LEFT JOIN documents d ON c.document_id = d.id
      WHERE c.tenant_id = ${tenantId}::uuid
        AND c.development_id = ${developmentId}::uuid
        AND (c.embedding <=> ${embeddingVector}::vector) < 0.7
      ORDER BY 
        CASE 
          WHEN c.house_type_code = ${houseTypeCode || null} THEN 0
          WHEN c.house_type_code IS NULL THEN 1
          ELSE 2
        END,
        c.embedding <=> ${embeddingVector}::vector
      LIMIT 50
    `);

    // Merge and deduplicate
    const existingIds = new Set(candidates.map((c: any) => c.id));
    const newCandidates = (devResults.rows || []).filter((c: any) => !existingIds.has(c.id));
    candidates = [...candidates, ...newCandidates];
    console.log(`  Found ${candidates.length} total candidates after development search`);
  }

  // Step 4: Compute hybrid scores
  const scoredChunks: HybridChunk[] = candidates.map((candidate: any) => {
    const vectorScore = Number(candidate.similarity) || 0;
    const keywordScore = computeKeywordScore(candidate.content, queryKeywords, isSupplier);
    
    let finalScore = (vectorWeight * vectorScore) + (keywordWeight * keywordScore);
    
    // Boost if marked as important
    const metadata = candidate.metadata || {};
    if (metadata.is_important === true || metadata.is_important === 'true') {
      finalScore *= 1.2;
    }
    
    return {
      id: candidate.id,
      content: candidate.content,
      document_id: candidate.document_id,
      document_title: candidate.document_title,
      vector_score: vectorScore,
      keyword_score: keywordScore,
      final_score: finalScore,
      metadata,
    };
  });

  // Step 5: Sort by final score and limit
  scoredChunks.sort((a, b) => b.final_score - a.final_score);
  const topChunks = scoredChunks.slice(0, limit);

  console.log(`  Hybrid scoring complete: ${topChunks.length} chunks selected`);
  console.log(`  Avg vector score: ${(topChunks.reduce((s, c) => s + c.vector_score, 0) / topChunks.length).toFixed(3)}`);
  console.log(`  Avg keyword score: ${(topChunks.reduce((s, c) => s + c.keyword_score, 0) / topChunks.length).toFixed(3)}`);
  console.log(`  Avg final score: ${(topChunks.reduce((s, c) => s + c.final_score, 0) / topChunks.length).toFixed(3)}`);

  return topChunks;
}
