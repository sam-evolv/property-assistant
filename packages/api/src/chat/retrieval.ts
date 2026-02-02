import { db } from '@openhouse/db/client';
import { doc_chunks } from '@openhouse/db/schema';
import { sql, and, eq } from 'drizzle-orm';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
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
    console.error('[RETRIEVAL] Failed to map development to project:', error);
    return null;
  }
}

async function searchDocumentSections(
  projectId: string,
  queryEmbedding: number[],
  limit: number = 10
): Promise<RelevantChunk[]> {
  try {
    const supabase = getSupabaseClient();
    
    const { data: sections, error } = await supabase
      .from('document_sections')
      .select('id, content, project_id')
      .eq('project_id', projectId)
      .not('embedding', 'is', null)
      .limit(limit);
    
    if (error || !sections || sections.length === 0) {
      console.log('[RETRIEVAL] No document_sections found for project:', projectId);
      return [];
    }
    
    console.log('[RETRIEVAL] Found', sections.length, 'document_sections for project');
    
    return sections.map((section: any) => ({
      id: section.id,
      content: section.content,
      documentId: null,
      chunkIndex: 0,
      similarity: 0.5,
      metadata: { source: 'document_sections', project_id: section.project_id },
    }));
  } catch (error) {
    console.error('[RETRIEVAL] Failed to search document_sections:', error);
    return [];
  }
}

export interface RelevantChunk {
  id: string;
  content: string;
  documentId: string | null;
  chunkIndex: number;
  similarity: number;
  metadata: Record<string, any>;
}

export interface RetrievalParams {
  developmentId: string;
  tenantId: string;
  query: string;
  houseTypeCode?: string | null;
  limit?: number;
}

/**
 * Query expansion mappings to improve retrieval.
 * Maps common terms and abbreviations to related concepts.
 * This helps find relevant content even when exact terms don't match.
 */
