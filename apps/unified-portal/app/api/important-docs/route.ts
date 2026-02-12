export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/supabase-server';
import { db } from '@openhouse/db/client';
import { documents } from '@openhouse/db/schema';
import { eq, and, desc, isNotNull } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const session = await requireRole(['developer', 'admin', 'super_admin']);
    const tenantId = session.tenantId;

    if (!tenantId) {
      return NextResponse.json({ error: 'No tenant ID found' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const developmentId = searchParams.get('developmentId');

    if (!developmentId) {
      return NextResponse.json({ error: 'developmentId is required' }, { status: 400 });
    }

    const docs = await db
      .select({
        id: documents.id,
        title: documents.title,
        original_file_name: documents.original_file_name,
        mime_type: documents.mime_type,
        size_kb: documents.size_kb,
        file_url: documents.file_url,
        version: documents.version,
        is_important: documents.is_important,
        must_read: documents.must_read,
        important_rank: documents.important_rank,
        created_at: documents.created_at,
      })
      .from(documents)
      .where(
        and(
          eq(documents.tenant_id, tenantId),
          eq(documents.development_id, developmentId)
        )
      )
      .orderBy(desc(documents.created_at))
      .limit(500);

    return NextResponse.json({ documents: docs });
  } catch (error) {
    console.error('[Important Docs API Error]:', error);
    return NextResponse.json(
      { error: 'Failed to fetch documents' },
      { status: 500 }
    );
  }
}
