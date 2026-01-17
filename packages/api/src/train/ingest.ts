import { db } from '../../../db/client';
import { doc_chunks, documents } from '../../../db/schema';
import { EmbeddingResult, IngestResult, TrainingItem } from './types';
import { sql } from 'drizzle-orm';

/**
 * Extracts house type code from filename or title
 * Matches patterns like BD01, BD12, BS03, BT10 (case insensitive)
 */
export function extractHouseTypeCode(fileNameOrTitle: string | null | undefined): string | null {
  if (!fileNameOrTitle) return null;

  // Match codes like BD01, BD12, BS03, BT10 (case insensitive)
  const match = fileNameOrTitle.toUpperCase().match(/\b(BD|BS|BT)\d{2}\b/);
  return match ? match[0] : null;
}

/**
 * Document categories for better organization and retrieval.
 * Each category has specific patterns and a priority weight.
 */
const DOCUMENT_CATEGORIES: Array<{
  type: string;
  patterns: RegExp[];
  description: string;
}> = [
  // Architectural & Technical Drawings
  {
    type: 'floor_plan',
    patterns: [/floor\s*plan/i, /\bfp\d/i, /floorplan/i, /room\s*layout/i],
    description: 'Floor plans and room layouts',
  },
  {
    type: 'elevation',
    patterns: [/elevation/i, /\belev\b/i, /facade/i, /front\s*view/i, /rear\s*view/i],
    description: 'Building elevations and external views',
  },
  {
    type: 'site_plan',
    patterns: [/site\s*plan/i, /site\s*layout/i, /master\s*plan/i, /development\s*layout/i],
    description: 'Site plans and development layouts',
  },

  // Specifications & Technical Docs
  {
    type: 'specification',
    patterns: [/\bspec(ification)?s?\b/i, /technical\s*spec/i, /build\s*spec/i],
    description: 'Technical specifications',
  },
  {
    type: 'brochure',
    patterns: [/brochure/i, /sales\s*brochure/i, /marketing/i, /feature\s*sheet/i],
    description: 'Sales and marketing brochures',
  },

  // Homeowner Documentation
  {
    type: 'homeowner_manual',
    patterns: [/homeowner/i, /home\s*owner/i, /resident\s*guide/i, /user\s*guide/i, /welcome\s*pack/i],
    description: 'Homeowner manuals and guides',
  },
  {
    type: 'appliance_manual',
    patterns: [/manual/i, /instruction/i, /user\s*manual/i, /operating/i, /handbook/i],
    description: 'Appliance and equipment manuals',
  },
  {
    type: 'maintenance_guide',
    patterns: [/maintenance/i, /care\s*(and|&)\s*maintenance/i, /upkeep/i, /service\s*guide/i],
    description: 'Maintenance and care guides',
  },

  // Energy & Compliance
  {
    type: 'ber_certificate',
    patterns: [/\bber\b/i, /building\s*energy/i, /energy\s*rating/i, /nzeb/i],
    description: 'BER certificates and energy documentation',
  },
  {
    type: 'compliance_cert',
    patterns: [/compliance/i, /certificate/i, /cert\b/i, /certification/i, /fire\s*cert/i, /disability\s*cert/i],
    description: 'Compliance certificates',
  },

  // Legal & Contracts
  {
    type: 'warranty',
    patterns: [/warranty/i, /homebond/i, /guarantee/i, /cover\s*note/i],
    description: 'Warranty and guarantee documents',
  },
  {
    type: 'contract',
    patterns: [/contract/i, /agreement/i, /terms/i, /conditions/i, /legal/i],
    description: 'Contracts and legal documents',
  },
  {
    type: 'management',
    patterns: [/management\s*company/i, /\bomc\b/i, /service\s*charge/i, /owner.*management/i],
    description: 'Management company documents',
  },

  // Location & Amenities
  {
    type: 'location_info',
    patterns: [/location/i, /area\s*guide/i, /local\s*info/i, /neighbourhood/i, /amenities/i],
    description: 'Location and area information',
  },
  {
    type: 'transport',
    patterns: [/transport/i, /commut/i, /bus/i, /train/i, /travel/i],
    description: 'Transport and commuting information',
  },

  // FAQs & Support
  {
    type: 'faq',
    patterns: [/\bfaq/i, /frequently\s*asked/i, /common\s*questions/i, /q\s*(&|and)\s*a/i],
    description: 'FAQs and common questions',
  },
  {
    type: 'contact_info',
    patterns: [/contact/i, /emergency/i, /phone\s*numbers/i, /support/i, /helpline/i],
    description: 'Contact and support information',
  },

  // House Type Specific
  {
    type: 'house_type_info',
    patterns: [/house\s*type/i, /unit\s*type/i, /\b(bd|bs|bt)\d{2}\b/i, /type\s*[a-z]/i],
    description: 'House type specific information',
  },

  // Development News & Updates
  {
    type: 'notice',
    patterns: [/notice/i, /announcement/i, /update/i, /news/i, /bulletin/i],
    description: 'Notices and announcements',
  },

  // Irish-specific Documents
  {
    type: 'snagging_report',
    patterns: [/snag(ging)?\s*(list|report)?/i, /punch\s*list/i, /defects?\s*(list|report)/i, /inspection\s*report/i],
    description: 'Snagging lists and inspection reports',
  },
  {
    type: 'taking_in_charge',
    patterns: [/taking\s*in\s*charge/i, /estate\s*completion/i, /bond\s*release/i],
    description: 'Taking in charge and estate completion documents',
  },
  {
    type: 'fire_safety',
    patterns: [/fire\s*safety/i, /fire\s*cert/i, /fire\s*alarm/i, /evacuation/i, /fire\s*action/i],
    description: 'Fire safety certificates and procedures',
  },
  {
    type: 'kitchen_spec',
    patterns: [/kitchen\s*(spec|narrative|schedule)/i, /appliance\s*(list|spec|schedule)/i, /white\s*goods/i],
    description: 'Kitchen specifications and appliance details',
  },
  {
    type: 'bathroom_spec',
    patterns: [/bathroom\s*(spec|schedule)/i, /sanitary\s*(ware|spec)/i, /tile\s*spec/i],
    description: 'Bathroom specifications and finishes',
  },
  {
    type: 'heating_spec',
    patterns: [/heating\s*(spec|manual|guide)/i, /heat\s*pump/i, /boiler\s*(manual|spec)/i, /daikin/i, /grant/i],
    description: 'Heating system specifications and manuals',
  },
  {
    type: 'ventilation_spec',
    patterns: [/ventilation/i, /mvhr/i, /air\s*quality/i, /extract\s*fan/i],
    description: 'Ventilation system specifications',
  },
  {
    type: 'help_to_buy',
    patterns: [/help\s*to\s*buy/i, /htb/i, /first\s*home/i, /shared\s*equity/i, /fhs/i],
    description: 'Help to Buy and government scheme documents',
  },
];

