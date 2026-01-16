import { db } from '@openhouse/db/client';
import { doc_chunks } from '@openhouse/db/schema';
import { sql, and, eq } from 'drizzle-orm';
import OpenAI from 'openai';

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

  // Transport
  'bus': ['public transport', 'route', 'bus stop', 'commute', 'timetable'],
  'train': ['rail', 'station', 'dart', 'commute', 'public transport'],
  'transport': ['bus', 'train', 'commute', 'travel', 'getting around'],
  'parking': ['car space', 'garage', 'driveway', 'visitor parking', 'ev charging'],

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

  console.log(`[RETRIEVAL] Found ${results.rows.length} relevant chunks`);

  // Log top results for debugging
  if (results.rows.length > 0) {
    const topSimilarity = parseFloat((results.rows[0] as any).similarity) || 0;
    console.log(`[RETRIEVAL] Top similarity score: ${topSimilarity.toFixed(4)}`);
  }

  return results.rows.map((row: any) => ({
    id: row.id,
    content: row.content,
    documentId: row.document_id,
    chunkIndex: row.chunk_index || 0,
    similarity: parseFloat(row.similarity) || 0,
    metadata: row.metadata || {},
  }));
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
