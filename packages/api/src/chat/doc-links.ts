/**
 * Document download links for chat - fetch house-specific architectural documents
 */

import { db, documents } from '../../../db/client';
import { eq, and, inArray, sql } from 'drizzle-orm';

export type HouseDocKind = 'architectural_floor_plan' | 'elevations' | 'site_plan';

export interface HouseDocLink {
  kind: HouseDocKind;
  title: string;
  url: string;
  house_type_code: string;
  documentId: string;
}

export async function getHouseDocLinksForContext(opts: {
  tenantId: string;
  developmentId: string;
  houseTypeCode?: string | null;
}): Promise<HouseDocLink[]> {
  const { tenantId, developmentId, houseTypeCode } = opts;

  if (!houseTypeCode) {
    console.log('[DocLinks] No house type code provided, returning empty');
    return [];
  }

  console.log('[DocLinks] Fetching architectural docs for:', {
    tenantId,
    developmentId,
    houseTypeCode,
  });

  try {
    // Query documents with architectural types for this house type
    const architecturalTypes: HouseDocKind[] = ['architectural_floor_plan', 'elevations', 'site_plan'];

    const docs = await db
      .select()
      .from(documents)
      .where(
        and(
          eq(documents.tenant_id, tenantId),
          eq(documents.development_id, developmentId),
          eq(documents.house_type_code, houseTypeCode),
          inArray(documents.document_type, architecturalTypes),
          eq(documents.status, 'active')
        )
      )
      .orderBy(sql`${documents.created_at} DESC`);

    console.log(`[DocLinks] Found ${docs.length} architectural documents`);

    const links: HouseDocLink[] = docs.map((doc) => ({
      kind: doc.document_type as HouseDocKind,
      title: doc.title || doc.file_name,
      url: doc.file_url || doc.relative_path || '',
      house_type_code: doc.house_type_code || '',
      documentId: doc.id,
    }));

    return links;
  } catch (error) {
    console.error('[DocLinks] Error fetching document links:', error);
    return [];
  }
}

/**
 * Intent detection from user message
 */
export type DocIntent =
  | 'wants_floor_plan'
  | 'wants_elevations'
  | 'wants_site_plan'
  | 'no_doc';

export function inferDocIntentFromMessage(message: string): DocIntent {
  const lower = message.toLowerCase();

  // Floor plans
  if (
    lower.includes('floor plan') ||
    lower.includes('floorplan') ||
    lower.includes('house plan') ||
    lower.includes('layout') ||
    (lower.includes('size') && (lower.includes('living room') || lower.includes('bedroom') || lower.includes('room')))
  ) {
    return 'wants_floor_plan';
  }

  // Elevations
  if (lower.includes('elevation')) {
    return 'wants_elevations';
  }

  // Site plans
  if (lower.includes('site plan') || lower.includes('site layout')) {
    return 'wants_site_plan';
  }

  return 'no_doc';
}
