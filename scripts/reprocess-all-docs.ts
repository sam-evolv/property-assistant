import { db } from '@openhouse/db/client';
import { sql } from 'drizzle-orm';
import { DocumentProcessor, DocKind } from '../packages/api/src/document-processor';

interface ReprocessOptions {
  forceReprocess?: boolean;
  tenantId?: string;
  developmentId?: string;
  docKind?: DocKind;
  limit?: number;
  dryRun?: boolean;
}

interface ReprocessResult {
  documentId: string;
  fileName: string;
  status: 'success' | 'error' | 'skipped';
  error?: string;
  chunksCreated?: number;
  visionExtracted?: boolean;
}

interface DocumentRow {
  id: string;
  tenant_id: string;
  development_id: string | null;
  house_type_id: string | null;
  house_type_code: string | null;
  file_name: string | null;
  original_file_name: string | null;
  file_url: string | null;
  storage_url: string | null;
  mime_type: string | null;
  doc_kind: string | null;
  processing_status: string | null;
}

async function getDocumentsToProcess(options: ReprocessOptions): Promise<DocumentRow[]> {
  const { forceReprocess, tenantId, developmentId, docKind, limit } = options;

  let whereConditions: string[] = [];
  whereConditions.push('(file_url IS NOT NULL OR storage_url IS NOT NULL)');

  if (!forceReprocess) {
    whereConditions.push("(processing_status IS NULL OR processing_status = 'pending' OR processing_status = 'failed')");
  }

  if (tenantId) {
    whereConditions.push(`tenant_id = '${tenantId}'`);
  }

  if (developmentId) {
    whereConditions.push(`development_id = '${developmentId}'`);
  }

  if (docKind) {
    whereConditions.push(`doc_kind = '${docKind}'`);
  }

  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
  const limitClause = limit ? `LIMIT ${limit}` : 'LIMIT 1000';

  const result = await db.execute<DocumentRow>(sql.raw(`
    SELECT 
      id, tenant_id, development_id, house_type_id, house_type_code,
      file_name, original_file_name, file_url, storage_url, mime_type,
      doc_kind, processing_status
    FROM documents
    ${whereClause}
    ORDER BY created_at DESC
    ${limitClause}
  `));

  return result.rows || [];
}

async function deleteDocumentChunks(documentId: string): Promise<number> {
  const result = await db.execute(sql`
    DELETE FROM doc_chunks WHERE document_id = ${documentId}::uuid
    RETURNING id
  `);
  return result.rows?.length || 0;
}

async function deleteFloorplanVisionData(documentId: string): Promise<number> {
  try {
    const result = await db.execute(sql`
      DELETE FROM floorplan_vision WHERE document_id = ${documentId}::uuid
      RETURNING id
    `);
    return result.rows?.length || 0;
  } catch {
    return 0;
  }
}

