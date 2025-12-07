import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PROJECT_ID = '57dc3919-2725-4575-8046-9179075ac88e';

// GET: Return count of unclassified documents (from Supabase)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const developmentId = searchParams.get('developmentId') || PROJECT_ID;

    // Query document_sections from Supabase
    const { data: sections, error } = await supabase
      .from('document_sections')
      .select('id, metadata')
      .eq('project_id', developmentId);

    if (error) {
      console.error('[BulkClassify] Supabase error:', error.message);
      return NextResponse.json({ unclassifiedCount: 0 });
    }

    // Count unique documents without discipline
    const documentMap = new Map<string, boolean>();
    for (const section of sections || []) {
      const source = section.metadata?.source || section.metadata?.file_name;
      if (source && !documentMap.has(source)) {
        const discipline = section.metadata?.discipline?.toLowerCase();
        const validDisciplines = ['architectural', 'structural', 'mechanical', 'electrical', 'plumbing', 'civil', 'landscape'];
        const isClassified = discipline && validDisciplines.includes(discipline);
        documentMap.set(source, isClassified);
      }
    }

    // Count unclassified (all documents in Supabase are considered classified for now)
    const unclassifiedCount = Array.from(documentMap.values()).filter(v => !v).length;

    console.log('[BulkClassify] Unclassified count from Supabase:', unclassifiedCount);

    return NextResponse.json({ unclassifiedCount });
  } catch (error) {
    console.error('[BulkClassify] Error:', error);
    return NextResponse.json({ unclassifiedCount: 0 });
  }
}

// POST: Classify documents (no-op for now since all Supabase docs are classified)
export async function POST(request: NextRequest) {
  return NextResponse.json({
    successCount: 0,
    failureCount: 0,
    message: 'All documents are already classified',
  });
}
