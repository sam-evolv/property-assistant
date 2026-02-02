import { db } from '@openhouse/db/client';
import { sql } from 'drizzle-orm';
import OpenAI from 'openai';
import { logger } from './logger';
import { normalizeToCanonicalRoomName } from './normalize-room-name';
import { createClient } from '@supabase/supabase-js';

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function getOpenAI() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY!,
  });
}

export interface EnhancedRetrievalOptions {
  tenantId: string;
  developmentId?: string;
  houseTypeId?: string;
  houseTypeCode?: string;
  unitId?: string;
  question: string;
  limit?: number;
}

export interface RetrievedChunk {
  id: string;
  content: string;
  documentId: string | null;
  documentTitle: string | null;
  docKind: string | null;
  houseTypeCode: string | null;
  similarity: number;
  boostedScore: number;
  scopeLevel: 'house_type' | 'development' | 'tenant';
  metadata: Record<string, any>;
}

export interface FloorplanVisionData {
  roomName: string;
  canonicalRoomName: string | null;
  floorName: string | null;
  lengthM: number | null;
  widthM: number | null;
  areaM2: number | null;
  confidence: number | null;
}

export interface EnhancedRetrievalResult {
  chunks: RetrievedChunk[];
  floorplanData: FloorplanVisionData[];
  questionType: 'spatial' | 'warranty' | 'specification' | 'general';
  totalChunks: number;
  scopeUsed: 'house_type' | 'development' | 'tenant' | 'none';
}

const SPATIAL_KEYWORDS = [
  'size', 'dimension', 'area', 'floor area', 'square', 'sqm', 'm2', 'm²',
  'length', 'width', 'height', 'room', 'rooms', 'floor', 'plan', 'layout',
  'bedroom', 'bathroom', 'kitchen', 'living', 'dining', 'utility', 'garage',
  'how big', 'how large', 'how many rooms', 'floorplan', 'floor plan',
  'measure', 'metres', 'meters', 'feet', 'space', 'total area'
];

const WARRANTY_KEYWORDS = [
  'warranty', 'guarantee', 'defect', 'repair', 'fix', 'broken', 'damage',
  'cover', 'coverage', 'claim', 'expire', 'expiry', 'expire', 'valid',
  'protected', 'builder', 'construction', 'structural', 'homebond'
];

const SPECIFICATION_KEYWORDS = [
  'specification', 'spec', 'specs', 'material', 'brand', 'model',
  'supplier', 'manufacturer', 'installed', 'type', 'grade', 'finish'
];

export function detectQuestionType(question: string): 'spatial' | 'warranty' | 'specification' | 'general' {
  const lowerQuestion = question.toLowerCase();

  const spatialScore = SPATIAL_KEYWORDS.reduce((score, kw) => 
    lowerQuestion.includes(kw) ? score + 1 : score, 0);
  
  const warrantyScore = WARRANTY_KEYWORDS.reduce((score, kw) => 
    lowerQuestion.includes(kw) ? score + 1 : score, 0);
  
  const specScore = SPECIFICATION_KEYWORDS.reduce((score, kw) => 
    lowerQuestion.includes(kw) ? score + 1 : score, 0);

  const maxScore = Math.max(spatialScore, warrantyScore, specScore);
  
  if (maxScore === 0) return 'general';
  if (spatialScore === maxScore) return 'spatial';
  if (warrantyScore === maxScore) return 'warranty';
  if (specScore === maxScore) return 'specification';
  
  return 'general';
}

export function isSpatialQuestion(question: string): boolean {
  return detectQuestionType(question) === 'spatial';
}

