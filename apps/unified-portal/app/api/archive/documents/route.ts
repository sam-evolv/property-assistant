export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/supabase-server';
import {
  deleteDocument,
  updateDocumentFlags
} from '@/lib/archive-documents';

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireRole(['developer', 'admin', 'super_admin']);
    const tenantId = session.tenantId;

    if (!tenantId) {
      return NextResponse.json({ error: 'No tenant ID found' }, { status: 400 });
    }

    const body = await request.json();
    const { fileName, isImportant, mustRead, schemeId } = body;

    if (!fileName) {
      return NextResponse.json({ error: 'fileName is required' }, { status: 400 });
    }

    const result = await updateDocumentFlags({
      fileName,
      isImportant,
      mustRead,
      schemeId,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to update document' },
        { status: 400 }
      );
    }

    // Also update the local DB documents table to keep in sync
    try {
      const { db } = await import('@openhouse/db/client');
      const { documents } = await import('@openhouse/db/schema');
      const { eq, and, or } = await import('drizzle-orm');

      const localDocs = await db
        .select({ id: documents.id })
        .from(documents)
        .where(
          and(
            eq(documents.tenant_id, tenantId),
            or(
              eq(documents.file_name, fileName),
              eq(documents.original_file_name, fileName)
            )
          )
        );

      for (const doc of localDocs) {
        const updates: Record<string, any> = { updated_at: new Date() };
        if (isImportant !== undefined) updates.is_important = isImportant;
        if (mustRead !== undefined) updates.must_read = mustRead;

        await db.update(documents)
          .set(updates)
          .where(eq(documents.id, doc.id));
      }
    } catch (dbError) {
      console.error('[Archive Documents API] Local DB sync error (non-fatal):', dbError);
    }

    return NextResponse.json({
      success: true,
      updatedCount: result.updatedCount
    });
  } catch (error: any) {
    console.error('[Archive Documents API] PATCH error:', error);
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Failed to update document' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await requireRole(['developer', 'admin', 'super_admin']);
    const tenantId = session.tenantId;

    if (!tenantId) {
      return NextResponse.json({ error: 'No tenant ID found' }, { status: 400 });
    }

    const body = await request.json();
    const { fileName, schemeId } = body;

    if (!fileName) {
      return NextResponse.json({ error: 'fileName is required' }, { status: 400 });
    }

    const result = await deleteDocument({
      fileName,
      schemeId,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to delete document' },
        { status: 400 }
      );
    }

    // Also delete from local DB
    try {
      const { db } = await import('@openhouse/db/client');
      const { documents } = await import('@openhouse/db/schema');
      const { eq, and, or } = await import('drizzle-orm');

      await db.delete(documents)
        .where(
          and(
            eq(documents.tenant_id, tenantId),
            or(
              eq(documents.file_name, fileName),
              eq(documents.original_file_name, fileName)
            )
          )
        );
    } catch (dbError) {
      console.error('[Archive Documents API] Local DB delete error (non-fatal):', dbError);
    }

    return NextResponse.json({
      success: true,
      deletedCount: result.deletedCount
    });
  } catch (error: any) {
    console.error('[Archive Documents API] DELETE error:', error);
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 });
  }
}