async function reprocessDocument(doc: any): Promise<ReprocessResult> {
  const fileUrl = doc.file_url || doc.storage_url;
  const fileName = doc.file_name || doc.original_file_name || 'document';

  if (!fileUrl) {
    return {
      documentId: doc.id,
      fileName,
      status: 'skipped',
      error: 'No file URL available',
    };
  }

  try {
    const response = await fetch(fileUrl);
    if (!response.ok) {
      return {
        documentId: doc.id,
        fileName,
        status: 'error',
        error: `Failed to download: ${response.statusText}`,
      };
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    const result = await DocumentProcessor.processDocument(
      doc.id,
      buffer,
      doc.mime_type || 'application/octet-stream',
      doc.tenant_id,
      doc.development_id || null,
      {
        houseTypeId: doc.house_type_id || null,
        houseTypeCode: doc.house_type_code || null,
        docKind: doc.doc_kind as DocKind || null,
        fileName,
      }
    );

    if (result.success) {
      return {
        documentId: doc.id,
        fileName,
        status: 'success',
        chunksCreated: result.chunksCreated,
        visionExtracted: result.visionExtracted,
      };
    } else {
      return {
        documentId: doc.id,
        fileName,
        status: 'error',
        error: result.error,
      };
    }
  } catch (error: any) {
    return {
      documentId: doc.id,
      fileName,
      status: 'error',
      error: error.message,
    };
  }
}

async function reprocessAllDocuments(options: ReprocessOptions = {}): Promise<void> {
  console.log('\n' + '='.repeat(80));
  console.log('DOCUMENT REPROCESSING PIPELINE');
  console.log('='.repeat(80) + '\n');

  console.log('Options:');
  console.log(`  Force reprocess: ${options.forceReprocess || false}`);
  console.log(`  Tenant filter: ${options.tenantId || 'All'}`);
  console.log(`  Development filter: ${options.developmentId || 'All'}`);
  console.log(`  Doc kind filter: ${options.docKind || 'All'}`);
  console.log(`  Limit: ${options.limit || 'None'}`);
  console.log(`  Dry run: ${options.dryRun || false}`);
  console.log('');

  const docs = await getDocumentsToProcess(options);
  console.log(`📚 Found ${docs.length} document(s) to process\n`);

  if (docs.length === 0) {
    console.log('✅ No documents need processing.');
    return;
  }

  if (options.dryRun) {
    console.log('DRY RUN - Documents that would be processed:');
    for (const doc of docs) {
      console.log(`  - ${doc.file_name} (${doc.doc_kind || 'unknown'}, status: ${doc.processing_status || 'null'})`);
    }
    console.log('\nRun without --dry-run to actually process these documents.');
    return;
  }

  const results: ReprocessResult[] = [];
  let successCount = 0;
  let errorCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i];
    console.log('-'.repeat(80));
    console.log(`[${i + 1}/${docs.length}] Processing: ${doc.file_name}`);
    console.log(`   Document ID: ${doc.id}`);
    console.log(`   Doc Kind: ${doc.doc_kind || 'not classified'}`);
    console.log(`   House Type: ${doc.house_type_code || 'not mapped'}`);

    const chunksDeleted = await deleteDocumentChunks(doc.id);
    const visionDeleted = await deleteFloorplanVisionData(doc.id);
    if (chunksDeleted > 0 || visionDeleted > 0) {
      console.log(`   Cleaned up: ${chunksDeleted} chunks, ${visionDeleted} vision records`);
    }

    const result = await reprocessDocument(doc);
    results.push(result);

    if (result.status === 'success') {
      console.log(`   ✅ SUCCESS: ${result.chunksCreated} chunks created`);
      if (result.visionExtracted) {
        console.log(`   🔍 Vision extraction performed`);
      }
      successCount++;
    } else if (result.status === 'error') {
      console.log(`   ❌ ERROR: ${result.error}`);
      errorCount++;
    } else {
      console.log(`   ⚠️  SKIPPED: ${result.error}`);
      skippedCount++;
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total documents: ${docs.length}`);
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Errors: ${errorCount}`);
  console.log(`⚠️  Skipped: ${skippedCount}`);

  if (errorCount > 0) {
    console.log('\nDocuments with errors:');
    results
      .filter(r => r.status === 'error')
      .forEach(r => {
        console.log(`  - ${r.fileName}: ${r.error}`);
      });
  }

  const needsReviewCount = await db.execute<{ count: string }>(sql`
    SELECT COUNT(*) as count FROM documents WHERE needs_review = true
  `);
  console.log(`\n📋 Documents needing review: ${needsReviewCount.rows?.[0]?.count || 0}`);

  const totalChunks = await db.execute<{ count: string }>(sql`
    SELECT COUNT(*) as count FROM doc_chunks
  `);
  console.log(`📊 Total chunks in database: ${totalChunks.rows?.[0]?.count || 0}`);

  console.log('\n');
}

const args = process.argv.slice(2);
const options: ReprocessOptions = {
  forceReprocess: args.includes('--force'),
  dryRun: args.includes('--dry-run'),
};

const limitIndex = args.indexOf('--limit');
if (limitIndex !== -1 && args[limitIndex + 1]) {
  options.limit = parseInt(args[limitIndex + 1], 10);
}

const tenantIndex = args.indexOf('--tenant');
if (tenantIndex !== -1 && args[tenantIndex + 1]) {
  options.tenantId = args[tenantIndex + 1];
}

const devIndex = args.indexOf('--development');
if (devIndex !== -1 && args[devIndex + 1]) {
  options.developmentId = args[devIndex + 1];
}

const kindIndex = args.indexOf('--kind');
if (kindIndex !== -1 && args[kindIndex + 1]) {
  options.docKind = args[kindIndex + 1] as DocKind;
}

if (args.includes('--help')) {
  console.log(`
Usage: npx tsx scripts/reprocess-all-docs.ts [options]

Options:
  --force           Reprocess ALL documents, even if already processed
  --dry-run         Show what would be processed without actually processing
  --limit <n>       Limit to first N documents
  --tenant <id>     Filter by tenant ID
  --development <id> Filter by development ID
  --kind <kind>     Filter by doc_kind (floorplan, specification, warranty, etc.)
  --help            Show this help message

Examples:
  npx tsx scripts/reprocess-all-docs.ts                    # Process unprocessed docs
  npx tsx scripts/reprocess-all-docs.ts --force            # Force reprocess all
  npx tsx scripts/reprocess-all-docs.ts --kind floorplan   # Only process floorplans
  npx tsx scripts/reprocess-all-docs.ts --dry-run          # Preview what would be processed
  npx tsx scripts/reprocess-all-docs.ts --force --limit 5  # Reprocess first 5 docs
`);
  process.exit(0);
}

reprocessAllDocuments(options)
  .then(() => {
    console.log('✅ Reprocessing complete\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Reprocessing failed:', error);
    process.exit(1);
  });
