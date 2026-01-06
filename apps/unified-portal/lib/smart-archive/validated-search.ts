/**
 * Smart Archive Validated Search
 * 
 * Wraps document retrieval with confidence scoring and validation.
 * Ensures only matching, relevant documents are returned to users.
 */

import { createClient } from '@supabase/supabase-js';
import {
  DocCategory,
  ValidationContext,
  ValidationResult,
  filterByValidation,
  inferCategoryFromText,
  generateGuidedFallback,
  logAnswerGap,
  type GuidedFallback,
} from './validate';

export interface DocumentChunk {
  id: string;
  content: string;
  metadata: {
    source?: string;
    file_name?: string;
    file_url?: string;
    discipline?: string;
    house_type_code?: string;
    unit_code?: string;
    category?: DocCategory;
    is_important?: boolean;
    must_read?: boolean;
    folder_id?: string;
  };
  embedding?: number[];
  similarity?: number;
}

export interface ValidatedSearchResult {
  chunks: DocumentChunk[];
  validation: {
    totalCandidates: number;
    passedValidation: number;
    bestConfidence: number | null;
    allBelowThreshold: boolean;
  };
  fallback: GuidedFallback | null;
}

export interface SearchOptions {
  schemeId: string;
  query: string;
  queryEmbedding: number[];
  intentCategory?: DocCategory | null;
  unitCode?: string | null;
  houseType?: string | null;
  threshold?: number;
  maxResults?: number;
}

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase configuration missing');
  }
  
  return createClient(supabaseUrl, supabaseKey);
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  return magnitude === 0 ? 0 : dotProduct / magnitude;
}

function parseEmbedding(embedding: any): number[] | null {
  if (!embedding) return null;
  if (Array.isArray(embedding)) return embedding;
  if (typeof embedding === 'string') {
    try {
      return JSON.parse(embedding);
    } catch {
      return null;
    }
  }
  return null;
}

export function detectIntentCategory(query: string): DocCategory | null {
  const lower = query.toLowerCase();
  
  const categoryPatterns: [RegExp, DocCategory][] = [
    [/\b(heat|boiler|thermostat|radiator|central\s*heating|warm|temperature|hvac)\b/i, 'heating'],
    [/\b(electric|wiring|fuse|circuit|socket|switch|light|power)\b/i, 'electrical'],
    [/\b(plumb|water|drain|pipe|tap|shower|toilet|sink|hot\s*water)\b/i, 'plumbing'],
    [/\b(warrant|guarant|certific|appliance\s*cover|insurance)\b/i, 'warranties'],
    [/\b(rule|regulation|management|hoa|covenants?|restrictions?)\b/i, 'house_rules'],
    [/\b(snag|defect|punch|issue|problem|fault|broken)\b/i, 'snagging'],
    [/\b(welcome|handover|move\s*in|getting\s*started|new\s*home)\b/i, 'welcome_pack'],
    [/\b(waste|bin|recycl|parking|car\s*park|garage|rubbish)\b/i, 'waste_parking'],
  ];
  
  for (const [pattern, category] of categoryPatterns) {
    if (pattern.test(lower)) {
      return category;
    }
  }
  
  return null;
}

export async function searchWithValidation(
  options: SearchOptions
): Promise<ValidatedSearchResult> {
  const {
    schemeId,
    query,
    queryEmbedding,
    intentCategory,
    unitCode,
    houseType,
    threshold = 50,
    maxResults = 5,
  } = options;
  
  const detectedCategory = intentCategory || detectIntentCategory(query);
  
  console.log('[ValidatedSearch] Starting search with:', {
    schemeId,
    detectedCategory,
    unitCode,
    houseType,
    threshold,
  });
  
  const supabase = getSupabaseClient();
  const { data: chunks, error } = await supabase
    .from('document_sections')
    .select('id, content, metadata, embedding')
    .eq('project_id', schemeId);
  
  if (error || !chunks) {
    console.error('[ValidatedSearch] Failed to fetch chunks:', error?.message);
    return {
      chunks: [],
      validation: {
        totalCandidates: 0,
        passedValidation: 0,
        bestConfidence: null,
        allBelowThreshold: true,
      },
      fallback: generateGuidedFallback(
        { targetSchemeId: schemeId, intentCategory: detectedCategory, unitCode, houseType },
        detectedCategory
      ),
    };
  }
  
  console.log('[ValidatedSearch] Fetched', chunks.length, 'total chunks');
  
  const scoredChunks: (DocumentChunk & { similarity: number })[] = chunks
    .map(chunk => {
      const embedding = parseEmbedding(chunk.embedding);
      const similarity = embedding ? cosineSimilarity(queryEmbedding, embedding) : 0;
      
      return {
        id: chunk.id,
        content: chunk.content,
        metadata: chunk.metadata || {},
        embedding: embedding || undefined,
        similarity,
      };
    })
    .filter(chunk => chunk.similarity > 0.3)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 50);
  
  console.log('[ValidatedSearch] Semantic filtering reduced to', scoredChunks.length, 'candidates');
  
  const validationContext: ValidationContext = {
    targetSchemeId: schemeId,
    intentCategory: detectedCategory,
    unitCode,
    houseType,
  };
  
  const validatedChunks = filterByValidation(
    scoredChunks.map(chunk => ({
      ...chunk,
      project_id: schemeId,
      discipline: chunk.metadata?.discipline || null,
      house_type_code: chunk.metadata?.house_type_code || null,
      unit_code: chunk.metadata?.unit_code || null,
      category: chunk.metadata?.category || null,
      file_name: chunk.metadata?.file_name || chunk.metadata?.source || 'Unknown',
      title: chunk.metadata?.source || chunk.metadata?.file_name || 'Unknown',
    })),
    validationContext,
    threshold
  );
  
  console.log('[ValidatedSearch] Validation passed:', validatedChunks.length, 'chunks');
  
  const bestConfidence = validatedChunks.length > 0 
    ? validatedChunks[0].validation.confidence 
    : (scoredChunks.length > 0 ? 0 : null);
  
  if (validatedChunks.length === 0) {
    console.log('[ValidatedSearch] No chunks passed validation threshold');
    
    logAnswerGap(null, {
      scheme_id: schemeId,
      query_text: query,
      intent_category: detectedCategory,
      gap_reason: scoredChunks.length === 0 ? 'no_documents' : 'low_doc_confidence',
      candidates_count: scoredChunks.length,
      best_confidence: bestConfidence,
      unit_code: unitCode || null,
      house_type: houseType || null,
    });
    
    return {
      chunks: [],
      validation: {
        totalCandidates: scoredChunks.length,
        passedValidation: 0,
        bestConfidence,
        allBelowThreshold: true,
      },
      fallback: generateGuidedFallback(validationContext, detectedCategory),
    };
  }
  
  const resultChunks: DocumentChunk[] = validatedChunks
    .slice(0, maxResults)
    .map(v => ({
      id: v.document.id,
      content: v.document.content,
      metadata: v.document.metadata || {},
      similarity: v.document.similarity,
    }));
  
  return {
    chunks: resultChunks,
    validation: {
      totalCandidates: scoredChunks.length,
      passedValidation: validatedChunks.length,
      bestConfidence: validatedChunks[0].validation.confidence,
      allBelowThreshold: false,
    },
    fallback: null,
  };
}

export function formatValidationFallbackResponse(fallback: GuidedFallback): string {
  let response = fallback.message;
  
  if (fallback.askFollowUp) {
    response += '\n\n' + fallback.askFollowUp;
  }
  
  return response;
}
