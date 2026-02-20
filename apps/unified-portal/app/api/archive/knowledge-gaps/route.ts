import { NextRequest, NextResponse } from 'next/server';
import { db } from '@openhouse/db/client';
import { answer_gap_log } from '@openhouse/db/schema';
import { eq, desc, and, sql, inArray } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const schemeId = searchParams.get('schemeId');
  const tenantId = searchParams.get('tenantId');

  if (!schemeId && !tenantId) {
    return NextResponse.json({ error: 'schemeId or tenantId required' }, { status: 400 });
  }

  try {
    // Only surface real document gaps (not location/places failures)
    const documentGapReasons = ['no_documents_found', 'low_doc_confidence', 'playbook_fallback', 'defer_to_developer', 'validation_failed'];

    const conditions = schemeId
      ? [eq(answer_gap_log.scheme_id, schemeId), inArray(answer_gap_log.gap_reason, documentGapReasons)]
      : [inArray(answer_gap_log.gap_reason, documentGapReasons)];

    // Get grouped gaps (deduplicate similar questions) - top 30 by count
    const gaps = await db
      .select({
        user_question: answer_gap_log.user_question,
        intent_type: answer_gap_log.intent_type,
        gap_reason: answer_gap_log.gap_reason,
        scheme_id: answer_gap_log.scheme_id,
        count: sql<number>`count(*)`,
        last_asked: sql<string>`max(${answer_gap_log.created_at})`,
      })
      .from(answer_gap_log)
      .where(and(...conditions))
      .groupBy(answer_gap_log.user_question, answer_gap_log.intent_type, answer_gap_log.gap_reason, answer_gap_log.scheme_id)
      .orderBy(desc(sql`count(*)`))
      .limit(30);

    return NextResponse.json({ gaps });
  } catch (error) {
    console.error('[KnowledgeGaps] Failed:', error);
    return NextResponse.json({ error: 'Failed to load knowledge gaps' }, { status: 500 });
  }
}
