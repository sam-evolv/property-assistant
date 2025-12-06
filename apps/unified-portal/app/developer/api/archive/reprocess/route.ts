import { NextRequest, NextResponse } from 'next/server';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { db } from '@openhouse/db/client';
import { admins, userDevelopments, documents, doc_chunks } from '@openhouse/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { classifyDocumentWithAI } from '@/lib/ai-classify';

async function validateTenantAdminAccess(
  email: string,
  tenantId: string,
  documentId: string
): Promise<{ valid: boolean; document?: typeof documents.$inferSelect; error?: string }> {
  const admin = await db.query.admins.findFirst({
    where: and(
      eq(admins.email, email),
      eq(admins.tenant_id, tenantId)
    ),
    columns: { id: true, role: true }
  });

  if (!admin) {
    console.log('[Reprocess] No admin found for email:', email, 'tenant:', tenantId);
    return { valid: false, error: 'Admin not found' };
  }

  const doc = await db.query.documents.findFirst({
    where: and(
      eq(documents.id, documentId),
      eq(documents.tenant_id, tenantId)
    )
  });

  if (!doc) {
    return { valid: false, error: 'Document not found' };
  }

  if (admin.role === 'super_admin' || admin.role === 'tenant_admin') {
    return { valid: true, document: doc };
  }

  if (doc.development_id) {
    const hasAccess = await db.query.userDevelopments.findFirst({
      where: and(
        eq(userDevelopments.user_id, admin.id),
        eq(userDevelopments.development_id, doc.development_id)
      ),
      columns: { user_id: true }
    });

    if (!hasAccess) {
      return { valid: false, error: 'No access to this document' };
    }
  }

  return { valid: true, document: doc };
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerComponentClient({ cookies });
    const { data: { user } } = await supabase.auth.getUser();

    if (!user || !user.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { documentId, tenantId } = body;

    if (!documentId || !tenantId) {
      return NextResponse.json(
        { error: 'documentId and tenantId are required' },
        { status: 400 }
      );
    }

    const access = await validateTenantAdminAccess(user.email, tenantId, documentId);
    if (!access.valid || !access.document) {
      return NextResponse.json({ error: access.error }, { status: 403 });
    }

    const doc = access.document;

    console.log(`[Reprocess] Starting reprocessing for document: ${doc.file_name}`);

    await db
      .update(documents)
      .set({
        processing_status: 'processing',
        updated_at: new Date()
      })
      .where(eq(documents.id, documentId));

    try {
      const classification = await classifyDocumentWithAI(doc.file_name);

      await db
        .update(documents)
        .set({
          discipline: classification.discipline,
          ai_classified: true,
          ai_classified_at: new Date(),
          ai_tags: classification.suggestedTags,
          processing_status: 'complete',
          updated_at: new Date()
        })
        .where(eq(documents.id, documentId));

      await db.execute(sql`
        UPDATE doc_chunks 
        SET 
          search_content = to_tsvector('english', COALESCE(content, '')),
          token_count = COALESCE(array_length(regexp_split_to_array(content, '\s+'), 1), 0)
        WHERE document_id = ${documentId}::uuid
      `);

      await db.execute(sql`
        DELETE FROM search_cache 
        WHERE tenant_id = ${doc.tenant_id}::uuid
      `);

      console.log(`[Reprocess] Completed for ${doc.file_name}: ${classification.discipline} (search cache invalidated)`);

      return NextResponse.json({
        success: true,
        documentId,
        classification: {
          discipline: classification.discipline,
          confidence: classification.confidence,
          suggestedTags: classification.suggestedTags,
          reasoning: classification.reasoning
        }
      });

    } catch (classifyError) {
      console.error('[Reprocess] Classification failed:', classifyError);
      
      await db
        .update(documents)
        .set({
          processing_status: 'error',
          processing_error: classifyError instanceof Error ? classifyError.message : 'Unknown error',
          updated_at: new Date()
        })
        .where(eq(documents.id, documentId));

      return NextResponse.json(
        { error: 'Classification failed', details: classifyError instanceof Error ? classifyError.message : 'Unknown' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('[Reprocess] Error:', error);
    return NextResponse.json(
      { error: 'Reprocess failed' },
      { status: 500 }
    );
  }
}
