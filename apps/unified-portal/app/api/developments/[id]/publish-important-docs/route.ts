export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/supabase-server';
import { db } from '@openhouse/db/client';
import { developments, documents, units } from '@openhouse/db/schema';
import { eq, and } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireRole(['developer', 'admin', 'super_admin']);
    const tenantId = session.tenantId;

    if (!tenantId) {
      return NextResponse.json({ error: 'No tenant ID found' }, { status: 400 });
    }

    const developmentId = params.id;

    const development = await db
      .select({
        id: developments.id,
        important_docs_version: developments.important_docs_version,
      })
      .from(developments)
      .where(
        and(eq(developments.id, developmentId), eq(developments.tenant_id, tenantId))
      )
      .limit(1);

    if (!development || development.length === 0) {
      return NextResponse.json(
        { error: 'Development not found' },
        { status: 404 }
      );
    }

    const importantDocs = await db
      .select({ id: documents.id })
      .from(documents)
      .where(
        and(
          eq(documents.development_id, developmentId),
          eq(documents.is_important, true)
        )
      );

    if (importantDocs.length === 0) {
      return NextResponse.json(
        { error: 'No important documents found for this development' },
        { status: 400 }
      );
    }

    const newVersion = development[0].important_docs_version + 1;

    await db
      .update(developments)
      .set({ important_docs_version: newVersion })
      .where(eq(developments.id, developmentId));

    const unitsCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(units)
      .where(eq(units.development_id, developmentId));

    return NextResponse.json({
      success: true,
      newVersion,
      importantDocsCount: importantDocs.length,
      affectedUnitsCount: unitsCount[0]?.count || 0,
    });
  } catch (error) {
    console.error('[Publish Important Docs API Error]:', error);
    return NextResponse.json(
      { error: 'Failed to publish important documents' },
      { status: 500 }
    );
  }
}
