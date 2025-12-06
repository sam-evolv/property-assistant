import { NextRequest, NextResponse } from 'next/server';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { db } from '@openhouse/db/client';
import { admins, documents, doc_chunks, userDevelopments } from '@openhouse/db/schema';
import { eq, and, sql, isNull, or } from 'drizzle-orm';
import { parseFile } from '@openhouse/api/train/parse';
import { chunkTrainingItems } from '@openhouse/api/train/chunk';
import { embedChunks } from '@openhouse/api/train/embed';
import { ingestEmbeddings } from '@openhouse/api/train/ingest';

export const maxDuration = 300;

async function validateAdminAccess(
  email: string,
  tenantId: string,
  developmentId?: string
): Promise<{ valid: boolean; error?: string; role?: string; adminId?: string }> {
  const admin = await db.query.admins.findFirst({
    where: and(
      eq(admins.email, email),
      eq(admins.tenant_id, tenantId)
    ),
    columns: { id: true, role: true }
  });

  if (!admin) {
    return { valid: false, error: 'Admin not found for this tenant' };
  }

  if (admin.role === 'super_admin' || admin.role === 'tenant_admin') {
    return { valid: true, role: admin.role, adminId: admin.id };
  }

  if (!developmentId) {
    return { valid: false, error: 'Developer-role admins must specify a developmentId' };
  }

  const hasAccess = await db.query.userDevelopments.findFirst({
    where: and(
      eq(userDevelopments.user_id, admin.id),
      eq(userDevelopments.development_id, developmentId)
    ),
    columns: { user_id: true }
  });

  if (!hasAccess) {
    return { valid: false, error: 'No access to this development' };
  }

  return { valid: true, role: admin.role, adminId: admin.id };
}