function getDocKindBoost(docKind: string | null, questionType: string): number {
  if (!docKind) return 1.0;

  const boosts: Record<string, Record<string, number>> = {
    spatial: {
      floorplan_summary: 1.5,
      floorplan: 1.3,
      brochure: 1.1,
      specification: 1.0,
      warranty: 0.8,
      legal: 0.7,
      other: 0.9,
    },
    warranty: {
      warranty: 1.5,
      legal: 1.2,
      specification: 1.0,
      brochure: 0.9,
      floorplan: 0.7,
      floorplan_summary: 0.7,
      other: 0.9,
    },
    specification: {
      specification: 1.5,
      brochure: 1.2,
      warranty: 1.0,
      floorplan: 0.8,
      floorplan_summary: 0.8,
      legal: 0.7,
      other: 0.9,
    },
    general: {
      floorplan_summary: 1.0,
      floorplan: 1.0,
      specification: 1.0,
      warranty: 1.0,
      brochure: 1.0,
      legal: 1.0,
      other: 1.0,
    },
  };

  return boosts[questionType]?.[docKind] ?? 1.0;
}

async function generateQueryEmbedding(query: string): Promise<number[]> {
  const response = await getOpenAI().embeddings.create({
    model: 'text-embedding-3-large',
    input: query,
    dimensions: 1536,
  });
  return response.data[0].embedding;
}

async function getProjectIdFromDevelopmentId(developmentId: string): Promise<string | null> {
  try {
    const supabase = getSupabaseClient();
    
    const { data: development } = await supabase
      .from('developments')
      .select('id, name')
      .eq('id', developmentId)
      .single();
    
    if (!development) return null;
    
    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('name', development.name)
      .single();
    
    return project?.id || null;
  } catch (error) {
    logger.warn('[EnhancedRAG] Failed to map development to project:', { error: (error as Error).message });
    return null;
  }
}

async function searchDocumentSections(
  projectId: string,
  queryEmbedding: number[],
  limit: number = 10
): Promise<RetrievedChunk[]> {
  try {
    const supabase = getSupabaseClient();
    const embeddingString = `[${queryEmbedding.join(',')}]`;
    
    const { data: sections, error } = await supabase.rpc('match_document_sections', {
      query_embedding: embeddingString,
      match_count: limit,
      filter_project_id: projectId
    });
    
    if (error) {
      logger.warn('[EnhancedRAG] RPC match_document_sections failed, trying direct query:', { error: error.message });
      
      const { data: directSections } = await supabase
        .from('document_sections')
        .select('id, content, project_id, embedding')
        .eq('project_id', projectId)
        .not('embedding', 'is', null)
        .limit(limit);
      
      if (!directSections || directSections.length === 0) return [];
      
      return directSections.map((section: any) => ({
        id: section.id,
        content: section.content,
        documentId: null,
        documentTitle: null,
        docKind: 'document_section',
        houseTypeCode: null,
        similarity: 0.5,
        boostedScore: 0.5,
        scopeLevel: 'development' as const,
        metadata: { source: 'document_sections', project_id: section.project_id },
      }));
    }
    
    return (sections || []).map((section: any) => ({
      id: section.id,
      content: section.content,
      documentId: null,
      documentTitle: section.title || null,
      docKind: 'document_section',
      houseTypeCode: null,
      similarity: section.similarity || 0.5,
      boostedScore: (section.similarity || 0.5) * 1.1,
      scopeLevel: 'development' as const,
      metadata: { source: 'document_sections', project_id: projectId },
    }));
  } catch (error) {
    logger.warn('[EnhancedRAG] Failed to search document_sections:', { error: (error as Error).message });
    return [];
  }
}

