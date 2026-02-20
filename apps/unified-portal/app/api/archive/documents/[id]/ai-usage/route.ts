import { NextRequest, NextResponse } from 'next/server';
import { db } from '@openhouse/db/client';
import { sql } from 'drizzle-orm';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const documentId = params.id;

  try {
    // messages table has cited_document_ids (text array). Count messages where this doc was cited.
    // cited_document_ids is a text array, so we use text array contains check
    const result = await db.execute(
      sql`SELECT COUNT(*)::int as usage_count, MAX(created_at) as last_used
          FROM messages
          WHERE cited_document_ids @> ARRAY[${documentId}]`
    );

    const row = result.rows?.[0] as { usage_count: number; last_used: string } | undefined;

    return NextResponse.json({
      usage_count: row?.usage_count || 0,
      last_used: row?.last_used || null,
    });
  } catch (error) {
    console.error('[AIUsage] Failed:', error);
    return NextResponse.json({ usage_count: 0, last_used: null });
  }
}
