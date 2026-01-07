/**
 * Amenity Document Augmenter
 * 
 * Searches Smart Archive for local_amenities and welcome_pack documents
 * to provide supplementary context for Places-derived amenity responses.
 * 
 * CRITICAL: Documents can ONLY augment Places results, never replace them.
 * - Document content cannot override place names, distances, or rankings
 * - Only used for supportive context like "mentioned in your welcome pack"
 */

import { db, documents, doc_chunks } from '@openhouse/db';
import { eq, and, or, sql, ilike } from 'drizzle-orm';

export interface AmenityDocContext {
  found: boolean;
  snippets: string[];
  documentTitles: string[];
  augmentationNote?: string;
}

const AMENITY_DOC_TYPES = ['local_amenities', 'welcome_pack', 'homeowner_guide'];
const MIN_MATCH_CONFIDENCE = 50;

export async function getAmenityDocContext(
  developmentId: string,
  category: string,
  query: string
): Promise<AmenityDocContext> {
  try {
    const searchTerms = extractSearchTerms(query, category);
    
    const docs = await db
      .select({
        id: documents.id,
        title: documents.title,
        docType: documents.document_type,
      })
      .from(documents)
      .where(
        and(
          eq(documents.development_id, developmentId),
          or(
            ...AMENITY_DOC_TYPES.map(docType => eq(documents.document_type, docType))
          )
        )
      )
      .limit(10);

    if (docs.length === 0) {
      return { found: false, snippets: [], documentTitles: [] };
    }

    const docIds = docs.map(d => d.id);
    
    const chunks = await db
      .select({
        content: doc_chunks.content,
        docId: doc_chunks.document_id,
      })
      .from(doc_chunks)
      .where(
        and(
          sql`${doc_chunks.document_id} = ANY(ARRAY[${sql.join(docIds.map(id => sql`${id}::uuid`), sql`, `)}])`,
          or(
            ...searchTerms.map(term => ilike(doc_chunks.content, `%${term}%`))
          )
        )
      )
      .limit(5);

    if (chunks.length === 0) {
      return { found: false, snippets: [], documentTitles: [] };
    }

    const relevantSnippets = chunks
      .map(chunk => extractRelevantSnippet(chunk.content || '', searchTerms))
      .filter(Boolean) as string[];

    const matchedDocTitles = Array.from(new Set(
      chunks.map(chunk => {
        const doc = docs.find(d => d.id === chunk.docId);
        return doc?.title || '';
      }).filter(Boolean)
    ));

    const augmentationNote = generateAugmentationNote(matchedDocTitles);

    return {
      found: true,
      snippets: relevantSnippets.slice(0, 2),
      documentTitles: matchedDocTitles,
      augmentationNote,
    };
  } catch (error) {
    console.error('[AmenityAugmenter] Error fetching doc context:', error);
    return { found: false, snippets: [], documentTitles: [] };
  }
}

function extractSearchTerms(query: string, category: string): string[] {
  const terms: string[] = [category.replace(/_/g, ' ')];
  
  const categoryTerms: Record<string, string[]> = {
    supermarket: ['supermarket', 'grocery', 'shopping', 'shops'],
    pharmacy: ['pharmacy', 'chemist', 'medical'],
    gp: ['gp', 'doctor', 'medical', 'health'],
    hospital: ['hospital', 'medical', 'health'],
    childcare: ['childcare', 'creche', 'nursery', 'preschool'],
    primary_school: ['primary school', 'school', 'education'],
    secondary_school: ['secondary school', 'school', 'education'],
    train_station: ['train', 'station', 'transport', 'rail'],
    bus_stop: ['bus', 'transport', 'public transport'],
    park: ['park', 'green space', 'outdoor'],
    playground: ['playground', 'play area', 'children'],
    gym: ['gym', 'fitness', 'exercise'],
    leisure: ['leisure', 'recreation', 'swimming'],
    cafe: ['cafe', 'coffee'],
    restaurant: ['restaurant', 'dining', 'food'],
    sports: ['sports', 'fitness', 'athletic'],
  };

  if (categoryTerms[category]) {
    terms.push(...categoryTerms[category]);
  }

  return Array.from(new Set(terms));
}

function extractRelevantSnippet(content: string, searchTerms: string[]): string | null {
  const lowerContent = content.toLowerCase();
  
  for (const term of searchTerms) {
    const index = lowerContent.indexOf(term.toLowerCase());
    if (index !== -1) {
      const start = Math.max(0, index - 100);
      const end = Math.min(content.length, index + term.length + 150);
      let snippet = content.slice(start, end).trim();
      
      if (start > 0) snippet = '...' + snippet;
      if (end < content.length) snippet = snippet + '...';
      
      snippet = snippet.replace(/\n+/g, ' ').replace(/\s+/g, ' ');
      
      return snippet;
    }
  }
  
  return null;
}

function generateAugmentationNote(docTitles: string[]): string {
  if (docTitles.length === 0) return '';
  
  const docType = docTitles.some(t => t.toLowerCase().includes('welcome')) 
    ? 'welcome pack'
    : docTitles.some(t => t.toLowerCase().includes('amenities'))
    ? 'local amenities guide'
    : 'homeowner documentation';
  
  return `Additional information from your ${docType}.`;
}

export function formatAugmentedResponse(
  placesResponse: string,
  docContext: AmenityDocContext
): string {
  if (!docContext.found || docContext.snippets.length === 0) {
    return placesResponse;
  }

  let augmented = placesResponse;
  
  if (docContext.augmentationNote) {
    const lastUpdateMatch = placesResponse.match(/\*Last updated:.*\*/);
    if (lastUpdateMatch) {
      augmented = placesResponse.replace(
        lastUpdateMatch[0],
        `${docContext.augmentationNote}\n\n${lastUpdateMatch[0]}`
      );
    } else {
      augmented += `\n\n${docContext.augmentationNote}`;
    }
  }

  return augmented;
}

export function buildMultiSourceHint(
  placesUsed: boolean,
  placesDate: Date | null,
  docsUsed: boolean
): string {
  if (!placesUsed) {
    return 'General guidance';
  }
  
  const dateStr = placesDate 
    ? placesDate.toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'recently';
  
  let hint = `Nearby amenities (Google Places, last updated ${dateStr})`;
  
  if (docsUsed) {
    hint += ' and your homeowner documentation';
  }
  
  return hint;
}