async function fetchFloorplanVisionData(
  tenantId: string,
  developmentId: string,
  houseTypeCode?: string
): Promise<FloorplanVisionData[]> {
  try {
    const query = houseTypeCode
      ? sql`
          SELECT 
            room_name, canonical_room_name, level as floor_name,
            length_m, width_m, area_m2, confidence
          FROM unit_room_dimensions
          WHERE tenant_id = ${tenantId}::uuid
            AND development_id = ${developmentId}::uuid
            AND unit_type_code = ${houseTypeCode}
            AND source = 'vision_floorplan'
          ORDER BY level, room_name
        `
      : sql`
          SELECT DISTINCT ON (canonical_room_name)
            room_name, canonical_room_name, level as floor_name,
            length_m, width_m, area_m2, confidence
          FROM unit_room_dimensions
          WHERE tenant_id = ${tenantId}::uuid
            AND development_id = ${developmentId}::uuid
            AND source = 'vision_floorplan'
          ORDER BY canonical_room_name, confidence DESC
        `;

    const result = await db.execute<{
      room_name: string;
      canonical_room_name: string | null;
      floor_name: string | null;
      length_m: string | null;
      width_m: string | null;
      area_m2: string | null;
      confidence: string | null;
    }>(query);

    return (result.rows || []).map(row => ({
      roomName: row.room_name,
      canonicalRoomName: row.canonical_room_name,
      floorName: row.floor_name,
      lengthM: row.length_m ? parseFloat(row.length_m) : null,
      widthM: row.width_m ? parseFloat(row.width_m) : null,
      areaM2: row.area_m2 ? parseFloat(row.area_m2) : null,
      confidence: row.confidence ? parseFloat(row.confidence) : null,
    }));
  } catch (error) {
    logger.warn('[EnhancedRAG] Failed to fetch floorplan vision data:', { error: (error as Error).message });
    return [];
  }
}

