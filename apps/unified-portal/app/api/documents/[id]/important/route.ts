export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/supabase-server';
import { db } from '@openhouse/db/client';
import { documents } from '@openhouse/db/schema';
import { eq, and } from 'drizzle-orm';

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
    const { developmentId, is_important, important_rank } = body;

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

    // If marking as important, check the limit (max 10)
    if (is_important && !existingDoc.is_important) {
      const importantDocs = await db
        .select({ id: documents.id })
        .from(documents)
        .where(
          and(
            eq(documents.tenant_id, tenantId),
            eq(documents.development_id, developmentId || existingDoc.development_id!),
            eq(documents.is_important, true)
          )
        );

      if (importantDocs.length >= 10) {
        return NextResponse.json(
          { error: 'Maximum 10 important documents allowed per development' },
          { status: 400 }
        );
      }
    }

    const updates: Record<string, any> = {
      is_important: is_important,
      important_rank: is_important ? (important_rank || null) : null,
      must_read: is_important ? (existingDoc.must_read || is_important) : false,
      updated_at: new Date(),
    };

    await db.update(documents)
      .set(updates)
      .where(eq(documents.id, documentId));

    // Also update Supabase document_sections metadata to keep in sync
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      const fileName = existingDoc.file_name || existingDoc.original_file_name;
      if (fileName) {
        const { data: sections } = await supabase
          .from('document_sections')
          .select('id, metadata');

        const matchingSections = (sections || []).filter(s => {
          const source = s.metadata?.source;
          const file_name = s.metadata?.file_name;
          return source === fileName || file_name === fileName;
        });

        for (const section of matchingSections) {
          await supabase
            .from('document_sections')
            .update({
              metadata: {
                ...section.metadata,
                is_important: is_important,
                must_read: is_important,
              },
            })
            .eq('id', section.id);
        }
      }
    } catch (syncError) {
      console.error('[Important API] Supabase sync error (non-fatal):', syncError);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Important API] Error:', error);
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Failed to update document importance' }, { status: 500 });
  }
}
