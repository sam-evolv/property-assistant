import { encoding_for_model } from 'tiktoken';
import { TrainingItem, TextChunk } from './types';

const DEFAULT_CHUNK_SIZE = 500;
const DEFAULT_OVERLAP = 50;

/**
 * Topic categories that help the AI understand what kind of information a chunk contains.
 * These are used across all developments to improve retrieval relevance.
 */
const TOPIC_PATTERNS: Record<string, RegExp[]> = {
  // Property & Home Features
  heating: [/heat(ing|er|pump)?/i, /boiler/i, /radiator/i, /underfloor/i, /thermostat/i, /hvac/i, /warmth/i],
  ventilation: [/ventilat(ion|e|ing)/i, /mvhr/i, /air\s*(quality|flow|exchange)/i, /extract(or)?(\s*fan)?/i, /humidity/i],
  energy: [/ber\b/i, /energy\s*rat(ing|ed)/i, /nzeb/i, /a-rated/i, /insulation/i, /solar\s*(panel|pv)/i, /heat\s*loss/i, /u-value/i],
  electrical: [/electric(al|ity)?/i, /socket/i, /fuse\s*board/i, /circuit/i, /wiring/i, /ev\s*charg(er|ing)/i, /power/i],
  plumbing: [/plumb(ing|er)?/i, /water\s*(heater|tank|pressure|supply)/i, /stopcock/i, /drain/i, /sewage/i, /pipe/i],
  security: [/alarm/i, /security/i, /lock/i, /cctv/i, /intercom/i, /access\s*control/i, /smoke\s*detector/i, /carbon\s*monoxide/i],

  // Spaces & Layout
  floor_plan: [/floor\s*plan/i, /layout/i, /sq(uare)?\s*(ft|feet|m|metre)/i, /bedroom/i, /bathroom/i, /kitchen/i, /living/i, /storage/i],
  garden: [/garden/i, /patio/i, /outdoor/i, /landscap/i, /grass/i, /fence/i, /shed/i, /deck(ing)?/i],
  parking: [/park(ing)?/i, /garage/i, /car\s*space/i, /driveway/i, /bicycle/i, /ev\s*charg/i],

  // Development & Community
  amenities: [/amenity|amenities/i, /gym/i, /playground/i, /community/i, /common\s*area/i, /resident/i, /shared/i],
  management: [/management\s*(company|fee|charge)/i, /service\s*charge/i, /sinking\s*fund/i, /owner.*management/i, /omc/i],
  rules: [/rule/i, /regulat/i, /covenant/i, /restriction/i, /permission/i, /pet/i, /noise/i, /bbq/i],

  // Location & Transport
  transport: [/bus/i, /train/i, /luas/i, /dart/i, /transport/i, /commut/i, /route\s*\d+/i, /station/i, /stop/i],
  schools: [/school/i, /education/i, /creche/i, /montessori/i, /primary/i, /secondary/i, /college/i],
  shopping: [/shop(ping)?/i, /supermarket/i, /retail/i, /centre/i, /mall/i, /store/i],
  healthcare: [/hospital/i, /doctor/i, /gp\b/i, /clinic/i, /pharmacy/i, /chemist/i, /dental/i, /medical/i],

  // Legal & Financial
  warranty: [/warrant(y|ies)/i, /homebond/i, /guarantee/i, /defect/i, /snag(ging)?/i, /latent/i],
  legal: [/contract/i, /legal/i, /solicitor/i, /conveyancing/i, /title/i, /deed/i, /lease/i],
  financial: [/price/i, /cost/i, /payment/i, /mortgage/i, /deposit/i, /stamp\s*duty/i, /htb/i, /help\s*to\s*buy/i],

  // Maintenance & Operations
  maintenance: [/maintenance/i, /repair/i, /service/i, /maintain/i, /upkeep/i, /cleaning/i, /inspect/i],
  waste: [/bin/i, /waste/i, /recycl/i, /rubbish/i, /collection/i, /refuse/i, /compost/i],
  utilities: [/utilit(y|ies)/i, /broadband/i, /internet/i, /wifi/i, /tv/i, /phone/i, /fibre/i],

  // Safety & Emergency
  safety: [/safety/i, /emergency/i, /fire/i, /evacuat/i, /first\s*aid/i, /hazard/i, /risk/i],
  contact: [/contact/i, /phone/i, /email/i, /call/i, /reach/i, /support/i, /helpline/i, /customer\s*service/i],

  // Interior Finishes & Features
  appliances: [/appliance/i, /oven/i, /hob/i, /dishwasher/i, /washing\s*machine/i, /fridge/i, /freezer/i, /extractor/i, /microwave/i],
  flooring: [/floor(ing)?/i, /tile/i, /carpet/i, /laminate/i, /wood\s*floor/i, /vinyl/i, /lino/i],
  windows_doors: [/window/i, /door/i, /glazing/i, /double\s*glaz/i, /triple\s*glaz/i, /patio\s*door/i, /french\s*door/i, /velux/i],
  finishes: [/paint/i, /finish/i, /fixture/i, /fitting/i, /worktop/i, /countertop/i, /splashback/i, /sanitary\s*ware/i],
  kitchen: [/kitchen/i, /units/i, /cabinet/i, /press/i, /worktop/i, /sink/i, /tap/i],
  bathroom_fittings: [/bath(room)?/i, /shower/i, /toilet/i, /wc/i, /basin/i, /vanity/i, /en-?suite/i],

  // Irish-specific
  snagging: [/snag(ging)?/i, /defect/i, /punch\s*list/i, /inspection/i],
  taking_in_charge: [/taking\s*in\s*charge/i, /estate\s*complet/i, /roads/i, /public\s*light/i, /footpath/i],
  help_to_buy: [/help\s*to\s*buy/i, /htb/i, /first\s*home\s*scheme/i, /fhs/i, /shared\s*equity/i],
};

