/**
 * Backfill script: process-pending-documents.ts
 *
 * Finds all documents with processing_status = 'pending' (or 'failed') and
 * re-triggers the ingest pipeline for each. Run once to catch up documents
 * that were uploaded before the automatic ingest trigger was wired in.
 *
 * Usage:
 *   INGEST_SECRET=openhouse-ingest-2026 \
 *   NEXT_PUBLIC_APP_URL=https://portal.openhouseai.ie \
 *   npx ts-node --project tsconfig.json scripts/process-pending-documents.ts
 *
 * Optional env:
 *   ONLY_FAILED=true   — reprocess only documents with processing_status = 'failed'
 *   DRY_RUN=true       — print what would be triggered without actually calling the ingest route
 *   BATCH_DELAY_MS=500 — milliseconds to wait between ingest calls (default 500)
 */

import { db } from '@openhouse/db/client';
import { documents } from '@openhouse/db/schema';
import { or, eq, and, isNotNull } from 'drizzle-orm';

const INGEST_SECRET = process.env.INGEST_SECRET;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const DRY_RUN = process.env.DRY_RUN === 'true';
const ONLY_FAILED = process.env.ONLY_FAILED === 'true';
const BATCH_DELAY_MS = parseInt(process.env.BATCH_DELAY_MS || '500', 10);

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function triggerIngest(documentId: string): Promise<{ ok: boolean; status?: number; error?: string }> {
  if (DRY_RUN) {
    console.log(`  [DRY RUN] Would trigger ingest for document ${documentId}`);
    return { ok: true };
  }

  try {
    const res = await fetch(`${APP_URL}/api/ingest/document`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-ingest-secret': INGEST_SECRET ?? '',
      },
      body: JSON.stringify({ document_id: documentId }),
    });
    return { ok: res.ok, status: res.status };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

async function main() {
  if (!INGEST_SECRET) {
    console.error('ERROR: INGEST_SECRET environment variable is required');
    process.exit(1);
  }

  console.log(`=== process-pending-documents backfill ===`);
  console.log(`App URL: ${APP_URL}`);
  console.log(`Dry run: ${DRY_RUN}`);
  console.log(`Only failed: ${ONLY_FAILED}`);
  console.log(`Batch delay: ${BATCH_DELAY_MS}ms`);
  console.log('');

  // Query pending/failed documents that have either a relative_path or file_url
  const statusFilter = ONLY_FAILED
    ? eq(documents.processing_status, 'failed')
    : or(
        eq(documents.processing_status, 'pending'),
        eq(documents.processing_status, 'failed')
      );

  const rows = await db.select({
    id: documents.id,
    file_name: documents.file_name,
    processing_status: documents.processing_status,
    upload_status: documents.upload_status,
    development_id: documents.development_id,
    mime_type: documents.mime_type,
  })
    .from(documents)
    .where(statusFilter!);

  if (rows.length === 0) {
    console.log('No pending/failed documents found — nothing to do.');
    return;
  }

  console.log(`Found ${rows.length} document(s) to process:\n`);

  let succeeded = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < rows.length; i++) {
    const doc = rows[i];
    const prefix = `[${i + 1}/${rows.length}]`;
    const mimeType = doc.mime_type || '';
    const fileName = (doc.file_name || '').toLowerCase();
    const isPdf = mimeType === 'application/pdf' || fileName.endsWith('.pdf');
    const isText = mimeType === 'text/plain' || fileName.endsWith('.txt');

    if (!isPdf && !isText) {
      console.log(`${prefix} SKIP  ${doc.file_name} (unsupported type: ${doc.mime_type})`);
      skipped++;
      continue;
    }

    process.stdout.write(`${prefix} ${doc.file_name} (${doc.processing_status}) ... `);
    const result = await triggerIngest(doc.id);

    if (result.ok) {
      console.log(`triggered (HTTP ${result.status ?? 'n/a'})`);
      succeeded++;
    } else {
      console.log(`FAILED — ${result.error || `HTTP ${result.status}`}`);
      failed++;
    }

    if (i < rows.length - 1) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Triggered: ${succeeded}`);
  console.log(`Failed:    ${failed}`);
  console.log(`Skipped:   ${skipped}`);

  if (DRY_RUN) {
    console.log('\nNote: DRY_RUN=true — no ingest calls were made.');
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