const QUERY_EXPANSIONS: Record<string, string[]> = {
  // Energy & Heating
  'ber': ['building energy rating', 'energy rating', 'energy efficiency', 'a-rated', 'nzeb'],
  'heating': ['heat pump', 'boiler', 'radiator', 'underfloor heating', 'thermostat', 'temperature'],
  'heat pump': ['daikin', 'air to water', 'heating system', 'hot water'],
  'hot water': ['cylinder', 'immersion', 'water heater', 'heating'],
  'insulation': ['u-value', 'thermal', 'heat loss', 'energy efficiency'],
  'solar': ['pv panels', 'photovoltaic', 'renewable', 'electricity generation'],
  'ventilation': ['mvhr', 'air quality', 'extract fan', 'humidity', 'condensation'],

  // Transport (expanded for Ireland)
  'bus': ['public transport', 'route', 'bus stop', 'commute', 'timetable', 'bus eireann', 'dublin bus', 'go ahead'],
  'train': ['rail', 'station', 'dart', 'commute', 'public transport', 'irish rail', 'iarnrod eireann'],
  'transport': ['bus', 'train', 'commute', 'travel', 'getting around', 'public transport', 'luas', 'dart'],
  'parking': ['car space', 'garage', 'driveway', 'visitor parking', 'ev charging', 'car park'],
  'luas': ['tram', 'light rail', 'public transport', 'red line', 'green line'],
  'dart': ['train', 'rail', 'commuter', 'public transport', 'station'],
  'commute': ['bus', 'train', 'transport', 'getting to work', 'city centre', 'travel time'],
  'cycle': ['cycling', 'bike', 'bicycle', 'greenway', 'bike storage', 'cycle lane'],
  'city centre': ['town', 'city', 'commute', 'bus', 'train', 'transport'],

  // Schools & Education
  'school': ['primary school', 'secondary school', 'education', 'children'],
  'schools': ['primary school', 'secondary school', 'education', 'creche', 'montessori'],
  'creche': ['childcare', 'daycare', 'nursery', 'preschool'],

  // Shopping & Amenities
  'shop': ['supermarket', 'shopping centre', 'retail', 'store', 'convenience'],
  'supermarket': ['shopping', 'groceries', 'tesco', 'dunnes', 'aldi', 'lidl'],

  // Healthcare
  'doctor': ['gp', 'medical centre', 'healthcare', 'clinic'],
  'gp': ['doctor', 'medical', 'health centre', 'surgery'],
  'hospital': ['healthcare', 'emergency', 'medical', 'a&e'],
  'pharmacy': ['chemist', 'prescription', 'medication'],

  // Property Features
  'size': ['square feet', 'square metres', 'floor area', 'dimensions', 'sq ft', 'sq m'],
  'bedroom': ['bed', 'room', 'accommodation', 'sleeping'],
  'bathroom': ['ensuite', 'shower', 'toilet', 'wc'],
  'kitchen': ['appliances', 'oven', 'hob', 'cooking'],
  'garden': ['outdoor', 'patio', 'landscaping', 'back garden', 'front garden'],

  // Maintenance & Issues
  'repair': ['fix', 'maintenance', 'broken', 'defect', 'issue'],
  'warranty': ['guarantee', 'homebond', 'defect', 'cover', 'protection'],
  'defect': ['snag', 'issue', 'problem', 'fault', 'repair'],
  'maintenance': ['upkeep', 'service', 'repair', 'maintain'],

  // Management & Contacts
  'contact': ['phone', 'email', 'call', 'reach', 'get in touch'],
  'management': ['management company', 'omc', 'service charge', 'fees'],
  'fees': ['service charge', 'management fee', 'costs', 'annual charge'],

  // Waste & Utilities
  'bin': ['waste', 'rubbish', 'recycling', 'collection', 'refuse'],
  'bins': ['waste collection', 'rubbish', 'recycling', 'bin day'],
  'recycling': ['bin', 'waste', 'green bin', 'brown bin'],
  'broadband': ['internet', 'wifi', 'fibre', 'connection'],
  'internet': ['broadband', 'wifi', 'fibre', 'online'],

  // Safety
  'alarm': ['security', 'intruder', 'burglar', 'monitoring'],
  'fire': ['smoke detector', 'fire alarm', 'emergency', 'safety'],
  'emergency': ['999', '112', 'urgent', 'fire', 'safety'],

  // Legal & Financial
  'price': ['cost', 'payment', 'purchase price', 'value'],
  'mortgage': ['loan', 'finance', 'bank', 'lending'],
  'deposit': ['booking deposit', 'contract deposit', 'payment'],
  'solicitor': ['legal', 'conveyancing', 'lawyer', 'contract'],

  // Irish-specific terms
  'eircode': ['postcode', 'address', 'location', 'postal code'],
  'omc': ['management company', 'owners management company', 'service charge', 'management fee'],
  'homebond': ['warranty', 'structural guarantee', 'building guarantee', 'latent defects', 'structural defects'],
  'snag': ['defect', 'issue', 'problem', 'punch list', 'snagging', 'snag list'],
  'snagging': ['snag', 'defects', 'issues', 'inspection', 'punch list'],
  'attic': ['loft', 'roof space', 'storage', 'attic hatch'],
  'press': ['cupboard', 'cabinet', 'storage', 'hot press', 'airing cupboard'],
  'hot press': ['airing cupboard', 'cylinder', 'hot water', 'storage', 'immersion'],
  'immersion': ['hot water', 'water heater', 'cylinder', 'boost'],
  'nzeb': ['nearly zero energy', 'energy efficient', 'ber', 'a-rated', 'building regulations'],
  'part l': ['building regulations', 'energy', 'insulation', 'nzeb'],
  'taking in charge': ['roads', 'estate', 'council', 'local authority', 'public areas'],
  'management fee': ['service charge', 'omc', 'annual fee', 'management company'],
  'estate': ['development', 'housing estate', 'scheme', 'neighbourhood'],

  // Additional common queries
  'move in': ['moving', 'handover', 'keys', 'completion', 'closing'],
  'keys': ['handover', 'move in', 'completion', 'collection'],
  'closing': ['completion', 'handover', 'keys', 'move in', 'final payment'],
  'neighbours': ['residents', 'community', 'estate', 'other homes'],
  'pets': ['dog', 'cat', 'animals', 'pet policy'],
  'noise': ['soundproofing', 'insulation', 'neighbours', 'acoustic'],
  'storage': ['attic', 'press', 'cupboard', 'shed', 'garage'],
  'meter': ['electricity meter', 'gas meter', 'water meter', 'smart meter', 'readings'],
};

