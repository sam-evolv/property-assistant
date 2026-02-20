export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/supabase-server';
import { db } from '@openhouse/db/client';
import { documents, developments, doc_chunks } from '@openhouse/db/schema';
import { eq, and } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: documentId } = await params;
    const session = await requireRole(['developer', 'admin', 'super_admin']);
    const tenantId = session.tenantId;

    if (!tenantId) {
      return NextResponse.json({ error: 'No tenant ID found' }, { status: 400 });
    }

    const doc = await db.query.documents.findFirst({
      where: and(
        eq(documents.id, documentId),
        eq(documents.tenant_id, tenantId)
      ),
    });

    if (!doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Get development name
    let developmentName = 'Unknown';
    if (doc.development_id) {
      const dev = await db.query.developments.findFirst({
        where: eq(developments.id, doc.development_id),
        columns: { name: true },
      });
      developmentName = dev?.name || 'Unknown';
    }

    // Get chunk previews
    let chunks: Array<{ id: string; content: string; chunk_index: number }> = [];
    try {
      const docChunks = await db
        .select({
          id: doc_chunks.id,
          content: doc_chunks.content,
          chunk_index: doc_chunks.chunk_index,
        })
        .from(doc_chunks)
        .where(eq(doc_chunks.document_id, documentId))
        .limit(20);
      chunks = docChunks.map(c => ({
        id: c.id,
        content: c.content || '',
        chunk_index: c.chunk_index || 0,
      }));
    } catch {
      // doc_chunks may not have data for all documents
    }

    const tags = Array.isArray(doc.ai_tags) ? doc.ai_tags : [];

    return NextResponse.json({
      document: {
        id: doc.id,
        title: doc.title,
        file_name: doc.file_name,
        discipline: doc.discipline,
        house_type_code: doc.house_type_code,
        house_type_id: doc.house_type_id,
        is_important: doc.is_important,
        must_read: doc.must_read,
        ai_classified: doc.ai_classified,
        tags,
        development_id: doc.development_id,
        development_name: developmentName,
        file_url: doc.file_url,
        storage_url: doc.storage_url,
        relative_path: doc.relative_path,
        mime_type: doc.mime_type,
        size_kb: doc.size_kb,
        created_at: doc.created_at,
        updated_at: doc.updated_at,
        processing_status: doc.processing_status,
        chunks_count: doc.chunks_count || 0,
      },
      chunks,
    });
  } catch (error: any) {
    console.error('[Document API] GET error:', error);
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Failed to fetch document' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: documentId } = await params;
    const session = await requireRole(['developer', 'admin', 'super_admin']);
    const tenantId = session.tenantId;

    if (!tenantId) {
      return NextResponse.json({ error: 'No tenant ID found' }, { status: 400 });
    }

    const body = await request.json();
    const { discipline, house_type_code, is_important, must_read, tags } = body;

    // Verify document belongs to tenant
    const existingDoc = await db.query.documents.findFirst({
      where: and(
        eq(documents.id, documentId),
        eq(documents.tenant_id, tenantId)
      ),
    });

    if (!existingDoc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    const updates: Record<string, any> = {
      updated_at: new Date(),
    };

    if (discipline !== undefined) updates.discipline = discipline;
    if (house_type_code !== undefined) updates.house_type_code = house_type_code;
    if (is_important !== undefined) updates.is_important = is_important;
    if (must_read !== undefined) updates.must_read = must_read;
    if (tags !== undefined) updates.ai_tags = tags;

    await db.update(documents)
      .set(updates)
      .where(eq(documents.id, documentId));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Document API] PATCH error:', error);
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Failed to update document' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: documentId } = await params;
    const session = await requireRole(['developer', 'admin', 'super_admin']);
    const tenantId = session.tenantId;

    if (!tenantId) {
      return NextResponse.json({ error: 'No tenant ID found' }, { status: 400 });
    }

    // Verify document belongs to tenant
    const existingDoc = await db.query.documents.findFirst({
      where: and(
        eq(documents.id, documentId),
        eq(documents.tenant_id, tenantId)
      ),
    });

    if (!existingDoc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Delete from local DB
    await db.delete(documents).where(eq(documents.id, documentId));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Document API] DELETE error:', error);
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 });
  }
}
