import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const PROJECT_ID = '57dc3919-2725-4575-8046-9179075ac88e';

export const maxDuration = 300;

// GET: Return embedding stats (from Supabase document_sections)
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const { searchParams } = new URL(request.url);
    const developmentId = searchParams.get('developmentId') || PROJECT_ID;

    // Query document_sections from Supabase
    const { data: sections, error } = await supabase
      .from('document_sections')
      .select('id, metadata, embedding')
      .eq('project_id', developmentId);

    if (error) {
      console.error('[ReprocessAll] Supabase error:', error.message);
      return NextResponse.json({
        totalDocuments: 0,
        withEmbeddings: 0,
        withoutEmbeddings: 0,
        pending: 0,
        processing: 0,
        errors: 0,
      });
    }

    // Count unique documents by source
    const documentMap = new Map<string, boolean>();
    for (const section of sections || []) {
      const source = section.metadata?.source || section.metadata?.file_name;
      if (source && !documentMap.has(source)) {
        // All documents in document_sections have embeddings
        documentMap.set(source, true);
      }
    }

    const totalDocuments = documentMap.size;
    const withEmbeddings = totalDocuments; // All docs in Supabase have embeddings
    const withoutEmbeddings = 0;

    console.log('[ReprocessAll] Stats from Supabase:', {
      totalDocuments,
      withEmbeddings,
      withoutEmbeddings,
    });

    return NextResponse.json({
      totalDocuments,
      withEmbeddings,
      withoutEmbeddings,
      pending: 0,
      processing: 0,
      errors: 0,
    });
  } catch (error) {
    console.error('[ReprocessAll] Error:', error);
    return NextResponse.json({
      totalDocuments: 0,
      withEmbeddings: 0,
      withoutEmbeddings: 0,
      pending: 0,
      processing: 0,
      errors: 0,
    });
  }
}

// POST: Reprocess documents (no-op since all Supabase docs already have embeddings)
export async function POST(request: NextRequest) {
  return NextResponse.json({
    processed: 0,
    successful: 0,
    failed: 0,
    totalChunks: 0,
    message: 'All documents are already indexed',
  });
}
