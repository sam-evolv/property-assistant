/**
 * POST /api/admin/backfill-documents
 *
 * One-shot backfill route: finds all documents in pending/failed state and
 * fires the ingest pipeline for each. Returns a progress summary.
 *
 * Protected by INGEST_SECRET (same header as the ingest route itself).
 *
 * Usage:
 *   curl -X POST https://portal.openhouseai.ie/api/admin/backfill-documents \
 *     -H "x-ingest-secret: openhouse-ingest-2026" \
 *     -H "Content-Type: application/json" \
 *     -d '{"dry_run": false}'
 *
 * Optional body fields:
 *   dry_run: boolean       — list what would run without triggering (default false)
 *   only_failed: boolean   — restrict to processing_status = 'failed' (default false)
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@openhouse/db/client';
import { documents } from '@openhouse/db/schema';
import { or, eq } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const secret = request.headers.get('x-ingest-secret');
  const expectedSecret = process.env.INGEST_SECRET;
  if (!expectedSecret || secret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let dryRun = false;
  let onlyFailed = false;
  try {
    const body = await request.json().catch(() => ({}));
    dryRun = body?.dry_run === true;
    onlyFailed = body?.only_failed === true;
  } catch {
    // default values fine
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://portal.openhouseai.ie';
  const ingestUrl = `${appUrl}/api/ingest/document`;

  // ── Query pending/failed documents ────────────────────────────────────────
  const statusFilter = onlyFailed
    ? eq(documents.processing_status, 'failed')
    : or(
        eq(documents.processing_status, 'pending'),
        eq(documents.processing_status, 'failed')
      );

  let rows: { id: string; file_name: string; processing_status: string; upload_status: string; mime_type: string | null }[];
  try {
    rows = await db.select({
      id: documents.id,
      file_name: documents.file_name,
      processing_status: documents.processing_status,
      upload_status: documents.upload_status,
      mime_type: documents.mime_type,
    })
      .from(documents)
      .where(statusFilter!);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `DB query failed: ${msg}` }, { status: 500 });
  }

  if (rows.length === 0) {
    return NextResponse.json({
      success: true,
      dry_run: dryRun,
      only_failed: onlyFailed,
      total: 0,
      triggered: 0,
      skipped: 0,
      failed: 0,
      note: 'No pending/failed documents found',
    });
  }

  // ── Fire ingest for each eligible document ────────────────────────────────
  const triggered: string[] = [];
  const skipped: { id: string; file_name: string; reason: string }[] = [];
  const failed: { id: string; file_name: string; error: string }[] = [];

  for (const doc of rows) {
    const mimeType = doc.mime_type || '';
    const fileName = (doc.file_name || '').toLowerCase();
    const isPdf = mimeType === 'application/pdf' || fileName.endsWith('.pdf');
    const isText = mimeType === 'text/plain' || fileName.endsWith('.txt');

    if (!isPdf && !isText) {
      skipped.push({ id: doc.id, file_name: doc.file_name, reason: `unsupported type: ${doc.mime_type || 'unknown'}` });
      continue;
    }

    if (dryRun) {
      triggered.push(doc.id);
      continue;
    }

    try {
      const res = await fetch(ingestUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-ingest-secret': expectedSecret,
        },
        body: JSON.stringify({ document_id: doc.id }),
      });
      if (res.ok) {
        triggered.push(doc.id);
      } else {
        const errText = await res.text().catch(() => `HTTP ${res.status}`);
        failed.push({ id: doc.id, file_name: doc.file_name, error: errText });
      }
    } catch (fetchErr) {
      const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
      failed.push({ id: doc.id, file_name: doc.file_name, error: msg });
    }

    // Small delay between calls to avoid hammering OpenAI embeddings
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  return NextResponse.json({
    success: true,
    dry_run: dryRun,
    only_failed: onlyFailed,
    total: rows.length,
    triggered: triggered.length,
    skipped: skipped.length,
    failed: failed.length,
    triggered_ids: triggered,
    skipped_details: skipped,
    failed_details: failed,
  });
}