/**
 * Classifies document type based on filename with improved categorization.
 * Returns a more specific document type for better retrieval and organization.
 */
export function classifyDocumentType(fileName: string): string {
  const normalizedName = fileName.toLowerCase().replace(/[_-]/g, ' ');

  for (const category of DOCUMENT_CATEGORIES) {
    for (const pattern of category.patterns) {
      if (pattern.test(normalizedName)) {
        return category.type;
      }
    }
  }

  // Default fallback
  return 'general';
}

/**
 * Returns a human-readable description for a document type.
 */
export function getDocumentTypeDescription(type: string): string {
  const category = DOCUMENT_CATEGORIES.find(c => c.type === type);
  return category?.description || 'General document';
}

/**
 * Returns all available document categories.
 * Useful for admin interfaces and filtering.
 */
export function getDocumentCategories(): Array<{ type: string; description: string }> {
  return DOCUMENT_CATEGORIES.map(c => ({
    type: c.type,
    description: c.description,
  }));
}

export async function ingestEmbeddings(
  embeddings: EmbeddingResult[],
  tenantId: string,
  developmentId: string,
  sourceType: string,
  sourceId?: string,
  houseTypeCode?: string | null
): Promise<IngestResult> {
  console.log(`\n🧩 INSERT CHUNKS: ${embeddings.length} chunks to insert`);
  console.log(`   Tenant: ${tenantId}`);
  console.log(`   Development: ${developmentId}`);
  console.log(`   Source Type: ${sourceType}`);
  console.log(`   Document ID: ${sourceId || 'none'}`);
  console.log(`   House Type Code: ${houseTypeCode || 'none (general document)'}`);
  
  if (embeddings.length === 0) {
    console.log('   ⚠️  No embeddings to ingest');
    return { success: true, chunksInserted: 0 };
  }
  
  let isImportant = false;
  
  if (sourceId) {
    try {
      const doc = await db
        .select({ is_important: documents.is_important })
        .from(documents)
        .where(sql`id = ${sourceId}::uuid`)
        .limit(1);
      isImportant = doc[0]?.is_important || false;
      console.log(`   Important Document: ${isImportant ? 'YES' : 'NO'}`);
    } catch (error) {
      console.warn(`   ⚠️  Could not retrieve document importance: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }
  
  const errors: string[] = [];
  let chunksInserted = 0;
  
  try {
    for (const { chunk, embedding } of embeddings) {
      try {
        const embeddingVector = `[${embedding.join(',')}]`;
        
        if (sourceId) {
          await db.execute(sql`
            INSERT INTO doc_chunks (tenant_id, development_id, document_id, content, embedding, source_type, source_id, house_type_code, is_important, metadata)
            VALUES (
              ${tenantId}::uuid,
              ${developmentId}::uuid,
              ${sourceId}::uuid,
              ${chunk.content},
              ${embeddingVector}::vector,
              ${sourceType},
              ${sourceId}::uuid,
              ${houseTypeCode},
              ${isImportant},
              ${JSON.stringify(chunk.metadata || {})}::jsonb
            )
          `);
        } else {
          await db.execute(sql`
            INSERT INTO doc_chunks (tenant_id, development_id, content, embedding, source_type, house_type_code, is_important, metadata)
            VALUES (
              ${tenantId}::uuid,
              ${developmentId}::uuid,
              ${chunk.content},
              ${embeddingVector}::vector,
              ${sourceType},
              ${houseTypeCode},
              ${isImportant},
              ${JSON.stringify(chunk.metadata || {})}::jsonb
            )
          `);
        }
        
        chunksInserted++;
        
        if (chunksInserted % 10 === 0) {
          console.log(`   📊 Progress: ${chunksInserted}/${embeddings.length} chunks inserted`);
        }
      } catch (error) {
        const errorMsg = `Failed to insert chunk ${chunk.index}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(`   ❌ ${errorMsg}`);
        errors.push(errorMsg);
      }
    }
    
    console.log(`✅ CHUNKS INSERTED successfully`);
    console.log(`   Total: ${chunksInserted}/${embeddings.length} chunks`);
    
    return {
      success: errors.length === 0,
      chunksInserted,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    console.error('❌ CHUNK INSERT FAILED:', error);
    throw new Error(`Failed to ingest embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function deleteDocumentChunks(tenantId: string, sourceId: string): Promise<number> {
  console.log(`\n🗑️  Deleting chunks for document: ${sourceId} (tenant: ${tenantId})`);
  
  try {
    const result = await db
      .delete(doc_chunks)
      .where(sql`tenant_id = ${tenantId} AND source_id = ${sourceId}`);
    
    console.log(`✅ Deleted existing chunks`);
    return 0;
  } catch (error) {
    console.error('❌ Delete failed:', error);
    throw new Error(`Failed to delete chunks: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function getTenantChunkCount(tenantId: string): Promise<number> {
  try {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(doc_chunks)
      .where(sql`tenant_id = ${tenantId}`);
    
    return Number(result[0]?.count || 0);
  } catch (error) {
    console.error('❌ Count query failed:', error);
    return 0;
  }
}

export async function searchSimilarChunks(
  tenantId: string,
  queryEmbedding: number[],
  limit: number = 5
): Promise<Array<{ content: string; similarity: number; metadata: any }>> {
  try {
    const embeddingStr = `[${queryEmbedding.join(',')}]`;
    
    const results = await db.execute<{
      content: string;
      similarity: number;
      metadata: any;
    }>(sql`
      SELECT
        content,
        1 - (embedding <=> ${embeddingStr}::vector) as similarity,
        metadata
      FROM doc_chunks
      WHERE tenant_id = ${tenantId}
        AND embedding IS NOT NULL
      ORDER BY embedding <=> ${embeddingStr}::vector
      LIMIT ${limit}
    `);
    
    return results.rows || [];
  } catch (error) {
    console.error('❌ Similarity search failed:', error);
    return [];
  }
}

export async function createDocument(
  tenantId: string,
  developmentId: string,
  fileName: string,
  fileUrl: string = ''
): Promise<{ id: string; houseTypeCode: string | null; documentType: string; houseTypeId: string | null }> {
  console.log(`\n📁 INSERT DOCUMENT: ${fileName}`);
  console.log(`   Tenant: ${tenantId}`);
  console.log(`   Development: ${developmentId}`);
  
  // Extract house type code from filename
  const houseTypeCode = extractHouseTypeCode(fileName);
  console.log(`   House Type Code: ${houseTypeCode || 'none (general document)'}`);
  
  // Classify document type based on filename
  const documentType = classifyDocumentType(fileName);
  console.log(`   Document Type: ${documentType}`);
  
  let houseTypeId: string | null = null;
  if (houseTypeCode) {
    try {
      const houseTypeResult = await db.execute<{ id: string }>(sql`
        SELECT id FROM house_types
        WHERE development_id = ${developmentId}::uuid
        AND house_type_code = ${houseTypeCode}
        LIMIT 1
      `);
      if (houseTypeResult.rows && houseTypeResult.rows.length > 0) {
        houseTypeId = houseTypeResult.rows[0].id;
      }
    } catch (e) {
      console.warn(`⚠️  Could not find house_type_id for ${houseTypeCode}`);
    }
  }
  
  try {
    const result = await db.insert(documents).values({
      tenant_id: tenantId,
      development_id: developmentId,
      house_type_id: houseTypeId,
      house_type_code: houseTypeCode,
      document_type: documentType,
      title: fileName,
      file_name: fileName,
      relative_path: `/uploads/${fileName}`,
      file_url: fileUrl || `/uploads/${fileName}`,
      version: 1,
      status: 'active',
      chunks_count: 0,
      metadata: {},
    }).returning({ id: documents.id });
    
    const documentId = result[0].id;
    console.log(`✅ DOCUMENT INSERTED successfully`);
    console.log(`   Document ID: ${documentId}`);
    return { id: documentId, houseTypeCode, documentType, houseTypeId };
  } catch (error) {
    console.error('❌ DOCUMENT INSERT FAILED:', error);
    throw new Error(`Failed to create document: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function getTenantDocumentCount(tenantId: string): Promise<number> {
  try {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(documents)
      .where(sql`tenant_id = ${tenantId}`);
    
    return Number(result[0]?.count || 0);
  } catch (error) {
    console.error('❌ Document count query failed:', error);
    return 0;
  }
}

export async function markDocumentFailed(documentId: string): Promise<void> {
  try {
    await db.execute(sql`
      UPDATE documents 
      SET status = 'failed', updated_at = NOW()
      WHERE id = ${documentId}::uuid
    `);
    console.log(`✅ Marked document ${documentId} as failed`);
  } catch (error) {
    console.error(`❌ Failed to mark document as failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function updateDocumentChunkCount(documentId: string, chunkCount: number): Promise<void> {
  try {
    await db.execute(sql`
      UPDATE documents 
      SET chunks_count = ${chunkCount}, updated_at = NOW()
      WHERE id = ${documentId}::uuid
    `);
    console.log(`✅ Updated document ${documentId} with ${chunkCount} chunks`);
  } catch (error) {
    console.error(`❌ Failed to update document chunk count: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