export async function enhancedRagRetrieval(options: EnhancedRetrievalOptions): Promise<EnhancedRetrievalResult> {
  const {
    tenantId,
    developmentId,
    houseTypeId,
    houseTypeCode,
    unitId,
    question,
    limit = 10,
  } = options;

  logger.info('[EnhancedRAG] Starting retrieval', { tenantId, developmentId, houseTypeCode, question });

  const questionType = detectQuestionType(question);
  logger.info('[EnhancedRAG] Question type detected', { questionType });

  const queryEmbedding = await generateQueryEmbedding(question);
  const embeddingVector = `[${queryEmbedding.join(',')}]`;

  let chunks: RetrievedChunk[] = [];
  let scopeUsed: 'house_type' | 'development' | 'tenant' | 'none' = 'none';
  const minResultsThreshold = 3;

  if (developmentId && houseTypeCode) {
    logger.info('[EnhancedRAG] Stage 1: House-type scoped search');
    const houseTypeResults = await db.execute<{
      id: string;
      content: string;
      document_id: string | null;
      document_title: string | null;
      doc_kind: string | null;
      house_type_code: string | null;
      similarity: number;
      metadata: Record<string, any>;
    }>(sql`
      SELECT
        c.id,
        c.content,
        c.document_id,
        d.title as document_title,
        c.doc_kind,
        c.house_type_code,
        1 - (c.embedding <=> ${embeddingVector}::vector) as similarity,
        c.metadata
      FROM doc_chunks c
      LEFT JOIN documents d ON c.document_id = d.id
      WHERE c.tenant_id = ${tenantId}::uuid
        AND c.development_id = ${developmentId}::uuid
        AND c.house_type_code = ${houseTypeCode}
        AND c.embedding IS NOT NULL
        AND (1 - (c.embedding <=> ${embeddingVector}::vector)) > 0.3
      ORDER BY c.embedding <=> ${embeddingVector}::vector
      LIMIT ${limit * 2}
    `);

    chunks = (houseTypeResults.rows || []).map(row => ({
      id: row.id,
      content: row.content,
      documentId: row.document_id,
      documentTitle: row.document_title,
      docKind: row.doc_kind,
      houseTypeCode: row.house_type_code,
      similarity: Number(row.similarity) || 0,
      boostedScore: (Number(row.similarity) || 0) * getDocKindBoost(row.doc_kind, questionType),
      scopeLevel: 'house_type' as const,
      metadata: row.metadata || {},
    }));

    if (chunks.length >= minResultsThreshold) {
      scopeUsed = 'house_type';
    }
  }

  if (developmentId && chunks.length < minResultsThreshold) {
    logger.info('[EnhancedRAG] Stage 2: Development-wide search');
    const devResults = await db.execute<{
      id: string;
      content: string;
      document_id: string | null;
      document_title: string | null;
      doc_kind: string | null;
      house_type_code: string | null;
      similarity: number;
      metadata: Record<string, any>;
    }>(sql`
      SELECT
        c.id,
        c.content,
        c.document_id,
        d.title as document_title,
        c.doc_kind,
        c.house_type_code,
        1 - (c.embedding <=> ${embeddingVector}::vector) as similarity,
        c.metadata
      FROM doc_chunks c
      LEFT JOIN documents d ON c.document_id = d.id
      WHERE c.tenant_id = ${tenantId}::uuid
        AND c.development_id = ${developmentId}::uuid
        AND c.embedding IS NOT NULL
        AND (1 - (c.embedding <=> ${embeddingVector}::vector)) > 0.25
      ORDER BY 
        CASE WHEN c.house_type_code = ${houseTypeCode || null} THEN 0 ELSE 1 END,
        c.embedding <=> ${embeddingVector}::vector
      LIMIT ${limit * 3}
    `);

    const existingIds = new Set(chunks.map(c => c.id));
    const devChunks = (devResults.rows || [])
      .filter(row => !existingIds.has(row.id))
      .map(row => ({
        id: row.id,
        content: row.content,
        documentId: row.document_id,
        documentTitle: row.document_title,
        docKind: row.doc_kind,
        houseTypeCode: row.house_type_code,
        similarity: Number(row.similarity) || 0,
        boostedScore: (Number(row.similarity) || 0) * getDocKindBoost(row.doc_kind, questionType),
        scopeLevel: 'development' as const,
        metadata: row.metadata || {},
      }));

    chunks = [...chunks, ...devChunks];
    
    if (chunks.length >= minResultsThreshold && scopeUsed === 'none') {
      scopeUsed = 'development';
    }
  }

  if (chunks.length < minResultsThreshold) {
    logger.info('[EnhancedRAG] Stage 3: Tenant-wide search');
    const tenantResults = await db.execute<{
      id: string;
      content: string;
      document_id: string | null;
      document_title: string | null;
      doc_kind: string | null;
      house_type_code: string | null;
      similarity: number;
      metadata: Record<string, any>;
    }>(sql`
      SELECT
        c.id,
        c.content,
        c.document_id,
        d.title as document_title,
        c.doc_kind,
        c.house_type_code,
        1 - (c.embedding <=> ${embeddingVector}::vector) as similarity,
        c.metadata
      FROM doc_chunks c
      LEFT JOIN documents d ON c.document_id = d.id
      WHERE c.tenant_id = ${tenantId}::uuid
        AND c.embedding IS NOT NULL
        AND (1 - (c.embedding <=> ${embeddingVector}::vector)) > 0.2
      ORDER BY c.embedding <=> ${embeddingVector}::vector
      LIMIT ${limit * 3}
    `);

    const existingIds = new Set(chunks.map(c => c.id));
    const tenantChunks = (tenantResults.rows || [])
      .filter(row => !existingIds.has(row.id))
      .map(row => ({
        id: row.id,
        content: row.content,
        documentId: row.document_id,
        documentTitle: row.document_title,
        docKind: row.doc_kind,
        houseTypeCode: row.house_type_code,
        similarity: Number(row.similarity) || 0,
        boostedScore: (Number(row.similarity) || 0) * getDocKindBoost(row.doc_kind, questionType),
        scopeLevel: 'tenant' as const,
        metadata: row.metadata || {},
      }));

    chunks = [...chunks, ...tenantChunks];
    
    if (chunks.length > 0 && scopeUsed === 'none') {
      scopeUsed = 'tenant';
    }
  }

  // Stage 4: Search document_sections (legacy Supabase table with project_id)
  // This catches content that exists in the Supabase document_sections table but not in doc_chunks
  if (developmentId && chunks.length < minResultsThreshold) {
    logger.info('[EnhancedRAG] Stage 4: Searching document_sections (project-based)');
    
    const projectId = await getProjectIdFromDevelopmentId(developmentId);
    
    if (projectId) {
      logger.info('[EnhancedRAG] Mapped development to project', { developmentId, projectId });
      
      const docSectionChunks = await searchDocumentSections(projectId, queryEmbedding, limit);
      
      if (docSectionChunks.length > 0) {
        const existingContents = new Set(chunks.map(c => c.content.substring(0, 100)));
        const newSectionChunks = docSectionChunks.filter(
          chunk => !existingContents.has(chunk.content.substring(0, 100))
        );
        
        chunks = [...chunks, ...newSectionChunks];
        logger.info('[EnhancedRAG] Added document_sections chunks', { count: newSectionChunks.length });
        
        if (chunks.length > 0 && scopeUsed === 'none') {
          scopeUsed = 'development';
        }
      }
    } else {
      logger.warn('[EnhancedRAG] Could not map development_id to project_id', { developmentId });
    }
  }

  chunks.sort((a, b) => b.boostedScore - a.boostedScore);
  chunks = chunks.slice(0, limit);

  let floorplanData: FloorplanVisionData[] = [];
  
  if (questionType === 'spatial' && developmentId) {
    floorplanData = await fetchFloorplanVisionData(tenantId, developmentId, houseTypeCode);
    logger.info('[EnhancedRAG] Fetched floorplan vision data', { roomCount: floorplanData.length });
  }

  logger.info('[EnhancedRAG] Retrieval complete', {
    totalChunks: chunks.length,
    scopeUsed,
    questionType,
    floorplanDataCount: floorplanData.length,
    avgSimilarity: chunks.length > 0 
      ? (chunks.reduce((sum, c) => sum + c.similarity, 0) / chunks.length).toFixed(3) 
      : 0,
    avgBoostedScore: chunks.length > 0
      ? (chunks.reduce((sum, c) => sum + c.boostedScore, 0) / chunks.length).toFixed(3)
      : 0,
  });

  return {
    chunks,
    floorplanData,
    questionType,
    totalChunks: chunks.length,
    scopeUsed,
  };
}

