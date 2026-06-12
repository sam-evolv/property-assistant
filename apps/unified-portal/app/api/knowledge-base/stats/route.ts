import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { db } from '@openhouse/db';
import { sql } from 'drizzle-orm';
import { requireRole } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(request: NextRequest) {
  try {
    // SECURITY: these are platform-wide aggregates ('sections' has no tenant
    // column path, messages count is global) — restrict to super_admin.
    await requireRole(['super_admin']);

    const supabase = getSupabaseClient();
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    const sectionsResult = await supabase
      .from('sections')
      .select('id', { count: 'exact' });

    const totalChunks = sectionsResult.count || 0;

    const documentsResult = await supabase
      .from('documents')
      .select('id', { count: 'exact' });

    const totalDocuments = documentsResult.count || 0;

    let totalQuestionsAnswered = 0;
    try {
      const messagesResult = await db.execute(sql`
        SELECT COUNT(*) as count FROM messages WHERE role = 'assistant'
      `);
      totalQuestionsAnswered = Number((messagesResult as any).rows?.[0]?.count || 0);
    } catch (_e) {
        // error handled silently
    }

    const avgResponseTime = 2.3;
    const knowledgeCoverage = totalChunks > 0 ? Math.min(95, Math.round((totalChunks / 150) * 100)) : 0;

    return NextResponse.json({
      total_documents: totalDocuments,
      total_chunks: totalChunks,
      processed_documents: totalDocuments,
      pending_documents: 0,
      total_questions_answered: totalQuestionsAnswered,
      avg_response_time: avgResponseTime,
      knowledge_coverage: knowledgeCoverage,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (errorMessage === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({
      total_documents: 0,
      total_chunks: 0,
      processed_documents: 0,
      pending_documents: 0,
      total_questions_answered: 0,
      avg_response_time: 0,
      knowledge_coverage: 0,
    });
  }
}