/**
 * Detects topics present in a text chunk.
 * Returns an array of topic strings that match the content.
 */
export function detectTopics(text: string): string[] {
  const detectedTopics: string[] = [];
  const lowerText = text.toLowerCase();

  for (const [topic, patterns] of Object.entries(TOPIC_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(lowerText)) {
        detectedTopics.push(topic);
        break; // Only add topic once even if multiple patterns match
      }
    }
  }

  return detectedTopics;
}

/**
 * Finds the best break point near a target position.
 * Prefers paragraph breaks > sentence ends > clause breaks > word boundaries
 */
function findBestBreakPoint(text: string, targetPos: number, searchRange: number = 100): number {
  const start = Math.max(0, targetPos - searchRange);
  const end = Math.min(text.length, targetPos + searchRange);
  const searchText = text.slice(start, end);

  // Priority 1: Paragraph break (double newline)
  const paragraphBreak = searchText.lastIndexOf('\n\n');
  if (paragraphBreak !== -1 && paragraphBreak > searchRange / 2) {
    return start + paragraphBreak + 2;
  }

  // Priority 2: Single newline
  const newlineBreak = searchText.lastIndexOf('\n');
  if (newlineBreak !== -1 && newlineBreak > searchRange / 2) {
    return start + newlineBreak + 1;
  }

  // Priority 3: Sentence end (. ! ?)
  const sentenceMatch = searchText.match(/[.!?]\s+(?=[A-Z])/g);
  if (sentenceMatch) {
    const lastSentenceEnd = searchText.lastIndexOf(sentenceMatch[sentenceMatch.length - 1]);
    if (lastSentenceEnd !== -1 && lastSentenceEnd > searchRange / 2) {
      return start + lastSentenceEnd + sentenceMatch[sentenceMatch.length - 1].length;
    }
  }

  // Priority 4: Clause break (comma, semicolon, colon)
  const clauseBreak = Math.max(
    searchText.lastIndexOf(', '),
    searchText.lastIndexOf('; '),
    searchText.lastIndexOf(': ')
  );
  if (clauseBreak !== -1 && clauseBreak > searchRange / 2) {
    return start + clauseBreak + 2;
  }

  // Fallback: word boundary
  const wordBreak = searchText.lastIndexOf(' ');
  if (wordBreak !== -1) {
    return start + wordBreak + 1;
  }

  return targetPos;
}

/**
 * Extracts a contextual header from the chunk content.
 * Looks for section titles, headings, or creates a summary.
 */
