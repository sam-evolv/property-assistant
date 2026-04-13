// POST /api/ingest/process-pending
//
// Finds documents with processing_status = 'pending' and runs them
// through DocumentProcessor. Protected by INGEST_SECRET.
//
// Invoked from scripts/process-pending-documents.ts:
//   INGEST_SECRET=... NEXT_PUBLIC_APP_URL=... npx ts-node scripts/process-pending-documents.ts

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@openhouse/db/client';
import { sql } from 'drizzle-orm';
import { DocumentProcessor } from '@api/document-processor';
import type { DocKind } from '@api/document-processor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Allow up to 5 minutes — processing can be slow for large PDFs
export const maxDuration = 300;

interface PendingDocument {
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
}

interface DocumentResult {
  id: string;
  fileName: string;
  status: 'success' | 'error' | 'skipped';
  chunksCreated?: number;
  visionExtracted?: boolean;
  error?: string;
}

async function runProcessing(limit: number) {
  // Fetch pending documents ordered oldest-first so nothing starves
  const queryResult = await db.execute<PendingDocument>(sql`
    SELECT
      id, tenant_id, development_id, house_type_id, house_type_code,
      file_name, original_file_name, file_url, storage_url, mime_type, doc_kind
    FROM documents
    WHERE
      processing_status = 'pending'
      AND (file_url IS NOT NULL OR storage_url IS NOT NULL)
    ORDER BY created_at ASC
    LIMIT ${limit}
  `);

  const docs: PendingDocument[] = queryResult.rows ?? [];

  if (docs.length === 0) {
    return { message: 'No pending documents found', processed: 0, failed: 0, skipped: 0, total: 0, results: [] as DocumentResult[] };
  }

  const results: DocumentResult[] = [];
  let processed = 0;
  let failed = 0;
  let skipped = 0;

  for (const doc of docs) {
    const fileUrl = doc.file_url || doc.storage_url;
    const fileName = doc.file_name || doc.original_file_name || 'document';

    if (!fileUrl) {
      results.push({ id: doc.id, fileName, status: 'skipped', error: 'No file URL available' });
      skipped++;
      continue;
    }

    try {
      const fetchResponse = await fetch(fileUrl);
      if (!fetchResponse.ok) {
        results.push({ id: doc.id, fileName, status: 'error', error: `Download failed: ${fetchResponse.status} ${fetchResponse.statusText}` });
        failed++;
        continue;
      }

      const buffer = Buffer.from(await fetchResponse.arrayBuffer());

      const processingResult = await DocumentProcessor.processDocument(
        doc.id,
        buffer,
        doc.mime_type || 'application/octet-stream',
        doc.tenant_id,
        doc.development_id,
        {
          houseTypeId: doc.house_type_id,
          houseTypeCode: doc.house_type_code,
          docKind: (doc.doc_kind as DocKind) || null,
          fileName,
        }
      );

      if (processingResult.success) {
        results.push({ id: doc.id, fileName, status: 'success', chunksCreated: processingResult.chunksCreated, visionExtracted: processingResult.visionExtracted });
        processed++;
      } else {
        results.push({ id: doc.id, fileName, status: 'error', error: processingResult.error });
        failed++;
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      results.push({ id: doc.id, fileName, status: 'error', error: message });
      failed++;
    }
  }

  return { processed, failed, skipped, total: docs.length, results };
}

function checkAuth(secret: string | null, provided: string | null): boolean {
  const envSecret = process.env.INGEST_SECRET;
  if (!envSecret) return false;
  return provided === envSecret || provided === `Bearer ${envSecret}`;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const provided = searchParams.get('secret');
  if (!checkAuth(provided, provided)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const limitParam = searchParams.get('limit');
  const limit = limitParam ? Math.min(parseInt(limitParam, 10) || 50, 200) : 50;
  const result = await runProcessing(limit);
  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  // Auth check
  const authHeader = request.headers.get('authorization');
  if (!checkAuth(null, authHeader)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Optional limit in request body (default 50, max 200)
  let limit = 50;
  try {
    const body = await request.json();
    if (typeof body.limit === 'number' && body.limit > 0) {
      limit = Math.min(body.limit, 200);
    }
  } catch {
    // no body — use default
  }

  const result = await runProcessing(limit);
  return NextResponse.json(result);
}