export function formatFloorplanDataForContext(floorplanData: FloorplanVisionData[]): string {
  if (floorplanData.length === 0) return '';

  let context = '\n\n--- VERIFIED ROOM DIMENSIONS (from architectural floor plans) ---\n';
  
  const byFloor = floorplanData.reduce((acc, room) => {
    const floor = room.floorName || 'Unknown Floor';
    if (!acc[floor]) acc[floor] = [];
    acc[floor].push(room);
    return acc;
  }, {} as Record<string, FloorplanVisionData[]>);

  for (const [floor, rooms] of Object.entries(byFloor)) {
    context += `\n${floor}:\n`;
    for (const room of rooms) {
      if (room.lengthM && room.widthM) {
        context += `  - ${room.roomName}: ${room.lengthM}m × ${room.widthM}m = ${room.areaM2}m²\n`;
      } else if (room.areaM2) {
        context += `  - ${room.roomName}: ${room.areaM2}m²\n`;
      }
    }
  }

  const totalArea = floorplanData.reduce((sum, r) => sum + (r.areaM2 || 0), 0);
  if (totalArea > 0) {
    context += `\nTotal floor area: approximately ${totalArea.toFixed(1)}m²\n`;
  }

  return context;
}

export const NO_HALLUCINATION_SYSTEM_PROMPT = `You are a helpful property assistant for a real estate development.

CRITICAL RULES:
1. ONLY use information provided in the context below. Do NOT make up or assume any dimensions, specifications, or facts.
2. If the information is not in the context, say "I don't have that specific information in the property documents."
3. When discussing room dimensions, ONLY use values from the "VERIFIED ROOM DIMENSIONS" section if present.
4. Do NOT calculate or estimate dimensions unless explicitly shown in the documents.
5. Be helpful but honest - it's better to admit you don't know than to provide incorrect information.
6. Reference the source of your information when possible (e.g., "According to the floor plans...").

If asked about something not covered in the documents, politely explain what types of information you do have access to.`;

export const FALLBACK_NO_DATA_MESSAGE = 
  "I'm sorry, I don't have specific information about that in the property documents. " +
  "I can help you with questions about your property's layout, specifications, warranties, and other documented features. " +
  "Would you like me to help you with something else?";