function extractChunkHeader(content: string): string | null {
  // Look for markdown-style headers
  const headerMatch = content.match(/^#{1,3}\s+(.+)$/m);
  if (headerMatch) {
    return headerMatch[1].trim();
  }

  // Look for title-case lines at the start
  const firstLine = content.split('\n')[0].trim();
  if (firstLine.length < 100 && /^[A-Z][A-Za-z\s&-]+$/.test(firstLine)) {
    return firstLine;
  }

  // Look for numbered sections
  const sectionMatch = content.match(/^\d+\.?\d*\s+([A-Z][A-Za-z\s]+)/m);
  if (sectionMatch) {
    return sectionMatch[1].trim();
  }

  return null;
}

export async function chunkText(
  text: string,
  maxTokens: number = DEFAULT_CHUNK_SIZE,
  overlap: number = DEFAULT_OVERLAP
): Promise<TextChunk[]> {
  const encoder = encoding_for_model('gpt-3.5-turbo');

  try {
    // Pre-process: normalize whitespace but preserve paragraph structure
    const normalizedText = text
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    const tokens = encoder.encode(normalizedText);
    const chunks: TextChunk[] = [];
    let charPosition = 0;
    let chunkIndex = 0;

    while (charPosition < normalizedText.length) {
      // Estimate end position based on token ratio
      const avgCharsPerToken = normalizedText.length / tokens.length;
      let estimatedEndChar = Math.min(
        charPosition + Math.floor(maxTokens * avgCharsPerToken),
        normalizedText.length
      );

      // Find a semantically good break point
      if (estimatedEndChar < normalizedText.length) {
        estimatedEndChar = findBestBreakPoint(normalizedText, estimatedEndChar);
      }

      // Extract the chunk text
      let chunkContent = normalizedText.slice(charPosition, estimatedEndChar).trim();

      // Verify token count and adjust if needed
      let chunkTokens = encoder.encode(chunkContent);
      while (chunkTokens.length > maxTokens && estimatedEndChar > charPosition + 100) {
        estimatedEndChar = findBestBreakPoint(normalizedText, estimatedEndChar - 50);
        chunkContent = normalizedText.slice(charPosition, estimatedEndChar).trim();
        chunkTokens = encoder.encode(chunkContent);
      }

      if (chunkContent.length === 0) {
        break;
      }

      // Detect topics in this chunk
      const topics = detectTopics(chunkContent);

      // Extract header/section title if present
      const header = extractChunkHeader(chunkContent);

      chunks.push({
        content: chunkContent,
        index: chunkIndex,
        tokenCount: chunkTokens.length,
        metadata: {
          startChar: charPosition,
          endChar: estimatedEndChar,
          topics: topics,
          header: header,
          hasStructure: /^#{1,3}\s|\n#{1,3}\s|\n\d+\.\s/.test(chunkContent),
        },
      });

      chunkIndex++;

      if (estimatedEndChar >= normalizedText.length) {
        break;
      }

      // Calculate overlap in characters
      const overlapChars = Math.floor(overlap * avgCharsPerToken);
      charPosition = Math.max(charPosition + 1, estimatedEndChar - overlapChars);

      // Try to start at a good break point
      const nextStart = findBestBreakPoint(normalizedText, charPosition, 50);
      if (nextStart > charPosition && nextStart < estimatedEndChar) {
        charPosition = nextStart;
      }
    }

    // Log summary with topic distribution
    const allTopics = chunks.flatMap(c => c.metadata?.topics || []);
    const topicCounts = allTopics.reduce((acc, t) => {
      acc[t] = (acc[t] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log(`  ✂️  Split into ${chunks.length} chunks (avg ~${Math.round(tokens.length / Math.max(1, chunks.length))} tokens each)`);
    if (Object.keys(topicCounts).length > 0) {
      const topTopics = Object.entries(topicCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([topic]) => topic);
      console.log(`  📋 Main topics: ${topTopics.join(', ')}`);
    }

    return chunks;
  } finally {
    encoder.free();
  }
}

export async function chunkTrainingItems(
  items: TrainingItem[],
  maxTokens: number = DEFAULT_CHUNK_SIZE,
  overlap: number = DEFAULT_OVERLAP
): Promise<Array<{ item: TrainingItem; chunks: TextChunk[] }>> {
  if (items.length === 0) {
    console.log('   ⚠️  No items to chunk');
    return [];
  }

  console.log(`\n✂️  Chunking ${items.length} training items...`);

  const results = [];

  for (const item of items) {
    const chunks = await chunkText(item.text, maxTokens, overlap);

    // Detect document-level topics from the full text
    const documentTopics = detectTopics(item.text);

    const enrichedChunks = chunks.map((chunk, idx) => ({
      ...chunk,
      metadata: {
        ...chunk.metadata,
        ...item.metadata,
        sourceType: item.sourceType,
        title: item.title,
        // Combine document-level and chunk-level topics
        topics: [...new Set([...(chunk.metadata?.topics || []), ...documentTopics])],
        // Add position context for multi-chunk documents
        chunkPosition: chunks.length > 1 ? (
          idx === 0 ? 'start' :
          idx === chunks.length - 1 ? 'end' : 'middle'
        ) : 'single',
        totalChunks: chunks.length,
      },
    }));

    results.push({
      item,
      chunks: enrichedChunks,
    });
  }

  const totalChunks = results.reduce((sum, r) => sum + r.chunks.length, 0);

  // Aggregate topic statistics across all items
  const allTopics = results.flatMap(r =>
    r.chunks.flatMap(c => c.metadata?.topics || [])
  );
  const uniqueTopics = [...new Set(allTopics)];

  console.log(`✅ Created ${totalChunks} total chunks from ${items.length} items`);
  console.log(`📊 Topics detected: ${uniqueTopics.length} unique topics across ${allTopics.length} topic tags`);

  return results;
}

export function estimateTokenCount(text: string): number {
  const encoder = encoding_for_model('gpt-3.5-turbo');
  try {
    const tokens = encoder.encode(text);
    return tokens.length;
  } finally {
    encoder.free();
  }
}