async function processDocumentForRAG(
  documentId: string,
  tenantId: string,
  developmentId: string,
  fileName: string,
  storageUrl: string,
  fileUrl: string | null,
  houseTypeCode: string | null,
  supabase: ReturnType<typeof createServerComponentClient>
): Promise<{ success: boolean; chunksInserted: number; error?: string }> {
  try {
    console.log(`[Reprocess-All] Processing ${fileName} (${documentId})`);
    
    await db
      .update(documents)
      .set({ processing_status: 'processing', updated_at: new Date() })
      .where(eq(documents.id, documentId));

    let buffer: Buffer | null = null;
    let fileType = 'application/pdf';

    if (storageUrl) {
      const { data, error } = await supabase.storage
        .from('documents')
        .download(storageUrl);

      if (data && !error) {
        const arrayBuffer = await data.arrayBuffer();
        buffer = Buffer.from(new Uint8Array(arrayBuffer));
        fileType = data.type || 'application/pdf';
      }
    }

    if (!buffer && fileUrl) {
      const fs = await import('fs');
      const path = await import('path');
      
      let localPath = fileUrl;
      if (localPath.startsWith('/')) {
        localPath = path.join(process.cwd(), 'public', localPath);
      }
      
      if (fs.existsSync(localPath)) {
        buffer = fs.readFileSync(localPath);
        const ext = path.extname(fileName).toLowerCase();
        fileType = ext === '.pdf' ? 'application/pdf' : 
                   ext === '.docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' :
                   ext === '.csv' ? 'text/csv' : 'application/octet-stream';
      }
    }

    if (!buffer) {
      console.log(`[Reprocess-All] Could not retrieve file content for ${fileName}`);
      await db
        .update(documents)
        .set({ 
          processing_status: 'error', 
          processing_error: 'Could not retrieve file content',
          updated_at: new Date() 
        })
        .where(eq(documents.id, documentId));
      return { success: false, chunksInserted: 0, error: 'Could not retrieve file content' };
    }

    const items = await parseFile(buffer, fileName, tenantId, fileType);
    console.log(`[Reprocess-All] Parsed ${items.length} items from ${fileName}`);

    if (items.length === 0) {
      await db
        .update(documents)
        .set({ processing_status: 'complete', chunks_count: 0, updated_at: new Date() })
        .where(eq(documents.id, documentId));
      return { success: true, chunksInserted: 0 };
    }

    const chunkedItems = await chunkTrainingItems(items);
    const allChunks = chunkedItems.flatMap(ci => ci.chunks);
    console.log(`[Reprocess-All] Created ${allChunks.length} chunks from ${fileName}`);

    if (allChunks.length === 0) {
      await db
        .update(documents)
        .set({ processing_status: 'complete', chunks_count: 0, updated_at: new Date() })
        .where(eq(documents.id, documentId));
      return { success: true, chunksInserted: 0 };
    }

    const embeddings = await embedChunks(allChunks);
    console.log(`[Reprocess-All] Generated ${embeddings.length} embeddings for ${fileName}`);

    const result = await ingestEmbeddings(
      embeddings,
      tenantId,
      developmentId,
      items[0]?.sourceType || 'document',
      documentId,
      houseTypeCode
    );

    await db
      .update(documents)
      .set({
        processing_status: 'complete',
        chunks_count: result.chunksInserted,
        updated_at: new Date()
      })
      .where(eq(documents.id, documentId));

    console.log(`[Reprocess-All] Completed ${fileName}: ${result.chunksInserted} chunks`);
    return { success: true, chunksInserted: result.chunksInserted };

  } catch (error) {
    console.error(`[Reprocess-All] Failed ${fileName}:`, error);
    await db
      .update(documents)
      .set({
        processing_status: 'error',
        processing_error: error instanceof Error ? error.message : 'Unknown error',
        updated_at: new Date()
      })
      .where(eq(documents.id, documentId));
    return { success: false, chunksInserted: 0, error: error instanceof Error ? error.message : 'Unknown' };
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerComponentClient({ cookies });
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user?.email) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const { tenantId, developmentId, limit = 10 } = body;

    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    }

    const accessCheck = await validateAdminAccess(user.email, tenantId, developmentId);
    if (!accessCheck.valid) {
      return NextResponse.json({ error: accessCheck.error }, { status: 403 });
    }

    const docsWithoutChunks = await db.execute<{
      id: string;
      file_name: string;
      storage_url: string | null;
      file_url: string | null;
      development_id: string;
      house_type_code: string | null;
    }>(sql`
      SELECT d.id, d.file_name, d.storage_url, d.file_url, d.development_id, d.house_type_code
      FROM documents d
      LEFT JOIN doc_chunks c ON d.id = c.document_id
      WHERE d.tenant_id = ${tenantId}::uuid
        AND d.status = 'active'
        ${developmentId ? sql`AND d.development_id = ${developmentId}::uuid` : sql``}
      GROUP BY d.id
      HAVING COUNT(c.id) = 0
      ORDER BY d.created_at DESC
      LIMIT ${limit}
    `);

    const docsToProcess = docsWithoutChunks.rows || [];
    console.log(`[Reprocess-All] Found ${docsToProcess.length} documents without embeddings`);

    if (docsToProcess.length === 0) {
      return NextResponse.json({
        success: true,
        processed: 0,
        message: 'No documents need reprocessing'
      });
    }

    const results: Array<{
      documentId: string;
      fileName: string;
      success: boolean;
      chunksInserted: number;
      error?: string;
    }> = [];

    for (const doc of docsToProcess) {
      const result = await processDocumentForRAG(
        doc.id,
        tenantId,
        doc.development_id,
        doc.file_name,
        doc.storage_url || '',
        doc.file_url,
        doc.house_type_code,
        supabase
      );

      results.push({
        documentId: doc.id,
        fileName: doc.file_name,
        ...result
      });
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const totalChunks = results.reduce((sum, r) => sum + r.chunksInserted, 0);

    return NextResponse.json({
      success: true,
      processed: results.length,
      successful,
      failed,
      totalChunks,
      results
    });

  } catch (error) {
    console.error('[Reprocess-All] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Reprocessing failed' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerComponentClient({ cookies });
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user?.email) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const developmentId = searchParams.get('developmentId');

    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    }

    const accessCheck = await validateAdminAccess(user.email, tenantId, developmentId || undefined);
    if (!accessCheck.valid) {
      return NextResponse.json({ error: accessCheck.error }, { status: 403 });
    }

    const stats = await db.execute<{
      total_docs: number;
      docs_with_chunks: number;
      docs_without_chunks: number;
      pending_count: number;
      processing_count: number;
      error_count: number;
    }>(sql`
      SELECT 
        COUNT(DISTINCT d.id) as total_docs,
        COUNT(DISTINCT CASE WHEN c.id IS NOT NULL THEN d.id END) as docs_with_chunks,
        COUNT(DISTINCT CASE WHEN c.id IS NULL THEN d.id END) as docs_without_chunks,
        COUNT(DISTINCT CASE WHEN d.processing_status = 'pending' OR d.processing_status IS NULL THEN d.id END) as pending_count,
        COUNT(DISTINCT CASE WHEN d.processing_status = 'processing' THEN d.id END) as processing_count,
        COUNT(DISTINCT CASE WHEN d.processing_status = 'error' THEN d.id END) as error_count
      FROM documents d
      LEFT JOIN doc_chunks c ON d.id = c.document_id
      WHERE d.tenant_id = ${tenantId}::uuid
        AND d.status = 'active'
        ${developmentId ? sql`AND d.development_id = ${developmentId}::uuid` : sql``}
    `);

    const row = stats.rows?.[0] || {
      total_docs: 0,
      docs_with_chunks: 0,
      docs_without_chunks: 0,
      pending_count: 0,
      processing_count: 0,
      error_count: 0
    };

    return NextResponse.json({
      totalDocuments: Number(row.total_docs),
      withEmbeddings: Number(row.docs_with_chunks),
      withoutEmbeddings: Number(row.docs_without_chunks),
      pending: Number(row.pending_count),
      processing: Number(row.processing_count),
      errors: Number(row.error_count)
    });

  } catch (error) {
    console.error('[Reprocess-All] Stats error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get stats' },
      { status: 500 }
    );
  }
}