/**
 * Expands a query with related terms to improve retrieval.
 * Returns the original query enhanced with relevant synonyms and related concepts.
 */
export function expandQuery(query: string): string {
  const lowerQuery = query.toLowerCase();
  const expansions: string[] = [];

  for (const [term, relatedTerms] of Object.entries(QUERY_EXPANSIONS)) {
    // Check if the term appears in the query
    const termRegex = new RegExp(`\\b${term}\\b`, 'i');
    if (termRegex.test(lowerQuery)) {
      // Add related terms that aren't already in the query
      for (const related of relatedTerms) {
        if (!lowerQuery.includes(related.toLowerCase())) {
          expansions.push(related);
        }
      }
    }
  }

  // Limit expansions to avoid over-diluting the query
  const limitedExpansions = expansions.slice(0, 5);

  if (limitedExpansions.length > 0) {
    // Create an expanded query that includes context
    return `${query} (related: ${limitedExpansions.join(', ')})`;
  }

  return query;
}

/**
 * Detects the likely intent/topic of a query to help with retrieval weighting.
 */
export function detectQueryIntent(query: string): string[] {
  const intents: string[] = [];
  const lowerQuery = query.toLowerCase();

  // Location/amenities queries
  if (/where|near(by)?|close|distance|how far|local/i.test(query)) {
    intents.push('location');
  }

  // How-to/operational queries
  if (/how (do|to|can)|what('s| is) the|instructions|operate|use|turn on|set/i.test(query)) {
    intents.push('operational');
  }

  // Contact/support queries
  if (/contact|call|email|phone|who|report|complain|support/i.test(query)) {
    intents.push('contact');
  }

  // Technical/specification queries
  if (/what (type|kind|model|brand)|specification|spec|rated|rating/i.test(query)) {
    intents.push('technical');
  }

  // Cost/financial queries
  if (/cost|price|fee|charge|pay|expense|how much/i.test(query)) {
    intents.push('financial');
  }

  // Time-based queries
  if (/when|what time|schedule|day|hours|open/i.test(query)) {
    intents.push('timing');
  }

  return intents;
}

export async function getRelevantChunks(
  params: RetrievalParams
): Promise<RelevantChunk[]> {
  const { developmentId, tenantId, query, houseTypeCode, limit = 12 } = params;

  console.log(`[RETRIEVAL] Searching chunks for development: ${developmentId}`);
  console.log(`[RETRIEVAL] Tenant ID: ${tenantId}`);
  console.log(`[RETRIEVAL] Original query: "${query}"`);

  if (houseTypeCode) {
    console.log(`[RETRIEVAL] Filtering by house_type_code: ${houseTypeCode}`);
  }

  // Expand the query with related terms for better recall
  const expandedQuery = expandQuery(query);
  const queryIntent = detectQueryIntent(query);

  if (expandedQuery !== query) {
    console.log(`[RETRIEVAL] Expanded query: "${expandedQuery}"`);
  }
  if (queryIntent.length > 0) {
    console.log(`[RETRIEVAL] Detected intents: ${queryIntent.join(', ')}`);
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key not configured');
  }

  const openai = new OpenAI({ apiKey });

  // Use expanded query for embedding to capture broader semantic meaning
  const embeddingResponse = await openai.embeddings.create({
    model: 'text-embedding-3-large',
    input: expandedQuery,
    dimensions: 1536,
  });

  const queryEmbedding = embeddingResponse.data[0].embedding;
  const embeddingString = `[${queryEmbedding.join(',')}]`;

  // Build topic matching boost based on query intent
  // This gives extra weight to chunks that match the detected topic
  const topicBoostSql = queryIntent.length > 0
    ? sql`
        CASE
          WHEN metadata->>'topics' IS NOT NULL AND (
            ${sql.join(
              queryIntent.map(intent => sql`metadata->>'topics' ILIKE ${'%' + intent + '%'}`),
              sql` OR `
            )}
          ) THEN 1.15
          ELSE 1.0
        END
      `
    : sql`1.0`;

  const results = houseTypeCode
    ? await db.execute(sql`
        SELECT
          id,
          content,
          document_id,
          chunk_index,
          metadata,
          house_type_code,
          is_important,
          1 - (embedding <=> ${embeddingString}::vector) as similarity,
          (1 - (embedding <=> ${embeddingString}::vector))
            * CASE WHEN is_important = true THEN 1.25 ELSE 1.0 END
            * ${topicBoostSql}
            * CASE WHEN house_type_code = ${houseTypeCode} THEN 1.1 ELSE 1.0 END
          as weighted_similarity
        FROM ${doc_chunks}
        WHERE
          tenant_id = ${tenantId}
          AND development_id = ${developmentId}
          AND (house_type_code = ${houseTypeCode} OR house_type_code IS NULL)
          AND embedding IS NOT NULL
        ORDER BY weighted_similarity DESC
        LIMIT ${limit}
      `)
    : await db.execute(sql`
        SELECT
          id,
          content,
          document_id,
          chunk_index,
          metadata,
          is_important,
          1 - (embedding <=> ${embeddingString}::vector) as similarity,
          (1 - (embedding <=> ${embeddingString}::vector))
            * CASE WHEN is_important = true THEN 1.25 ELSE 1.0 END
            * ${topicBoostSql}
          as weighted_similarity
        FROM ${doc_chunks}
        WHERE
          tenant_id = ${tenantId}
          AND development_id = ${developmentId}
          AND embedding IS NOT NULL
        ORDER BY weighted_similarity DESC
        LIMIT ${limit}
      `);

  console.log(`[RETRIEVAL] Found ${results.rows.length} relevant chunks from doc_chunks`);

  // Log top results for debugging
  if (results.rows.length > 0) {
    const topSimilarity = parseFloat((results.rows[0] as any).similarity) || 0;
    console.log(`[RETRIEVAL] Top similarity score: ${topSimilarity.toFixed(4)}`);
  }

  let chunks: RelevantChunk[] = results.rows.map((row: any) => ({
    id: row.id,
    content: row.content,
    documentId: row.document_id,
    chunkIndex: row.chunk_index || 0,
    similarity: parseFloat(row.similarity) || 0,
    metadata: row.metadata || {},
  }));

  // Fallback: Search document_sections (legacy Supabase table with project_id)
  // This catches content that exists in document_sections but not in doc_chunks
  const minResultsThreshold = 3;
  if (chunks.length < minResultsThreshold) {
    console.log(`[RETRIEVAL] Fewer than ${minResultsThreshold} results, searching document_sections...`);
    
    const projectId = await getProjectIdFromDevelopmentId(developmentId);
    
    if (projectId) {
      console.log(`[RETRIEVAL] Mapped development ${developmentId} to project ${projectId}`);
      
      const docSectionChunks = await searchDocumentSections(projectId, queryEmbedding, limit);
      
      if (docSectionChunks.length > 0) {
        // Deduplicate by content prefix
        const existingContents = new Set(chunks.map(c => c.content.substring(0, 100)));
        const newChunks = docSectionChunks.filter(
          chunk => !existingContents.has(chunk.content.substring(0, 100))
        );
        
        chunks = [...chunks, ...newChunks];
        console.log(`[RETRIEVAL] Added ${newChunks.length} chunks from document_sections`);
      }
    } else {
      console.log(`[RETRIEVAL] Could not map development_id to project_id`);
    }
  }

  return chunks;
}

export async function embedQuery(query: string): Promise<number[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key not configured');
  }

  const openai = new OpenAI({ apiKey });

  const embeddingResponse = await openai.embeddings.create({
    model: 'text-embedding-3-large',
    input: query,
    dimensions: 1536,
  });

  return embeddingResponse.data[0].embedding;
}
