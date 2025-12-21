export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { db } from '@openhouse/db/client';
import { documents, doc_chunks } from '@openhouse/db/schema';
import { like, or, inArray } from 'drizzle-orm';
import { clearAllDocumentCache } from '@/lib/documentCache';

export async function GET() {
  try {
    const ghostDocs = await db.select({ id: documents.id })
      .from(documents)
      .where(
        or(
          like(documents.file_url, '/uploads/%'),
          like(documents.file_url, 'uploads/%')
        )
      );

    if (ghostDocs.length === 0) {
      return new NextResponse(
        `No ghost records found. Database is clean.`,
        { status: 200, headers: { 'Content-Type': 'text/plain' } }
      );
    }

    const ghostIds = ghostDocs.map(d => d.id);

    let chunksDeleted = 0;
    try {
      const chunkResult = await db.delete(doc_chunks)
        .where(inArray(doc_chunks.document_id, ghostIds))
        .returning({ id: doc_chunks.id });
      chunksDeleted = chunkResult.length;
    } catch (e) {
    }

    const result = await db.delete(documents)
      .where(
        or(
          like(documents.file_url, '/uploads/%'),
          like(documents.file_url, 'uploads/%')
        )
      )
      .returning({ id: documents.id });

    try {
      clearAllDocumentCache();
    } catch (e) {
    }

    return new NextResponse(
      `SUCCESS: Cleaned up ${result.length} ghost document records and ${chunksDeleted} associated chunks.\n\nGo refresh your Admin Panel (Ctrl+Shift+R for hard refresh).`,
      { status: 200, headers: { 'Content-Type': 'text/plain' } }
    );
  } catch (error) {
    return new NextResponse(
      `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      { status: 500, headers: { 'Content-Type': 'text/plain' } }
    );
  }
}
